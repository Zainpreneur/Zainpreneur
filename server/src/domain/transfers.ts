import type { DatabaseSync } from "node:sqlite";
import { all, num, one, now, tx } from "../db/client.js";
import { amount as optionalAmount, bind, clean, fail, id, notFuture } from "../lib/validate.js";
import { ALLOCATION_UNITS, money, roundEquity, toUnits } from "@zainpreneur/shared";

/**
 * Buying and selling equity.
 *
 * Four rules carry this module, and they are the reason it exists in this shape:
 *
 *  1. **A stake can never be destroyed.** A sale moves it to a named buyer. Without
 *     that, the business would be left part-owned and the cap table would stop
 *     reconciling to 100% — the original refused to allow it, and so does this.
 *     A buyer who is outside the book simply gets a `stakeholders` row.
 *
 *  2. **A cap table is a history, not a balance.** When the buyer already holds, their
 *     existing period is *closed* and a new one opened at the combined stake. Nothing
 *     is resized in place, which is why `ux_bs_one_current` can allow exactly one open
 *     row per holder while permitting any number of closed ones.
 *
 *  3. **The buyer's capital carries forward unchanged.** What they paid for the slice
 *     is the *seller's* proceeds, recorded once on the side that received the money.
 *     Inventing a second figure on the buyer's side would let the two disagree.
 *
 *  4. **100% is re-asserted after both sides land**, inside the same transaction — not
 *     before, and not per statement. Asserting between the close and the insert would
 *     fail on every transfer, because there is a moment when the business genuinely
 *     holds less than 100%.
 */

export type Level = "business" | "branch";

/**
 * Which table a level means, and which column names its owner.
 *
 * A whitelist, never an interpolated caller value. `db.py:569` did the same and
 * commented on it; the alternative is a SQL injection through a URL parameter.
 */
function relTable(level: Level): { table: string; ownerCol: string } {
  if (level === "branch") return { table: "branch_stakeholders", ownerCol: "branch_id" };
  if (level === "business") return { table: "business_stakeholders", ownerCol: "business_id" };
  throw new Error(`Unsupported level: ${level}`);
}

/** The business a level's owner belongs to. */
function businessOf(level: Level, ownerId: number): number {
  if (level === "business") return ownerId;
  const row = one<{ business_id: number }>("SELECT business_id FROM branches WHERE id=?", [ownerId]);
  if (!row) fail("branch_id", "That branch is not in the register");
  return Number(row.business_id);
}

/** Every holding row at a level, closed rows included. */
function rowsAt(level: Level, ownerId: number) {
  const { table, ownerCol } = relTable(level);
  return all<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE ${ownerCol}=? ORDER BY invested_on, id`,
    [ownerId],
  );
}

function openRow(level: Level, ownerId: number, stakeholderId: number) {
  const { table, ownerCol } = relTable(level);
  return one<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE ${ownerCol}=? AND stakeholder_id=? AND exited_on IS NULL`,
    [ownerId, stakeholderId],
  );
}

/**
 * The open cap table must total exactly 100%.
 *
 * Integer hundredths, zero tolerance — the same rule as every other allocation
 * check, and the reason a transfer cannot leave a book at 99.6%.
 */
export function assertOwnerTotal(level: Level, ownerId: number): void {
  const { table, ownerCol } = relTable(level);
  const total = all<{ equity: number }>(
    `SELECT equity FROM ${table} WHERE ${ownerCol}=? AND exited_on IS NULL AND equity > 0`,
    [ownerId],
  ).reduce((sum, r) => sum + toUnits(Number(r.equity ?? 0)), 0);

  if (total !== ALLOCATION_UNITS) {
    const label = level === "branch" ? "This branch" : "This business";
    const diff = ALLOCATION_UNITS - total;
    const fix = diff > 0
      ? `Add the remaining ${diff / 100}%.`
      : `Reduce by ${Math.abs(diff) / 100}%.`;
    fail("equity", `${label} must total exactly 100% (currently ${total / 100}%). ${fix}`);
  }
}

