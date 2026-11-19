import { all, num, one, run, tx, now } from "../db/client.js";
import {
  amount as vAmount,
  bind,
  bool,
  clean,
  date,
  fail,
  id,
  notFuture,
  optDate,
  positive,
} from "../lib/validate.js";
import {
  DIVIDEND_CADENCES,
  DISTRIBUTION_KINDS,
  INCOME_KINDS,
  RETURN_OF_CAPITAL,
  coverage,
  expectedKeys,
  formatMoney,
  heldOn,
  holdingsOn,
  money,
  monthEnd,
  monthKey,
  prorateEntitlements,
  roundEquity,
  type DividendCadence,
  type EntitlementLine,
  type HoldingPeriod,
} from "@zainpreneur/shared";

/**
 * Dividends, declared monthly and settled per holder.
 *
 * Three things the original could not express, and which this fixes:
 *
 *  1. **Who was paid.** A business-wide declaration fans out to N holders, each of
 *     whom may be paid separately, late or partly. Settlement is therefore
 *     per-holder in `dividend_payments` — it cannot be a status on the declaration,
 *     because "paid" is a different fact for every recipient.
 *
 *  2. **One cut-off rule.** `heldOn` decides who held on a date, and every read
 *     path goes through it. The original had three, and the one the ordinary
 *     pro-rata path used disagreed with the other two.
 *
 *  3. **Declared is not received.** `dividends.basis` existed and was hardcoded to
 *     `'declared'`, never read, with no field anywhere to say a dividend had
 *     actually been paid.
 */

export interface Declaration {
  id: number;
  businessId: number;
  businessName: string;
  declaredOn: string;
  amount: number;
  periodKey: string;
  note: string;
  kind: string;
  /** A named payment goes to that holder in full; no one else's share moves. */
  stakeholderId: number | null;
  recipientName: string | null;
  entitlementMode: string;
  contractualBasis: string;
}

function toDeclaration(r: Record<string, unknown>): Declaration {
  return {
    id: Number(r.id),
    businessId: Number(r.business_id),
    businessName: String(r.business_name ?? ""),
    declaredOn: String(r.declared_on),
    amount: Number(r.amount ?? 0),
    periodKey: String(r.period_key ?? ""),
    note: String(r.note ?? ""),
    kind: String(r.kind ?? "dividend"),
    stakeholderId: r.stakeholder_id === null || r.stakeholder_id === undefined ? null : Number(r.stakeholder_id),
    recipientName: r.recipient_name === null || r.recipient_name === undefined ? null : String(r.recipient_name),
    entitlementMode: String(r.entitlement_mode ?? "record_date"),
    contractualBasis: String(r.contractual_basis ?? "explicit"),
  };
}

const DECLARATION_SELECT = `
  SELECT d.*, b.name AS business_name, s.name AS recipient_name
    FROM dividends d
    JOIN businesses b ON b.id = d.business_id
    LEFT JOIN stakeholders s ON s.id = d.stakeholder_id`;

/* -------------------------------------------------------------------------- */
/* Holdings                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every holding period for a business, optionally a branch.
 *
 * Branch cap tables are independent, so a branch's holdings are read separately —
 * a branch can total 100% through entirely different people from its parent.
 */
export function holdingPeriods(businessId: number, branchId?: number | null): HoldingPeriod[] {
  if (branchId) {
    return all<Record<string, unknown>>(
      `SELECT b.business_id, br.id AS branch_id, x.stakeholder_id, x.equity, x.invested_on, x.exited_on
         FROM branch_stakeholders x
         JOIN branches br ON br.id = x.branch_id
        WHERE br.business_id = ? AND x.branch_id = ?`,
      [businessId, branchId],
    ).map(toHolding);
  }
  return all<Record<string, unknown>>(
    `SELECT business_id, NULL AS branch_id, stakeholder_id, equity, invested_on, exited_on
       FROM business_stakeholders WHERE business_id = ?`,
    [businessId],
  ).map(toHolding);
}

