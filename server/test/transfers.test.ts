import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Buying and selling equity.
 *
 * The properties under test are the ones that make a cap table a *history* rather
 * than a balance: a stake can never be destroyed, one holder has one open row, and
 * the book is whole again the moment a transfer has landed.
 */
const DB = resolve(process.cwd(), "db/test-transfers.db");
process.env.ZP_DB = DB;

let client: typeof import("../src/db/client.js");
let t: typeof import("../src/domain/transfers.js");

let principal: number;
let fund: number;
let angel: number;
let outsider: number;
let biz: number;

const equityOf = (businessId: number, sid: number): number =>
  client.num(
    "SELECT COALESCE(equity,0) FROM business_stakeholders WHERE business_id=? AND stakeholder_id=? AND exited_on IS NULL",
    [businessId, sid],
  );
const openRows = (businessId: number, sid: number): number =>
  client.num(
    "SELECT COUNT(*) FROM business_stakeholders WHERE business_id=? AND stakeholder_id=? AND exited_on IS NULL",
    [businessId, sid],
  );
const totalOf = (businessId: number): number =>
  client.num(
    "SELECT COALESCE(SUM(equity),0) FROM business_stakeholders WHERE business_id=? AND exited_on IS NULL",
    [businessId],
  );

/**
 * A fresh 60/40 book, built through the real write path rather than raw SQL.
 *
 * The earlier fixture was built with INSERTs, which is how it ended up at 80% and had
 * to be debugged against the domain rules instead of the rules themselves.
 */
async function freshBook(): Promise<void> {
  client.run("DELETE FROM ownership_transfers");
  client.run("DELETE FROM investment_rounds");
  client.run("DELETE FROM business_stakeholders");
  client.run("DELETE FROM businesses");
  const ts = client.now();
  const b = client.run(
    `INSERT INTO businesses (name, status, relationship_type, served, created_at, updated_at, rev)
     VALUES ('Exit Test Co', 'active', 'equity', 0, ?, ?, 1)`,
    [ts, ts],
  );
  biz = Number(b.lastInsertRowid);
  await t.recordInvestment({ businessId: biz, stakeholderId: principal, investedOn: "2024-01-01", amount: 3_000_000, equity: 60 });
  await t.recordInvestment({ businessId: biz, stakeholderId: fund, investedOn: "2024-01-01", amount: 2_000_000, equity: 40 });
}

before(async () => {
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
  client = await import("../src/db/client.js");
  t = await import("../src/domain/transfers.js");
  (await import("../src/db/migrations.js")).migrate();

  const ts = client.now();
  const mk = (name: string, kind: string) =>
    Number(
      client
        .run(
          `INSERT INTO stakeholders (name, kind, created_at, updated_at, rev) VALUES (?, ?, ?, ?, 1)`,
          [name, kind, ts, ts],
        ).lastInsertRowid,
    );
  principal = mk("Zainpreneur Nominees Ltd", "company");
  fund = mk("Kenya Growth Partners", "fund");
  angel = mk("Achieng Odhiambo", "individual");
  outsider = mk("Trade Buyer (Pty) Ltd", "company");
  client.run("INSERT INTO settings (key, value) VALUES ('principal_stakeholder_id', ?)", [
    String(principal),
  ]);
});

after(() => {
  client.closeDb();
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
});

/* -------------------------------------------------------------------------- */

test("the open book must total exactly 100%", async () => {
  await freshBook();
  assert.equal(totalOf(biz), 100);
  assert.doesNotThrow(() => t.assertOwnerTotal("business", biz));
});

test("a part sale keeps the book whole and pro-rates the cost basis", async () => {
  await freshBook();
  // Sell a third of Zainpreneur's 60% — that is 20 points.
  const r = await t.sellParticipation({
    ownerId: biz,
    stakeholderId: principal,
    exitedOn: "2026-06-30",
    percentage: 33.333,
    proceeds: 1_500_000,
    toStakeholderId: outsider,
  });

  assert.equal(r.kind, "part");
  assert.ok(Math.abs(r.sold - 20) < 0.05, `sold ${r.sold}, expected about 20`);
  assert.ok(Math.abs(r.remaining - 40) < 0.05, `remaining ${r.remaining}`);
  assert.equal(totalOf(biz), 100, "the book is still whole after a part sale");
  assert.equal(equityOf(biz, outsider), r.sold, "the buyer holds exactly what left");
  // 3,000,000 basis pro-rated: a third of it goes with the slice.
  assert.ok(Math.abs((r.costBasisSold ?? 0) - 1_000_000) < 1, `basis sold ${r.costBasisSold}`);
  assert.ok(Math.abs((r.costBasisRemaining ?? 0) - 2_000_000) < 1);
});

