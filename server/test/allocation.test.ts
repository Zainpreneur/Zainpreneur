import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOCATION_UNITS,
  AllocationError,
  UNITS_PER_PERCENT,
  allocationState,
  assertAllocation,
  distributeWithRemainder,
  formatUnits,
  summariseAllocation,
  toUnits,
} from "@zainpreneur/shared";

/**
 * The 100% rule.
 *
 * These cases are the ones the original gets wrong. `db.py` accepts anything
 * inside [99.495, 100.005] because of a `0.005` tolerance, and the browser
 * blocked submission at 100.0001 — a different threshold again. So 99.6% was
 * writable, and 100.003% was *disabled in the browser but accepted by the server*.
 * Each of those is asserted here.
 */

const rows = (...percents: number[]) =>
  percents.map((percent, i) => ({ stakeholderId: i + 1, percent }));

/** `assert.throws` does not hand back the error, and the message is the point. */
function errorFrom(fn: () => void): AllocationError {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof AllocationError, `expected an AllocationError, got ${err}`);
    return err;
  }
  throw new assert.AssertionError({ message: "expected a throw, none happened" });
}

test("100% is exactly 10000 units", () => {
  assert.equal(ALLOCATION_UNITS, 10_000);
  assert.equal(UNITS_PER_PERCENT, 100);
  assert.equal(toUnits(100), 10_000);
  assert.equal(toUnits(0), 0);
});

test("a whole cap table passes", () => {
  assert.doesNotThrow(() => assertAllocation(rows(60, 20, 15, 5), "equity"));
  assert.doesNotThrow(() => assertAllocation(rows(100), "fully_owned"));
});

test("a client holds no equity", () => {
  assert.doesNotThrow(() => assertAllocation(rows(), "client"));
  assert.throws(() => assertAllocation(rows(1), "client"), AllocationError);
});

test("99.6% is refused — the original accepted it", () => {
  const err = errorFrom(() => assertAllocation(rows(99.6), "equity"));
  assert.match(err.message, /exactly 100%/);
  assert.match(err.message, /Add the remaining 0\.4%/);
  assert.equal(err.field, "percent");
});

test("the tolerance window is closed at the boundary", () => {
  // 99.994 rounds to 9999 units and 100.006 to 10001 — one hundredth out either way.
  // The original accepted everything from 99.495 upwards.
  assert.throws(() => assertAllocation(rows(99.994), "equity"), AllocationError);
  assert.throws(() => assertAllocation(rows(100.006), "equity"), AllocationError);
});

test("100.003% is refused — the browser disabled this, the server allowed it", () => {
  assert.throws(() => assertAllocation(rows(100.003), "equity"), AllocationError);
});

test("over-allocation names the amount to remove", () => {
  const err = errorFrom(() => assertAllocation(rows(60, 55), "equity"));
  assert.match(err.message, /Reduce by 15%/);
});

test("under-allocation names the amount to add", () => {
  const err = errorFrom(() => assertAllocation(rows(60, 20), "equity"));
  assert.match(err.message, /Add the remaining 20%/);
});

test("a business with no rows is unallocated, not misallocated", () => {
  // A venture launched and not yet allocated to anyone. The type is a claim; the
  // rows are the reality, and the reality is still empty.
  assert.doesNotThrow(() => assertAllocation([], "equity"));
  assert.doesNotThrow(() => assertAllocation([], "fully_owned"));
});

test("a row holding zero is visible rather than silently dropped", () => {
  const summary = summariseAllocation(rows(100, 0));
  assert.equal(summary.holders.length, 1);
  assert.equal(summary.zeroRows.length, 1);
  assert.equal(summary.totalUnits, 10_000);
});

test("sums are order-independent", () => {
  assert.equal(summariseAllocation(rows(33.33, 33.33, 33.34)).totalUnits, 10_000);
  assert.equal(summariseAllocation(rows(33.34, 33.33, 33.33)).totalUnits, 10_000);
});

test("allocation state names the shape", () => {
  assert.equal(allocationState([]), "empty");
  assert.equal(allocationState(rows(40)), "partial");
  assert.equal(allocationState(rows(100)), "full");
  assert.equal(allocationState(rows(60, 55)), "over"); // 115 across two holders
});

test("a single percentage above 100 is a field error, not an over-allocation", () => {
  // Better to be told the field is impossible than to be told the total is 15
  // too high, which would send the user hunting across every row.
  assert.throws(() => toUnits(120), AllocationError);
  assert.throws(() => toUnits(-1), AllocationError);
  assert.throws(() => toUnits("abc"), AllocationError);
});

test("units render the way a person reads a percentage", () => {
  assert.equal(formatUnits(10_000), "100");
  assert.equal(formatUnits(2_500), "25");
  assert.equal(formatUnits(1_250), "12.5");
  assert.equal(formatUnits(1), "0.01");
  assert.equal(formatUnits(0), "0");
  assert.equal(formatUnits(-1_500), "-15");
  assert.equal(formatUnits(-1), "-0.01");
});

test("the rounding remainder goes to the largest holder, deterministically", () => {
  const first = distributeWithRemainder([50, 30, 20]);
  const second = distributeWithRemainder([50, 30, 20]);
  assert.deepEqual(first, second);
  assert.equal(
    summariseAllocation(first.map((p) => ({ stakeholderId: 1, percent: p }))).totalUnits,
    10_000,
  );
});

test("a remainder that must come off lands on the largest holder", () => {
  const out = distributeWithRemainder([33.34, 33.33, 33.33]);
  assert.equal(
    summariseAllocation(out.map((p) => ({ stakeholderId: 1, percent: p }))).totalUnits,
    10_000,
  );
});