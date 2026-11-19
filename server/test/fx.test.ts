import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Currencies.
 *
 * The property that matters is negative: nothing here may ever quietly succeed with
 * the wrong answer. A mixed-currency total is the kind of mistake that produces no
 * error, no warning and a confidently wrong number — so the tests are mostly about
 * refusals, and about the absence of a default.
 */
const DB = resolve(process.cwd(), "db/test-fx.db");
process.env.ZP_DB = DB;

let client: typeof import("../src/db/client.js");
let F: typeof import("../src/domain/fx.js");
let INHERITED_CURRENCY_FOR_TEST: Record<string, string>;

before(async () => {
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
  client = await import("../src/db/client.js");
  const { migrate } = await import("../src/db/migrations.js");
  F = await import("../src/domain/fx.js");
  INHERITED_CURRENCY_FOR_TEST = F.INHERITED_CURRENCY;
  migrate();
});

after(() => {
  client.closeDb();
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
});

/* -------------------------------------------------------------------------- */
/* Recording                                                                    */
/* -------------------------------------------------------------------------- */

test("a rate is recorded against a day and a direction", () => {
  F.recordRate({ from: "USD", to: "KES", rate: 129.5, quotedOn: "2026-08-01", source: "bank" });
  const q = F.rateOn("USD", "KES", "2026-08-01");
  assert.equal(q.rate, 129.5);
  assert.equal(q.quotedOn, "2026-08-01");
  assert.equal(q.source, "bank");
});

test("a currency cannot have a rate against itself", () => {
  assert.throws(
    () => F.recordRate({ from: "KES", to: "KES", rate: 1, quotedOn: "2026-08-01" }),
    /against itself/,
  );
});

test("a rate of zero or less is refused", () => {
  assert.throws(() => F.recordRate({ from: "USD", to: "KES", rate: 0, quotedOn: "2026-08-01" }), /more than zero/);
  assert.throws(
    () => F.recordRate({ from: "USD", to: "KES", rate: -5, quotedOn: "2026-08-01" }),
    /more than zero/,
  );
});

test("an unknown currency is named, not accepted", () => {
  assert.throws(() => F.recordRate({ from: "XYZ", to: "KES", rate: 1, quotedOn: "2026-08-01" }), /Pick a currency/);
});

test("quoting the same day again corrects it rather than duplicating it", () => {
  // Two sources quoting one day is a correction. Keeping both would leave two
  // true-looking rows for one day, and which one a report used would be a coin toss.
  F.recordRate({ from: "GBP", to: "USD", rate: 1.27, quotedOn: "2026-08-01", source: "first" });
  F.recordRate({ from: "GBP", to: "USD", rate: 1.29, quotedOn: "2026-08-01", source: "second" });

  assert.equal(client.num("SELECT COUNT(*) FROM fx_rates WHERE from_code='GBP' AND quoted_on='2026-08-01'"), 1);
  assert.equal(F.rateOn("GBP", "USD", "2026-08-01").rate, 1.29);
  assert.equal(F.rateOn("GBP", "USD", "2026-08-01").source, "second");
});

/* -------------------------------------------------------------------------- */
/* The rule this module exists for                                              */
/* -------------------------------------------------------------------------- */

test("a missing rate is refused, never assumed to be one", () => {
  // The catastrophic case. There is no default of 1.0 and no "they're close enough":
  // a shilling figure added to a dollar figure as though they were the same raises
  // nothing at all and looks like any other total.
  assert.throws(
    () => F.convert(100_000, "TZS", "USD", "2026-08-01"),
    /No exchange rate/,
    "a missing rate was treated as a rate of one",
  );
  assert.throws(() => F.convert(100_000, "TZS", "USD", "2026-08-01"), /record the rate for that date/);
});

test("a rate recorded the other way round is named as a data-entry gap", () => {
  assert.throws(
    () => F.convert(100, "KES", "USD", "2026-08-15"),
    /recorded as USD→KES/,
    "the reverse pair exists and the reader was not told",
  );
});

test("the same currency needs no rate at all", () => {
  assert.equal(F.convert(1234.56, "KES", "KES", "2026-08-01"), 1234.56);
  assert.equal(F.rateOn("KES", "KES", "2026-08-01").source, "identity");
});

/* -------------------------------------------------------------------------- */
/* Dated rates                                                                  */
/* -------------------------------------------------------------------------- */

test("a conversion uses the rate of its own day, not today's", () => {
  F.recordRate({ from: "EUR", to: "USD", rate: 1.10, quotedOn: "2026-01-15" });
  F.recordRate({ from: "EUR", to: "USD", rate: 1.05, quotedOn: "2026-09-01" });

  assert.equal(F.convert(1000, "EUR", "USD", "2026-01-20"), 1100, "the January rate");
  assert.equal(F.convert(1000, "EUR", "USD", "2026-09-15"), 1050, "the September rate");
});

