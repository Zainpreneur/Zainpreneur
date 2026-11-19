import { parseIsoDate, money } from "@zainpreneur/shared";

/**
 * Field validation.
 *
 * Every message carries the label *as the UI renders it*, echoes the value that
 * was rejected, and says what the fix is. The original's messages leaked raw enum
 * values — a form said "Client" while the error said `Relationship type must be
 * one of: client, equity, fully_owned` — and one was truncated at 200 characters
 * with no indication that it had been.
 */

export class FieldError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "FieldError";
    this.field = field;
  }
}

export function fail(field: string, message: string): never {
  throw new FieldError(field, message);
}

/** Trim and cap. Absent becomes empty, never `undefined`. */
export function clean(value: unknown, max = 200): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, max);
}

export function required(value: unknown, label: string, field = label): string {
  const v = clean(value);
  if (!v) fail(field, `${label} is required`);
  return v;
}

/** A required date. */
export function date(value: unknown, label: string, field = label): string {
  const v = clean(value);
  if (!v) fail(field, `${label} is required`);
  try {
    return parseIsoDate(v, label);
  } catch (err) {
    fail(field, (err as Error).message);
  }
}

/** An optional date: absent becomes empty, which callers store as NULL. */
export function optDate(value: unknown, label: string, field = label): string {
  const v = clean(value);
  if (!v) return "";
  try {
    return parseIsoDate(v, label);
  } catch (err) {
    fail(field, (err as Error).message);
  }
}

export function notFuture(value: string, label: string, field = label): string {
  const today = new Date().toISOString().slice(0, 10);
  if (value > today) fail(field, `${label} of ${value} is in the future`);
  return value;
}

/** An amount: a number, not negative, to the cent. */
export function amount(value: unknown, label: string, field = label): number | null {
  if (value === null || value === undefined || clean(value) === "") return null;
  const n = typeof value === "number" ? value : Number(clean(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) fail(field, `${label} needs to be an amount, not '${clean(value)}'`);
  if (n < 0) fail(field, `${label} cannot be negative, and this is ${n}`);
  return money(n);
}

/** An amount that must be present — a row with no number cannot be totalled. */
export function requiredAmount(value: unknown, label: string, field = label): number {
  const n = amount(value, label, field);
  if (n === null) fail(field, `${label} is required`);
  return n;
}

export function positive(value: unknown, label: string, field = label): number {
  const n = requiredAmount(value, label, field);
  if (n <= 0) fail(field, `${label} has to be more than nothing`);
  return n;
}

/** Membership in a closed set, reported with the label the UI shows. */
export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  labels: Record<string, string> | undefined,
  field = label,
): T {
  const v = clean(value).toLowerCase();
  if (!v) fail(field, `${label} is required`);
  if (!(allowed as readonly string[]).includes(v)) {
    fail(field, `${label} must be one of: ${allowed.map((a) => labels?.[a] ?? a).join(", ")}`);
  }
  return v as T;
}

export function id(value: unknown, label: string, field = label): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) fail(field, `${label} is required`);
  return Math.trunc(n);
}

export function bool(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  return false;
}

/** A SQLite binding. `node:sqlite` refuses booleans, `undefined` and `Date`. */
export function bind(value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "string") return value;
  return String(value);
}