test("a retained stake keeps the original entry date, so the period stays unbroken", async () => {
  await freshBook();
  await t.sellParticipation({
    ownerId: biz,
    stakeholderId: principal,
    exitedOn: "2026-06-30",
    percentage: 50,
    toStakeholderId: outsider,
  });
  const rows = client.all<{ invested_on: string; equity: number; exited_on: string | null }>(
    "SELECT invested_on, equity, exited_on FROM business_stakeholders WHERE business_id=? AND stakeholder_id=? ORDER BY rowid",
    [biz, principal],
  );
  assert.equal(rows.length, 2, "the position is now two rows: a closed slice and a retained one");
  assert.equal(rows[0]!.exited_on, "2026-06-30", "the sold slice is closed on the exit date");
  assert.equal(rows[1]!.exited_on, null, "the retained slice is open");
  assert.equal(rows[1]!.invested_on, "2024-01-01", "the retained slice keeps the original entry date");
});

test("a buyer who already holds has their period closed and reopened", async () => {
  await freshBook();
  await t.sellParticipation({
    ownerId: biz,
    stakeholderId: principal,
    exitedOn: "2026-06-30",
    percentage: 10,
    toStakeholderId: fund,
  });

  const rows = client.all<{ equity: number; exited_on: string | null }>(
    "SELECT equity, exited_on FROM business_stakeholders WHERE business_id=? AND stakeholder_id=? ORDER BY rowid",
    [biz, fund],
  );
  // Their original row *becomes* the closed period, and a new one opens at the
  // combined stake — two rows, not three. Resizing in place would be a balance, and
  // a cap table is a history.
  assert.equal(rows.length, 2, "the previous period closed, a combined one opened");
  assert.equal(rows[0]!.exited_on, "2026-06-30", "the previous period is closed, not resized");
  assert.equal(rows[1]!.exited_on, null, "a new period is open");
  assert.equal(rows[0]!.equity, 40, "the closed period records what they held until");
  assert.ok(Math.abs(rows[1]!.equity - 46) < 0.05, `combined stake ${rows[1]!.equity}, expected about 46`);
  assert.equal(openRows(biz, fund), 1, "still exactly one open row per holder");
});

test("a sale must name a buyer — a stake is never destroyed", async () => {
  await freshBook();
  await assert.rejects(
    () =>
      t.closePosition({ ownerId: biz, stakeholderId: principal, exitedOn: "2026-06-30" }),
    /name who bought it/,
  );
  await assert.rejects(
    () =>
      t.closePosition({
        ownerId: biz,
        stakeholderId: principal,
        exitedOn: "2026-06-30",
        toStakeholderId: principal,
      }),
    /cannot buy their own position/,
  );
  await assert.rejects(
    () =>
      t.closePosition({
        ownerId: biz,
        stakeholderId: principal,
        exitedOn: "2026-06-30",
        toStakeholderId: 9999,
      }),
    /not a known stakeholder/,
  );
});

test("a full sale closes the position, moves the stake, and writes one ledger row", async () => {
  await freshBook();
  const r = await t.closePosition({
    ownerId: biz,
    stakeholderId: fund,
    exitedOn: "2026-07-31",
    proceeds: 2_500_000,
    toStakeholderId: outsider,
  });

  assert.equal(r.kind, "full");
  assert.equal(equityOf(biz, fund), 0, "the seller no longer holds");
  assert.equal(equityOf(biz, outsider), 40, "the buyer holds what was sold");
  assert.equal(totalOf(biz), 100, "the book is whole again");

  const ledger = t.listTransfers(biz);
  assert.equal(ledger.length, 1, "one transfer, recorded once");
  assert.equal(ledger[0]!.sellerName, "Kenya Growth Partners");
  assert.equal(ledger[0]!.buyerName, "Trade Buyer (Pty) Ltd");
  assert.equal(ledger[0]!.percentage, 40);
  assert.equal(ledger[0]!.proceeds, 2_500_000);
});

test("selling 100% of a holding is refused — close the position instead", async () => {
  await freshBook();
  await assert.rejects(
    () =>
      t.sellParticipation({
        ownerId: biz,
        stakeholderId: principal,
        exitedOn: "2026-06-30",
        percentage: 100,
        toStakeholderId: outsider,
      }),
    /close the position instead/,
  );
});

test("an exit cannot predate the entry", async () => {
  await freshBook();
  await assert.rejects(
    () =>
      t.closePosition({
        ownerId: biz,
        stakeholderId: principal,
        exitedOn: "2023-01-01",
        toStakeholderId: outsider,
      }),
    /before the entry date/,
  );
});

test("a part sale is refused on a book that is not already whole", async () => {
  await freshBook();
  // Shrink the book below 100% behind the domain layer's back.
  client.run(
    "UPDATE business_stakeholders SET equity = 30 WHERE business_id = ? AND stakeholder_id = ? AND exited_on IS NULL",
    [biz, principal],
  );
  assert.equal(totalOf(biz), 70);
  await assert.rejects(
    () =>
      t.sellParticipation({
        ownerId: biz,
        stakeholderId: fund,
        exitedOn: "2026-06-30",
        percentage: 25,
        toStakeholderId: outsider,
      }),
    /not allocated to 100%/,
  );
});

