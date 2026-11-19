import { all, now, num, one, run, tx } from "../db/client.js";
import { money } from "@zainpreneur/shared";
import { principalEquity } from "./principal.js";
import { bookCurrency as bookCurrency_, convert } from "./fx.js";
import { fail } from "../lib/validate.js";

/**
 * What the client owes.
 *
 * This is the second money ledger in the book, and the one that is easiest to get
 * wrong in ways nobody notices until a client queries an invoice:
 *
 *   **Money owed to Zainpreneur is never added to money received from it.** A
 *   dividend received and an invoice paid are unrelated facts. The original had a
 *   `revenue` column settable on any business, with no invoice behind it.
 *
 *   **A line's rate is copied, not joined.** Raising a price re-prices the pipeline
 *   and leaves every issued invoice saying what it said.
 *
 *   **The lines sum to the total exactly.** Rounding each line independently and
 *   summing the results is how an invoice ends up a cent away from its own total, and
 *   a total that disagrees with its own lines is not a total.
 */

/* -------------------------------------------------------------------------- */
/* Rounding                                                                     */
/* -------------------------------------------------------------------------- */

/** Money as integer cents. The only place floats are allowed to become money. */
const cents = (value: number): number => Math.round(value * 100);

/**
 * Split an amount across weights so the parts add back to it *exactly*.
 *
 * Rounding each share on its own and summing the results does not give the original
 * back: 33.33 three ways is 99.99, and an invoice whose total disagrees with its lines
 * is an invoice nobody can reconcile. So the largest-remainder method gives the extra
 * cents to whoever was robbed by the rounding, and the last part absorbs whatever is
 * left over — belt and braces, because a penny of drift is still drift.
 */
