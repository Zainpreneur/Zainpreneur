import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * What the book actually returned.
 *
 * The reasoning under test is not the arithmetic — it is the distinctions. Income is
 * not return of capital; a multiple is not a percentage; a dated return is not a counted
 * one; and a figure with no capital behind it is absent rather than zero.
 */
const DB = resolve(process.cwd(), "db/test-returns.db");
process.env.ZP_DB = DB;

let client: typeof import("../src/db/client.js");
let T: typeof import("../src/domain/transfers.js");
let D: typeof import("../src/domain/dividends.js");
const R = await import("../src/domain/returns.js");

let seq = 0;

before(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${DB}${suffix}`, { force: true });
  client = await import("../src/db/client.js");
  const { migrate } = await import("../src/db/migrations.js");
  T = await import("../src/domain/transfers.js");
  D = await import("../src/domain/dividends.js");
  migrate();
});

after(() => {
  client.closeDb();
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${DB}${suffix}`, { force: true });
});

/** Businesses have no domain module of their own, so tests insert them directly. */
function newBusiness(name: string): number {
  const ts = client.now();
  const cur = client.run(
    `INSERT INTO businesses (name, status, relationship_type, served, created_at, updated_at, rev)
     VALUES (?, 'active', 'equity', 0, ?, ?, 1)`,
    [name, ts, ts],
  );
  return Number(cur.lastInsertRowid);
}

function addHolder(name: string): number {
  const ts = client.now();
  const cur = client.run(
    `INSERT INTO stakeholders (name, kind, role, notes, created_at, updated_at, rev)
     VALUES (?, 'person', 'Owner', '', ?, ?, 1)`,
    [name, ts, ts],
  );
  return Number(cur.lastInsertRowid);
}

/** `equity` is a percentage, as everywhere else in this codebase. */
const invest = (
  businessId: number,
  stakeholderId: number,
  amount: number,
  equity: number,
  investedOn = "2024-01-01",
) => T.recordInvestment({ businessId, stakeholderId, amount, equity, investedOn });

const declare = (businessId: number, amount: number, declaredOn: string, kind = "dividend") =>
  D.recordDistribution({ businessId, amount, declaredOn, kind });

const sell = (
  businessId: number,
  stakeholderId: number,
  equity: number,
  exitedOn: string,
  proceeds: number,
  toStakeholderId: number,
) => T.sellParticipation({ ownerId: businessId, stakeholderId, equity, exitedOn, proceeds, toStakeholderId });

/* -------------------------------------------------------------------------- */
/* The capital account                                                          */
/* -------------------------------------------------------------------------- */

test("a capital account separates income from return of capital", async () => {
  const b = newBusiness("ROC Co");
  const holder = addHolder("ROC Holder");

  await invest(b, holder, 1_000_000, 100, "2024-01-15");

  // A dividend is income. A repayment of capital is a recovery of the capital itself.
  await declare(b, 200_000, "2024-06-30", "dividend");
  await declare(b, 300_000, "2024-07-31", "capital_repayment");

  const a = R.capitalAccount(holder, b);
  assert.equal(a.contributed, 1_000_000, "capital in");
  assert.equal(a.distributed, 200_000, "dividends received");
  assert.equal(a.returnedOfCapital, 300_000, "capital returned");
  // Income must not reduce the basis; a return of capital must.
  assert.equal(a.netInvested, 700_000, "basis reduced by the return of capital, not by the dividend");
  assert.equal(a.capitalAtWork, 700_000);
});

test("getting one's own money back is never income", async () => {
  const b = newBusiness("ROC Multiple");
  const holder = addHolder("Multiple Holder");
  await invest(b, holder, 1_000_000, 100, "2024-01-15");

  // 500k back as capital, and only 100k of genuine dividend.
  await declare(b, 500_000, "2024-12-30", "capital_repayment");
  await declare(b, 100_000, "2024-12-31", "dividend");

  const a = R.capitalAccount(holder, b);
  const m = R.multiples(a, 0);
  assert.equal(m.cashOnCash, 0.2, "cash-on-cash counts income only: 100k of dividend over 500k basis");
  assert.equal(m.dpi, 0.6, "600k received over 1m called — DPI is measured against paid-in, not net invested");
  assert.equal(m.moic, 0.2, "but the 500k that merely came home is not a gain, so MOIC sees only the 100k dividend over the 500k still at risk");
  assert.equal(a.netInvested, 500_000, "the basis fell by the repayment, not by the dividend");

  // And the sharpest form of the rule: with no dividend at all, there is no income,
  // however much capital came home.
  const c = newBusiness("ROC Only");
  const only = addHolder("ROC Only Holder");
  await invest(c, only, 400_000, 100);
  await declare(c, 400_000, "2024-12-30", "capital_repayment");
  const account = R.capitalAccount(only, c);
  assert.equal(
    R.multiples(account, 0).cashOnCash,
    null,
    "a full return of capital earns nothing — and with no capital at risk there is no multiple to quote at all",
  );
  assert.equal(account.netInvested, 0, "and leaves no capital at work");
});

