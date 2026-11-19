import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { money } from "@zainpreneur/shared";

/**
 * Work done inside the group.
 *
 * The property that matters is arithmetic, not bookkeeping: internal trading must not
 * look like performance. Every other test here is in service of that one — that both
 * sides are in the group, that a charge cannot be recorded with only one leg, and that
 * the elimination removes the same amount from both sides.
 */
const DB = resolve(process.cwd(), "db/test-intercompany.db");
process.env.ZP_DB = DB;

let client: typeof import("../src/db/client.js");
let I: typeof import("../src/domain/intercompany.js");
let P: typeof import("../src/domain/profitCycles.js");

let principal = 0;
let subsidiary = 0;
let secondSubsidiary = 0;
let outsider = 0;
let ts = "";

before(async () => {
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
  client = await import("../src/db/client.js");
  const { migrate } = await import("../src/db/migrations.js");
  I = await import("../src/domain/intercompany.js");
  P = await import("../src/domain/profitCycles.js");
  migrate();
  ts = client.now();

  const holder = (name: string, kind = "company") =>
    Number(
      client
        .run(
          "INSERT INTO stakeholders (name, kind, role, notes, created_at, updated_at, rev) VALUES (?, ?, 'Owner', '', ?, ?, 1)",
          [name, kind, ts, ts],
        ).lastInsertRowid,
    );

  principal = holder("Zainpreneur Nominees Ltd");
  client.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('principal_stakeholder_id', ?)", [
    String(principal),
  ]);

  const biz = (name: string) =>
    Number(
      client
        .run(
          `INSERT INTO businesses (name, status, relationship_type, served, created_at, updated_at, rev)
           VALUES (?, 'active', 'equity', 1, ?, ?, 1)`,
          [name, ts, ts],
        ).lastInsertRowid,
    );

  const share = (businessId: number, stakeholderId: number, equity: number) =>
    client.run(
      `INSERT INTO business_stakeholders
         (business_id, stakeholder_id, relationship, equity, is_equity, invested_on, created_at, updated_at, rev)
       VALUES (?, ?, 'equity', ?, 1, '2024-01-01', ?, ?, 1)`,
      [businessId, stakeholderId, equity, ts, ts],
    );

  subsidiary = biz("Green Life Nursery");
  share(subsidiary, principal, 100);

  secondSubsidiary = biz("Riverside Lodge");
  share(secondSubsidiary, principal, 100);

  outsider = biz("ABC Trading");
  share(outsider, holder("Meridian Holdings Ltd"), 100);
});

after(() => {
  client.closeDb();
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
});

let seq = 0;
const charge = (over: Record<string, unknown> = {}) =>
  I.recordCharge({
    number: `IC-${++seq}`,
    businessId: subsidiary,
    toStakeholderId: principal,
    amount: 500_000,
    chargedOn: "2026-03-31",
    basis: "management_fee",
    ...over,
  });

const profit = (businessId: number, periodEnd: string, revenue: number, expenses: number) =>
  P.recordProfitCycle({
    businessId,
    periodEnd,
    grossRevenue: revenue,
    operatingExpenses: expenses,
    retained: 0,
  });

/* -------------------------------------------------------------------------- */
/* Membership of the group                                                      */
/* -------------------------------------------------------------------------- */

test("the group is the businesses Zainpreneur wholly owns", () => {
  assert.deepEqual(
    I.groupBusinesses().map((b) => b.id).sort((a, b) => a - b),
    [subsidiary, secondSubsidiary].sort((a, b) => a - b),
  );
  assert.equal(I.inGroup(subsidiary), true);
  assert.equal(I.inGroup(outsider), false);
});

test("a charge to a business outside the group is refused, and pointed at invoicing", async () => {
  await assert.rejects(
    () => charge({ businessId: outsider }),
    /ordinary sale — invoice it instead/,
    "an external sale was accepted as intercompany",
  );
});

test("a charge between two businesses outside the group is refused", async () => {
  await assert.rejects(
    () => charge({ businessId: outsider, toStakeholderId: null, toBusinessId: subsidiary }),
    /does not wholly own that business/,
    "the creditor was in the group, so this should have been refused for the debtor",
  );
});

/* -------------------------------------------------------------------------- */
/* Both sides                                                                   */
/* -------------------------------------------------------------------------- */