test("a rate from after the date is not used to convert it", () => {
  // Converting last April's figure at June's rate is not a conversion, it is a
  // restatement of the past using hindsight.
  F.recordRate({ from: "TZS", to: "USD", rate: 0.0004, quotedOn: "2026-06-01" });
  assert.throws(() => F.convert(1_000_000, "TZS", "USD", "2026-04-30"), /No exchange rate/);
  assert.equal(F.convert(1_000_000, "TZS", "USD", "2026-06-02"), 400, "and it works from the day it exists");
});

test("a rate is carried forward from the most recent day before it", () => {
  F.recordRate({ from: "EUR", to: "KES", rate: 170, quotedOn: "2026-01-15" });
  assert.equal(F.convert(100, "EUR", "KES", "2026-08-30"), 17_000);
  assert.equal(F.rateOn("EUR", "KES", "2026-08-30").quotedOn, "2026-01-15", "and says which day it used");
});

test("a stale rate still converts, because that is the rate for the day", () => {
  // A conversion for last year is supposed to use last year's rate however old it now
  // looks. Refusing it would make historical reporting impossible; substituting
  // today's rate would restate the past.
  F.recordRate({ from: "GBP", to: "KES", rate: 175, quotedOn: "2025-01-06" });
  const q = F.rateOn("GBP", "KES", "2026-09-01");
  assert.equal(q.stale, true, "but it is flagged");
  assert.equal(q.rate, 175);
  assert.equal(F.convert(100, "GBP", "KES", "2026-09-01"), 17_500);
});

/* -------------------------------------------------------------------------- */
/* Rounding                                                                     */
/* -------------------------------------------------------------------------- */

test("a conversion is rounded once, at the end", () => {
  F.recordRate({ from: "USD", to: "KES", rate: 129.4567, quotedOn: "2026-08-01" });
  // 0.1 * 129.4567 = 12.94567, which must be 12.95 and not 12.94 or 12.96.
  assert.equal(F.convert(0.1, "USD", "KES", "2026-08-01"), 12.95);
});

test("converted figures still sum to the converted total", () => {
  F.recordRate({ from: "USD", to: "KES", rate: 129.5, quotedOn: "2026-08-01" });
  const parts = [0.1, 0.1, 0.1, 0.1, 0.1].map((a) => F.convert(a, "USD", "KES", "2026-08-01"));
  const roundedTotal = F.convert(0.5, "USD", "KES", "2026-08-01");
  assert.equal(
    Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100,
    roundedTotal,
    "rounding each part separately drifted away from the total",
  );
});

/* -------------------------------------------------------------------------- */
/* Mixed currencies                                                             */
/* -------------------------------------------------------------------------- */

test("amounts are totalled per currency and never added together", () => {
  const totals = F.totalByCurrency([
    { amount: 1000, currency: "KES" },
    { amount: 500, currency: "KES" },
    { amount: 50, currency: "USD" },
  ]);
  assert.deepEqual(totals, [
    { currency: "KES", amount: 1500 },
    { currency: "USD", amount: 50 },
  ]);
});

test("asking for one total across currencies is refused, with the sum spelled out", () => {
  assert.throws(
    () =>
      F.singleCurrencyTotal([
        { amount: 1000, currency: "KES" },
        { amount: 50, currency: "USD" },
      ]),
    /mixes 2 currencies/,
  );
  assert.throws(
    () =>
      F.singleCurrencyTotal([
        { amount: 1000, currency: "KES" },
        { amount: 50, currency: "USD" },
      ]),
    /KES 1,000 \+ USD 50/,
    "the refusal did not say what was being mixed",
  );
});

test("one currency totals fine", () => {
  assert.deepEqual(
    F.singleCurrencyTotal([
      { amount: 1000, currency: "KES" },
      { amount: 250, currency: "KES" },
    ]),
    { currency: "KES", amount: 1250 },
  );
});

/* -------------------------------------------------------------------------- */
/* The book currency                                                            */
/* -------------------------------------------------------------------------- */

test("the book currency is a setting, and defaults to a real currency", () => {
  assert.equal(F.bookCurrency(), "KES", "with nothing set, it says KES rather than nothing");
  assert.equal(F.setBookCurrency("usd"), "USD", "and it is not case sensitive");
  assert.equal(F.bookCurrency(), "USD");
  F.setBookCurrency("KES");
});