export function allocate(amount: number, weights: number[]): number[] {
  const total = cents(amount);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (weightSum <= 0) {
    // Nothing to weight by: put everything on the first part rather than divide by
    // zero, and let the caller see the whole amount rather than nothing.
    return weights.map((_, i) => (i === 0 ? total : 0));
  }

  const exact = weights.map((w) => (total * w) / weightSum);
  const floors = exact.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);

  // Who was shorted the most, in whole cents.
  const order = exact
    .map((e, i) => ({ i, gap: e - Math.floor(e) }))
    .sort((a, b) => b.gap - a.gap || a.i - b.i);

  const out = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    remainder--;
  }
  // If rounding still left a gap, the last part absorbs it so the sum is guaranteed.
  if (remainder !== 0) {
    const last = out.length - 1;
    out[last] = (out[last] ?? 0) + remainder;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Lines                                                                        */
/* -------------------------------------------------------------------------- */

export interface LineInput {
  variantId?: unknown;
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  pricingModel?: unknown;
  discount?: unknown;
  taxRate?: unknown;
}

/** One billed thing, priced. Subtotal is gross of discount; total is net of tax. */
export function priceLine(line: LineInput): {
  quantity: number;
  unitPrice: number | null;
  pricingModel: string;
  discount: number;
  taxRate: number | null;
  taxAmount: number | null;
  subtotal: number;
  total: number;
} {
  const quantity = Number(line.quantity ?? 1);
  if (!Number.isFinite(quantity) || quantity < 0) fail("quantity", "A quantity cannot be negative");

  const hasPrice = line.unitPrice !== undefined && line.unitPrice !== null && line.unitPrice !== "";
  const unitPrice = hasPrice ? money(Number(line.unitPrice)) : null;
  if (hasPrice && !Number.isFinite(Number(line.unitPrice))) fail("unit_price", "A price must be a number");

  // Everything below is done in cents and converted back once, at the end. Mixing the
  // two is how a tax of 16% on 250,000 comes out as 400000000, and how a discount
  // larger than its own line slips past the check that is meant to catch it.
  const grossCents = cents((unitPrice ?? 0) * quantity);

  const discount = money(Math.max(0, Number(line.discount ?? 0)));
  if (!Number.isFinite(discount)) fail("discount", "A discount must be a number");
  const discountCents = cents(discount);
  if (discountCents > grossCents) fail("discount", "A discount cannot be more than the line it discounts");

  const netCents = grossCents - discountCents;

  const hasTax = line.taxRate !== undefined && line.taxRate !== null && line.taxRate !== "";
  const taxRate = hasTax ? Number(line.taxRate) : null;
  if (hasTax && (!Number.isFinite(taxRate as number) || (taxRate as number) < 0)) {
    fail("tax_rate", "A tax rate cannot be negative");
  }
  const taxCents = taxRate === null ? null : Math.round((netCents * (taxRate as number)) / 100);

  return {
    quantity,
    unitPrice,
    pricingModel: String(line.pricingModel ?? "fixed"),
    discount,
    taxRate,
    taxAmount: taxCents === null ? null : money(taxCents / 100),
    subtotal: money(netCents / 100),
    total: money((netCents + (taxCents ?? 0)) / 100),
  };
}

/* -------------------------------------------------------------------------- */
/* Issuing                                                                      */
/* -------------------------------------------------------------------------- */

export interface IssueInvoiceInput {
  number?: unknown;
  businessId: number;
  requestId?: unknown;
  currency?: unknown;
  issuedOn: unknown;
  dueOn?: unknown;
  note?: unknown;
  lines: LineInput[];
}

/**
 * Raise an invoice.
 *
 * The number is required rather than generated: an automatic sequence would quietly
 * fill a gap left by a deleted draft, and a gap in an invoice series is the first thing
 * an auditor asks about.
 */
export async function issueInvoice(data: IssueInvoiceInput) {
  const number = String(data.number ?? "").trim();
  if (!number) fail("number", "An invoice needs a number");
  const businessId = Number(data.businessId);
  if (!Number.isFinite(businessId) || !one("SELECT 1 FROM businesses WHERE id = ?", [businessId])) {
    fail("business_id", "That business is not in the register");
  }

  // You cannot invoice a business you wholly own. Charging yourself for advisory is
  // intercompany, which is a different ledger with different rules — and billing it
  // here would show Zainpreneur owing Zainpreneur money, which is the sort of thing
  // that gets "fixed" later by deleting the invoice.
  const held = principalEquity(businessId);
  if (held >= 100) {
    fail(
      "business_id",
      "Zainpreneur wholly owns this business, so a fee would be intercompany — raise it as an intercompany charge (POST /api/intercompany-charges), not an invoice",
    );
  }
  const issuedOn = String(data.issuedOn ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)) fail("issued_on", "An invoice needs a date as YYYY-MM-DD");

  const dueOn = String(data.dueOn ?? "").trim();
  if (dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) fail("due_on", "A due date needs to be YYYY-MM-DD");
  if (dueOn && dueOn < issuedOn) fail("due_on", "An invoice cannot fall due before it is issued");

  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    fail("lines", "An invoice needs at least one line");
  }
  for (const l of data.lines) {
    if (l.unitPrice === undefined || l.unitPrice === null || l.unitPrice === "") {
      fail("unit_price", "Every line needs a price — a quote is priced before it is invoiced");
    }
  }

  const priced = data.lines.map(priceLine);
  const ts = now();

  return await tx(async (db) => {
    if (one("SELECT 1 FROM invoices WHERE number = ?", [number])) {
      fail("number", `Invoice ${number} already exists`);
    }
    const cur = db
      .prepare(
        `INSERT INTO invoices
           (number, business_id, request_id, currency, issued_on, due_on, note,
            voided_on, void_note, created_at, updated_at, rev)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, '', ?, ?, 1)`,
      )
      .run(
        number,
        businessId,
        data.requestId ? Number(data.requestId) : null,
        String(data.currency ?? ""),
        issuedOn,
        dueOn || null,
        String(data.note ?? ""),
        ts,
        ts,
      );
    const invoiceId = Number(cur.lastInsertRowid);

    const insert = db.prepare(
      `INSERT INTO invoice_lines
         (invoice_id, variant_id, description, quantity, unit_price, pricing_model,
          discount, tax_rate, tax_amount, subtotal, total, position, created_at, updated_at, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    );
    priced.forEach((p, i) => {
      const l = data.lines[i] as LineInput;
      insert.run(
        invoiceId,
        l.variantId ? Number(l.variantId) : null,
        String(l.description ?? ""),
        p.quantity,
        p.unitPrice,
        p.pricingModel,
        p.discount,
        p.taxRate,
        p.taxAmount,
        p.subtotal,
        p.total,
        i,
        ts,
        ts,
      );
    });

    return invoiceId;
  });
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                      */
/* -------------------------------------------------------------------------- */

export interface InvoiceLine {
  id: number;
  variantId: number | null;
  description: string;
  quantity: number;
  unitPrice: number | null;
  pricingModel: string;
  discount: number;
  taxRate: number | null;
  taxAmount: number | null;
  subtotal: number;
  total: number;
}

export interface Invoice {
  id: number;
  number: string;
  businessId: number;
  businessName: string;
  requestId: number | null;
  currency: string;
  issuedOn: string;
  dueOn: string | null;
  note: string;
  voidedOn: string | null;
  lines: InvoiceLine[];
  tax: number;
  total: number;
  paid: number;
  credited: number;
  outstanding: number;
  /**
   * Paid more than owed. A distinct fact, not a negative: "this client is in credit"
   * and "this client owes nothing" are different answers, and reporting the first as
   * the second is how a credit gets spent twice.
   */
  overpaid: number;
  /** Payments and credit notes, oldest first. */
  movements: Array<{ on: string; amount: number; kind: "payment" | "credit"; method?: string; reference?: string }>;
  /** Overdue, and by how long — only for an issued invoice that is not settled. */
  daysOverdue: number | null;
  status: InvoiceStatus;
}

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "part_paid"
  | "paid"
  | "overpaid"
  | "credited"
  | "void";

/**
 * The status, worked out every time it is read.
 *
 * Nothing here is stored. A stored status is a second opinion about payments and
 * credit notes, and it is wrong the moment a payment lands without anybody updating
 * it — which is how invoices come to read "unpaid" while sitting fully settled.
 */
export function invoiceStatus(a: {
  voidedOn: string | null;
  total: number;
  paid: number;
  credited: number;
}): InvoiceStatus {
  if (a.voidedOn) return "void";
  const settled = money(a.paid + a.credited);
  const outstanding = money(a.total - settled);
  // Overpaid is checked first: a client who has sent more than the total is in credit,
  // which is a different answer from "paid", even though both are money received.
  if (outstanding < 0) return "overpaid";
  if (outstanding > 0) return a.paid > 0 || a.credited > 0 ? "part_paid" : "issued";
  // Fully settled: a credit note closed it out, so it was not paid.
  return a.credited > 0 ? "credited" : "paid";
}

export function readInvoice(invoiceId: number): Invoice | null {
  const inv = one<Record<string, unknown>>(
    `SELECT i.*, b.name AS business_name FROM invoices i
       JOIN businesses b ON b.id = i.business_id
      WHERE i.id = ? AND i.deleted_at IS NULL`,
    [invoiceId],
  );
  if (!inv) return null;

  const lines = all<Record<string, unknown>>(
    "SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY position, id",
    [invoiceId],
  ).map(
    (l): InvoiceLine => ({
      id: Number(l.id),
      variantId: l.variant_id === null ? null : Number(l.variant_id),
      description: String(l.description ?? ""),
      quantity: Number(l.quantity ?? 0),
      unitPrice: l.unit_price === null ? null : money(Number(l.unit_price)),
      pricingModel: String(l.pricing_model ?? "fixed"),
      discount: money(Number(l.discount ?? 0)),
      taxRate: l.tax_rate === null ? null : Number(l.tax_rate),
      taxAmount: l.tax_amount === null ? null : money(Number(l.tax_amount)),
      subtotal: money(Number(l.subtotal ?? 0)),
      total: money(Number(l.total ?? 0)),
    }),
  );

  const payments = all<{ paid_on: string; amount: number; method: string; reference: string }>(
    "SELECT paid_on, amount, method, reference FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_on, id",
    [invoiceId],
  );
  const credits = all<{ issued_on: string; amount: number }>(
    "SELECT issued_on, amount FROM credit_notes WHERE invoice_id = ? ORDER BY issued_on, id",
    [invoiceId],
  );

  const movements: Invoice["movements"] = [
    ...payments.map((p) => ({
      on: String(p.paid_on),
      amount: money(Number(p.amount)),
      kind: "payment" as const,
      method: String(p.method ?? ""),
      reference: String(p.reference ?? ""),
    })),
    ...credits.map((c) => ({
      on: String(c.issued_on),
      amount: money(Number(c.amount)),
      kind: "credit" as const,
    })),
  ].sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));

  const total = money(lines.reduce((s, l) => s + l.total, 0));
  const tax = money(lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0));
  const paid = money(payments.reduce((s, p) => s + Number(p.amount ?? 0), 0));
  const credited = money(credits.reduce((s, c) => s + Number(c.amount ?? 0), 0));
  const outstanding = money(total - paid - credited);

  const voidedOn = inv.voided_on === null || inv.voided_on === undefined ? null : String(inv.voided_on);
  const dueOn = inv.due_on === null || inv.due_on === undefined ? null : String(inv.due_on);

  // A voided invoice is a document that was cancelled, not a bill. It keeps its lines
  // and its number for the audit trail, but nobody owes it and it is not revenue —
  // leaving `outstanding` at the face value made cancelling an invoice do nothing to
  // what the client was said to owe.
  const rawOutstanding = voidedOn === null ? money(total - paid - credited) : 0;

  return {
    id: Number(inv.id),
    number: String(inv.number),
    businessId: Number(inv.business_id),
    businessName: String(inv.business_name ?? ""),
    requestId: inv.request_id === null ? null : Number(inv.request_id),
    currency: String(inv.currency ?? ""),
    issuedOn: String(inv.issued_on),
    dueOn,
    note: String(inv.note ?? ""),
    voidedOn,
    lines,
    tax,
    total,
    paid,
    credited,
    outstanding: rawOutstanding > 0 ? rawOutstanding : 0,
    overpaid: voidedOn === null && rawOutstanding < 0 ? money(-rawOutstanding) : 0,
    movements,
    daysOverdue:
      voidedOn === null && outstanding > 0 && dueOn !== null && dueOn < today()
        ? daysBetween(dueOn, today())
        : null,
    status: invoiceStatus({ voidedOn, total, paid, credited }),
  };
}

export function listInvoices(businessId?: number): Invoice[] {
  const ids = businessId
    ? all<{ id: number }>(
        "SELECT id FROM invoices WHERE business_id = ? AND deleted_at IS NULL ORDER BY issued_on DESC, id DESC",
        [businessId],
      )
    : all<{ id: number }>(
        "SELECT id FROM invoices WHERE deleted_at IS NULL ORDER BY issued_on DESC, id DESC",
      );
  return ids.map((r) => readInvoice(r.id)).filter((i): i is Invoice => i !== null);
}

/* -------------------------------------------------------------------------- */
/* Settling                                                                     */
/* -------------------------------------------------------------------------- */

export async function recordPayment(data: {
  invoiceId: number;
  amount: unknown;
  paidOn?: unknown;
  method?: unknown;
  reference?: unknown;
}) {
  const invoiceId = Number(data.invoiceId);
  const inv = readInvoice(invoiceId);
  if (!inv) fail("invoice_id", "That invoice does not exist");
  if (inv.voidedOn) fail("invoice_id", `Invoice ${inv.number} was voided — it cannot be paid`);

  const amount = money(Number(data.amount ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) fail("amount", "A payment must be more than nothing");

  // Overpayment is allowed and kept: a client who pays too much is in credit, and
  // refusing the payment would make the money unaccounted for.
  const paidOn = String(data.paidOn ?? today()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) fail("paid_on", "A payment needs a date as YYYY-MM-DD");

  const ts = now();
  await tx(async (db) => {
    db.prepare(
      `INSERT INTO invoice_payments (invoice_id, paid_on, amount, method, reference, created_at, updated_at, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    ).run(
      invoiceId,
      paidOn,
      amount,
      String(data.method ?? "cash"),
      String(data.reference ?? ""),
      ts,
      ts,
    );
  });
  return readInvoice(invoiceId) as Invoice;
}

