import { all, num, one } from "../db/client.js";
import { INCOME_KINDS, RETURN_OF_CAPITAL, money, roundEquity, toUnits } from "@zainpreneur/shared";

/**
 * What the book actually returned.
 *
 * This is the module the whole register exists to feed. It reads events and computes
 * figures; it writes nothing and stores no total. Every number below is derived on
 * read, because a stored return figure is a second opinion that will eventually
 * disagree with the events it came from.
 *
 * Three ledgers, and the discipline that keeps them apart:
 *
 *   dividends received   investment income, to Zainpreneur
 *   dividends paid       distributions of the group's own capital to co-investors
 *   service revenue      not in this build (Phase 2) — and must never be added here
 *
 * Nothing in this module sums across them. A dividend received is not revenue, and a
 * dividend paid is not a cost; adding any two produces a number that means nothing.
 */

export interface CashFlow {
  /** ISO date the money moved. */
  on: string;
  /** Negative for capital going in, positive for money coming back. */
  amount: number;
  kind: "contribution" | "distribution" | "proceeds" | "return_of_capital";
  label: string;
  businessId: number | null;
  ref: string;
}

/** Cash *going in*. Rounds are the dated truth; a holding's basis is a position. */
export function contributions(stakeholderId: number, businessId?: number): CashFlow[] {
  const rows = businessId
    ? all<Record<string, unknown>>(
        `SELECT r.*, b.name AS business_name FROM investment_rounds r
           JOIN businesses b ON b.id = r.business_id
          WHERE r.stakeholder_id = ? AND r.business_id = ? ORDER BY r.invested_on`,
        [stakeholderId, businessId],
      )
    : all<Record<string, unknown>>(
        `SELECT r.*, b.name AS business_name FROM investment_rounds r
           JOIN businesses b ON b.id = r.business_id
          WHERE r.stakeholder_id = ? ORDER BY r.invested_on`,
        [stakeholderId],
      );

  return rows.map((r) => ({
    on: String(r.invested_on),
    amount: -money(Number(r.amount ?? 0)),
    kind: "contribution" as const,
    label: `${r.business_name} — ${String(r.kind).replace("_", " ")}`,
    businessId: Number(r.business_id),
    ref: `round:${r.id}`,
  }));
}

/**
 * Dividends received, at this holder's share of each declaration.
 *
 * The share is read from the cap table on the declaration date, the same rule every
 * other read uses. A return of capital is *excluded from income* but still counts as
 * capital recovered, so it appears here with its own kind rather than being mixed in
 * with the dividends — the original summed all of them, which inflated MOIC by exactly
 * the amount that was returned.
 */
export function distributionsReceived(
  stakeholderId: number,
  businessId?: number,
): CashFlow[] {
  const rows = businessId
    ? all<Record<string, unknown>>(
        `SELECT d.*, b.name AS business_name FROM dividends d
           JOIN businesses b ON b.id = d.business_id
          WHERE d.stakeholder_id IS NULL AND d.business_id = ? ORDER BY d.declared_on`,
        [businessId],
      )
    : all<Record<string, unknown>>(
        `SELECT d.*, b.name AS business_name FROM dividends d
           JOIN businesses b ON b.id = d.business_id
          WHERE d.stakeholder_id IS NULL ORDER BY d.declared_on`,
      );

  const out: CashFlow[] = [];
  for (const r of rows) {
    const on = String(r.declared_on);
    const kind = String(r.kind ?? "dividend");
    const equity = equityOnDate(Number(r.business_id), stakeholderId, on);
    if (equity <= 0) continue;
    const amount = money((Number(r.amount ?? 0) * equity) / 100);
    if (amount === 0) continue;
    out.push({
      on,
      amount,
      kind: kind === RETURN_OF_CAPITAL ? "return_of_capital" : "distribution",
      label: `${r.business_name} — ${kind === RETURN_OF_CAPITAL ? "return of capital" : "dividend"}`,
      businessId: Number(r.business_id),
      ref: `dividend:${r.id}`,
    });
  }
  return out;
}

