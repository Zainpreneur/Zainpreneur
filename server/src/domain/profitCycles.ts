import { all, num, one, now, tx } from "../db/client.js";
import {
  amount as vAmount,
  clean,
  date,
  fail,
  id,
  notFuture,
  optDate,
} from "../lib/validate.js";
import { money, monthEnd, monthKey, monthStart, quarterForMonth, monthLabel } from "@zainpreneur/shared";
import { recordDistribution } from "./dividends.js";

/**
 * Profit cycles — one period of trading, from which any dividend is derived.
 *
 * `net` is worked out on read and never stored. The distributable is
 * `gross − expenses − retained`: the original distributed the *whole* net with no
 * reserve, so a venture that kept back a share of profit recorded a dividend it
 * never actually paid. Recording the cycle is what makes the dividend traceable
 * back to trading rather than typed in by hand.
 */

export interface Cycle {
  id: number;
  businessId: number;
  businessName: string;
  periodLabel: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  grossRevenue: number;
  operatingExpenses: number;
  retained: number;
  note: string;
  /** Worked out, not stored. */
  net: number;
  distributable: number;
  marginPct: number | null;
}

function toCycle(r: Record<string, unknown>): Cycle {
  const grossRevenue = money(Number(r.gross_revenue ?? 0));
  const expenses = money(Number(r.operating_expenses ?? 0));
  const retained = money(Number(r.retained ?? 0));
  const net = money(grossRevenue - expenses);
  return {
    id: Number(r.id),
    businessId: Number(r.business_id),
    businessName: String(r.business_name ?? ""),
    periodLabel: String(r.period_label ?? ""),
    periodKey: String(r.period_key ?? ""),
    periodStart: String(r.period_start ?? ""),
    periodEnd: String(r.period_end ?? ""),
    grossRevenue,
    operatingExpenses: expenses,
    retained,
    note: String(r.note ?? ""),
    net,
    distributable: money(Math.max(0, net - retained)),
    marginPct: grossRevenue === 0 ? null : money((net / grossRevenue) * 100),
  };
}

const CYCLE_SELECT = `
  SELECT p.*, b.name AS business_name
    FROM profit_cycles p JOIN businesses b ON b.id = p.business_id`;

export function listCycles(businessId?: number, limit = 200): Cycle[] {
  if (businessId) {
    return all<Record<string, unknown>>(
      `${CYCLE_SELECT} WHERE p.business_id = ? ORDER BY p.period_end DESC, p.id DESC LIMIT ?`,
      [businessId, limit],
    ).map(toCycle);
  }
  return all<Record<string, unknown>>(
    `${CYCLE_SELECT} ORDER BY p.period_end DESC, p.id DESC LIMIT ?`,
    [limit],
  ).map(toCycle);
}

export function getCycle(cycleId: number): Cycle | null {
  const row = one<Record<string, unknown>>(`${CYCLE_SELECT} WHERE p.id = ?`, [cycleId]);
  return row ? toCycle(row) : null;
}

/**
 * Close a trading period and share out what it made.
 *
 * The dividend is written by the same transaction that records the cycle, so a
 * period and the payment it produced cannot come apart.
 */
export async function recordProfitCycle(data: {
  businessId: number;
  periodEnd: unknown;
  periodStart?: unknown;
  periodLabel?: string;
  grossRevenue: unknown;
  operatingExpenses: unknown;
  retained?: unknown;
  note?: string;
  /** Set false to close a period without distributing. */
  distribute?: boolean;
}): Promise<{ cycle: Cycle; distributed: number }> {
  const businessId = id(data.businessId, "Business", "business_id");
  if (num("SELECT COUNT(*) FROM businesses WHERE id=? AND deleted_at IS NULL", [businessId]) === 0) {
    fail("business_id", "That business is not in the register");
  }

  const end = date(data.periodEnd, "Period end", "period_end");
  notFuture(end, "A period cannot end in the future");
  const start = optDate(data.periodStart, "Period start", "period_start");
  if (start && start > end) fail("period_start", "The period starts after it ends");

  const key = monthKey(end);
  const label = clean(data.periodLabel, 40) || monthLabel(key);
  const gross = vAmount(data.grossRevenue, "Gross revenue", "gross_revenue") ?? 0;
  const expenses = vAmount(data.operatingExpenses, "Operating expenses", "operating_expenses") ?? 0;
  const retained = vAmount(data.retained, "Retained", "retained") ?? 0;
  if (gross === 0 && expenses === 0) fail("gross_revenue", "A cycle needs revenue or expenses against it");

  const net = money(gross - expenses);
  // Retaining is only meaningful out of a surplus. A loss period distributes
  // nothing and there is nothing to retain — `retained > net` alone would fire on a
  // loss, because 0 is greater than a negative number.
  if (retained > 0 && net <= 0) {
    fail("retained", "A loss period has nothing to retain, and nothing is distributed");
  }
  if (net > 0 && retained > net) {
    fail("retained", `You cannot retain ${retained} from a net of ${net}`);
  }
  const distributable = money(Math.max(0, net - retained));

  // The canonical key is what stops the same month being recorded twice under two
  // different spellings of its label.
  const dupKey = one<{ period_label: string }>(
    "SELECT period_label FROM profit_cycles WHERE business_id=? AND period_key=? AND period_key<>''",
    [businessId, key],
  );
  if (dupKey) {
    fail("period_end", `This business already has a cycle for ${monthLabel(key)} (labelled "${dupKey.period_label}")`);
  }

  const ts = now();
  const note = clean(data.note, 200);
  const wantDividend = data.distribute !== false;

  if (wantDividend && distributable > 0) {
    const clash = one<{ id: number }>(
      "SELECT id FROM dividends WHERE business_id=? AND declared_on=?",
      [businessId, end],
    );
    if (clash) {
      fail(
        "period_end",
        `This business already has a distribution dated ${end} — remove it first if this cycle is what paid it`,
      );
    }
  }

  const cycleId = await tx(async (db) => {
    const cur = db
      .prepare(
        `INSERT INTO profit_cycles
           (business_id, period_label, period_start, period_end, gross_revenue,
            operating_expenses, retained, note, period_key, frequency, created_at, rev)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'monthly', ?, 1)`,
      )
      .run(businessId, label, start || monthStart(end), end, gross, expenses, retained, note, key, ts);
    return Number(cur.lastInsertRowid);
  });

  let distributed = 0;
  if (wantDividend && distributable > 0) {
    const declaration = await recordDistribution({
      businessId,
      declaredOn: end,
      amount: distributable,
      kind: "dividend",
      note: `${label} profit share`,
      periodKey: key,
    });
    distributed = declaration.amount;
  }

  return { cycle: getCycle(cycleId)!, distributed };
}

/** Trailing figures for a business, newest period first. */
export function tradingSummary(businessId: number) {
  const cycles = listCycles(businessId);
  const revenue = money(cycles.reduce((t, c) => t + c.grossRevenue, 0));
  const expenses = money(cycles.reduce((t, c) => t + c.operatingExpenses, 0));
  const retained = money(cycles.reduce((t, c) => t + c.retained, 0));
  const net = money(revenue - expenses);
  return {
    periods: cycles.length,
    revenue,
    expenses,
    retained,
    net,
    marginPct: revenue === 0 ? null : money((net / revenue) * 100),
    lastPeriod: cycles[0]?.periodEnd ?? null,
  };
}

export { quarterForMonth };