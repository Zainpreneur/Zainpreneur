import { all, num, one, run, tx, now } from "../db/client.js";
import type { DatabaseSync } from "node:sqlite";
import { date, fail, id, notFuture, positive, clean, amount } from "../lib/validate.js";
import { money } from "@zainpreneur/shared";

/**
 * Valuations — the series of marks on a business's equity.
 *
 * The series is the truth. `businesses.valuation` is a cache of its latest entry,
 * and it is the *only* derived column the book is allowed to store, because the
 * list and tile queries need it on every row and a correlated subquery per row was
 * measurably slow. Every write to that cache happens in `refreshMarkCache`, and a
 * test asserts nothing else touches it.
 */

export interface Mark {
  id: number;
  businessId: number;
  valuedOn: string;
  valuation: number | null;
  note: string;
  voided: boolean;
  method: string;
  source: string;
  audited: boolean;
}

function toMark(r: Record<string, unknown>): Mark {
  return {
    id: Number(r.id),
    businessId: Number(r.business_id),
    valuedOn: String(r.valued_on),
    valuation: r.valuation === null || r.valuation === undefined ? null : Number(r.valuation),
    note: String(r.note ?? ""),
    voided: Number(r.voided ?? 0) > 0,
    method: String(r.method ?? ""),
    source: String(r.source ?? ""),
    audited: Number(r.audited ?? 0) > 0,
  };
}

/**
 * The series oldest to newest.
 *
 * Order matters: "the move" between two marks is only computable in one direction,
 * and the original walked the series backwards for history and forwards for change.
 */
export function valuationHistory(businessId: number, includeVoided = false): Mark[] {
  return all<Record<string, unknown>>(
    `SELECT * FROM valuations
      WHERE business_id = ? ${includeVoided ? "" : "AND voided = 0"}
      ORDER BY valued_on ASC, id ASC`,
    [businessId],
  ).map(toMark);
}

export function currentMark(businessId: number): Mark | null {
  const rows = valuationHistory(businessId);
  return rows.length ? rows[rows.length - 1]! : null;
}

export interface MarkChange {
  from: string;
  to: string;
  fromValue: number;
  toValue: number;
  change: number;
  changePct: number | null;
  direction: "up" | "down" | "flat";
  /** A drop of a fifth or more is a write-down worth naming rather than showing. */
  writeDown: boolean;
}

/**
 * Change between consecutive marks.
 *
 * Derived on read. Nothing stores a percentage change, because a stored percentage
 * is a figure that can disagree with the two numbers it came from.
 */
export function markChanges(businessId: number): MarkChange[] {
  const marks = valuationHistory(businessId).filter((m) => m.valuation !== null);
  const out: MarkChange[] = [];
  for (let i = 1; i < marks.length; i++) {
    const a = marks[i - 1]!;
    const b = marks[i]!;
    const fromValue = a.valuation!;
    const toValue = b.valuation!;
    const change = money(toValue - fromValue);
    const changePct = fromValue === 0 ? null : money(((toValue - fromValue) / fromValue) * 100);
    out.push({
      from: a.valuedOn,
      to: b.valuedOn,
      fromValue,
      toValue,
      change,
      changePct,
      direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
      writeDown: fromValue > 0 && toValue / fromValue <= 0.8,
    });
  }
  return out;
}

/**
 * The single sanctioned write to the cached mark.
 *
 * Takes the caller's transaction connection so the cache is written in the same
 * transaction as the mark it reflects — a cache that can lag its own source is a
 * second opinion, which is the thing this whole design refuses.
 */
function refreshMarkCache(c: DatabaseSync, businessId: number): void {
  const row = one<{ valuation: number | null; valued_on: string }>(
    `SELECT valuation, valued_on FROM valuations
      WHERE business_id = ? AND voided = 0
      ORDER BY valued_on DESC, id DESC LIMIT 1`,
    [businessId],
  );
  c.prepare(
    "UPDATE businesses SET valuation=?, valued_on=?, updated_at=?, rev=rev+1 WHERE id=?",
  ).run(row?.valuation ?? null, row?.valued_on ?? "", now(), businessId);
}