/** A read-only version, used to refuse a part sale on an already-broken book. */
export function ownerTotalIsWhole(level: Level, ownerId: number): boolean {
  const { table, ownerCol } = relTable(level);
  const total = all<{ equity: number }>(
    `SELECT equity FROM ${table} WHERE ${ownerCol}=? AND exited_on IS NULL AND equity > 0`,
    [ownerId],
  ).reduce((sum, r) => sum + toUnits(Number(r.equity ?? 0)), 0);
  return total === ALLOCATION_UNITS;
}

/* -------------------------------------------------------------------------- */
/* Buying                                                                       */
/* -------------------------------------------------------------------------- */

export const ROUND_KINDS = ["initial", "additional", "re_entry"] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];

/**
 * What kind of round this is, derived rather than asked.
 *
 * Money that came back into a business someone had already left is a different fact
 * from money that went in the first time, so the distinction is worth deriving — but
 * a caller who knows better may still say so.
 */
export function deriveRoundKind(businessId: number, stakeholderId: number): RoundKind {
  const rounds = num(
    "SELECT COUNT(*) FROM investment_rounds WHERE business_id=? AND stakeholder_id=?",
    [businessId, stakeholderId],
  );
  if (rounds === 0) return "initial";
  const open = openRow("business", businessId, stakeholderId);
  return open ? "additional" : "re_entry";
}

/**
 * Record one round of investment, and the cap-table row it produces, together.
 *
 * Two writes that must not come apart: the round says the money went in, the holding
 * says what was bought. Written in one transaction because a book that has one
 * without the other is wrong in a way nothing downstream can detect.
 *
 * `equity` is the stake *this round bought*, not the total afterwards — a later round
 * may buy more and a part sale may sell some of it back.
 */
