import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Billing a client.
 *
 * The properties under test are the ones that make an invoice trustworthy: its lines
 * add up to its own total, a raised price does not rewrite what was already issued,
 * an unpaid invoice is still owed after the client pays part of it, and money owed to
 * Zainpreneur never becomes money received from it.
 */
const DB = resolve(process.cwd(), "db/test-invoicing.db");
process.env.ZP_DB = DB;

let client: typeof import("../src/db/client.js");
let I: typeof import("../src/domain/invoicing.js");

before(async () => {
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
  client = await import("../src/db/client.js");
  const { migrate } = await import("../src/db/migrations.js");
  I = await import("../src/domain/invoicing.js");
  migrate();
});

after(() => {
  client.closeDb();
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
});

let seq = 0;
function newBusiness(): number {
  const ts = client.now();
  return Number(
    client
      .run(
        `INSERT INTO businesses (name, status, relationship_type, served, created_at, updated_at, rev)
         VALUES (?, 'active', 'client', 1, ?, ?, 1)`,
        [`Billed Co ${++seq}`, ts, ts],
      ).lastInsertRowid,
  );
}

const issue = (businessId: number, lines: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
  I.issueInvoice({
    number: `INV-${++seq}`,
    businessId,
    issuedOn: "2026-01-31",
    currency: "KES",
    lines,
    ...extra,
  });

/* -------------------------------------------------------------------------- */
/* Rounding                                                                     */
/* -------------------------------------------------------------------------- */

test("an allocated amount adds back to itself exactly", () => {
  // The classic failure: three thirds at 33.33 is 99.99, and an invoice whose total
  // disagrees with its own lines cannot be reconciled.
  // `allocate` works in cents, so 100.00 comes back as 10000.
  assert.equal(I.allocate(100, [1, 1, 1]).reduce((a, b) => a + b, 0), 10000);
  assert.deepEqual(
    I.allocate(100, [1, 1, 1]),
    [3334, 3333, 3333],
    "the extra cent goes to the first part, which was shorted the most",
  );
});

test("allocation holds across many awkward splits", () => {
  const cases: Array<[number, number[]]> = [
    [100, [1, 1, 1]],
    [1000, [1, 1, 1]],
    [0.01, [1, 1]],
    [999.99, [7, 11, 13]],
    [12345.67, [1, 2, 3, 4, 5]],
    [50, [1, 1, 1, 1, 1, 1, 1]],
    [1, [1, 1, 1, 1]],
  ];
  for (const [amount, weights] of cases) {
    const parts = I.allocate(amount, weights);
    assert.equal(
      parts.reduce((a, b) => a + b, 0),
      Math.round(amount * 100),
      `${amount} split ${weights.join("/")} did not add back`,
    );
  }
});

test("allocation with nothing to weight by puts the whole amount somewhere visible", () => {
  assert.deepEqual(I.allocate(500, [0, 0]), [50000, 0]);
});

/* -------------------------------------------------------------------------- */
/* Pricing a line                                                              */
/* -------------------------------------------------------------------------- */

test("a line prices quantity, discount and tax in that order", () => {
  const p = I.priceLine({ quantity: 6, unitPrice: 50_000, discount: 50_000, taxRate: 16 });
  assert.equal(p.subtotal, 250_000, "6 x 50,000 less the 50,000 discount");
  assert.equal(p.taxAmount, 40_000, "tax on the discounted amount, not the gross");
  assert.equal(p.total, 290_000);
});

test("a discount cannot exceed the line it discounts", () => {
  assert.throws(() => I.priceLine({ quantity: 1, unitPrice: 100, discount: 500 }), /discount/);
});

test("a negative quantity is refused rather than becoming credit", () => {
  assert.throws(() => I.priceLine({ quantity: -2, unitPrice: 100 }), /negative/);
});

/* -------------------------------------------------------------------------- */
/* Issuing                                                                      */
/* -------------------------------------------------------------------------- */

test("an invoice's lines add up to its own total, exactly", async () => {
  const b = newBusiness();
  // 1000/3 per line at 16% tax: the classic place pennies go missing.
  const id = await issue(b, [
    { description: "one", quantity: 1, unitPrice: 333.33 },
    { description: "two", quantity: 1, unitPrice: 333.33 },
    { description: "three", quantity: 1, unitPrice: 333.33 },
  ]);
  const inv = I.readInvoice(id)!;
  const lineSum = inv.lines.reduce((s, l) => s + l.total, 0);
  assert.equal(lineSum, inv.total, "the total is the sum of its own lines");
  assert.equal(inv.total, 999.99);
});

test("a rate change does not rewrite an invoice already issued", async () => {
  const b = newBusiness();
  const ts = client.now();
  const svc = Number(
    client.run(
      "INSERT INTO services (name, status, created_at, updated_at, rev) VALUES ('Consulting', 'active', ?, ?, 1)",
      [ts, ts],
    ).lastInsertRowid,
  );
  const variant = Number(
    client
      .run(
        `INSERT INTO service_variants
           (service_id, name, rate, pricing_model, status, created_at, updated_at, rev)
         VALUES (?, 'Standard', 100000, 'fixed', 'active', ?, ?, 1)`,
        [svc, ts, ts],
      )
      .lastInsertRowid,
  );

  const id = await issue(b, [{ variantId: variant, description: "Standard", quantity: 1, unitPrice: 100_000 }]);
  const before = I.readInvoice(id)!;

  // The catalogue price doubles tomorrow.
  client.run("UPDATE service_variants SET rate = 200000 WHERE id = ?", [variant]);

  const after = I.readInvoice(id)!;
  assert.equal(after.lines[0]?.unitPrice, 100_000, "the issued invoice kept the price it quoted");
  assert.equal(after.total, before.total);
  assert.equal(
    client.num("SELECT rate FROM service_variants WHERE id = ?", [variant]),
    200000,
    "while the catalogue carries the new price forward",
  );
});

test("a business you wholly own cannot be invoiced", async () => {
  // Charging yourself for advisory is intercompany, not a client invoice. Billing it
  // here produced Zainpreneur owing Zainpreneur money, which is the sort of figure
  // that later gets fixed by deleting the invoice.
  const b = newBusiness();
  const ts = client.now();
  const owner = Number(
    client
      .run("INSERT INTO stakeholders (name, kind, role, notes, created_at, updated_at, rev) VALUES ('Zainpreneur Nominees Ltd', 'company', 'Owner', '', ?, ?, 1)", [ts, ts])
      .lastInsertRowid,
  );
  client.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('principal_stakeholder_id', ?)", [
    String(owner),
  ]);
  client.run(
    `INSERT INTO business_stakeholders
       (business_id, stakeholder_id, relationship, equity, is_equity, invested_on, created_at, updated_at, rev)
     VALUES (?, ?, 'equity', 100, 1, '2024-01-01', ?, ?, 1)`,
    [b, owner, ts, ts],
  );

  await assert.rejects(
    () => issue(b, [{ unitPrice: 100_000 }], { number: "OWN-1" }),
    /intercompany/,
  );
  assert.equal(client.num("SELECT COUNT(*) FROM invoices WHERE number = 'OWN-1'"), 0, "but nothing was recorded");
});