export async function recordValuation(data: {
  businessId: number;
  valuedOn: string;
  valuation: unknown;
  note?: string;
  method?: string;
  source?: string;
  audited?: boolean;
}): Promise<Mark> {
  const businessId = id(data.businessId, "Business", "business_id");
  const on = date(data.valuedOn, "Valuation date", "valued_on");
  notFuture(on, "A valuation date");

  if (num("SELECT COUNT(*) FROM businesses WHERE id = ? AND deleted_at IS NULL", [businessId]) === 0) {
    fail("business_id", "That business is not in the register");
  }

  const value = amount(data.valuation, "Valuation");
  if (value === null) fail("valuation", "A valuation needs a value");
  if (value <= 0) fail("valuation", "A valuation cannot be zero or negative");

  const clash = one<{ id: number; valued_on: string }>(
    "SELECT id, valued_on FROM valuations WHERE business_id = ? AND valued_on = ?",
    [businessId, on],
  );
  if (clash) {
    fail("valued_on", `This business already has a mark dated ${clash.valued_on}`);
  }

  const ts = now();
  const note = clean(data.note, 200);
  const method = clean(data.method, 40);
  const source = clean(data.source, 120);
  const audited = data.audited ? 1 : 0;

  const created = await tx(async (db) => {
    const cur = db
      .prepare(
        `INSERT INTO valuations
           (business_id, valued_on, valuation, note, voided, method, source, audited, created_at, rev)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 1)`,
      )
      .run(businessId, on, value, note, method, source, audited, ts);
    refreshMarkCache(db, businessId);
    return Number(cur.lastInsertRowid);
  });

  return { id: created, businessId, valuedOn: on, valuation: value, note, voided: false, method, source, audited: !!audited };
}

/**
 * Void a mark rather than deleting it.
 *
 * A valuation is a statement about a date; removing it would let the next mark
 * silently become the first, and the history is the point.
 */
export async function clearValuation(businessId: number, markId: number): Promise<void> {
  const businessIdNum = id(businessId, "Business", "business_id");
  const idNum = id(markId, "Valuation", "id");
  const found = one<{ id: number; valuation: number }>(
    "SELECT id, valuation FROM valuations WHERE id = ? AND business_id = ? AND voided = 0",
    [idNum, businessIdNum],
  );
  if (!found) fail("id", "There is no live mark with that id on this business");

  const ts = now();
  await tx(async (db) => {
    db.prepare("UPDATE valuations SET voided=1 WHERE id=?").run(idNum);
    refreshMarkCache(db, businessIdNum);
  });
  void ts;
}

/**
 * What an open position is worth.
 *
 * A business with no mark is reported at cost and *says so* — `basis` and
 * `status` are part of the answer. The original did this well and it is kept: a
 * cost shown without that label is a valuation nobody can support.
 */
export function positionValue(businessId: number, equityPercent: number) {
  const mark = currentMark(businessId);
  if (!mark || mark.valuation === null) {
    return {
      basis: "cost" as const,
      status: "unmarked" as const,
      value: null,
      markedOn: null,
      note: "Reported at cost — this business has never been marked.",
    };
  }
  return {
    basis: "mark" as const,
    status: "marked" as const,
    value: money((mark.valuation * equityPercent) / 100),
    markedOn: mark.valuedOn,
    note: "",
  };
}

/** Marks old enough to be worth revisiting, measured against the open book. */
export interface StaleMark {
  id: number;
  name: string;
  /** Null when the business has never been marked at all. */
  lastMarked: string | null;
  stale: boolean;
}

export function staleMarks(olderThanDays = 365): StaleMark[] {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString().slice(0, 10);
  return all<{ id: number; name: string; last_marked: string | null }>(
    `SELECT b.id, b.name,
            (SELECT MAX(valued_on) FROM valuations v
              WHERE v.business_id = b.id AND v.voided = 0) AS last_marked
       FROM businesses b
      WHERE b.deleted_at IS NULL AND b.status = 'active'
        AND EXISTS (SELECT 1 FROM business_stakeholders x
                     WHERE x.business_id = b.id AND x.exited_on IS NULL AND x.equity > 0)`,
  )
    .map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      lastMarked: r.last_marked ?? null,
      stale: r.last_marked === null || r.last_marked < cutoff,
    }))
    .filter((r) => r.stale);
}

export function recordVoided(businessId: number, valuationId: number) {
  const businessIdNum = id(businessId, "Business", "business_id");
  const valuationIdNum = id(valuationId, "Valuation", "id");
  if (!one("SELECT 1 FROM valuations WHERE id=? AND business_id=?", [valuationIdNum, businessIdNum])) {
    fail("id", "There is no live mark with that id on this business");
  }
  return tx(async (db) => {
    db.prepare("UPDATE valuations SET voided=1 WHERE id=?").run(valuationIdNum);
    refreshMarkCache(db, businessIdNum);
  });
}

export { positive };