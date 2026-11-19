import { all, now, one, run } from "../db/client.js";
import { CURRENCIES, NO_IMPLICIT_RATE, STALE_RATE_DAYS, money } from "@zainpreneur/shared";
import { fail } from "../lib/validate.js";

/**
 * Currencies.
 *
 * One rule governs this module, and everything else here exists to serve it:
 *
 *   **A conversion either has a rate or it does not happen.**
 *
 * The failure this prevents is not subtle once it happens — a Kenyan shilling figure
 * added to a dollar figure as though they were the same, producing a total that is
 * confidently wrong. It is hard to spot afterwards because nothing raises: there is no
 * error, the arithmetic succeeds, and the number looks like any other. So there is no
 * default rate, no fallback of 1.0, and no "assume they're close enough". A missing
 * rate is refused, and the refusal names what to do about it.
 *
 * The second rule is about honesty in time: a rate belongs to a *day*. Converting a
 * figure from last year at today's rate silently restates the past, so every
 * conversion carries the date it was asked for, and a date with no rate behind it is
 * refused rather than filled in from the nearest available day after it.
 */

const known = new Set<string>(CURRENCIES);

export function isCurrency(code: unknown): code is string {
  return typeof code === "string" && known.has(code.toUpperCase());
}

function currency(code: unknown, field: string): string {
  const c = String(code ?? "").trim().toUpperCase();
  if (!isCurrency(c)) fail(field, `Pick a currency: ${CURRENCIES.join(", ")}`);
  return c;
}

/** The currency the whole book is consolidated into. */
export function bookCurrency(): string {
  const row = one<{ value: string }>("SELECT value FROM settings WHERE key = 'book_currency'", []);
  const set = String(row?.value ?? "").toUpperCase();
  return isCurrency(set) ? set : "KES";
}

export function setBookCurrency(code: unknown): string {
  const c = currency(code, "book_currency");
  run("INSERT OR REPLACE INTO settings (key, value) VALUES ('book_currency', ?)", [c]);
  return c;
}

/* -------------------------------------------------------------------------- */
/* Recording                                                                    */
/* -------------------------------------------------------------------------- */

export interface RecordRateInput {
  from: unknown;
  to: unknown;
  rate: unknown;
  quotedOn: unknown;
  source?: unknown;
}

export function recordRate(data: RecordRateInput): number {
  const from = currency(data.from, "from");
  const to = currency(data.to, "to");
  if (from === to) fail("to", "A currency cannot have a rate against itself");

  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    fail("rate", `A rate is how many ${to} one ${from} buys, so it has to be more than zero`);
  }
  const quotedOn = String(data.quotedOn ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(quotedOn)) fail("quoted_on", "A rate needs a date as YYYY-MM-DD");

  const ts = now();
  // Restated rather than refused: two sources quoting the same day is a correction,
  // and keeping the first number would leave two true-looking rows for one day.
  run(
    `INSERT INTO fx_rates (from_code, to_code, rate, quoted_on, source, created_at, updated_at, rev)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT (from_code, to_code, quoted_on)
     DO UPDATE SET rate = excluded.rate, source = excluded.source, updated_at = excluded.updated_at, rev = rev + 1`,
    [from, to, rate, quotedOn, String(data.source ?? ""), ts, ts],
  );
  return Number(
    one<{ id: number }>("SELECT id FROM fx_rates WHERE from_code = ? AND to_code = ? AND quoted_on = ?", [
      from,
      to,
      quotedOn,
    ])?.id ?? 0,
  );
}

/* -------------------------------------------------------------------------- */
/* Looking up                                                                   */
/* -------------------------------------------------------------------------- */