test("a business wholly owned by somebody else is still a client", async () => {
  // The guard is about *Zainpreneur* owning the business, not about a client happening
  // to have one 100% shareholder — which is most of them.
  const b = newBusiness();
  const ts = client.now();
  const owner = Number(
    client
      .run("INSERT INTO stakeholders (name, kind, role, notes, created_at, updated_at, rev) VALUES ('Someone Else Ltd', 'company', 'Owner', '', ?, ?, 1)", [ts, ts])
      .lastInsertRowid,
  );
  client.run(
    `INSERT INTO business_stakeholders
       (business_id, stakeholder_id, relationship, equity, is_equity, invested_on, created_at, updated_at, rev)
     VALUES (?, ?, 'equity', 100, 1, '2024-01-01', ?, ?, 1)`,
    [b, owner, ts, ts],
  );
  const id = await issue(b, [{ unitPrice: 250_000 }], { number: "THEIRS-1" });
  assert.equal(I.readInvoice(id)?.total, 250_000, "a client's single shareholder is not intercompany");
});

test("an invoice cannot be issued without a number or without a price", async () => {
  const b = newBusiness();
  await assert.rejects(
    () => I.issueInvoice({ businessId: b, issuedOn: "2026-01-31", lines: [{ unitPrice: 100 }] }),
    /number/,
  );
  await assert.rejects(
    () => I.issueInvoice({ businessId: b, number: "X", issuedOn: "2026-01-31", lines: [{ description: "no price" }] }),
    /price/,
  );
  await assert.rejects(
    () => I.issueInvoice({ businessId: b, number: "Y", issuedOn: "2026-01-31", lines: [] }),
    /at least one line/,
  );
});