export async function recordInvestment(data: {
  businessId: number;
  stakeholderId: number;
  investedOn: unknown;
  amount?: unknown;
  equity?: unknown;
  kind?: string;
  note?: string;
}): Promise<{ roundId: number; holdingId: number; kind: RoundKind; businessId: number }> {
  const businessId = id(data.businessId, "Business", "business_id");
  const stakeholderId = id(data.stakeholderId, "Stakeholder", "stakeholder_id");
  const investedOn = String(data.investedOn ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(investedOn)) {
    fail("invested_on", "An investment needs a date as YYYY-MM-DD");
  }
  notFuture(investedOn, "An investment date");

  if (num("SELECT COUNT(*) FROM businesses WHERE id=? AND deleted_at IS NULL", [businessId]) === 0) {
    fail("business_id", "That business is not in the register");
  }
  if (!one("SELECT 1 FROM stakeholders WHERE id=?", [stakeholderId])) {
    fail("stakeholder_id", "That stakeholder is not in the register");
  }

  const equity = optionalAmount(data.equity, "Stake bought", "equity") ?? 0;
  if (equity <= 0) fail("equity", "An investment must buy some equity");
  if (equity > 100) fail("equity", "An investment cannot buy more than 100%");
  const amount = optionalAmount(data.amount, "Amount invested", "amount") ?? 0;

  const kind = clean(data.kind, 20)
    ? (clean(data.kind, 20).toLowerCase() as RoundKind)
    : deriveRoundKind(businessId, stakeholderId);
  if (!ROUND_KINDS.includes(kind)) {
    fail("kind", `A round kind must be one of: ${ROUND_KINDS.join(", ")}`);
  }

  const clash = one<{ invested_on: string; kind: string }>(
    "SELECT invested_on, kind FROM investment_rounds WHERE business_id=? AND stakeholder_id=? AND invested_on=? AND kind=?",
    [businessId, stakeholderId, investedOn, kind],
  );
  if (clash) {
    fail("invested_on", `There is already a ${clash.kind} round on ${clash.invested_on}`);
  }

  const ts = now();
  const note = clean(data.note, 200);

  const { roundId, holdingId } = await tx(async (db) => {
    const round = db
      .prepare(
        `INSERT INTO investment_rounds
           (business_id, stakeholder_id, invested_on, amount, equity_acquired, kind, note, created_at, rev)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(businessId, stakeholderId, investedOn, amount, equity, kind, note, ts);
    const roundId = Number(round.lastInsertRowid);

    const holdingId = creditEquity(
      db,
      "business",
      businessId,
      stakeholderId,
      roundEquity(equity),
      investedOn,
      amount,
      ts,
    );
    return { roundId, holdingId };
  });

  return { roundId, holdingId, kind, businessId };
}

/**
 * Move `equity` from one holder to another, keeping the total unchanged.
 *
 * If the buyer already holds, their period is closed and a new one opened at the
 * combined stake. Their capital basis carries forward unchanged — what they paid is
 * the seller's proceeds, recorded once, on the side that received the money.
 */
function creditEquity(
  db: DatabaseSync,
  level: Level,
  ownerId: number,
  stakeholderId: number,
  equity: number,
  on: string,
  proceeds: number | null,
  ts: string,
): number {
  const { table, ownerCol } = relTable(level);
  // The transaction handle is the connection, so this read is inside the same
  // transaction and sees the writes already made by this exit.
  const have = one<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE ${ownerCol}=? AND stakeholder_id=? AND exited_on IS NULL`,
    [ownerId, stakeholderId],
  );

  const relationship = level === "branch" ? "subsidiary" : "equity";

  if (have) {
    db.prepare(
      `UPDATE ${table} SET exited_on=?, updated_at=?, rev=rev+1
        WHERE ${ownerCol}=? AND stakeholder_id=? AND exited_on IS NULL`,
    ).run(on, ts, ownerId, stakeholderId);

    const combined = roundEquity(Number(have.equity ?? 0) + equity);
    const cur = db
      .prepare(
        `INSERT INTO ${table}
           (${ownerCol}, stakeholder_id, relationship, equity, is_equity, role,
            invested_on, exited_on, transferred_to, amount, proceeds,
            created_at, updated_at, rev)
         VALUES (?, ?, ?, ?, 1, ?, ?, NULL, NULL, ?, ?, ?, ?, 1)`,
      )
      .run(
        ownerId,
        stakeholderId,
        relationship,
        combined,
        String(have.role ?? ""),
        on,
        bind(have.amount), // the buyer's own capital, carried forward unchanged
        proceeds,
        ts,
        ts,
      );
    return Number(cur.lastInsertRowid);
  }

  const cur = db
    .prepare(
      `INSERT INTO ${table}
         (${ownerCol}, stakeholder_id, relationship, equity, is_equity, role,
          invested_on, exited_on, transferred_to, amount, proceeds,
          created_at, updated_at, rev)
       VALUES (?, ?, ?, ?, 1, '', ?, NULL, NULL, ?, ?, ?, ?, 1)`,
    )
    .run(ownerId, stakeholderId, relationship, equity, on, proceeds, proceeds, ts, ts);
  return Number(cur.lastInsertRowid);
}

/** One ledger row per transfer, written inside the caller's transaction. */
function recordTransfer(
  db: DatabaseSync,
  level: Level,
  ownerId: number,
  sellerId: number,
  buyerId: number | null,
  percentage: number,
  date: string,
  proceeds: number | null,
  ts: string,
): number {
  const businessId = level === "business" ? ownerId : businessOf(level, ownerId);
  const branchId = level === "branch" ? ownerId : null;
  const cur = db
    .prepare(
      `INSERT INTO ownership_transfers
         (level, business_id, branch_id, seller_id, buyer_id, percentage, date, proceeds, created_at, updated_at, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .run(level, businessId, branchId, sellerId, buyerId, percentage, date, proceeds, ts, ts);
  return Number(cur.lastInsertRowid);
}

/* -------------------------------------------------------------------------- */
/* Selling                                                                      */
/* -------------------------------------------------------------------------- */

/** Both halves of an exit that must land together. */
function requireSaleParties(
  level: Level,
  ownerId: number,
  sellerId: number,
  buyerId: number,
  label: string,
) {
  void level;
  void ownerId;
  if (buyerId <= 0) {
    fail(
      "to_stakeholder_id",
      `A sale moves the stake to someone — name who bought it, so the ${label} is never left part-owned.`,
    );
  }
  if (buyerId === sellerId) fail("to_stakeholder_id", "They cannot buy their own position");
  if (!one("SELECT 1 FROM stakeholders WHERE id=?", [buyerId])) {
    fail("to_stakeholder_id", "That buyer is not a known stakeholder");
  }
}

/**
 * The buyer, or the reason there isn't one.
 *
 * Read separately from `id()` so that a *missing* buyer gets the sentence that
 * explains why a sale cannot proceed without one, rather than a generic
 * "required" that says nothing about the 100% rule behind it.
 */
function readBuyer(raw: unknown, label: string): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n <= 0) {
    fail(
      "to_stakeholder_id",
      `A sale moves the stake to someone — name who bought it, so the ${label} is never left part-owned.`,
    );
  }
  return Math.trunc(n);
}

export interface ExitResult {
  ok: true;
  kind: "full" | "part";
  sold: number;
  remaining: number;
  exitedOn: string;
  proceeds: number | null;
  transferredTo: number | null;
  costBasisSold: number | null;
  costBasisRemaining: number | null;
}

/**
 * Close a whole position by selling it.
 *
 * The row is kept and closed rather than deleted: deleting it would make a sale
 * indistinguishable from never having invested, and would take the entry date and the
 * amount with it.
 */
export async function closePosition(data: {
  level?: string;
  ownerId: number;
  stakeholderId: number;
  exitedOn: unknown;
  proceeds?: unknown;
  toStakeholderId?: unknown;
}): Promise<ExitResult> {
  const level = (clean(data.level, 20) || "business") as Level;
  const ownerId = id(data.ownerId, "Business", "owner_id");
  const sellerId = id(data.stakeholderId, "Stakeholder", "stakeholder_id");
  const exitedOn = String(data.exitedOn ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exitedOn)) fail("exited_on", "An exit needs a date as YYYY-MM-DD");

  const label = level === "branch" ? "branch" : "business";
  const row = openRow(level, ownerId, sellerId);
  if (!row) fail("stakeholder_id", "That position is not open");
  if (String(row.invested_on ?? "") > exitedOn) {
    fail("exited_on", `Exit date ${exitedOn} is before the entry date ${row.invested_on}`);
  }

  const stake = roundEquity(Number(row.equity ?? 0));
  const proceeds = optionalAmount(data.proceeds, "Proceeds", "proceeds");

  // A link with no equity to move closes on its own — there is nothing to hand over.
  let buyerId = 0;
  if (stake > 0) {
    buyerId = readBuyer(data.toStakeholderId, label);
    requireSaleParties(level, ownerId, sellerId, buyerId, label);
  }

  const ts = now();
  await tx(async (db) => {
    db.prepare(
      `UPDATE ${relTable(level).table} SET exited_on=?, transferred_to=?, proceeds=?,
              updated_at=?, rev=rev+1
        WHERE ${relTable(level).ownerCol}=? AND stakeholder_id=? AND exited_on IS NULL`,
    ).run(exitedOn, stake > 0 ? buyerId : null, proceeds, ts, ownerId, sellerId);

    if (stake > 0) {
      creditEquity(db, level, ownerId, buyerId, stake, exitedOn, proceeds, ts);
    }
    // One event, carrying the same date the holding has just taken.
    recordTransfer(db, level, ownerId, sellerId, stake > 0 ? buyerId : null, stake, exitedOn, proceeds, ts);
    assertOwnerTotal(level, ownerId);
  });

  return {
    ok: true,
    kind: "full",
    sold: stake,
    remaining: 0,
    exitedOn,
    proceeds,
    transferredTo: stake > 0 ? buyerId : null,
    costBasisSold: optionalAmount(row.amount, "Cost", "amount"),
    costBasisRemaining: 0,
  };
}

/**
 * Sell part of a position, keeping the rest.
 *
 * `percentage` is the share of the *holding* being sold — sell a third of a 30% stake
 * — because that is how a sale is described in plain language. The cost basis is
 * pro-rated both ways, so the proceeds can be judged against what the sold slice
 * actually cost rather than against the whole position.
 *
 * The retained stake is a *new* row carrying the original entry date, so the holding
 * period stays unbroken.
 */
export async function sellParticipation(data: {
  level?: string;
  ownerId: number;
  stakeholderId: number;
  exitedOn: unknown;
  percentage?: unknown;
  equity?: unknown;
  proceeds?: unknown;
  toStakeholderId?: unknown;
}): Promise<ExitResult> {
  const level = (clean(data.level, 20) || "business") as Level;
  const ownerId = id(data.ownerId, "Business", "owner_id");
  const sellerId = id(data.stakeholderId, "Stakeholder", "stakeholder_id");
  const exitedOn = String(data.exitedOn ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exitedOn)) fail("exited_on", "An exit needs a date as YYYY-MM-DD");
  const label = level === "branch" ? "branch" : "business";

  const row = openRow(level, ownerId, sellerId);
  if (!row) fail("stakeholder_id", "That position is not open");
  if (String(row.invested_on ?? "") > exitedOn) {
    fail("exited_on", `Exit date ${exitedOn} is before the entry date ${row.invested_on}`);
  }

  const held = roundEquity(Number(row.equity ?? 0));
  const hasPct = data.percentage !== undefined && data.percentage !== null && data.percentage !== "";
  const hasPts = data.equity !== undefined && data.equity !== null && data.equity !== "";
  if (hasPct === hasPts) {
    fail(
      "percentage",
      "Give the share to sell, as a percentage of the holding or in points — not both",
    );
  }

  let sold: number;
  if (hasPct) {
    const pct = roundEquity(Number(data.percentage));
    if (pct <= 0 || pct > 100) fail("percentage", "The share to sell must be between 0 and 100");
    sold = roundEquity((held * pct) / 100);
  } else {
    sold = roundEquity(Number(data.equity));
  }

  if (held <= 0 || sold <= 0) fail("equity", "There is no equity in this position to sell part of");
  if (sold >= held) {
    fail(
      "equity",
      `That is the whole ${held}% holding — close the position instead, so the exit is recorded as a full exit`,
    );
  }
  const remaining = roundEquity(held - sold);
  if (remaining <= 0) fail("equity", "Nothing would be left holding this position");

  const buyerId = readBuyer(data.toStakeholderId, label);
  requireSaleParties(level, ownerId, sellerId, buyerId, label);

  // The business must be whole before a part of it changes hands, otherwise the sale
  // would paper over an unallocated book.
  if (!ownerTotalIsWhole(level, ownerId)) {
    fail("equity", `This ${label} is not allocated to 100% yet, so a part sale would hide the gap`);
  }

  const proceeds = optionalAmount(data.proceeds, "Proceeds", "proceeds");
  const basis = Number(row.amount ?? 0);
  const soldBasis = basis ? money((basis * sold) / held) : null;
  const keptBasis = basis && soldBasis !== null ? money(basis - soldBasis) : basis || null;

  const ts = now();
  await tx(async (db) => {
    const { table, ownerCol } = relTable(level);

    // 1. the slice that left, closed and dated, with its own proceeds and basis
    db.prepare(
      `UPDATE ${table} SET equity=?, exited_on=?, transferred_to=?, proceeds=?, amount=COALESCE(?, amount),
              updated_at=?, rev=rev+1
        WHERE ${ownerCol}=? AND stakeholder_id=? AND exited_on IS NULL`,
    ).run(sold, exitedOn, buyerId, proceeds, soldBasis, ts, ownerId, sellerId);

    // 2. the slice that stayed, as a new open row keeping the original entry date
    db.prepare(
      `INSERT INTO ${table}
         (${ownerCol}, stakeholder_id, relationship, equity, is_equity, role,
          invested_on, exited_on, transferred_to, amount, proceeds,
          created_at, updated_at, rev)
       VALUES (?, ?, ?, ?, 1, ?, ?, NULL, NULL, ?, NULL, ?, ?, 1)`,
    ).run(
      ownerId,
      sellerId,
      String(row.relationship ?? (level === "branch" ? "subsidiary" : "equity")),
      remaining,
      String(row.role ?? ""),
      String(row.invested_on ?? ""),
      keptBasis,
      ts,
      ts,
    );

    // 3. the buyer is credited, on their own terms
    creditEquity(db, level, ownerId, buyerId, sold, exitedOn, proceeds, ts);
    // 4. and the slice that left is one ledger event
    recordTransfer(db, level, ownerId, sellerId, buyerId, sold, exitedOn, proceeds, ts);
    // both sides have landed; the book is still whole
    assertOwnerTotal(level, ownerId);
  });

  return {
    ok: true,
    kind: "part",
    sold,
    remaining,
    exitedOn,
    proceeds,
    transferredTo: buyerId,
    costBasisSold: soldBasis,
    costBasisRemaining: keptBasis,
  };
}

/**
 * Undo an exit.
 *
 * Because a sale is a transfer, undoing one means taking the stake *back*. Who gave it
 * is recorded on the closed row, so the reversal is derived rather than asked for.
 * Proceeds belong to a sale, so reopening withdraws them.
 */
export async function reopenPosition(data: {
  level?: string;
  ownerId: number;
  stakeholderId: number;
  on?: string;
}): Promise<{ ok: true; takenBackFrom: number | null }> {
  const level = (clean(data.level, 20) || "business") as Level;
  const ownerId = id(data.ownerId, "Business", "owner_id");
  const sellerId = id(data.stakeholderId, "Stakeholder", "stakeholder_id");
  const on = clean(data.on, 10) || undefined;
  const { table, ownerCol } = relTable(level);

  const closed = on
    ? one<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE ${ownerCol}=? AND stakeholder_id=? AND exited_on=?`,
        [ownerId, sellerId, on],
      )
    : one<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE ${ownerCol}=? AND stakeholder_id=? AND exited_on IS NOT NULL
          ORDER BY exited_on DESC, id DESC LIMIT 1`,
        [ownerId, sellerId],
      );
  if (!closed) fail("stakeholder_id", "That position is not closed");
  if (openRow(level, ownerId, sellerId)) {
    fail("stakeholder_id", "They already hold a current position here — close that one first");
  }

  const stake = roundEquity(Number(closed.equity ?? 0));
  const giver = closed.transferred_to ? Number(closed.transferred_to) : 0;
  if (stake > 0 && giver <= 0) {
    fail("transferred_to", "This exit was recorded before the buyer was noted — say who the stake went to, so it can be taken back");
  }

  const ts = now();
  await tx(async (db) => {
    if (stake > 0) {
      const g = one<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE ${ownerCol}=? AND stakeholder_id=? AND exited_on IS NULL`,
        [ownerId, giver],
      );
      if (!g) fail("transferred_to", "The buyer no longer holds a position here");
      if (roundEquity(Number(g.equity ?? 0)) < stake) {
        fail(
          "transferred_to",
          "The buyer no longer holds that stake, so the sale cannot simply be undone — close their position instead",
        );
      }
      const left = roundEquity(Number(g.equity ?? 0) - stake);
      db.prepare(
        `UPDATE ${table} SET equity=?, is_equity=?, updated_at=?, rev=rev+1
          WHERE ${ownerCol}=? AND stakeholder_id=? AND exited_on IS NULL`,
      ).run(left, left === 0 ? 0 : Number(g.is_equity ?? 1), ts, ownerId, giver);
    }

    // proceeds belong to a sale: reopening the position withdraws them
    db.prepare(
      `UPDATE ${table} SET exited_on=NULL, transferred_to=NULL, proceeds=NULL, updated_at=?, rev=rev+1
        WHERE ${ownerCol}=? AND stakeholder_id=? AND exited_on IS NOT NULL`,
    ).run(ts, ownerId, sellerId);

    // and the event behind it is struck from the ledger
    db.prepare(
      "DELETE FROM ownership_transfers WHERE level=? AND seller_id=? AND date=? AND percentage=?",
    ).run(level, sellerId, String(closed.exited_on), stake);
    db.prepare(
      "DELETE FROM ownership_transfers WHERE level=? AND buyer_id=? AND date=? AND percentage=?",
    ).run(level, sellerId, String(closed.exited_on), stake);

    assertOwnerTotal(level, ownerId);
  });

  return { ok: true, takenBackFrom: giver || null };
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                      */
/* -------------------------------------------------------------------------- */