/** What this holder owned on a date. The one cut-off rule, from `shared`. */
function equityOnDate(businessId: number, stakeholderId: number, on: string): number {
  const rows = all<{ equity: number; invested_on: string; exited_on: string | null }>(
    `SELECT equity, invested_on, exited_on FROM business_stakeholders
      WHERE business_id = ? AND stakeholder_id = ?`,
    [businessId, stakeholderId],
  );
  return roundEquity(
    rows
      .filter((r) => {
        if (r.invested_on && r.invested_on > on) return false;
        if (r.exited_on && r.exited_on <= on) return false;
        return true;
      })
      .reduce((sum, r) => sum + (Number(r.equity ?? 0) > 0 ? Number(r.equity) : 0), 0),
  );
}

/** Money coming back from a sale. The ledger, which is dated and named. */
export function proceedsFrom(stakeholderId: number, businessId?: number): CashFlow[] {
  const rows = businessId
    ? all<Record<string, unknown>>(
        `SELECT t.*, b.name AS business_name FROM ownership_transfers t
           JOIN businesses b ON b.id = t.business_id
          WHERE t.seller_id = ? AND t.business_id = ? AND t.buyer_id IS NOT NULL
          ORDER BY t.date`,
        [stakeholderId, businessId],
      )
    : all<Record<string, unknown>>(
        `SELECT t.*, b.name AS business_name FROM ownership_transfers t
           JOIN businesses b ON b.id = t.business_id
          WHERE t.seller_id = ? AND t.buyer_id IS NOT NULL ORDER BY t.date`,
        [stakeholderId],
      );

  return rows.map((r) => ({
    on: String(r.date),
    // Blank means "not priced", which is a different fact from zero — a sale with no
    // agreed figure contributes nothing to cash, but the stake did leave.
    amount: money(Number(r.proceeds ?? 0)),
    kind: "proceeds" as const,
    label: `${r.business_name} — sale of ${r.percentage}%`,
    businessId: Number(r.business_id),
    ref: `transfer:${r.id}`,
  }));
}

/** Every dated movement for a holder, oldest first. */
export function cashFlows(stakeholderId: number, businessId?: number): CashFlow[] {
  return [
    ...contributions(stakeholderId, businessId),
    ...distributionsReceived(stakeholderId, businessId),
    ...proceedsFrom(stakeholderId, businessId),
  ].sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
}

/* -------------------------------------------------------------------------- */
/* The capital account                                                          */
/* -------------------------------------------------------------------------- */

export interface CapitalAccount {
  stakeholderId: number;
  /** Capital that went in. */
  contributed: number;
  /** Capital that came back as a return of capital — *not* income. */
  returnedOfCapital: number;
  /** Dividends actually received. */
  distributed: number;
  /** Money realised from sales. */
  realised: number;
  /**
   * What the capital still at risk costs: contributions less anything returned as
   * capital. Never reduced by a dividend, because a dividend is income rather than a
   * recovery of the capital itself.
   */
  netInvested: number;
  /** contributed − returnedOfCapital */
  capitalAtWork: number;
}

/**
 * The standard capital account statement.
 *
 * The distinction that matters here is between *income* and *return of capital*. A
 * return of capital reduces the basis; a dividend does not. Reporting them the same
 * way overstates returns by the amount returned.
 */
export function capitalAccount(stakeholderId: number, businessId?: number): CapitalAccount {
  let contributed = 0;
  let returnedOfCapital = 0;
  let distributed = 0;
  let realised = 0;

  for (const cf of cashFlows(stakeholderId, businessId)) {
    if (cf.kind === "contribution") contributed = money(contributed + Math.abs(cf.amount));
    else if (cf.kind === "distribution") distributed = money(distributed + cf.amount);
    else if (cf.kind === "return_of_capital") returnedOfCapital = money(returnedOfCapital + cf.amount);
    else if (cf.kind === "proceeds") realised = money(realised + cf.amount);
  }

  return {
    stakeholderId,
    contributed,
    returnedOfCapital,
    distributed,
    realised,
    netInvested: money(contributed - returnedOfCapital),
    capitalAtWork: money(contributed - returnedOfCapital),
  };
}

