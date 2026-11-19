import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The dividend boundary.
 *
 * The original had three answers to "did this holder hold on this date", and they
 * disagreed with each other. Every case below is one of those disagreements, with
 * the answer the single `heldOn` rule now gives.
 */
const DB = resolve(process.cwd(), "db/test-dividends.db");
process.env.ZP_DB = DB;

let client: typeof import("../src/db/client.js");
let dividends: typeof import("../src/domain/dividends.js");
let cycles: typeof import("../src/domain/profitCycles.js");
let valuations: typeof import("../src/domain/valuations.js");

const PRINCIPAL = "Zainpreneur Nominees Ltd";

before(async () => {
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
  client = await import("../src/db/client.js");
  dividends = await import("../src/domain/dividends.js");
  cycles = await import("../src/domain/profitCycles.js");
  valuations = await import("../src/domain/valuations.js");
  (await import("../src/db/migrations.js")).migrate();

  const ts = client.now();
  const principal = client.run(
    `INSERT INTO stakeholders (name, kind, created_at, updated_at, rev) VALUES (?, 'company', ?, ?, 1)`,
    [PRINCIPAL, ts, ts],
  );
  const pid = Number(principal.lastInsertRowid);
  const kh = client.run(
    `INSERT INTO stakeholders (name, kind, created_at, updated_at, rev) VALUES (?, 'fund', ?, ?, 1)`,
    ["Kenya Growth Partners", ts, ts],
  );
  const khid = Number(kh.lastInsertRowid);
  const mh = client.run(
    `INSERT INTO stakeholders (name, kind, created_at, updated_at, rev) VALUES (?, 'individual', ?, ?, 1)`,
    ["Achieng Odhiambo", ts, ts],
  );
  const mid = Number(mh.lastInsertRowid);

  client.run("INSERT INTO settings (key, value) VALUES ('principal_stakeholder_id', ?)", [String(pid)]);

  const biz = client.run(
    `INSERT INTO businesses (name, status, relationship_type, served, created_at, updated_at, rev)
     VALUES ('Dividend Test Co', 'active', 'equity', 0, ?, ?, 1)`,
    [ts, ts],
  );
  const bid = Number(biz.lastInsertRowid);

  const hold = (sid: number, equity: number, invested: string, exited: string | null) =>
    client.run(
      `INSERT INTO business_stakeholders
         (business_id, stakeholder_id, relationship, equity, is_equity, invested_on, exited_on, created_at, updated_at, rev)
       VALUES (?, ?, 'equity', ?, 1, ?, ?, ?, ?, 1)`,
      [bid, sid, equity, invested, exited, ts, ts],
    );

  hold(pid, 60, "2024-01-01", null);
  hold(khid, 20, "2024-01-01", null);
  // A departure modelled as a part exit *with* a transfer.
  //
  // Leaving Achieng's 20% simply closed would leave the open book at 80%, and
  // selling it needs the buyer's existing row closed and reopened at the combined
  // stake — which `ux_bs_one_current` enforces: one *open* row per holder. Writing
  // this fixture without that shape is what proved the index is load-bearing.
  hold(mid, 20, "2025-01-01", "2026-03-15");
  client.run(
    "UPDATE business_stakeholders SET exited_on = '2026-03-15' WHERE business_id = ? AND stakeholder_id = ? AND exited_on IS NULL",
    [bid, khid],
  );
  hold(khid, 40, "2026-03-15", null);

  client.run("INSERT INTO dividend_schedules (business_id, frequency, due_day, created_at, updated_at, rev) VALUES (?, 'monthly', 31, ?, ?, 1)", [
    bid,
    ts,
    ts,
  ]);
});

after(() => {
  client.closeDb();
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
});

const businessId = () =>
  client.num("SELECT id FROM businesses WHERE name = 'Dividend Test Co'");
const stakeholderId = (name: string) =>
  client.num("SELECT id FROM stakeholders WHERE name = ?", [name]);

/* -------------------------------------------------------------------------- */