export interface Transfer {
  id: number;
  level: Level;
  businessId: number;
  branchId: number | null;
  sellerId: number;
  sellerName: string;
  buyerId: number | null;
  buyerName: string | null;
  percentage: number;
  date: string;
  proceeds: number | null;
}

export function listTransfers(businessId?: number, limit = 200): Transfer[] {
  const rows = businessId
    ? all<Record<string, unknown>>(
        `SELECT t.*, s.name AS seller_name, b.name AS buyer_name
           FROM ownership_transfers t
           JOIN stakeholders s ON s.id = t.seller_id
           LEFT JOIN stakeholders b ON b.id = t.buyer_id
          WHERE t.business_id = ?
          ORDER BY t.date DESC, t.id DESC LIMIT ?`,
        [businessId, limit],
      )
    : all<Record<string, unknown>>(
        `SELECT t.*, s.name AS seller_name, b.name AS buyer_name
           FROM ownership_transfers t
           JOIN stakeholders s ON s.id = t.seller_id
           LEFT JOIN stakeholders b ON b.id = t.buyer_id
          ORDER BY t.date DESC, t.id DESC LIMIT ?`,
        [limit],
      );

  return rows.map((r) => ({
    id: Number(r.id),
    level: String(r.level) as Level,
    businessId: Number(r.business_id),
    branchId: r.branch_id === null || r.branch_id === undefined ? null : Number(r.branch_id),
    sellerId: Number(r.seller_id),
    sellerName: String(r.seller_name ?? ""),
    buyerId: r.buyer_id === null || r.buyer_id === undefined ? null : Number(r.buyer_id),
    buyerName: r.buyer_name === null || r.buyer_name === undefined ? null : String(r.buyer_name),
    percentage: Number(r.percentage ?? 0),
    date: String(r.date),
    // Blank means "not priced", which is a different fact from zero.
    proceeds: r.proceeds === null || r.proceeds === undefined ? null : Number(r.proceeds),
  }));
}