test("the same number cannot be issued twice", async () => {
  const b = newBusiness();
  await issue(b, [{ unitPrice: 100 }], { number: "DUP-1" });
  await assert.rejects(
    () => issue(b, [{ unitPrice: 100 }], { number: "DUP-1" }),
    /already exists/,
  );
});

test("an invoice cannot fall due before it was issued", async () => {
  const b = newBusiness();
  await assert.rejects(
    () => issue(b, [{ unitPrice: 100 }], { issuedOn: "2026-03-31", dueOn: "2026-03-01" }),
    /before it is issued/,
  );
});

/* -------------------------------------------------------------------------- */
/* Settling                                                                     */
/* -------------------------------------------------------------------------- */

test("a part payment leaves the rest owed, and the status says so", async () => {
  const b = newBusiness();
  const id = await issue(b, [{ description: "Retainer", quantity: 1, unitPrice: 400_000 }]);
  const after = await I.recordPayment({ invoiceId: id, amount: 150_000, paidOn: "2026-02-05" });

  assert.equal(after.total, 400_000);
  assert.equal(after.paid, 150_000);
  assert.equal(after.outstanding, 250_000, "the rest is still owed");
  assert.equal(after.status, "part_paid");
  assert.equal(after.overpaid, 0);
});

test("paying in full settles it, and the status is not stored anywhere", async () => {
  const b = newBusiness();
  const id = await issue(b, [{ unitPrice: 400_000 }]);
  await I.recordPayment({ invoiceId: id, amount: 250_000, paidOn: "2026-02-05" });
  const settled = await I.recordPayment({ invoiceId: id, amount: 150_000, paidOn: "2026-02-06" });

  assert.equal(settled.outstanding, 0);
  assert.equal(settled.status, "paid");

  // The status is derived from the payments, so it cannot fall out of step with them.
  const stored = client.num(
    "SELECT COUNT(*) FROM pragma_table_info('invoices') WHERE name IN ('status','paid','outstanding','balance')",
  );
  assert.equal(stored, 0, "an invoice stores no derived status or balance");
});

test("paying too much leaves the client in credit, not with a negative bill", async () => {
  const b = newBusiness();
  const id = await issue(b, [{ unitPrice: 100_000 }]);
  const after = await I.recordPayment({ invoiceId: id, amount: 150_000, paidOn: "2026-02-05" });

  assert.equal(after.outstanding, 0, "nothing is owed");
  assert.equal(after.overpaid, 50_000, "and the credit is stated rather than hidden");
  assert.equal(after.status, "overpaid");
});

test("a credit note closes an invoice without pretending it was paid", async () => {
  const b = newBusiness();
  const id = await issue(b, [{ unitPrice: 100_000 }]);
  const credited = await I.issueCreditNote({
    invoiceId: id,
    number: "CN-1",
    amount: 100_000,
    issuedOn: "2026-02-10",
    reason: "billed twice",
  });
  assert.equal(credited.outstanding, 0);
  assert.equal(credited.paid, 0, "no money arrived");
  assert.equal(credited.status, "credited", "so it did not report as paid");
});

test("a credit note cannot exceed what is owed", async () => {
  const b = newBusiness();
  const id = await issue(b, [{ unitPrice: 100_000 }]);
  await assert.rejects(
    () => I.issueCreditNote({ invoiceId: id, number: "CN-2", amount: 100_001, issuedOn: "2026-02-10" }),
    /more than the .* still owed|refund/,
  );
});

test("an invoice with money against it is credited, not voided", async () => {
  const b = newBusiness();
  const id = await issue(b, [{ unitPrice: 100_000 }]);
  await I.recordPayment({ invoiceId: id, amount: 40_000, paidOn: "2026-02-05" });
  await assert.rejects(() => I.voidInvoice({ invoiceId: id }), /credit note instead/);
});

test("voiding keeps the number, so it cannot be reused", async () => {
  const b = newBusiness();
  const id = await issue(b, [{ unitPrice: 100_000 }], { number: "VOID-1" });
  const voided = await I.voidInvoice({ invoiceId: id, on: "2026-02-01", note: "raised in error" });

  assert.equal(voided.status, "void");
  assert.equal(voided.outstanding, 0, "a voided invoice is owed by nobody");
  assert.ok(voided.voidedOn, "and the fact it was voided is kept");

  await assert.rejects(() => issue(b, [{ unitPrice: 1 }], { number: "VOID-1" }), /already exists/);
  await assert.rejects(() => I.recordPayment({ invoiceId: id, amount: 10 }), /was voided/);
});

/* -------------------------------------------------------------------------- */
/* Receivables                                                                  */
/* -------------------------------------------------------------------------- */