test("every charge has both sides, because there is nowhere to put one", async () => {
  const id = await charge();
  const c = I.chargeById(id)!;
  assert.equal(c.sides.length, 2);
  assert.equal(c.sides[0].role, "debtor");
  assert.equal(c.sides[1].role, "creditor");
  assert.equal(c.sides[0].name, "Green Life Nursery");
  assert.equal(c.sides[1].name, "Zainpreneur Nominees Ltd");
});

test("the two legs of an elimination are always equal", async () => {
  const id = await charge({ amount: 123_457.89 });
  const c = I.chargeById(id)!;
  assert.equal(c.elimination.fromRevenue, 123_457.89);
  assert.equal(c.elimination.fromExpenses, 123_457.89);
  assert.equal(
    c.elimination.fromRevenue,
    c.elimination.fromExpenses,
    "eliminating one side only would leave a profit the size of the transfer",
  );
});

test("a charge needs exactly one counterparty", async () => {
  await assert.rejects(() => charge({ toStakeholderId: null }), /needs to say who is being paid/);
  await assert.rejects(
    () => charge({ toBusinessId: secondSubsidiary, toStakeholderId: principal }),
    /one counterparty/,
  );
});

test("a business cannot charge itself", async () => {
  await assert.rejects(
    () => charge({ toStakeholderId: null, toBusinessId: subsidiary }),
    /cannot charge itself/,
  );
});

test("two group companies can charge each other", async () => {
  const id = await charge({ toStakeholderId: null, toBusinessId: secondSubsidiary });
  const c = I.chargeById(id)!;
  assert.equal(c.sides[1].businessId, secondSubsidiary);
});

test("interest is not a basis, because this group runs none", async () => {
  await assert.rejects(
    () => charge({ basis: "interest" }),
    /no interest-bearing instrument/,
    "a zero-interest group was offered an interest charge",
  );
});

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                    */
/* -------------------------------------------------------------------------- */

test("a charge is proposed until it is confirmed", async () => {
  const id = await charge();
  assert.equal(I.chargeById(id)?.status, "proposed");
  assert.equal(I.chargeById(id)?.confirmedOn, null);

  const confirmed = I.confirmCharge(id, "2026-04-05");
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.confirmedOn, "2026-04-05");
});

test("a charge cannot be confirmed before it was raised", async () => {
  const id = await charge({ chargedOn: "2026-03-31" });
  assert.throws(() => I.confirmCharge(id, "2026-03-01"), /before it was raised/);
  // Not "before it was raised": settling something unconfirmed is refused first, and
  // that is the better objection to make to somebody.
  assert.throws(() => I.settleCharge(id, "2026-03-01"), /not been confirmed/);
});

test("a charge cannot be settled before it is confirmed", async () => {
  const id = await charge();
  assert.throws(() => I.settleCharge(id), /not been confirmed/);
  I.confirmCharge(id, "2026-04-01");
  assert.equal(I.settleCharge(id, "2026-04-10").status, "settled");
});

test("a charge is recognised once, not twice", async () => {
  const id = await charge();
  I.confirmCharge(id, "2026-04-01");
  assert.throws(() => I.confirmCharge(id), /already confirmed/);
});

/* -------------------------------------------------------------------------- */
/* Consolidation                                                                */
/* -------------------------------------------------------------------------- */

test("two group companies trading with each other do not flatter the group", async () => {
  // Each reports honestly: the lodge sells services to the nursery, so the lodge shows
  // the income and the nursery shows the cost. Added together that looks like growth.
  await profit(subsidiary, "2026-01-31", 1_000_000, 400_000);
  await profit(secondSubsidiary, "2026-01-31", 800_000, 300_000);

  const clean = I.consolidation();
  assert.equal(clean.reportedNet, 1_100_000, "1.1m as the two companies report it");
  assert.equal(clean.eliminatedWithinGroup, 0, "nothing internal has happened yet");

  // The lodge charges the nursery for internal services.
  const id = await charge({
    number: `IC-${++seq}`,
    businessId: secondSubsidiary,
    toStakeholderId: null,
    toBusinessId: subsidiary,
    amount: 300_000,
    chargedOn: "2026-02-28",
  });
  I.confirmCharge(id, "2026-03-05");
  // Both sides book it, exactly as they would any charge.
  await profit(secondSubsidiary, "2026-02-28", 300_000, 0);
  await profit(subsidiary, "2026-02-28", 0, 300_000);

  const after = I.consolidation();
  const lodge = after.rows.find((r) => r.businessId === secondSubsidiary)!;
  const nursery = after.rows.find((r) => r.businessId === subsidiary)!;

  assert.equal(lodge.chargedToGroup, 300_000, "the lodge's income came from inside the group");
  assert.equal(nursery.chargedByGroup, 300_000, "and the nursery's cost went to inside it");

  // Standalone, neither company looks better for having sold to the other.
  assert.equal(lodge.standaloneNet, money(lodge.reportedNet - 300_000));
  assert.equal(nursery.standaloneNet, money(nursery.reportedNet + 300_000));

  // And the group total is untouched, because the transfer was never a group event.
  assert.equal(
    after.reportedNet,
    1_100_000,
    "internal trading changed what each company looks like, not what the group earned",
  );
  assert.equal(after.eliminatedWithinGroup, 0, "so elimination moved nothing");
  assert.equal(after.standaloneTotal, after.reportedNet);
});