/* -------------------------------------------------------------------------- */
/* Multiples                                                                    */
/* -------------------------------------------------------------------------- */

/** Guard: dividing by a small or negative basis produces a figure nobody can use. */
function multiple(value: number, basis: number): number | null {
  if (basis <= 0) return null;
  const m = value / basis;
  return Number.isFinite(m) ? Math.round(m * 100) / 100 : null;
}

export interface Multiples {
  /**
   * Money multiple on the capital still at risk: dividends plus sale proceeds over net
   * invested. Return of capital is excluded, because getting one's own money back is not
   * a gain. Denominator: net invested.
   */
  moic: number | null;
  /** cash-on-cash: dividends only, over net invested. Denominator: net invested. */
  cashOnCash: number | null;
  /** Distributable to paid-in: everything received, over capital called. */
  dpi: number | null;
  /** Total value to paid-in: everything received plus what is still held. */
  tvpi: number | null;
  /** Residual value to paid-in: what is still held. */
  rvpi: number | null;
}

/**
 * Each multiple has its own denominator, and reaching for the wrong one is exactly how a
 * return of capital gets reported as a return:
 *
 *   MOIC, cash-on-cash   / net invested   (capital still at risk)
 *   DPI, TVPI, RVPI      / paid in         (capital actually called)
 *
 * Measuring DPI against net invested would report 1.2x on a book where three fifths of
 * the money had simply come home — a gain that never happened.
 */
export function multiples(
  account: CapitalAccount,
  residualValue: number,
): Multiples {
  const paidIn = account.contributed;
  const atRisk = account.netInvested;
  // Everything in the hand, return of capital included: DPI is about cash received.
  const received = money(account.distributed + account.returnedOfCapital + account.realised);
  // Everything *earned*: the return of capital is not among it.
  const earned = money(account.distributed + account.realised);
  return {
    moic: multiple(earned, atRisk),
    cashOnCash: multiple(account.distributed, atRisk),
    dpi: multiple(received, paidIn),
    tvpi: multiple(money(received + residualValue), paidIn),
    rvpi: multiple(residualValue, paidIn),
  };
}

/* -------------------------------------------------------------------------- */
/* IRR                                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Money-weighted return, from the dated series.
 *
 * Solved by bisection rather than Newton's method: Newton throws when the derivative
 * collapses, and a return figure that makes the page 500 is worse than one that is a
 * little slower. Bisection on the sign of the present value cannot fail to converge
 * once the bracket is found, and it is deterministic — the same book always gives the
 * same answer, which is the property that makes a return testable at all.
 *
 * A single flow, or flows that never change sign, has no internal rate of return to
 * find and returns null rather than a number.
 */