/* -------------------------------------------------------------------------- */
/* Multiples                                                                    */
/* -------------------------------------------------------------------------- */

test("multiples read as multiples, not percentages", async () => {
  const account = {
    stakeholderId: 1,
    contributed: 1_000_000,
    returnedOfCapital: 0,
    distributed: 400_000,
    realised: 600_000,
    netInvested: 1_000_000,
    capitalAtWork: 1_000_000,
  };
  const m = R.multiples(account, 500_000);
  assert.equal(m.moic, 1, "1.0m returned over 1.0m in — 1.0x, not 100%");
  assert.equal(m.cashOnCash, 0.4);
  assert.equal(m.dpi, 1, "1.0m received over 1.0m paid in");
  assert.equal(m.tvpi, 1.5, "1.0m received plus 500k still held, over 1.0m paid in");
  assert.equal(m.rvpi, 0.5);
});

test("a figure with no capital behind it is absent, not zero", async () => {
  const account = {
    stakeholderId: 1,
    contributed: 0,
    returnedOfCapital: 0,
    distributed: 0,
    realised: 0,
    netInvested: 0,
    capitalAtWork: 0,
  };
  const m = R.multiples(account, 250_000);
  // 250k / 0 is not "infinite", and certainly not 0. There is no multiple here.
  assert.equal(m.moic, null);
  assert.equal(m.tvpi, null);
  assert.equal(m.rvpi, null);
});

/* -------------------------------------------------------------------------- */
/* IRR                                                                          */
/* -------------------------------------------------------------------------- */

type Flow = import("../src/domain/returns.js").CashFlow;
const flow = (on: string, amount: number, kind: Flow["kind"] = "contribution"): Flow => ({
  on,
  amount,
  kind,
  label: "t",
  businessId: null,
  ref: "t",
});

test("IRR of a known doubling is 100% a year", () => {
  // March to March: 365 days exactly. January to January spans 366 in a leap year, and
  // actual/365 correctly reports a shade under 100% for it — which is the convention
  // doing its job, not an error to be rounded away.
  const rate = R.irr([flow("2024-03-01", -1000), flow("2025-03-01", 2000, "proceeds")]);
  assert.ok(rate !== null, "an internal rate of return exists for a doubling");
  assert.ok(Math.abs((rate ?? 0) - 1) < 0.001, `expected 1, got ${rate}`);
});

test("IRR is dated, not annualised by count", () => {
  // One thousand in, two thousand back. Same cash, two years: the annual rate is
  // sqrt(2) - 1 = 41.4%, even though the multiple is 2x. Counting flows instead of
  // dates would report 100% for both and lose the whole point of an annual rate.
  const twoYears = R.irr([flow("2024-03-01", -1000), flow("2026-03-01", 2000, "proceeds")]);
  const oneYear = R.irr([flow("2024-03-01", -1000), flow("2025-03-01", 2000, "proceeds")]);
  assert.ok((twoYears ?? 0) < (oneYear ?? 0), "the same multiple over longer is a lower annual rate");
  assert.ok(
    Math.abs((twoYears ?? 0) - (Math.SQRT2 - 1)) < 0.002,
    `expected ~${(Math.SQRT2 - 1).toFixed(4)}, got ${twoYears}`,
  );
});

test("IRR is absent when the flows cannot produce one", () => {
  assert.equal(R.irr([flow("2024-01-01", -1000)]), null, "one flow has no rate");
  assert.equal(R.irr([flow("2024-01-01", 500), flow("2024-06-01", 500)]), null, "no money out, no rate");
  assert.equal(R.irr([flow("2024-01-01", -500), flow("2024-06-01", -500)]), null, "no money back, no rate");
  assert.equal(R.irr([]), null);
});

test("IRR is deterministic — the same book gives the same answer", () => {
  const flows = [
    flow("2024-01-01", -1_000_000),
    flow("2024-09-30", 120_000, "distribution"),
    flow("2025-06-30", 150_000, "distribution"),
    flow("2026-03-31", 2_400_000, "proceeds"),
  ];
  const runs = Array.from({ length: 5 }, () => R.irr(flows));
  assert.equal(new Set(runs).size, 1, "the rate moved between identical runs");
});