export async function issueCreditNote(data: {
  invoiceId: number;
  number?: unknown;
  amount: unknown;
  issuedOn?: unknown;
  reason?: unknown;
}) {
  const invoiceId = Number(data.invoiceId);
  const inv = readInvoice(invoiceId);
  if (!inv) fail("invoice_id", "That invoice does not exist");
  if (inv.voidedOn) fail("invoice_id", `Invoice ${inv.number} was voided — there is nothing to credit`);

  const number = String(data.number ?? "").trim();
  if (!number) fail("number", "A credit note needs a number");
  if (one("SELECT 1 FROM credit_notes WHERE number = ?", [number])) {
    fail("number", `Credit note ${number} already exists`);
  }

  const amount = money(Number(data.amount ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) fail("amount", "A credit note must be more than nothing");

  // A credit that exceeds what is owed would put the client in credit, which is a
  // refund decision and not something a credit note should be able to do by accident.
  const stillOwed = money(inv.outstanding - inv.overpaid);
  if (amount > stillOwed) {
    fail("amount", `That is more than the ${stillOwed} still owed — a refund is not a credit note`);
  }

  const issuedOn = String(data.issuedOn ?? today()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)) fail("issued_on", "A credit note needs a date as YYYY-MM-DD");

  const ts = now();
  await tx(async (db) => {
    db.prepare(
      `INSERT INTO credit_notes (number, invoice_id, issued_on, amount, reason, created_at, updated_at, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    ).run(number, invoiceId, issuedOn, amount, String(data.reason ?? ""), ts, ts);
  });
  return readInvoice(invoiceId) as Invoice;
}

/** Voiding keeps the invoice and its number. Deleting it would let the number be reused. */
export async function voidInvoice(data: { invoiceId: number; on?: unknown; note?: unknown }) {
  const invoiceId = Number(data.invoiceId);
  const inv = readInvoice(invoiceId);
  if (!inv) fail("invoice_id", "That invoice does not exist");
  if (inv.voidedOn) fail("invoice_id", `Invoice ${inv.number} was already voided`);

  const paid = money(inv.paid);
  if (paid > 0) {
    fail(
      "invoice_id",
      `Invoice ${inv.number} has ${paid} paid against it — issue a credit note instead of voiding it`,
    );
  }

  const on = String(data.on ?? today()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) fail("voided_on", "A void needs a date as YYYY-MM-DD");
  run(
    "UPDATE invoices SET voided_on = ?, void_note = ?, updated_at = ?, rev = rev + 1 WHERE id = ?",
    [on, String(data.note ?? ""), now(), invoiceId],
  );
  return readInvoice(invoiceId) as Invoice;
}

/* -------------------------------------------------------------------------- */
/* Receivables                                                                  */
/* -------------------------------------------------------------------------- */

export interface Receivable {
  businessId: number;
  businessName: string;
  issued: number;
  paid: number;
  credited: number;
  outstanding: number;
  overdue: number;
  oldestOverdueDays: number | null;
  /**
   * The currency every figure on this row is in.
   *
   * A row is per currency *and* per business. That pairing is the whole point: a client
   * billed in both dollars and shillings produces two rows, because adding them would
   * produce a figure that means nothing.
   */
  currency: string;
}

export interface ReceivableTotals {
  /** One entry per currency. There is deliberately no grand total field. */
  byCurrency: Array<{ currency: string; issued: number; paid: number; credited: number; outstanding: number; overdue: number }>;
  /**
   * Whether every currency involved has a rate into the book's currency on the date
   * asked for. When this is false there is no single total to show, and the reason is
   * given rather than papered over.
   */
  bookTotal: { currency: string; issued: number; paid: number; outstanding: number; overdue: number } | null;
  bookCurrency: string;
  /** Why there is no single total, if there isn't one. */
  cannotTotal: string | null;
}

/**
 * What every client owes, from live invoices.
 *
 * Derived by reading the invoices rather than kept in a running total on the
 * business. A stored balance is right until the first payment lands, and then it is
 * wrong in the direction nobody looks — and voiding or crediting an invoice is exactly
 * the moment a stored total forgets to change.
 */
export function receivables(): Receivable[] {
  const invoices = listInvoices();
  const byBusiness = new Map<string, Receivable>();

  for (const inv of invoices) {
    // Voided invoices are excluded outright: they are not outstanding revenue, and
    // counting them meant voiding one changed nothing in the receivables report.
    if (inv.voidedOn !== null) continue;
    // Keyed by currency *and* business. Keying on the business alone was the bug this
    // comment exists to prevent: it summed dollars into shillings and reported a total
    // that was confidently wrong, with nothing in the report to say so.
  const key = `${inv.businessId}:${inv.currency}`;
  const row =
      byBusiness.get(key) ??
      ({
        businessId: inv.businessId,
        businessName: inv.businessName,
        issued: 0,
        paid: 0,
        credited: 0,
        outstanding: 0,
        overdue: 0,
        oldestOverdueDays: null,
        currency: inv.currency,
      } satisfies Receivable);
    row.issued = money(row.issued + inv.total);
    row.paid = money(row.paid + inv.paid);
    row.credited = money(row.credited + inv.credited);
    row.outstanding = money(row.outstanding + inv.outstanding);
    row.overdue = money(row.overdue + (inv.daysOverdue === null ? 0 : inv.outstanding));
    if (inv.daysOverdue !== null && (row.oldestOverdueDays === null || inv.daysOverdue > row.oldestOverdueDays)) {
      row.oldestOverdueDays = inv.daysOverdue;
    }
    if (!row.currency && inv.currency) row.currency = inv.currency;
    byBusiness.set(key, row);
  }

  return [...byBusiness.values()].sort(
    (a, b) => b.outstanding - a.outstanding || a.currency.localeCompare(b.currency),
  );
}

/**
 * The position, per currency, and one total only if every currency can be converted.
 *
 * The second half is the important one. A single receivables figure is what every reader
 * wants, so it is offered the moment it is possible — and refused, with the reason, the
 * moment it is not. What is never offered is a total assembled by adding currencies
 * together.
 */
export function receivableTotals(on?: string): ReceivableTotals {
  const rows = receivables();
  const bookCurrency = bookCurrency_();
  const date = String(on ?? new Date().toISOString().slice(0, 10));

  const grouped = new Map<string, { issued: number; paid: number; credited: number; outstanding: number; overdue: number }>();
  for (const r of rows) {
    const c = r.currency || "UNSET";
    const g = grouped.get(c) ?? { issued: 0, paid: 0, credited: 0, outstanding: 0, overdue: 0 };
    g.issued = money(g.issued + r.issued);
    g.paid = money(g.paid + r.paid);
    g.credited = money(g.credited + r.credited);
    g.outstanding = money(g.outstanding + r.outstanding);
    g.overdue = money(g.overdue + r.overdue);
    grouped.set(c, g);
  }

  const byCurrency = [...grouped.entries()]
    .map(([currency, g]) => ({ currency, ...g }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const foreign = byCurrency.filter((g) => g.currency !== bookCurrency);
  if (foreign.length === 0) {
    const only = byCurrency[0];
    return {
      byCurrency,
      bookTotal: only
        ? { currency: bookCurrency, issued: only.issued, paid: only.paid, outstanding: only.outstanding, overdue: only.overdue }
        : { currency: bookCurrency, issued: 0, paid: 0, outstanding: 0, overdue: 0 },
      bookCurrency,
      cannotTotal: null,
    };
  }

  const totals = { currency: bookCurrency, issued: 0, paid: 0, outstanding: 0, overdue: 0 };
  const missing: string[] = [];
  for (const g of byCurrency) {
    try {
      totals.issued = money(totals.issued + convert(g.issued, g.currency, bookCurrency, date));
      totals.paid = money(totals.paid + convert(g.paid, g.currency, bookCurrency, date));
      totals.outstanding = money(totals.outstanding + convert(g.outstanding, g.currency, bookCurrency, date));
      totals.overdue = money(totals.overdue + convert(g.overdue, g.currency, bookCurrency, date));
    } catch (e) {
      missing.push(`${g.currency} (${(e as Error).message})`);
    }
  }

  return {
    byCurrency,
    bookTotal: missing.length === 0 ? totals : null,
    bookCurrency,
    cannotTotal:
      missing.length === 0
        ? null
        : `No ${bookCurrency} total is shown: no rate for ${missing.join("; ")} on ${date}`,
  };
}

/** One client's position, for the detail view. */
export function businessReceivable(businessId: number): Receivable | null {
  return receivables().find((r) => r.businessId === businessId) ?? null;
}

/* -------------------------------------------------------------------------- */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export { num };