function toHolding(r: Record<string, unknown>): HoldingPeriod {
  return {
    businessId: Number(r.business_id),
    branchId: r.branch_id === null || r.branch_id === undefined ? null : Number(r.branch_id),
    stakeholderId: Number(r.stakeholder_id),
    equity: roundEquity(Number(r.equity ?? 0)),
    investedOn: String(r.invested_on ?? ""),
    exitedOn: r.exited_on === null || r.exited_on === undefined ? null : String(r.exited_on),
  };
}

/** Did this holder hold this business on this date? The only such rule. */
export function holderHeldOn(businessId: number, stakeholderId: number, on: string): boolean {
  return holdingPeriods(businessId).some((h) => h.stakeholderId === stakeholderId && heldOn(h, on));
}

/* -------------------------------------------------------------------------- */
/* Entitlement                                                                  */
/* -------------------------------------------------------------------------- */

export interface Entitlement extends EntitlementLine {
  stakeholderName: string;
  /** What has actually been settled to this holder against this declaration. */
  paid: number;
  outstanding: number;
}

/**
 * Who is entitled to a declaration, and what is still owed.
 *
 * `record_date` derives the split from the cap table on the declaration date.
 * `contractual` reads the recorded amounts — and the two may not be mixed, because
 * a declaration with both would have two answers to "what is this worth".
 */
export function entitlements(dividendId: number): Entitlement[] {
  const declaration = one<Record<string, unknown>>(
    `${DECLARATION_SELECT} WHERE d.id = ?`,
    [dividendId],
  );
  if (!declaration) return [];
  const d = toDeclaration(declaration);

  if (d.stakeholderId !== null) {
    // A payment to one named holder goes to them in full.
    const paid = num("SELECT COALESCE(SUM(amount),0) FROM dividend_payments WHERE dividend_id=?", [
      dividendId,
    ]);
    return [{
      stakeholderId: d.stakeholderId,
      stakeholderName: d.recipientName ?? "",
      equity: 0,
      amount: d.amount,
      paid: money(paid),
      outstanding: money(Math.max(0, d.amount - paid)),
      basis: "recorded",
    }];
  }

  let lines: EntitlementLine[];
  if (d.entitlementMode === "contractual") {
    const recorded = all<Record<string, unknown>>(
      `SELECT e.stakeholder_id, e.amount, s.name AS stakeholder_name
         FROM dividend_entitlements e JOIN stakeholders s ON s.id = e.stakeholder_id
        WHERE e.dividend_id = ? ORDER BY s.name COLLATE NOCASE`,
      [dividendId],
    );
    lines = recorded.map((r) => ({
      stakeholderId: Number(r.stakeholder_id),
      equity: 0,
      amount: Number(r.amount ?? 0),
      basis: "recorded" as const,
    }));
  } else {
    lines = prorateEntitlements(d.amount, holdingPeriods(d.businessId), d.declaredOn);
  }

  const names = new Map<number, string>(
    all<{ id: number; name: string }>("SELECT id, name FROM stakeholders").map((s) => [s.id, s.name]),
  );
  const paidBy = new Map<number, number>(
    all<{ stakeholder_id: number; total: number }>(
      "SELECT stakeholder_id, SUM(amount) AS total FROM dividend_payments WHERE dividend_id=? GROUP BY stakeholder_id",
      [dividendId],
    ).map((r) => [Number(r.stakeholder_id), Number(r.total ?? 0)]),
  );

  return lines.map((l) => {
    const paid = money(paidBy.get(l.stakeholderId) ?? 0);
    return {
      ...l,
      stakeholderName: names.get(l.stakeholderId) ?? "",
      paid,
      outstanding: money(Math.max(0, l.amount - paid)),
    };
  });
}

/**
 * Declared minus settled, totalled per holder.
 *
 * The lines are aggregated rather than left one-per-declaration: a book with eight
 * monthly dividends would otherwise list the same person eight times, which is a
 * list, not an answer to "who is owed money".
 */