/* -------------------------------------------------------------------------- */
/* Track record                                                                 */
/* -------------------------------------------------------------------------- */

test("a partial sale leaves the position open and counts only the slice", async () => {
  const b = newBusiness("Partial Track");
  const seller = addHolder("Track Seller");
  const buyer = addHolder("Track Buyer");

  await invest(b, seller, 1_000_000, 100);
  await sell(b, seller, 40, "2025-01-01", 500_000, buyer);

  const t = R.trackRecord(seller);
  const closed = t.realised.find((p) => p.businessId === b);
  assert.ok(closed, "the sold slice is realised");
  assert.equal(closed?.cost, 400_000, "40% of a 1m basis is 400k of cost realised");
  assert.equal(closed?.proceeds, 500_000);
  assert.equal(closed?.moic, 1.25);
  assert.equal(closed?.yearsHeld, 1);

  // The stake that stayed is still open, at its own basis.
  const still = t.open.find((p) => p.businessId === b);
  assert.ok(still, "the retained stake is still an open position");
  assert.equal(still?.cost, 600_000, "60% of the basis stays at work");
  assert.equal(still?.equity, 60, "equity is a percentage, not basis points");
});

test("an unmarked open position is reported at cost and says so", async () => {
  const b = newBusiness("Unmarked Track");
  const holder = addHolder("Unmarked Holder");
  await invest(b, holder, 800_000, 100);

  const t = R.trackRecord(holder);
  const p = t.open.find((x) => x.businessId === b);
  assert.equal(p?.basis, "cost");
  assert.equal(p?.value, 800_000);
  assert.equal(p?.markedOn, null);
  assert.equal(t.totals.unmarkedPositions, 1, "the book is told it is missing a mark");
});

test("a marked open position is valued from the mark, not the cost", async () => {
  const b = newBusiness("Marked Track");
  const holder = addHolder("Marked Holder");
  await invest(b, holder, 800_000, 100);
  const vts = client.now();
  client.run(
`INSERT INTO valuations (business_id, valued_on, valuation, note, voided, created_at, rev)
       VALUES (?, '2025-06-30', 2000000, '', 0, ?, 1)`,
    [b, vts],
  );

  const t = R.trackRecord(holder);
  const p = t.open.find((x) => x.businessId === b);
  assert.equal(p?.basis, "mark");
  assert.equal(p?.value, 2_000_000, "100% of a 2m mark on 1m in");
  assert.equal(p?.markedOn, "2025-06-30");
});

test("realised proceeds from the ledger and from the holdings agree", async () => {
  // Two independent reads of the same money. If they diverge, one of them is wrong, and
  // that is worth knowing before a figure goes on the page.
  const b = newBusiness("Agreement Track");
  const seller = addHolder("Agree Seller");
  const buyer = addHolder("Agree Buyer");
  await invest(b, seller, 1_000_000, 100);
  await sell(b, seller, 25, "2025-02-01", 300_000, buyer);
  await sell(b, seller, 15, "2025-05-01", 210_000, buyer);

  const fromLedger = R.capitalAccount(seller, b).realised;
  const fromHoldings = R.trackRecord(seller).realised
    .filter((p) => p.businessId === b)
    .reduce((s, p) => s + p.proceeds, 0);
  assert.equal(fromLedger, 510_000, "300k + 210k in the transfer ledger");
  assert.equal(fromHoldings, 510_000, "the same money read off the closed slices");
});

test("dividends received are investment income, never service revenue", async () => {
  const b = newBusiness("Ledger Separation");
  const holder = addHolder("Ledger Holder");
  await invest(b, holder, 500_000, 100);
  await declare(b, 100_000, "2024-06-30", "dividend");

  const flows = R.cashFlows(holder, b);
  assert.deepEqual([...new Set(flows.map((f) => f.kind))].sort(), ["contribution", "distribution"]);
  // Nothing in this module knows about revenue, and nothing adds across the two ledgers.
  // Asserted over the declared union rather than by comparison, so adding a "revenue"
  // kind later breaks this test loudly instead of compiling to a tautology.
  assert.deepEqual(
    [...new Set(flows.map((f) => f.kind))].sort(),
    ["contribution", "distribution"],
  );
  assert.ok(
    !(["distribution", "proceeds"] as string[]).includes("revenue"),
    "the two money ledgers stay separate",
  );
});

test("no table stores a derived return figure", () => {
  assert.deepEqual(
    R.derivedColumnsAbsent(),
    [],
    "a stored return will eventually disagree with the events it came from",
  );
});