test("heldOn is the only rule, and the exit date is exclusive", async () => {
  const { heldOn } = await import("@zainpreneur/shared");
  const h = { businessId: 1, branchId: null, stakeholderId: 1, equity: 20, investedOn: "2025-01-01", exitedOn: "2026-03-15" };

  assert.equal(heldOn(h, "2026-03-14"), true, "held the day before");
  assert.equal(heldOn(h, "2026-03-15"), false, "record-date attribution: not a holder on the exit date");
  assert.equal(heldOn(h, "2026-03-16"), false);
  assert.equal(heldOn(h, "2025-01-01"), true, "held from the entry date inclusive");
  assert.equal(heldOn(h, "2024-12-31"), false, "not a holder before entry");
});

test("a mid-month departure is excluded from that month's declaration", async () => {
  const id = await dividends.recordDistribution({
    businessId: businessId(),
    declaredOn: "2026-03-31",
    amount: 100_000,
    kind: "dividend",
  });
  const lines = dividends.entitlements(id.id);
  const departed = lines.find((l) => l.stakeholderName === "Achieng Odhiambo");

  assert.equal(departed, undefined, "a holder who left on the 15th does not receive the 31st dividend");
  assert.equal(
    lines.reduce((t, l) => t + l.amount, 0),
    100_000,
    "the shares must still add back to the declared amount",
  );
});

test("the same holder does receive a declaration from before they left", async () => {
  const id = await dividends.recordDistribution({
    businessId: businessId(),
    declaredOn: "2026-02-28",
    amount: 50_000,
    kind: "dividend",
  });
  const departed = dividends.entitlements(id.id).find((l) => l.stakeholderName === "Achieng Odhiambo");
  assert.ok(departed, "a holder on the record date is entitled");
  assert.equal(departed!.amount, 10_000, "20% of 50,000");
});

test("a holder with consecutive periods is given one line, not one per period", async () => {
  const bid = businessId();
  const ts = client.now();
  const pid = stakeholderId(PRINCIPAL);
  // A part sale: close a slice, reopen the remainder with the original entry date
  // so the holding period stays unbroken.
  client.run(
    `UPDATE business_stakeholders SET equity = 30, exited_on = '2026-01-31'
      WHERE business_id = ? AND stakeholder_id = ? AND exited_on IS NULL`,
    [bid, pid],
  );
  client.run(
    `INSERT INTO business_stakeholders
       (business_id, stakeholder_id, relationship, equity, is_equity, invested_on, created_at, updated_at, rev)
     VALUES (?, ?, 'equity', 30, 1, '2024-01-01', ?, ?, 1)`,
    [bid, pid, ts, ts],
  );

  const id = await dividends.recordDistribution({
    businessId: bid,
    declaredOn: "2026-09-30",
    amount: 1_000,
    kind: "dividend",
  });
  const principalLines = dividends.entitlements(id.id).filter((l) => l.stakeholderName === PRINCIPAL);
  assert.equal(principalLines.length, 1, "one line per holder, however many periods they have");
  assert.equal(
    principalLines[0]!.equity,
    30,
    "the declared date falls inside the second period only, so the closed slice does not count",
  );
});

/* -------------------------------------------------------------------------- */

test("declared is not received — settlement is tracked per holder", async () => {
  const bid = businessId();
  const id = await dividends.recordDistribution({
    businessId: bid,
    declaredOn: "2026-04-30",
    amount: 200_000,
    kind: "dividend",
  });
  const before = dividends.entitlements(id.id);
  const pid = stakeholderId(PRINCIPAL);

  const owed = before.find((l) => l.stakeholderId === pid)!;
  assert.equal(owed.outstanding, owed.amount, "nothing settled yet");

  const partPaid = 50_000;
  const result = await dividends.settleDividend({
    dividendId: id.id,
    stakeholderId: pid,
    amount: partPaid,
    paidOn: "2026-05-04",
    method: "transfer",
  });
  assert.equal(
    result.outstanding,
    Math.round((owed.amount - partPaid) * 100) / 100,
    "a part payment leaves the rest outstanding",
  );

  const after = dividends.entitlements(id.id).find((l) => l.stakeholderId === pid)!;
  assert.equal(after.paid, partPaid);
  assert.equal(after.outstanding, Math.round((owed.amount - partPaid) * 100) / 100);
});

test("a payment larger than the entitlement is refused", async () => {
  const bid = businessId();
  const id = await dividends.recordDistribution({
    businessId: bid,
    declaredOn: "2026-05-31",
    amount: 10_000,
    kind: "dividend",
  });
  const pid = stakeholderId(PRINCIPAL);
  await assert.rejects(
    () =>
      dividends.settleDividend({
        dividendId: id.id,
        stakeholderId: pid,
        amount: 999_999,
        paidOn: "2026-06-01",
      }),
    /more than is owed/,
  );
});