export function dividendsReceivable(businessId: number) {
  const ids = all<{ id: number }>(
    "SELECT id FROM dividends WHERE business_id = ? AND stakeholder_id IS NULL AND kind = 'dividend'",
    [businessId],
  );
  let declared = 0;
  let paid = 0;
  const byHolder = new Map<number, { name: string; outstanding: number }>();

  for (const { id } of ids) {
    for (const e of entitlements(id)) {
      declared = money(declared + e.amount);
      paid = money(paid + e.paid);
      const existing = byHolder.get(e.stakeholderId);
      if (existing) {
        existing.outstanding = money(existing.outstanding + e.outstanding);
      } else {
        byHolder.set(e.stakeholderId, { name: e.stakeholderName, outstanding: e.outstanding });
      }
    }
  }

  return {
    declared,
    paid,
    outstanding: money(declared - paid),
    perHolder: [...byHolder.values()]
      .filter((h) => h.outstanding > 0.005)
      .sort((a, b) => b.outstanding - a.outstanding),
  };
}

/* -------------------------------------------------------------------------- */
/* Declaring                                                                    */
/* -------------------------------------------------------------------------- */

export async function recordDistribution(data: {
  businessId: number;
  declaredOn: unknown;
  amount: unknown;
  kind?: string;
  stakeholderId?: unknown;
  note?: string;
  periodKey?: string;
  entitlementMode?: string;
  contractualBasis?: string;
  /** Recorded amounts, required when the mode is contractual and explicit. */
  entitlements?: Array<{ stakeholderId: number; amount: number }>;
}): Promise<Declaration> {
  const businessId = id(data.businessId, "Business", "business_id");
  const on = date(data.declaredOn, "Declaration date", "declared_on");
  notFuture(on, "A declaration date");

  if (num("SELECT COUNT(*) FROM businesses WHERE id=? AND deleted_at IS NULL", [businessId]) === 0) {
    fail("business_id", "That business is not in the register");
  }

  const value = positive(data.amount, "Distribution", "amount");
  const kind = clean(data.kind ?? "dividend", 30).toLowerCase() || "dividend";
  if (!(DISTRIBUTION_KINDS as readonly string[]).includes(kind)) {
    fail("kind", `A distribution must be one of: ${DISTRIBUTION_KINDS.join(", ")}`);
  }

  // Friendly duplicate. The original relied on the unique index and surfaced
  // SQLite's generic "that record conflicts with an existing one".
  const clash = one<{ declared_on: string }>(
    "SELECT declared_on FROM dividends WHERE business_id = ? AND declared_on = ?",
    [businessId, on],
  );
  if (clash) fail("declared_on", `This business already has a distribution dated ${on}`);

  const stakeholderId = data.stakeholderId ? id(data.stakeholderId, "Recipient", "stakeholder_id") : null;
  if (stakeholderId !== null) {
    if (!one("SELECT 1 FROM stakeholders WHERE id=?", [stakeholderId])) {
      fail("stakeholder_id", "That recipient is not a known stakeholder");
    }
    // A named payment attaches to a period the holder was actually in.
    if (!holdingPeriods(businessId).some((h) => h.stakeholderId === stakeholderId)) {
      fail("stakeholder_id", "That person has never held this business, so a payment to them cannot be attached to a holding period");
    }
  }

  const entitlementMode = clean(data.entitlementMode ?? "record_date", 20) || "record_date";
  if (!["record_date", "contractual"].includes(entitlementMode)) {
    fail("entitlement_mode", "Entitlement mode must be record_date or contractual");
  }
  const contractualBasis = clean(data.contractualBasis ?? "explicit", 20) || "explicit";
  if (!["explicit", "prorated_days"].includes(contractualBasis)) {
    fail("contractual_basis", "Contractual basis must be explicit or prorated_days");
  }

  const recorded = (data.entitlements ?? []).map((e) => ({
    stakeholderId: id(e.stakeholderId, "Recipient", "stakeholder_id"),
    amount: vAmount(e.amount, "Entitlement", "entitlements") ?? 0,
  }));

  // Invariant 2: the two representations may not be mixed.
  if (entitlementMode === "contractual" && recorded.length === 0) {
    fail("entitlements", "A contractual dividend needs recorded entitlements");
  }
  if (entitlementMode === "record_date" && recorded.length > 0) {
    fail("entitlements", "A record-date dividend derives its entitlements; it cannot also record them");
  }
  if (stakeholderId !== null && recorded.length > 0) {
    fail("entitlements", "A payment to one named holder does not carry a split");
  }
  // Invariant 5: a recorded split adds back to the declared amount.
  if (recorded.length > 0) {
    const sum = money(recorded.reduce((t, e) => t + e.amount, 0));
    if (Math.abs(sum - value) > 0.005) {
      fail("entitlements", `The recorded entitlements add to ${formatMoney(sum)}, not the ${formatMoney(value)} declared`);
    }
  }

  const ts = now();
  const note = clean(data.note, 200);
  const key = clean(data.periodKey, 7) || monthKey(on);

  const created = await tx(async (db) => {
    const cur = db
      .prepare(
        `INSERT INTO dividends
           (business_id, declared_on, amount, note, stakeholder_id, kind, basis,
            entitlement_mode, contractual_basis, period_key, created_at, rev)
         VALUES (?, ?, ?, ?, ?, ?, 'declared', ?, ?, ?, ?, 1)`,
      )
      .run(businessId, on, value, note, stakeholderId, kind, entitlementMode, contractualBasis, key, ts);
    const dividendId = Number(cur.lastInsertRowid);
    for (const e of recorded) {
      db.prepare(
        `INSERT INTO dividend_entitlements
           (dividend_id, stakeholder_id, amount, created_at, updated_at, rev)
         VALUES (?, ?, ?, ?, ?, 1)`,
      ).run(dividendId, e.stakeholderId, e.amount, ts, ts);
    }
    return dividendId;
  });

  return declarationById(created)!;
}

