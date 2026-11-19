/**
 * The 100% rule, in integer hundredths of a percent.
 *
 * The original records a strict cap table in floating point with a tolerance:
 * `abs(total - 100.0) > 0.005` accepts 99.6%, and the browser blocked submission at
 * a *different* threshold (100.0001) than the server did — 50x looser, so a book
 * could be written at 99.6% and then reported as compliant.
 *
 * Neither the tolerance nor the floating point is needed. Equity percentages are
 * quoted to two decimals, so hundredths of a percent are the natural unit: 10000
 * units is 100%. Sums of integers are exact and order-independent, which matters
 * because floating-point addition is not — the same three holdings summed in two
 * orders can disagree in the last digit.
 *
 * This module is imported by the server *and* the client so the two can never
 * hold different thresholds. That disagreement was a real defect, not a
 * hypothetical: the rule was stated three different ways across three files.
 */

export const UNITS_PER_PERCENT = 100;
export const ALLOCATION_UNITS = 10_000;

/** Tolerance is zero, deliberately. There is no allowance to tune. */
export const ALLOCATION_TOLERANCE_UNITS = 0;

export interface AllocationRow {
  stakeholderId: number;
  /** Percentage as recorded — a number or a numeric string. */
  percent: number | string | null | undefined;
}

export interface AllocationSummary {
  /** Sum of every positive row, in units. */
  totalUnits: number;
  /** Rows with a stake greater than zero. */
  holders: AllocationRow[];
  /** Rows present but holding nothing. */
  zeroRows: AllocationRow[];
  /** True when the sum is exactly 10000 units. */
  isExact: boolean;
  /** Units still to allocate; negative when over-allocated. */
  deltaUnits: number;
}

export class AllocationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "AllocationError";
    this.field = field;
  }
}

/** Parse a percentage into whole hundredths, rejecting anything out of range. */
export function toUnits(percent: number | string | null | undefined, label = "Equity"): number {
  if (percent === null || percent === undefined || percent === "") return 0;

  const value = typeof percent === "number" ? percent : Number(String(percent).trim());
  if (!Number.isFinite(value)) {
    throw new AllocationError("percent", `${label} takes a number, not '${String(percent).trim()}'`);
  }
  if (value < 0) {
    throw new AllocationError("percent", `${label} cannot be negative, and this is ${formatUnits(toUnitsUnchecked(value))}.`);
  }
  if (value > 100) {
    throw new AllocationError("percent", `${label} cannot be more than 100%, and this is ${formatUnits(toUnitsUnchecked(value))}.`);
  }
  return toUnitsUnchecked(value);
}

function toUnitsUnchecked(value: number): number {
  // Round rather than truncate: 33.335% is 3334 bp, not 3333. Truncation biases
  // every holding downwards and makes three-way splits miss 100% by construction.
  return Math.round(value * UNITS_PER_PERCENT);
}

/** Render units the way a person reads them: 25, 12.5, 0.01, -15. */
export function formatUnits(units: number): string {
  const sign = units < 0 ? "-" : "";
  const abs = Math.abs(units);
  const whole = Math.trunc(abs / UNITS_PER_PERCENT);
  const frac = abs % UNITS_PER_PERCENT;
  if (frac === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

/** Sum a set of rows. Pure — it never touches the database. */
export function summariseAllocation(rows: AllocationRow[], label = "This business"): AllocationSummary {
  const holders: AllocationRow[] = [];
  const zeroRows: AllocationRow[] = [];
  let totalUnits = 0;

  for (const row of rows) {
    const units = toUnits(row.percent);
    if (units > 0) {
      totalUnits += units;
      holders.push(row);
    } else {
      zeroRows.push(row);
    }
  }

  const deltaUnits = ALLOCATION_UNITS - totalUnits;
  return {
    totalUnits,
    holders,
    zeroRows,
    isExact: totalUnits === ALLOCATION_UNITS,
    deltaUnits,
  };
}

/** `empty` | `partial` | `full` | `over` — the shape of a cap table at a glance. */
export type AllocationState = "empty" | "partial" | "full" | "over";

export function allocationState(rows: AllocationRow[]): AllocationState {
  const { totalUnits } = summariseAllocation(rows);
  if (totalUnits <= 0) return "empty";
  if (totalUnits === ALLOCATION_UNITS) return "full";
  return totalUnits > ALLOCATION_UNITS ? "over" : "partial";
}

/**
 * The rule itself.
 *
 * `strict` describes businesses whose cap table must total exactly 100%. A
 * business typed `client` holds no equity at all and is exempt — and a business
 * with *no rows yet* is unallocated rather than misallocated, which is the case
 * a newly launched venture is in before its first stakeholder is recorded.
 */
export function assertAllocation(
  rows: AllocationRow[],
  relationshipType: string,
  label = "This business",
): void {
  // No equity rows at all: nothing to total. The type is a claim; the rows are
  // the reality, and reality is still empty.
  if (rows.length === 0) return;

  const { totalUnits, deltaUnits } = summariseAllocation(rows, label);

  if (relationshipType === "client") {
    if (totalUnits > 0) {
      throw new AllocationError(
        "relationship_type",
        `${label} is typed as a client relationship but holds ${formatUnits(totalUnits)}% equity. ` +
          "Use Equity if you also hold a stake.",
      );
    }
    return;
  }

  if (deltaUnits !== 0) {
    const shortfall = deltaUnits > 0
      ? `Add the remaining ${formatUnits(deltaUnits)}%.`
      : `Reduce by ${formatUnits(-deltaUnits)}%.`;
    throw new AllocationError(
      "percent",
      `${label} must total exactly 100% (currently ${formatUnits(totalUnits)}%). ${shortfall}`,
    );
  }
}

/**
 * Hand the rounding remainder to the largest holder.
 *
 * When a percentage is split into more parts than hundredths allow — say three
 * ways from 100% — somebody has to round. Floating-point division produces a
 * sum that misses 100% by a hair; dropping the remainder on the floor does the
 * same. This assigns it deterministically to the biggest stake, so the cap table
 * is exact and *the same inputs always give the same answer*.
 */
export function distributeWithRemainder(
  percents: Array<number | string | null | undefined>,
  label = "This business",
): number[] {
  const units = percents.map((p) => toUnits(p, label));
  let shortfall = ALLOCATION_UNITS - units.reduce((a, b) => a + b, 0);
  if (shortfall === 0 || units.length === 0) return units.map(fromUnits);

  const order = units
    .map((u, i) => ({ u, i }))
    .sort((a, b) => b.u - a.u || a.i - b.i);

  const step = shortfall > 0 ? 1 : -1;
  for (const { i } of order) {
    if (shortfall === 0) break;
    const next = units[i]! + step;
    if (next < 0 || next > ALLOCATION_UNITS) continue;
    units[i] = next;
    shortfall -= step;
  }
  return units.map(fromUnits);
}

/** Units back to a percentage. */
export function fromUnits(units: number): number {
  return units / UNITS_PER_PERCENT;
}