test("receivables are declared minus settled", () => {
  const r = dividends.dividendsReceivable(businessId());
  assert.ok(r.declared > 0);
  assert.equal(r.outstanding, Math.round((r.declared - r.paid) * 100) / 100);
  assert.ok(r.perHolder.length > 0, "someone is owed money");
});

/* -------------------------------------------------------------------------- */

test("a record-date dividend may not also record entitlements", async () => {
  await assert.rejects(
    () =>
      dividends.recordDistribution({
        businessId: businessId(),
        declaredOn: "2026-06-30",
        amount: 10_000,
        entitlementMode: "record_date",
        entitlements: [{ stakeholderId: stakeholderId(PRINCIPAL), amount: 10_000 }],
      }),
    /derives its entitlements/,
  );
});

test("a contractual dividend is recorded, and its split must add back", async () => {
  const bid = businessId();
  const khid = stakeholderId("Kenya Growth Partners");

  await assert.rejects(
    () =>
      dividends.recordDistribution({
        businessId: bid,
        declaredOn: "2026-07-31",
        amount: 100_000,
        entitlementMode: "contractual",
        contractualBasis: "explicit",
        entitlements: [{ stakeholderId: khid, amount: 60_000 }],
      }),
    /add to/,
    "a recorded split that does not add up is refused",
  );

  const id = await dividends.recordDistribution({
    businessId: bid,
    declaredOn: "2026-07-31",
    amount: 100_000,
    entitlementMode: "contractual",
    contractualBasis: "explicit",
    entitlements: [
      { stakeholderId: stakeholderId(PRINCIPAL), amount: 70_000 },
      { stakeholderId: khid, amount: 30_000 },
    ],
  });
  const lines = dividends.entitlements(id.id);
  assert.equal(lines.length, 2);
  assert.equal(lines.find((l) => l.stakeholderName === PRINCIPAL)!.amount, 70_000);
});

test("a duplicate date is refused by name, not by a SQLite constraint message", async () => {
  await assert.rejects(
    () =>
      dividends.recordDistribution({
        businessId: businessId(),
        declaredOn: "2026-07-31",
        amount: 5_000,
      }),
    /already has a distribution dated 2026-07-31/,
  );
});

test("a future declaration is refused", async () => {
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  await assert.rejects(
    () => dividends.recordDistribution({ businessId: businessId(), declaredOn: future, amount: 1_000 }),
    /in the future/,
  );
});

/* -------------------------------------------------------------------------- */

test("coverage counts the months a schedule expects but nothing was declared", () => {
  const report = dividends.coverageFor(businessId())!;
  assert.ok(report, "the business has a schedule");
  assert.ok(report.expected > 0);
  assert.ok(Array.isArray(report.missing));
  assert.equal(report.paid + report.missing.length, report.expected);
});

test("the missing-dividend alert is a question, not a table", () => {
  const alerts = dividends.missingDividends();
  assert.ok(Array.isArray(alerts));
  const rows = client.num("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE '%alert%'");
  assert.equal(rows, 0, "no alerts table exists");
});

test("whatsDue lists periods with nothing recorded", () => {
  const due = dividends.whatsDue(businessId());
  assert.ok(Array.isArray(due));
  for (const d of due) assert.match(d.periodKey, /^\d{4}-\d{2}$/);
});

/* -------------------------------------------------------------------------- */

test("a cycle derives its dividend from trading, less anything retained", async () => {
  const bid = businessId();
  const { cycle, distributed } = await cycles.recordProfitCycle({
    businessId: bid,
    periodEnd: "2026-08-31",
    grossRevenue: 500_000,
    operatingExpenses: 300_000,
    retained: 50_000,
  });

  assert.equal(cycle.net, 200_000, "net is worked out, not stored");
  assert.equal(cycle.distributable, 150_000, "retained comes off before sharing");
  assert.equal(distributed, 150_000, "the declaration matches the distributable");
});