export function declarationById(dividendId: number): Declaration | null {
  const row = one<Record<string, unknown>>(`${DECLARATION_SELECT} WHERE d.id = ?`, [dividendId]);
  return row ? toDeclaration(row) : null;
}

export function listDeclarations(businessId?: number, limit = 100): Declaration[] {
  if (businessId) {
    return all<Record<string, unknown>>(
      `${DECLARATION_SELECT} WHERE d.business_id = ? ORDER BY d.declared_on DESC, d.id DESC LIMIT ?`,
      [businessId, limit],
    ).map(toDeclaration);
  }
  return all<Record<string, unknown>>(
    `${DECLARATION_SELECT} ORDER BY d.declared_on DESC, d.id DESC LIMIT ?`,
    [limit],
  ).map(toDeclaration);
}

/* -------------------------------------------------------------------------- */
/* Settlement                                                                   */
/* -------------------------------------------------------------------------- */

export async function settleDividend(data: {
  dividendId: number;
  stakeholderId: number;
  amount: unknown;
  paidOn: unknown;
  method?: string;
  reference?: string;
  note?: string;
}): Promise<{ outstanding: number }> {
  const dividendId = id(data.dividendId, "Distribution", "dividend_id");
  const stakeholderId = id(data.stakeholderId, "Recipient", "stakeholder_id");
  const paidOn = date(data.paidOn, "Paid date", "paid_on");
  notFuture(paidOn, "A payment date");
  const value = positive(data.amount, "Payment", "amount");
  const method = clean(data.method ?? "cash", 20) || "cash";
  if (!["cash", "transfer", "offset", "writeoff"].includes(method)) {
    fail("method", "A payment method must be cash, transfer, offset or writeoff");
  }

  const declaration = declarationById(dividendId);
  if (!declaration) fail("dividend_id", "That distribution is not in the book");

  const lines = entitlements(dividendId);
  const line = lines.find((l) => l.stakeholderId === stakeholderId);
  if (!line) {
    fail("stakeholder_id", "That holder is not a recipient of this distribution");
  }
  if (value > line.outstanding + 0.005) {
    fail(
      "amount",
      `That is more than is owed — ${formatMoney(line.outstanding)} is outstanding on this distribution`,
    );
  }

  const ts = now();
  await tx(async (db) => {
    db.prepare(
      `INSERT INTO dividend_payments
         (dividend_id, stakeholder_id, amount, paid_on, method, reference, note, created_at, updated_at, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    ).run(dividendId, stakeholderId, value, paidOn, method, clean(data.reference, 120), clean(data.note, 200), ts, ts);

    // Keep the declaration's own summary in step. Only written when a business-wide
    // declaration has been fully settled, because "paid" is not one fact otherwise.
    const settled = db
      .prepare(
        "SELECT COALESCE(SUM(amount),0) AS total FROM dividend_payments WHERE dividend_id=?",
      )
      .get(dividendId) as { total: number };
    if (Number(settled.total) >= declaration.amount - 0.005) {
      db.prepare("UPDATE dividends SET basis='paid', paid_on=?, paid_amount=? WHERE id=?").run(
        paidOn,
        money(declaration.amount),
        dividendId,
      );
    }
  });

  return { outstanding: money(line.outstanding - value) };
}

/* -------------------------------------------------------------------------- */
/* Cadence, coverage, alerts                                                    */
/* -------------------------------------------------------------------------- */

export interface Schedule {
  businessId: number;
  businessName: string;
  frequency: DividendCadence;
  dueDay: number;
  startsOn: string;
  endsOn: string | null;
  note: string;
}

export function getSchedule(businessId: number): Schedule | null {
  const row = one<Record<string, unknown>>(
    `SELECT s.*, b.name AS business_name
       FROM dividend_schedules s JOIN businesses b ON b.id = s.business_id
      WHERE s.business_id = ?`,
    [businessId],
  );
  if (!row) return null;
  return {
    businessId: Number(row.business_id),
    businessName: String(row.business_name ?? ""),
    frequency: String(row.frequency ?? "none") as DividendCadence,
    dueDay: Number(row.due_day ?? 31),
    startsOn: String(row.starts_on ?? ""),
    endsOn: row.ends_on === null || row.ends_on === undefined ? null : String(row.ends_on),
    note: String(row.note ?? ""),
  };
}

export function listSchedules(): Schedule[] {
  return all<Record<string, unknown>>(
    `SELECT s.*, b.name AS business_name
       FROM dividend_schedules s JOIN businesses b ON b.id = s.business_id
      ORDER BY b.name COLLATE NOCASE`,
  ).map((row) => ({
    businessId: Number(row.business_id),
    businessName: String(row.business_name ?? ""),
    frequency: String(row.frequency ?? "none") as DividendCadence,
    dueDay: Number(row.due_day ?? 31),
    startsOn: String(row.starts_on ?? ""),
    endsOn: row.ends_on === null || row.ends_on === undefined ? null : String(row.ends_on),
    note: String(row.note ?? ""),
  }));
}

export async function setSchedule(data: {
  businessId: number;
  frequency: unknown;
  dueDay?: unknown;
  startsOn?: unknown;
  endsOn?: unknown;
  note?: string;
}): Promise<Schedule> {
  const businessId = id(data.businessId, "Business", "business_id");
  const frequency = clean(data.frequency ?? "monthly", 20).toLowerCase();
  if (!(DIVIDEND_CADENCES as readonly string[]).includes(frequency)) {
    fail("frequency", `A dividend cadence must be one of: ${DIVIDEND_CADENCES.join(", ")}`);
  }
  if (num("SELECT COUNT(*) FROM businesses WHERE id=? AND deleted_at IS NULL", [businessId]) === 0) {
    fail("business_id", "That business is not in the register");
  }
  const dueDay = Number(data.dueDay ?? 31);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    fail("due_day", "The day of the month must be between 1 and 31");
  }
  const startsOn = optDate(data.startsOn, "Start date", "starts_on");
  const endsOn = optDate(data.endsOn, "End date", "ends_on");
  if (startsOn && endsOn && endsOn < startsOn) fail("ends_on", "The schedule ends before it starts");

  const ts = now();
  await tx(async (db) => {
    db.prepare(
      `INSERT INTO dividend_schedules
         (business_id, frequency, due_day, starts_on, ends_on, note, created_at, updated_at, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(business_id) DO UPDATE SET
         frequency=excluded.frequency, due_day=excluded.due_day,
         starts_on=excluded.starts_on, ends_on=excluded.ends_on,
         note=excluded.note, updated_at=excluded.updated_at, rev=rev+1`,
    ).run(businessId, frequency, dueDay, startsOn, endsOn || null, clean(data.note, 200), ts, ts);
  });

  return getSchedule(businessId)!;
}

export interface CoverageReport {
  businessId: number;
  businessName: string;
  frequency: DividendCadence;
  expected: number;
  paid: number;
  missing: string[];
  lastDeclared: string | null;
  receivable: { declared: number; paid: number; outstanding: number };
}

/**
 * How much of the expected cadence has actually been declared.
 *
 * Derived from the schedule and the declarations that exist. There is no table of
 * expectations, for the same reason `alerts.py` carries no table: an alert written
 * down is a second opinion that can disagree with the record.
 */
export function coverageFor(businessId: number, through = monthEnd(new Date().toISOString().slice(0, 10))): CoverageReport | null {
  const schedule = getSchedule(businessId);
  if (!schedule) return null;

  const declaredKeys = new Set(
    all<{ period_key: string }>(
      "SELECT period_key FROM dividends WHERE business_id=? AND stakeholder_id IS NULL AND kind='dividend'",
      [businessId],
    ).map((r) => String(r.period_key ?? "")),
  );
  const expected = expectedKeys(schedule.frequency, through, schedule.startsOn, schedule.endsOn ?? "");
  const report = coverage(expected, declaredKeys);
  const last = one<{ declared_on: string }>(
    "SELECT declared_on FROM dividends WHERE business_id=? AND kind='dividend' ORDER BY declared_on DESC LIMIT 1",
    [businessId],
  );

  return {
    businessId,
    businessName: schedule.businessName,
    frequency: schedule.frequency,
    expected: report.expected,
    paid: report.paid,
    missing: report.missing,
    lastDeclared: last?.declared_on ?? null,
    receivable: dividendsReceivable(businessId),
  };
}

/**
 * Businesses that are behind their own cadence.
 *
 * A question the book can answer now, so it cannot go stale — the `alerts.py`
 * principle applied to a schedule rather than a deadline.
 */
export function missingDividends(lookbackMonths = 12) {
  const out: CoverageReport[] = [];
  for (const schedule of listSchedules()) {
    if (schedule.frequency === "none") continue;
    const report = coverageFor(schedule.businessId);
    if (!report) continue;
    const lookback = expectedKeys(schedule.frequency, monthEnd(new Date().toISOString().slice(0, 10)));
    const recent = new Set(lookback.slice(-lookbackMonths));
    const recentMissing = report.missing.filter((k) => recent.has(k));
    if (recentMissing.length > 0) {
      out.push({ ...report, missing: recentMissing, expected: recent.size });
    }
  }
  return out;
}

/** Months a schedule expects but nothing has been declared against. */
export function whatsDue(businessId: number) {
  const report = coverageFor(businessId);
  if (!report) return [];
  const schedule = getSchedule(businessId)!;
  return report.missing.map((key) => ({
    periodKey: key,
    dueDay: schedule.dueDay,
    periodEnd: monthEnd(`${key}-01`),
  }));
}

/** Income only — a return of capital is not revenue and must never count as it. */
export function incomeByKind(businessId: number): Record<string, number> {
  const rows = all<{ kind: string; total: number }>(
    "SELECT kind, COALESCE(SUM(amount),0) AS total FROM dividends WHERE business_id=? GROUP BY kind",
    [businessId],
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.kind)] = money(Number(r.total ?? 0));
  return out;
}

export { INCOME_KINDS, RETURN_OF_CAPITAL, holdingsOn, run, bind, bool };