export interface Round {
  id: number;
  businessId: number;
  businessName: string;
  stakeholderId: number;
  stakeholderName: string;
  investedOn: string;
  amount: number;
  equityAcquired: number;
  kind: RoundKind;
  note: string;
}

export function listRounds(businessId?: number, limit = 200): Round[] {
  const rows = businessId
    ? all<Record<string, unknown>>(
        `SELECT r.*, b.name AS business_name, s.name AS stakeholder_name
           FROM investment_rounds r
           JOIN businesses b ON b.id = r.business_id
           JOIN stakeholders s ON s.id = r.stakeholder_id
          WHERE r.business_id = ? ORDER BY r.invested_on DESC, r.id DESC LIMIT ?`,
        [businessId, limit],
      )
    : all<Record<string, unknown>>(
        `SELECT r.*, b.name AS business_name, s.name AS stakeholder_name
           FROM investment_rounds r
           JOIN businesses b ON b.id = r.business_id
           JOIN stakeholders s ON s.id = r.stakeholder_id
          ORDER BY r.invested_on DESC, r.id DESC LIMIT ?`,
        [limit],
      );
  return rows.map((r) => ({
    id: Number(r.id),
    businessId: Number(r.business_id),
    businessName: String(r.business_name ?? ""),
    stakeholderId: Number(r.stakeholder_id),
    stakeholderName: String(r.stakeholder_name ?? ""),
    investedOn: String(r.invested_on),
    amount: money(Number(r.amount ?? 0)),
    equityAcquired: roundEquity(Number(r.equity_acquired ?? 0)),
    kind: String(r.kind) as RoundKind,
    note: String(r.note ?? ""),
  }));
}

/** Whether a closed period was a sale, or a holder simply bought more. */
export function isSale(buyerId: number | null, percentage: number): boolean {
  // A sale names who took the stake. A period closed because its holder bought
  // *more* has no buyer, and must stay out of the exit report — that was a
  // purchase, not a disposal.
  return Boolean(buyerId) || roundEquity(percentage) <= 0;
}

export { rowsAt, businessOf };