export function irr(flows: CashFlow[]): number | null {
  const dated = flows
    .filter((f) => Number.isFinite(f.amount) && f.amount !== 0)
    .map((f) => ({ days: daysFrom(flows[0]!.on, f.on), amount: f.amount }))
    .sort((a, b) => a.days - b.days);

  if (dated.length < 2) return null;
  const hasPositive = dated.some((f) => f.amount > 0);
  const hasNegative = dated.some((f) => f.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const npv = (rate: number): number =>
    dated.reduce((sum, f) => sum + f.amount / Math.pow(1 + rate, f.days / 365), 0);

  // Widen the bracket until it straddles the root.
  let lo = -0.9999;
  let hi = 0.01;
  let fLo = npv(lo);
  let fHi = npv(hi);
  let guard = 0;
  while (fLo * fHi > 0 && guard < 200) {
    hi = hi < 10 ? hi * 2 + 0.01 : hi;
    if (hi > 1000) return null;
    fHi = npv(hi);
    guard++;
  }
  if (fLo * fHi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return Math.round(mid * 1e6) / 1e6;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return Math.round(((lo + hi) / 2) * 1e6) / 1e6;
}

function daysFrom(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/* -------------------------------------------------------------------------- */
/* Track record                                                                 */
/* -------------------------------------------------------------------------- */

export interface RealisedPosition {
  businessId: number;
  businessName: string;
  cost: number;
  proceeds: number;
  profit: number;
  moic: number | null;
  daysHeld: number;
  yearsHeld: number;
  closedOn: string;
}

export interface OpenPosition {
  businessId: number;
  businessName: string;
  cost: number;
  equity: number;
  /** mark × equity where a mark exists; cost and `basis: 'cost'` where it does not. */
  value: number;
  basis: "mark" | "cost";
  markedOn: string | null;
  distributionsReceived: number;
}

/**
 * The track record, for one holder.
 *
 * Realised and unrealised are kept apart and then combined, because a single blended
 * figure hides which of the two a portfolio is made of.
 *
 * An open position with no mark is reported **at cost and labelled as cost**. Showing
 * a cost in the same column as a mark, without saying which it is, is how a portfolio
 * comes to look worth more than it is.
 */
export function trackRecord(stakeholderId: number): {
  realised: RealisedPosition[];
  open: OpenPosition[];
  totals: {
    realisedCost: number;
    realisedProceeds: number;
    realisedProfit: number;
    realisedMoic: number | null;
    openCost: number;
    openValue: number;
    distributionsReceived: number;
    totalReturn: number;
    totalValue: number;
    moic: number | null;
    tvpi: number | null;
    dpi: number | null;
    rvpi: number | null;
    irr: number | null;
    unmarkedPositions: number;
  };
} {
  /* realised ---------------------------------------------------------- */
  // A partial sale does not close a position; it closes *the slice that left* and
  // opens a fresh row for what stayed, keeping the original entry date. So a sold
  // business appears as several closed slices plus one open row, and the slices have
  // to be added back together before they mean anything to a reader.
  const slices = all<Record<string, unknown>>(
    `SELECT x.business_id, x.equity, x.amount, x.proceeds, x.invested_on, x.exited_on,
            x.transferred_to, b.name AS business_name
       FROM business_stakeholders x
       JOIN businesses b ON b.id = x.business_id
      WHERE x.stakeholder_id = ? AND x.exited_on IS NOT NULL AND x.equity > 0
      ORDER BY x.exited_on DESC`,
    [stakeholderId],
  );

  const byBusiness = new Map<number, RealisedPosition>();
  for (const r of slices) {
    const businessId = Number(r.business_id);
    const cost = money(Number(r.amount ?? 0));
    // Blank means "not priced", which is a different fact from zero — an unpriced sale
    // contributed no cash and still shows as a stake that left.
    const proceeds = money(Number(r.proceeds ?? 0));
    const prev = byBusiness.get(businessId);
    if (prev) {
      prev.cost = money(prev.cost + cost);
      prev.proceeds = money(prev.proceeds + proceeds);
      prev.profit = money(prev.proceeds - prev.cost);
      prev.moic = multiple(prev.proceeds, prev.cost);
      prev.daysHeld = Math.max(prev.daysHeld, daysFrom(String(r.invested_on), String(r.exited_on)));
      continue;
    }
    const daysHeld = r.invested_on ? daysFrom(String(r.invested_on), String(r.exited_on)) : 0;
    byBusiness.set(businessId, {
      businessId,
      businessName: String(r.business_name),
      cost,
      proceeds,
      profit: money(proceeds - cost),
      moic: multiple(proceeds, cost),
      daysHeld,
      yearsHeld: Math.round((daysHeld / 365) * 100) / 100,
      closedOn: String(r.exited_on),
    });
  }
  const realised = [...byBusiness.values()].map((p) => ({
    ...p,
    daysHeld: Math.max(0, p.daysHeld),
  }));

  /* open -------------------------------------------------------------- */
  const held = all<Record<string, unknown>>(
    `SELECT x.business_id, x.amount, x.equity, b.name AS business_name,
            (SELECT v.valuation FROM valuations v
              WHERE v.business_id = x.business_id AND v.voided = 0
              ORDER BY v.valued_on DESC, v.id DESC LIMIT 1) AS valuation,
            (SELECT v.valued_on FROM valuations v
              WHERE v.business_id = x.business_id AND v.voided = 0
              ORDER BY v.valued_on DESC, v.id DESC LIMIT 1) AS valued_on
       FROM business_stakeholders x
       JOIN businesses b ON b.id = x.business_id
      WHERE x.stakeholder_id = ? AND x.exited_on IS NULL AND x.equity > 0
        AND b.deleted_at IS NULL`,
    [stakeholderId],
  );

  const open: OpenPosition[] = held.map((r) => {
    const cost = money(Number(r.amount ?? 0));
    const equity = roundEquity(Number(r.equity ?? 0));
    const mark = r.valuation === null || r.valuation === undefined ? null : Number(r.valuation);
    const received = money(
      distributionsReceived(stakeholderId, Number(r.business_id))
        .filter((f) => f.kind === "distribution")
        .reduce((sum, f) => sum + f.amount, 0),
    );
    return {
      businessId: Number(r.business_id),
      businessName: String(r.business_name),
      cost,
      equity,
      value: mark === null ? cost : money((mark * equity) / 100),
      basis: mark === null ? ("cost" as const) : ("mark" as const),
      markedOn: mark === null ? null : String(r.valued_on ?? ""),
      distributionsReceived: received,
    };
  });

  /* totals ------------------------------------------------------------ */
  const account = capitalAccount(stakeholderId);
  const realisedCost = money(realised.reduce((s, p) => s + p.cost, 0));
  const realisedProceeds = money(realised.reduce((s, p) => s + p.proceeds, 0));
  const openCost = money(open.reduce((s, p) => s + p.cost, 0));
  const openValue = money(open.reduce((s, p) => s + p.value, 0));
  const distributionsReceivedTotal = money(
    distributionsReceived(stakeholderId).reduce((s, f) => s + f.amount, 0),
  );

  const returned = money(realisedProceeds + distributionsReceivedTotal);
  const totalValue = money(returned + openValue);
  const basis = account.netInvested;

  return {
    realised,
    open,
    totals: {
      realisedCost,
      realisedProceeds,
      realisedProfit: money(realisedProceeds - realisedCost),
      realisedMoic: multiple(realisedProceeds, realisedCost),
      openCost,
      openValue,
      distributionsReceived: distributionsReceivedTotal,
      totalReturn: money(returned + openValue - basis),
      totalValue,
      moic: multiple(returned, basis),
      tvpi: multiple(totalValue, basis),
      dpi: multiple(returned, basis),
      rvpi: multiple(openValue, basis),
      irr: irr(cashFlows(stakeholderId)),
      unmarkedPositions: open.filter((p) => p.basis === "cost").length,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Audit helpers                                                                */
/* -------------------------------------------------------------------------- */

/** True when no table holds a derived return figure. The §36 audit, for returns. */
export function derivedColumnsAbsent(): string[] {
  const banned = ["irr", "moic", "tvpi", "dpi", "rvpi", "total_return", "net_invested", "cash_on_cash"];
  const offenders: string[] = [];
  // `name` comes from sqlite_schema rather than pragma_table_list, which has no
  // `tbl_name` column and does not exist at all on some builds.
  const tables = all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  for (const t of tables) {
    for (const c of all<{ name: string }>(`PRAGMA table_info(${t.name})`)) {
      if (banned.includes(String(c.name).toLowerCase())) offenders.push(`${t.name}.${c.name}`);
    }
  }
  return offenders;
}

export { INCOME_KINDS, RETURN_OF_CAPITAL, num, one, toUnits };