test("receivables are read from the invoices, never kept as a running balance", async () => {
  const b = newBusiness();
  const one = await issue(b, [{ unitPrice: 100_000 }], { number: "R-1" });
  await issue(b, [{ unitPrice: 50_000 }], { number: "R-2" });
  await I.recordPayment({ invoiceId: one, amount: 30_000, paidOn: "2026-02-05" });

  const r = I.businessReceivable(b);
  assert.equal(r?.issued, 150_000);
  assert.equal(r?.paid, 30_000);
  assert.equal(r?.outstanding, 120_000);

  // Voiding must change the balance immediately — which a stored total would not do.
  const second = I.listInvoices(b).find((i) => i.number === "R-2");
  await I.voidInvoice({ invoiceId: second!.id });
  assert.equal(I.businessReceivable(b)?.issued, 100_000, "a voided invoice is not outstanding revenue");
  assert.equal(I.businessReceivable(b)?.outstanding, 70_000);
});

test("money owed is never money received", async () => {
  const b = newBusiness();
  const id = await issue(b, [{ unitPrice: 100_000 }], { number: "SEP-1" });
  await I.recordPayment({ invoiceId: id, amount: 100_000, paidOn: "2026-02-05" });

  const inv = I.readInvoice(id)!;
  assert.equal(inv.outstanding, 0);

  // The investment ledgers read nothing from invoicing, and invoicing reads nothing
  // from them: 100k collected here is revenue, never a distribution received.
  assert.equal(
    client.num("SELECT COUNT(*) FROM dividends WHERE note LIKE '%invoice%' OR note LIKE '%INV-SEP%'"),
    0,
    "an invoice payment was filed as a distribution",
  );
  const revenueColumn = client.num(
    "SELECT COUNT(*) FROM pragma_table_info('businesses') WHERE name = 'revenue'",
  );
  assert.equal(revenueColumn, 0, "a business still carries a settable revenue column");
});
/* -------------------------------------------------------------------------- */
/* Currencies in the receivables                                                */
/* -------------------------------------------------------------------------- */

test("receivables are never added across currencies", async () => {
  // Keyed on the business alone, a client billed in both dollars and shillings produced
  // one row summing the two — a confidently wrong figure with nothing in the report to
  // say so. That is the exact failure this whole module is about.
  const b = newBusiness();
  await issue(b, [{ unitPrice: 100_000 }], { number: "CUR-1", currency: "KES" });
  await issue(b, [{ unitPrice: 500 }], { number: "CUR-2", currency: "USD" });

  // Scoped to this business: earlier tests in this file left their own invoices behind,
  // and `receivables()` is a whole-book report.
  const rows = I.receivables().filter((r) => r.businessId === b);
  assert.equal(rows.length, 2, "two currencies produced one row");
  for (const r of rows) {
    assert.ok(["KES", "USD"].includes(r.currency), `a row has no currency: ${r.currency}`);
  }
  const kes = rows.find((r) => r.currency === "KES")!;
  const usd = rows.find((r) => r.currency === "USD")!;
  assert.equal(kes.issued, 100_000);
  assert.equal(usd.issued, 500);
  assert.notEqual(kes.issued, 100_500, "the two were added together");
});

test("a book-currency total is offered only when every rate exists", async () => {
  const { recordRate } = await import("../src/domain/fx.js");
  recordRate({ from: "USD", to: "KES", rate: 100, quotedOn: "2026-01-01" });

  const b = newBusiness();
  await issue(b, [{ unitPrice: 100_000 }], { number: "TOT-1", currency: "KES" });
  await issue(b, [{ unitPrice: 10 }], { number: "TOT-2", currency: "USD" });

  const totals = I.receivableTotals("2026-06-01");
  assert.equal(totals.bookTotal?.currency, "KES");
  assert.equal(totals.byCurrency.length >= 2, true, "the per-currency breakdown is the real output");
});

test("a currency with no rate stops the total rather than producing one", async () => {
  const b = newBusiness();
  await issue(b, [{ unitPrice: 100_000 }], { number: "NOTOT-1", currency: "KES" });
  await issue(b, [{ unitPrice: 10 }], { number: "NOTOT-2", currency: "TZS" });

  const totals = I.receivableTotals("2026-06-01");
  assert.equal(totals.bookTotal, null, "a total was produced without a rate for every currency");
  assert.match(String(totals.cannotTotal), /No KES total is shown/);
  assert.match(String(totals.cannotTotal), /TZS/);
});