export interface RateQuote {
  from: string;
  to: string;
  /** How many `to` one `from` buys. */
  rate: number;
  quotedOn: string;
  source: string;
  /** Days between the quote and the date it was used for. */
  ageDays: number;
  stale: boolean;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The rate to use on a given day: the most recent quote on or before it.
 *
 * A quote from *after* the date is refused, not used. A figure dated last April cannot
 * be converted with a rate published in June — that is not a conversion, it is a
 * restatement of the past using hindsight.
 *
 * Triangulation is deliberately not attempted. Deriving KES→USD through a third
 * currency is legitimate accounting, but doing it silently hides the fact that a rate
 * nobody entered is missing, and the gap is what you want to see.
 */
export function rateOn(from: unknown, to: unknown, on: unknown): RateQuote {
  const f = currency(from, "from");
  const t = currency(to, "to");
  const date = String(on ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("on", "A conversion needs a date as YYYY-MM-DD");

  // The same currency needs no rate. Not a special case bolted on — it is the only
  // conversion that is genuinely certain, and pretending otherwise would hide the fact
  // that every other conversion depends on somebody remembering a number.
  if (f === t) {
    return { from: f, to: t, rate: 1, quotedOn: date, source: "identity", ageDays: 0, stale: false };
  }

  const row = one<{ rate: number; quoted_on: string; source: string }>(
    `SELECT rate, quoted_on, source FROM fx_rates
      WHERE from_code = ? AND to_code = ? AND quoted_on <= ?
      ORDER BY quoted_on DESC, id DESC LIMIT 1`,
    [f, t, date],
  );
  if (!row) {
    const inverse = one<{ rate: number; quoted_on: string; source: string }>(
      `SELECT rate, quoted_on, source FROM fx_rates
        WHERE from_code = ? AND to_code = ? AND quoted_on <= ?
        ORDER BY quoted_on DESC, id DESC LIMIT 1`,
      [t, f, date],
    );
    if (inverse) {
      // The pair is recorded the other way round, which is a data-entry problem with a
      // definite fix, so it is named rather than merely reported as missing.
      fail(
        "on",
        `No ${f}→${t} rate on or before ${date}. The pair is recorded as ${t}→${f}; add the ${f}→${t} rate so the direction is explicit`,
      );
    }
    fail("on", `${NO_IMPLICIT_RATE} (looking for ${f}→${t} on or before ${date})`);
  }

  const ageDays = Math.max(0, daysBetween(String(row.quoted_on), date));
  return {
    from: f,
    to: t,
    rate: Number(row.rate),
    quotedOn: String(row.quoted_on),
    source: String(row.source ?? ""),
    ageDays,
    stale: ageDays > STALE_RATE_DAYS,
  };
}

/**
 * Convert an amount, rounding once at the end.
 *
 * A figure is multiplied and divided by rates all over the place in reporting, and
 * rounding at each step is how a converted total drifts a cent from the sum of its
 * parts. The whole calculation happens at full precision and is rounded once.
 */
export function convert(amount: number, from: unknown, to: unknown, on: unknown): number {
  const quote = rateOn(from, to, on);
  if (quote.rate === 1) return money(amount);
  return money(amount * quote.rate);
}

/** Convert into the currency the book is kept in. */
export function toBookCurrency(amount: number, from: unknown, on: unknown): number {
  return convert(amount, from, bookCurrency(), on);
}

/** Convert and say which rate did it, so a figure can be defended. */
export function convertExplained(
  amount: number,
  from: unknown,
  to: unknown,
  on: unknown,
): { amount: number; quote: RateQuote } {
  const quote = rateOn(from, to, on);
  return { amount: quote.rate === 1 ? money(amount) : money(amount * quote.rate), quote };
}

/* -------------------------------------------------------------------------- */
/* Mixed currencies                                                             */
/* -------------------------------------------------------------------------- */

export interface CurrencyTotal {
  currency: string;
  amount: number;
}

/**
 * Total amounts that are each already in their own currency.
 *
 * This function exists to make an error impossible rather than merely discouraged:
 * given a list of `{amount, currency}` it returns **one total per currency** and there
 * is no argument that will make it add them together. A caller that wants a single
 * number has to convert, and `convert` will not proceed without a rate.
 */
export function totalByCurrency(
  entries: Array<{ amount: number; currency: string }>,
): CurrencyTotal[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    const c = String(e.currency ?? "").toUpperCase() || "UNSET";
    totals.set(c, money((totals.get(c) ?? 0) + Number(e.amount ?? 0)));
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * The one total, if and only if everything is already in the same currency.
 *
 * Refused otherwise, with the reason. This is the function a careless caller would
 * otherwise have written by hand, and writing it by hand is exactly how KES ends up
 * added to USD.
 */
export function singleCurrencyTotal(
  entries: Array<{ amount: number; currency: string }>,
  label = "This total",
): { currency: string; amount: number } {
  const totals = totalByCurrency(entries);
  if (totals.length === 0) fail("entries", `${label} has nothing to add up`);
  if (totals.length > 1) {
    const list = totals.map((t) => `${t.currency} ${t.amount.toLocaleString("en-GB")}`).join(" + ");
    fail(
      "entries",
      `${label} mixes ${totals.length} currencies — ${list}. Convert them to one currency on a stated date first`,
    );
  }
  return totals[0] as { currency: string; amount: number };
}

/* -------------------------------------------------------------------------- */
/* Freshness                                                                    */
/* -------------------------------------------------------------------------- */

export interface StaleRate {
  from: string;
  to: string;
  quotedOn: string;
  ageDays: number;
}

/**
 * Rates nobody has refreshed.
 *
 * Only checked for the currencies actually in use, so an unused pair going stale is
 * nobody's problem and does not become noise that trains people to ignore the warning.
 */
export function staleRates(asOf?: string): StaleRate[] {
  const date = String(asOf ?? new Date().toISOString().slice(0, 10));
  const used = currenciesInUse();
  const pairs = all<{ from_code: string; to_code: string }>(
    "SELECT DISTINCT from_code, to_code FROM fx_rates",
  ).filter((p) => used.has(p.from_code) || used.has(p.to_code));

  const out: StaleRate[] = [];
  for (const p of pairs) {
    const last = one<{ quoted_on: string }>(
      `SELECT quoted_on FROM fx_rates WHERE from_code = ? AND to_code = ? ORDER BY quoted_on DESC LIMIT 1`,
      [p.from_code, p.to_code],
    );
    if (!last) continue;
    const age = daysBetween(String(last.quoted_on), date);
    if (age > STALE_RATE_DAYS) {
      out.push({ from: p.from_code, to: p.to_code, quotedOn: String(last.quoted_on), ageDays: age });
    }
  }
  return out.sort((a, b) => b.ageDays - a.ageDays);
}

/** Every currency something is actually recorded in. */
export function currenciesInUse(): Set<string> {
  const used = new Set<string>();
  const business = one<{ c: string }>(
    "SELECT GROUP_CONCAT(DISTINCT reporting_currency) AS c FROM businesses WHERE deleted_at IS NULL AND reporting_currency <> ''",
  );
  const invoice = one<{ c: string }>(
    "SELECT GROUP_CONCAT(DISTINCT currency) AS c FROM invoices WHERE deleted_at IS NULL AND currency <> ''",
  );
  for (const c of [business?.c, invoice?.c]) {
    for (const code of String(c ?? "").split(",")) {
      if (code.trim()) used.add(code.trim().toUpperCase());
    }
  }
  return used;
}

/** The whole position, per currency, with nothing added together. */
export function currencyPosition(): {
  bookCurrency: string;
  inUse: Array<{ currency: string; businesses: number; invoices: number }>;
  rates: RateQuote[];
  stale: StaleRate[];
} {
  const date = new Date().toISOString().slice(0, 10);
  const inUse = [...currenciesInUse()].sort();
  return {
    bookCurrency: bookCurrency(),
    inUse: inUse.map((currency) => ({
      currency,
      businesses: num(
        "SELECT COUNT(*) FROM businesses WHERE deleted_at IS NULL AND reporting_currency = ?",
        [currency],
      ),
      invoices: num(
        "SELECT COUNT(*) FROM invoices WHERE deleted_at IS NULL AND currency = ?",
        [currency],
      ),
    })),
    rates: inUse
      .filter((c) => c !== bookCurrency())
      .map((c) => {
        try {
          return rateOn(c, bookCurrency(), date);
        } catch {
          // Reported as missing below rather than crashing the whole position view.
          return {
            from: c,
            to: bookCurrency(),
            rate: 0,
            quotedOn: "",
            source: "missing",
            ageDays: 0,
            stale: true,
          } satisfies RateQuote;
        }
      }),
    stale: staleRates(),
  };
}

/**
 * A count. `COUNT(*)` names its column after the expression, so the query has to alias
 * it — reading `.n` off an unaliased count returns undefined and every tally in this
 * module silently reads zero, which looks exactly like "nothing has happened yet".
 */
function num(sql: string, params: Array<string | number> = []): number {
  const row = one<Record<string, unknown>>(sql, params);
  if (!row) return 0;
  return Number(Object.values(row)[0] ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Money columns that take their currency from a related row.
 *
 * Every one of these was found by the audit below rather than designed deliberately,
 * and leaving them implicit would be the worst option available: an inherited currency
 * is a weaker guarantee than an owned one, because it depends on a join being right,
 * and nothing in the column itself records which currency it is.
 *
 * Declaring them here makes the inheritance reviewable, and lets the audit check that
 * every one of these paths still exists — so a table that is renamed or loses its
 * currency column breaks a test instead of quietly becoming ambiguous.
 *
 * `table.column -> table.column` is where the currency comes from, via the foreign key
 * the code already follows.
 */
export const INHERITED_CURRENCY: Record<string, string> = {
  // Capital put into a business, and what came back for it. In the business's own
  // reporting currency, because that is the currency the money was contributed in.
  "business_stakeholders.amount": "businesses.reporting_currency",
  "business_stakeholders.proceeds": "businesses.reporting_currency",
  "branch_stakeholders.amount": "businesses.reporting_currency",
  "branch_stakeholders.proceeds": "businesses.reporting_currency",
  "investment_rounds.amount": "businesses.reporting_currency",
  "ownership_transfers.proceeds": "businesses.reporting_currency",

  // Everything raised by, declared on, or paid against a business.
  "dividends.amount": "businesses.reporting_currency",
  "dividend_entitlements.amount": "businesses.reporting_currency",
  "dividend_payments.amount": "businesses.reporting_currency",
  "profit_cycles.gross_revenue": "businesses.reporting_currency",
  "profit_cycles.operating_expenses": "businesses.reporting_currency",
  "profit_cycles.retained": "businesses.reporting_currency",
  "valuations.valuation": "businesses.reporting_currency",
  "delivery_costs.amount": "businesses.reporting_currency",
  "service_requests.budget": "businesses.reporting_currency",

  // Client billing. Every one of these is denominated in its invoice's currency.
  "invoice_lines.unit_price": "invoices.currency",
  "invoice_lines.subtotal": "invoices.currency",
  "invoice_lines.total": "invoices.currency",
  "invoice_payments.amount": "invoices.currency",
  "credit_notes.amount": "invoices.currency",

  // Catalogue prices are quoted in the book's own currency. There is no per-service
  // currency, which is a real limitation rather than a design choice, and it is noted
  // in the audit output rather than hidden here.
  "service_variants.rate": "settings:book_currency",
};

export interface CurrencyAuditResult {
  tables: string[];
  /** Money columns whose currency is neither owned nor declared. */
  offenders: string[];
  /** Declarations whose path no longer exists — the real danger, not the offender list. */
  brokenDeclarations: string[];
  /** Columns relying on a join, which is a weaker guarantee than owning the currency. */
  inherited: number;
  owned: number;
}

/**
 * Every money column must either name its own currency or have a declared one.
 *
 * An undeclared column is a genuine defect: a KES figure and a USD figure can sit in
 * the same column with nothing to tell them apart. A *declared* one is a known
 * limitation, and the value of declaring it is that the audit fails when the path
 * stops existing — which is when the inheritance silently stops being true.
 */
export function currencyAudit(): CurrencyAuditResult {
  const tables = all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map((t) => String(t.name));

  const moneyColumns = new Set([
    "amount",
    "rate",
    "valuation",
    "gross_revenue",
    "operating_expenses",
    "retained",
    "distributable",
    "unit_price",
    "subtotal",
    "total",
    "proceeds",
    "budget",
  ]);

  const columnsOf = new Map<string, Set<string>>();
  for (const t of tables) {
    columnsOf.set(
      t,
      new Set(all<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => String(c.name))),
    );
  }

  const offenders: string[] = [];
  let inherited = 0;
  let owned = 0;
  for (const [t, cols] of columnsOf) {
    const hasCurrency = cols.has("currency") || cols.has("reporting_currency") || cols.has("to_code");
    // fx_rates is the one table where `rate` is not an amount but a ratio, and it names
    // both sides of the pair itself.
    if (t === "fx_rates") continue;
    for (const c of cols) {
      if (!moneyColumns.has(c)) continue;
      if (hasCurrency) {
        owned++;
        continue;
      }
      if (INHERITED_CURRENCY[`${t}.${c}`]) {
        inherited++;
        continue;
      }
      offenders.push(`${t}.${c} has no currency of its own and none declared`);
    }
  }

  // A declaration that has stopped being true is worse than an undeclared column,
  // because somebody has been relying on it.
  const brokenDeclarations: string[] = [];
  for (const [path, via] of Object.entries(INHERITED_CURRENCY)) {
    const [table = ""] = path.split(".");
    if (!columnsOf.has(table)) {
      brokenDeclarations.push(`${path}: the table no longer exists`);
      continue;
    }
    if (via.startsWith("settings:")) continue; // the book currency is a setting, by name
    const [target = "", column = ""] = via.split(".");
    if (!columnsOf.has(target) || !columnsOf.get(target)?.has(column)) {
      brokenDeclarations.push(`${path}: ${via} no longer exists`);
    }
  }
  for (const path of Object.keys(INHERITED_CURRENCY)) {
    const [table = "", column = ""] = path.split(".");
    if (!columnsOf.get(table)?.has(column)) {
      brokenDeclarations.push(`${path}: the column it was declared for is gone`);
    }
  }

  return { tables, offenders, brokenDeclarations, inherited, owned };
}