/* -------------------------------------------------------------------------- */

test("an investment writes the round and the holding together", async () => {
  await freshBook();
  const before = client.num("SELECT COUNT(*) FROM investment_rounds");
  const r = await t.recordInvestment({
    businessId: biz,
    stakeholderId: outsider,
    investedOn: "2026-08-01",
    amount: 500_000,
    equity: 5,
  });

  assert.equal(r.kind, "initial", "a first round for a new holder");
  assert.equal(
    client.num("SELECT COUNT(*) FROM investment_rounds"),
    before + 1,
    "the round was written",
  );
  assert.equal(equityOf(biz, outsider), 5, "and the holding it produced");
  const round = t.listRounds(biz).find((x) => x.stakeholderId === outsider)!;
  assert.equal(round.equityAcquired, 5, "the round records the stake this round bought");
  assert.equal(round.amount, 500_000);
});

test("an investment of zero equity is refused", async () => {
  await freshBook();
  await assert.rejects(
    () => t.recordInvestment({ businessId: biz, stakeholderId: outsider, investedOn: "2026-08-01" }),
    /must buy some equity/,
  );
});

test("an investment must buy some equity", async () => {
  await freshBook();
  await assert.rejects(
    () => t.recordInvestment({ businessId: biz, stakeholderId: outsider, investedOn: "2026-08-01" }),
    /must buy some equity/,
  );
});

test("a round kind is derived from what came before", async () => {
  await freshBook();
  assert.equal(t.deriveRoundKind(biz, outsider), "initial", "never held, never invested");
  assert.equal(t.deriveRoundKind(biz, principal), "additional", "already holds a stake");

  // Close them out, so the next round is a re-entry.
  await t.closePosition({
    ownerId: biz,
    stakeholderId: principal,
    exitedOn: "2026-09-30",
    proceeds: 1,
    toStakeholderId: outsider,
  });
  assert.equal(t.deriveRoundKind(biz, principal), "re_entry", "money going back into a business they left");
});

test("an additional round merges into the holder's open position", async () => {
  await freshBook();
  await t.recordInvestment({
    businessId: biz,
    stakeholderId: principal,
    investedOn: "2026-08-01",
    amount: 250_000,
    equity: 5,
  });
  assert.equal(equityOf(biz, principal), 65, "60 plus 5");
  assert.equal(openRows(biz, principal), 1, "still one open row");
  assert.equal(totalOf(biz), 105, "the book is over-allocated, which the caller must resolve");
});

/* -------------------------------------------------------------------------- */

test("reopening takes the stake back and withdraws the proceeds", async () => {
  await freshBook();
  await t.closePosition({
    ownerId: biz,
    stakeholderId: fund,
    exitedOn: "2026-07-31",
    proceeds: 2_500_000,
    toStakeholderId: outsider,
  });
  const r = await t.reopenPosition({ ownerId: biz, stakeholderId: fund, on: "2026-07-31" });

  assert.equal(r.takenBackFrom, outsider, "the reversal is derived from who the stake went to");
  assert.ok(Math.abs(equityOf(biz, fund) - 40) < 0.01, "the stake came back");
  assert.equal(equityOf(biz, outsider), 0, "the buyer no longer holds it");
  assert.equal(totalOf(biz), 100);
  assert.equal(
    client.num("SELECT COALESCE(proceeds,0) FROM business_stakeholders WHERE business_id=? AND stakeholder_id=?", [biz, fund]),
    0,
    "proceeds belong to a sale, so reopening withdraws them",
  );
  assert.equal(t.listTransfers(biz).length, 0, "the ledger event is struck too");
});

test("a sale is a sale; a holder who bought more is not an exit", () => {
  assert.equal(t.isSale(outsider, 10), true, "naming a buyer makes it a sale");
  assert.equal(t.isSale(null, 10), false, "no buyer and some equity left: that was a purchase");
  assert.equal(t.isSale(null, 0), true, "no equity to move: the relationship closed");
});

test("the ledger records a blank price as unpriced, not as zero", async () => {
  await freshBook();
  // A trade sale with no agreed figure yet.
  client.run(
    `INSERT INTO ownership_transfers
       (level, business_id, seller_id, buyer_id, percentage, date, proceeds, created_at, updated_at, rev)
     VALUES ('business', ?, ?, ?, 5, '2026-10-01', NULL, ?, ?, 1)`,
    [biz, principal, outsider, client.now(), client.now()],
  );
  const row = t.listTransfers(biz)[0]!;
  assert.equal(row.proceeds, null, "blank means not priced, which is a different fact from zero");
});

test("a level is a whitelist, never a caller-supplied identifier", () => {
  assert.throws(() => t.assertOwnerTotal("business; DROP TABLE businesses" as never, 1), /Unsupported level/);
});