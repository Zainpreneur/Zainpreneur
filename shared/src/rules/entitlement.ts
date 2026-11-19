/**
 * The one rule that decides who held what on a given day.
 *
 * The original had three answers to the same question, and they disagreed:
 *
 *   ownership_at(:3610)         invested_on <= on AND exited_on >  on    exclusive
 *   distribution_history(:3932) effective_from <= on AND effective_to >= on inclusive
 *   distributions_received(:2005) declared_on BETWEEN invested_on AND exited_on inclusive
 *
 * A holding that ended 2026-03-15 with a dividend declared 2026-03-15 was
 * therefore a holder for two of the three, and not for the third — and the one
 * that disagreed was `ownership_at`, which is the predicate the normal
 * business-wide pro-rata path runs through. So the ordinary case was the odd one
 * out.
 *
 * There is now one function, and `dividends.entitlement_mode` decides how it is
 * applied. It is a column on the declaration rather than a global setting on
 * purpose: flipping a global policy would silently restate every past dividend,
 * which is the drift the derivation audit exists to prevent.
 */

import type { ContractualBasis, EntitlementMode } from "./vocabulary.js";

export type { ContractualBasis, EntitlementMode };

/** A holding as it stood on one day. */
export interface HoldingPeriod {
  businessId: number;
  branchId: number | null;
  stakeholderId: number;
  /** Equity in percentage points, as recorded. */
  equity: number;
  investedOn: string;
  exitedOn: string | null;
}

/**
 * Did this holder hold on this date?
 *
 * Record-date attribution is the default: a dividend belongs to whoever held when
 * it was declared, and entitlement does not follow the shares afterwards. The exit
 * date is therefore *exclusive* — a holder who left on the 15th does not receive a
 * dividend declared on the 15th, only one declared before it.
 */
export function heldOn(holding: HoldingPeriod, on: string): boolean {
  if (holding.investedOn && holding.investedOn > on) return false;
  if (holding.exitedOn && holding.exitedOn <= on) return false;
  return true;
}

/** Every holding open on a date. */
export function holdingsOn(holdings: HoldingPeriod[], on: string): HoldingPeriod[] {
  return holdings.filter((h) => heldOn(h, on));
}

/** The equity that holder had on a date, in percentage points. */
export function equityOn(holdings: HoldingPeriod[], stakeholderId: number, on: string): number {
  return sumEquity(holdingsOn(holdings, on).filter((h) => h.stakeholderId === stakeholderId));
}

/**
 * One line per holder, however many periods they hold.
 *
 * After a part sale a holder has two periods open at once. Paying their share of
 * each would pay them twice, so the equity is totalled per stakeholder first and
 * one line is emitted — which is what the original did correctly here, and the
 * reason the shares still add back to the declared amount.
 */
export function sumEquity(holdings: HoldingPeriod[]): number {
  return roundEquity(holdings.reduce((total, h) => total + (h.equity || 0), 0));
}

/** Equity is quoted to two decimals; money arithmetic needs that settled. */
export function roundEquity(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface EntitlementLine {
  stakeholderId: number;
  equity: number;
  /** The share of the declared amount this holder is entitled to. */
  amount: number;
  basis: "derived" | "recorded";
}

/**
 * The pro-rata split of a declaration.
 *
 * Returns one line per holder, and the amounts always sum back to `declared` —
 * which is an invariant worth asserting, because a rounding drift here would
 * silently create or destroy money.
 */
export function prorateEntitlements(
  declared: number,
  holdings: HoldingPeriod[],
  on: string,
): EntitlementLine[] {
  const totals = new Map<number, number>();
  for (const h of holdingsOn(holdings, on)) {
    if (h.equity <= 0) continue;
    totals.set(h.stakeholderId, roundEquity((totals.get(h.stakeholderId) ?? 0) + h.equity));
  }

  const lines: EntitlementLine[] = [];
  for (const stakeholderId of [...totals.keys()].sort((a, b) => a - b)) {
    const equity = totals.get(stakeholderId)!;
    lines.push({
      stakeholderId,
      equity,
      amount: money(declared * (equity / 100)),
      basis: "derived",
    });
  }
  return lines;
}

/**
 * Contractual entitlement by days held.
 *
 * Only used when a shareholders' agreement says a departing stakeholder is
 * entitled to a proportion. The share is of the *period*, so this needs the
 * period's bounds rather than a single date.
 */
export function prorateByDays(
  declared: number,
  holding: HoldingPeriod,
  periodStart: string,
  periodEnd: string,
): number {
  const from = laterOf(holding.investedOn, periodStart);
  const to = earlierOf(holding.exitedOn ?? periodEnd, periodEnd);
  const total = daysBetween(periodStart, periodEnd);
  if (total <= 0 || !from || !to || to < from) return 0;
  return money(declared * (daysBetween(from, to) / total));
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000) + 1; // inclusive of both ends
}

function laterOf(a: string, b: string): string {
  return a > b ? a : b;
}
function earlierOf(a: string, b: string): string {
  return a < b ? a : b;
}

/** Round to cents. Money is never left to binary floating point. */
export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Money rendered for people. Blank is never a fabricated zero. */
export function formatMoney(value: number | null | undefined, currency = ""): string {
  if (value === null || value === undefined) return "—";
  const n = money(Number(value));
  const text = n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return currency ? `${currency} ${text}` : text;
}