test("converting into the book currency needs a rate like any other", () => {
  F.setBookCurrency("KES");
  assert.equal(F.toBookCurrency(100, "KES", "2026-08-01"), 100);
  assert.equal(F.toBookCurrency(100, "EUR", "2026-09-01"), 17_000, "EUR→KES exists, so this converts");

  // Change the book's currency and the gap moves. KES→USD was never recorded, and
  // switching the book currency does not conjure one.
  F.setBookCurrency("USD");
  assert.equal(F.bookCurrency(), "USD");
  // The refusal names the specific gap: the pair exists the other way round, which is
  // a data-entry fix rather than a plain absence.
  assert.throws(() => F.toBookCurrency(100, "KES", "2026-09-01"), /recorded as USD→KES/);
  F.setBookCurrency("KES");
});

/* -------------------------------------------------------------------------- */
/* Freshness                                                                    */
/* -------------------------------------------------------------------------- */

test("a rate nobody has refreshed is flagged, not refused", () => {
  // Staleness is only reported for currencies something is actually recorded in, so
  // the currency needs a real user for the flag to be meaningful.
  const ts = client.now();
  client.run(
    `INSERT INTO businesses (name, status, relationship_type, served, reporting_currency, created_at, updated_at, rev)
     VALUES ('Tanzania Co', 'active', 'client', 0, 'TZS', ?, ?, 1)`,
    [ts, ts],
  );
  F.recordRate({ from: "TZS", to: "KES", rate: 0.39, quotedOn: "2020-01-01" });
  const stale = F.staleRates("2026-09-01");
  const row = stale.find((s) => s.from === "TZS" && s.to === "KES");
  assert.ok(row, "a six-year-old rate was not flagged");
  assert.ok((row?.ageDays ?? 0) > 365);
  // And it is only a warning: the rate is still the rate for that day.
  assert.equal(F.convert(1000, "TZS", "KES", "2020-02-01"), 390);
});

test("only rates for currencies actually in use are checked for staleness", () => {
  // An unused pair going stale is nobody's problem, and reporting it trains people to
  // ignore the warning that matters.
  const inUse = F.currenciesInUse();
  for (const s of F.staleRates("2026-09-01")) {
    assert.ok(
      inUse.has(s.from) || inUse.has(s.to),
      `${s.from}/${s.to} is stale but neither currency is used`,
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Audit                                                                        */
/* -------------------------------------------------------------------------- */

test("no money column is left with an undeclared currency", () => {
  // A column of amounts beside a `currency` column on some *other* row is how a shilling
  // figure and a dollar figure end up in one column with nothing to tell them apart.
  const audit = F.currencyAudit();
  assert.deepEqual(audit.offenders, []);
  assert.deepEqual(audit.brokenDeclarations, [], "a declared currency path no longer exists");
  assert.ok(audit.inherited > 0, "the audit found nothing to inherit, so it is not looking");
});

test("every declared currency path still resolves to a real column", () => {
  // A declaration whose target has been renamed is worse than no declaration, because
  // somebody has been relying on it. The audit is what makes that visible.
  const audit = F.currencyAudit();
  for (const declaration of Object.keys(INHERITED_CURRENCY_FOR_TEST)) {
    assert.ok(
      !audit.brokenDeclarations.some((b) => b.startsWith(`${declaration}:`)),
      `${declaration} was declared against something that does not exist`,
    );
  }
});

test("the catalogue has no currency of its own, which is a known limitation", () => {
  // `service_variants.rate` is declared against the book currency because there is no
  // per-service currency. That is a decision, not an oversight, and the audit reports
  // it as inherited rather than quietly treating it as fine.
  assert.ok(INHERITED_CURRENCY_FOR_TEST["service_variants.rate"], "the catalogue price has no declared currency");
  const hasOwn =
    client.num(
      "SELECT COUNT(*) FROM pragma_table_info('service_variants') WHERE name IN ('currency','reporting_currency')",
    ) > 0;
  assert.equal(hasOwn, false, "if the catalogue gained a currency column, this declaration should be revisited");
});
test("a tally of businesses and invoices is not silently zero", () => {
  // `COUNT(*)` names its column after the expression. Reading a fixed property off it
  // returns undefined, and every tally in this module reads zero — which is
  // indistinguishable from "nothing has happened yet", the least useful thing a count
  // can report.
  const ts = client.now();
  client.run(
    `INSERT INTO businesses (name, status, relationship_type, served, reporting_currency, created_at, updated_at, rev)
     VALUES ('Counted Co', 'active', 'client', 0, 'GBP', ?, ?, 1)`,
    [ts, ts],
  );

  const p = F.currencyPosition();
  const gbp = p.inUse.find((c) => c.currency === "GBP");
  assert.ok(gbp, "GBP is not reported as in use");
  assert.equal(gbp?.businesses, 1, "a business that exists was counted as none");
});
