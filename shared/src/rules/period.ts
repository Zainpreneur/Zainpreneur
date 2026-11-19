/**
 * Period keys.
 *
 * `profit_cycles.period_label` is free text, which the original allowed to hold
 * both `Oct 2026` and `2026-10` for the same month — and then treated as two
 * different periods. A canonical key alongside the human label fixes that without
 * taking the label away, because "Oct 2026" is what a person reads.
 */

export type PeriodCadence = "monthly" | "quarterly" | "annual";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Validate a date and reject one that does not exist. */
export function parseIsoDate(value: string, label = "Date"): string {
  const v = (value ?? "").trim();
  if (!isIsoDate(v)) throw new Error(`${label} needs a date as YYYY-MM-DD`);
  const [y, m, d] = v.split("-").map(Number);
  const probe = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== (m ?? 1) - 1 ||
    probe.getUTCDate() !== d
  ) {
    throw new Error(`${label} of ${v} is not a real date`);
  }
  return v;
}

/** Split `YYYY-MM`, or null. Every month-key reader goes through this. */
function parts(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}

/** The canonical key for a month: `2026-10`. */
export function monthKey(periodEnd: string): string {
  return parseIsoDate(periodEnd, "Period end").slice(0, 7);
}

/** `2026-10` → `Oct 2026`. */
export function monthLabel(key: string): string {
  const p = parts(key);
  return p ? `${MONTHS[p.month - 1] ?? p.month} ${p.year}` : key;
}

/** `2026-10` → `Q4 2026`. */
export function quarterForMonth(key: string): string {
  const p = parts(key);
  return p ? `Q${Math.floor((p.month - 1) / 3) + 1} ${p.year}` : key;
}

/** The last day of the month a date falls in. */
export function monthEnd(iso: string): string {
  const [y, m] = parseIsoDate(iso).split("-").map(Number);
  const last = new Date(Date.UTC(y ?? 0, m ?? 1, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/** The first day of the month a date falls in. */
export function monthStart(iso: string): string {
  return `${parseIsoDate(iso).slice(0, 7)}-01`;
}

/** Shift a month key by `delta` months. */
export function shiftMonth(key: string, delta: number): string {
  const p = parts(key);
  if (!p) throw new Error(`'${key}' is not a YYYY-MM month key`);
  const total = p.year * 12 + (p.month - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** How often a cadence expects a declaration, in months. */
export function cadenceMonths(cadence: "monthly" | "quarterly" | "annual"): number {
  return cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12;
}

/**
 * The month keys a cadence expects to be paid, up to `through`.
 *
 * Used for the "what's due" list and the missing-dividend alert. Both are derived
 * from the schedule and the declarations that exist — never from a table of
 * expectations, because a row that remembers what a dividend *should* have been is
 * a second opinion that can disagree with the record.
 */
export function expectedKeys(
  cadence: "monthly" | "quarterly" | "annual" | "none",
  through: string,
  startsOn = "",
  endsOn = "",
): string[] {
  if (cadence === "none" || !through) return [];
  const step = cadenceMonths(cadence);
  const last = monthKey(through);

  // Back up far enough to be sure of covering the start.
  let key = shiftMonth(last, -(step * 4));
  const out: string[] = [];
  for (let i = 0; i < 480; i++) {
    key = shiftMonth(key, step);
    if (key > last) break;
    if (startsOn && monthKey(startsOn) > key) continue;
    if (endsOn && key > monthKey(endsOn)) break;
    out.push(key);
  }
  return out;
}

/** How many of the expected months are missing a declaration. */
export function coverage(
  expected: string[],
  declaredKeys: Set<string>,
): { paid: number; expected: number; missing: string[] } {
  const missing = expected.filter((k) => !declaredKeys.has(k));
  return { paid: expected.length - missing.length, expected: expected.length, missing };
}