test("a fee paid to the portfolio owner is never added back", async () => {
  // The owner's income leg is not in the set of company rows, so adding the expense
  // back would manufacture profit out of a transaction whose other half is not here.
  // That is the direction which makes a consolidated figure look *better* than the sum
  // of its parts — the clearest sign something was created rather than removed.
  await profit(subsidiary, "2026-03-31", 0, 400_000);

  // Earlier tests left confirmed charges behind, so this measures the change rather
  // than the absolute total.
  const before = I.consolidation().rows.find((r) => r.businessId === subsidiary)!;
  const id = await charge({ number: `IC-${++seq}`, amount: 400_000, chargedOn: "2026-03-31" });
  I.confirmCharge(id, "2026-04-02");
  const after = I.consolidation().rows.find((r) => r.businessId === subsidiary)!;

  assert.equal(
    after.chargedByPrincipal - before.chargedByPrincipal,
    400_000,
    "the new cost is recorded as coming from the owner",
  );
  assert.equal(
    after.chargedByGroup,
    before.chargedByGroup,
    "and is not folded into the internal trading that gets eliminated",
  );
  assert.equal(
    after.standaloneNet - before.standaloneNet,
    0,
    "so the cost stays where it was booked and no profit was created",
  );
  assert.equal(
    I.consolidation().paidToPrincipal >= 400_000,
    true,
    "and the group is shown as having paid it out to the owner",
  );
});

test("consolidation reconciles, and says so when it does not", () => {
  const check = I.consolidationReconciles();
  assert.equal(check.ok, true, check.problems.join("; "));
});

test("eliminating internal trading leaves the group total exactly where it was", () => {
  // The classic consolidation error is removing one leg of a transfer without the
  // other, which moves the total by the size of the transfer. For a closed set the
  // two legs always cancel, so this must be exactly zero.
  const c = I.consolidation();
  assert.equal(c.eliminatedWithinGroup, 0, "the elimination changed the group total");
  assert.equal(c.standaloneTotal, c.reportedNet);
  for (const row of c.rows) {
    assert.equal(
      money(row.reportedNet - row.chargedToGroup + row.chargedByGroup),
      row.standaloneNet,
      `${row.businessName} did not remove both legs`,
    );
  }
});

test("a proposed charge is shown but not eliminated", async () => {
  // A fee nobody has agreed to is not yet recognised; eliminating it would remove
  // something that has not happened.
  const before = I.consolidation();
  await charge({ amount: 999_999, chargedOn: "2026-03-31" });
  const after = I.consolidation();
  assert.equal(after.reportedNet, before.reportedNet, "an unconfirmed charge changed the group result");
  assert.equal(after.proposed, before.proposed + 1);
  assert.equal(after.proposedAmount, money(before.proposedAmount + 999_999));
});

test("every confirmed charge reconciles", async () => {
  const integrity = I.chargeIntegrity();
  assert.equal(integrity.balanced, true, integrity.breaches.map((b) => `${b.number}: ${b.reason}`).join("; "));
});

test("an intercompany charge is never filed as an invoice", () => {
  assert.equal(
    client.num("SELECT COUNT(*) FROM invoices WHERE business_id = ?", [subsidiary]),
    0,
    "a wholly-owned business was invoiced instead of charged",
  );
  // A dividend paid by a wholly-owned subsidiary to its owner is a real dividend and
  // belongs in the dividend ledger — it is not revenue, and it is not an invoice.
  // What must not exist is an *invoice*, which is what the line above checks.
  assert.equal(
    client.num("SELECT COUNT(*) FROM invoices WHERE business_id = ? OR business_id = ?", [subsidiary, secondSubsidiary]),
    0,
    "a wholly-owned business was invoiced instead of charged",
  );
});