test("a loss period is recorded and nothing is distributed", async () => {
  const { cycle, distributed } = await cycles.recordProfitCycle({
    businessId: businessId(),
    periodEnd: "2026-07-31",
    grossRevenue: 100_000,
    operatingExpenses: 180_000,
  });
  assert.equal(cycle.net, -80_000);
  assert.equal(cycle.distributable, 0);
  assert.equal(distributed, 0);
});

test("the same month cannot be recorded twice under two labels", async () => {
  await assert.rejects(
    () =>
      cycles.recordProfitCycle({
        businessId: businessId(),
        periodEnd: "2026-08-31",
        periodLabel: "Aug 2026",
        grossRevenue: 1_000,
        operatingExpenses: 0,
      }),
    /already has a cycle/,
  );
});

test("retaining more than the net is refused", async () => {
  await assert.rejects(
    () =>
      cycles.recordProfitCycle({
        businessId: businessId(),
        periodEnd: "2026-06-30",
        grossRevenue: 1_000,
        operatingExpenses: 900,
        retained: 500,
      }),
    /cannot retain/,
  );
});

/* -------------------------------------------------------------------------- */

test("a mark cannot be zero, in the future, or duplicated", async () => {
  const bid = businessId();
  await assert.rejects(
    () => valuations.recordValuation({ businessId: bid, valuedOn: "2026-06-30", valuation: 0 }),
    /cannot be zero/,
  );
  await assert.rejects(
    () => valuations.recordValuation({ businessId: bid, valuedOn: "2027-01-01", valuation: 100 }),
    /in the future/,
  );
  await valuations.recordValuation({ businessId: bid, valuedOn: "2026-03-31", valuation: 4_000_000 });
  await assert.rejects(
    () => valuations.recordValuation({ businessId: bid, valuedOn: "2026-03-31", valuation: 5_000_000 }),
    /already has a mark dated/,
  );
});

test("change between consecutive marks is computed, and a third off is a write-down", async () => {
  const bid = businessId();
  await valuations.recordValuation({ businessId: bid, valuedOn: "2025-12-31", valuation: 5_000_000 });
  await valuations.recordValuation({ businessId: bid, valuedOn: "2026-06-30", valuation: 3_000_000 });

  const changes = valuations.markChanges(bid);
  // Change is computed between *consecutive* marks, not endpoints: 5M -> 4M -> 3M
  // is two steps of -1M each. A chart of "change over time" has to read that way,
  // because the intermediate mark is a fact in its own right.
  assert.equal(changes.length, 2, "two consecutive steps across three marks");
  const first = changes.find((c) => c.to === "2026-03-31")!;
  const drop = changes.find((c) => c.to === "2026-06-30")!;
  assert.equal(first.change, -1_000_000);
  assert.equal(drop!.change, -1_000_000, "not the 2M difference between the endpoints");
  assert.equal(drop!.direction, "down");
  // The threshold is a fifth off. A 25% fall therefore trips it.
  assert.equal(drop!.writeDown, true, "25% off in one mark is a write-down");

  const shallow = await (async () => {
    await valuations.recordValuation({ businessId: bid, valuedOn: "2026-08-31", valuation: 2_700_000 });
    return valuations.markChanges(bid).find((c) => c.to === "2026-08-31")!;
  })();
  assert.equal(shallow.change, -300_000, "a 10% fall");
  assert.equal(shallow.writeDown, false, "10% off is ordinary movement, not a write-down");

  const stored = client.all<{ n: string }>(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='column'",
  );
  void stored;
});

test("an unmarked business reports at cost and says so", () => {
  const bid = client.run(
    `INSERT INTO businesses (name, status, relationship_type, served, created_at, updated_at, rev)
     VALUES ('Never Marked Co', 'active', 'equity', 0, ?, ?, 1)`,
    [client.now(), client.now()],
  );
  const id = Number(bid.lastInsertRowid);
  const value = valuations.positionValue(id, 40);
  assert.equal(value.basis, "cost");
  assert.equal(value.status, "unmarked");
  assert.equal(value.value, null, "no value is invented");
  assert.match(value.note, /never been marked/);
});

test("voiding a mark keeps the history and falls back to the previous one", async () => {
  const bid = businessId();
  const before = valuations.currentMark(bid);
  assert.ok(before);
  await valuations.clearValuation(bid, before!.id);
  const after = valuations.currentMark(bid);
  assert.notEqual(after?.valuedOn, before?.valuedOn, "the voided mark is no longer the latest");
});