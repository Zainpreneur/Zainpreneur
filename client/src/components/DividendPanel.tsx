import { useEffect, useState } from "react";
import { formatMoney } from "@zainpreneur/shared";
import { api, type BusinessRow } from "../lib/api";
import { ResponsiveTable, FigureStrip, type Column } from "./Table";

/**
 * One business's money.
 *
 * Three figures at the top, and the gap between the first two is the point: a
 * dividend that has been declared is not money that has been received. The original
 * had a `basis` column for this and hardcoded it to "declared", never read it, and
 * had nowhere at all to record that a holder had been paid.
 */
export function DividendPanel({ business }: { business: BusinessRow }) {
  const [data, setData] = useState<Receivable | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [trading, setTrading] = useState<Trading | null>(null);

  useEffect(() => {
    let alive = true;
    api.receivable(business.id).then((d) => alive && setData(d)).catch(() => {});
    api.coverage(business.id).then((d) => alive && setCoverage(d)).catch(() => {});
    api.trading(business.id).then((d) => alive && setTrading(d)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [business.id]);

  if (!data) {
    // A skeleton rather than `null`: a component that renders nothing while it
    // fetches leaves a blank gap with no explanation, which reads the same as a
    // crash. The panel announces itself as busy instead.
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="mt-8 rounded-[16px] border border-line bg-surface px-[22px] py-[22px]"
      >
        <span className="sr-only">Loading dividends…</span>
        {[88, 72, 80, 64].map((w, i) => (
          <div
            key={i}
            className="mb-[10px] h-[13px] rounded-full bg-[var(--zp-surface-2)] motion-safe:animate-[zp-pulse_1.6s_ease-in-out_infinite]"
            style={{ width: `${w}%` }}
          />
        ))}
      </section>
    );
  }

  const tradingColumns: Array<Column<CycleRow>> = [
    { key: "period", label: "Period", render: (c) => c.periodLabel },
    { key: "net", label: "Net", align: "right", render: (c) => formatMoney(c.net) },
    {
      key: "retained",
      label: "Retained",
      align: "right",
      secondary: true,
      render: (c) => (c.retained ? formatMoney(c.retained) : "—"),
    },
    {
      key: "distributable",
      label: "Shared out",
      align: "right",
      render: (c) => formatMoney(c.distributable),
    },
  ];

  return (
    <div className="mt-8 space-y-6">
      <Box title={`${business.name} — dividends`}>
        <FigureStrip
          figures={[
            { label: "Declared", value: formatMoney(data.declared) },
            { label: "Received", value: formatMoney(data.paid) },
            {
              label: "Outstanding",
              value: formatMoney(data.outstanding),
              tone: data.outstanding > 0 ? "bad" : "ok",
            },
          ]}
        />

        {data.perHolder.length === 0 ? (
          <p className="px-[22px] py-[16px] text-[0.875rem] text-ink-3">
            Nothing is outstanding — every declared dividend has been settled.
          </p>
        ) : (
          <ul>
            {data.perHolder.map((h) => (
              <li
                key={h.name}
                className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-line px-[22px] py-[10px]"
              >
                <span className="text-[0.9375rem] text-ink">{h.name}</span>
                <span className="tnum text-[0.9375rem]" style={{ color: "var(--zp-bad)" }}>
                  {formatMoney(h.outstanding)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {coverage && coverage.frequency !== "none" && (
          <p className="border-t border-line px-[22px] py-[12px] text-[0.8125rem] text-muted">
            {coverage.frequency === "monthly" ? "Pays monthly" : `Pays ${coverage.frequency}`} —{" "}
            <span className="tnum text-ink">
              {coverage.paid} of {coverage.expected} periods declared
            </span>
            {coverage.lastDeclared && <> · last declared {coverage.lastDeclared}</>}
            {coverage.missing.length > 0 && (
              <span style={{ color: "var(--zp-warn)" }}>
                {" "}
                · nothing recorded for {coverage.missing.join(", ")}
              </span>
            )}
          </p>
        )}
      </Box>

      <Box title="Monthly trading">
        {!trading ? (
          <p className="px-[22px] py-[16px] text-[0.875rem] text-ink-3" role="status">
            Loading trading periods…
          </p>
        ) : trading.cycles.length === 0 ? (
          <p className="px-[22px] py-[16px] text-[0.875rem] text-ink-3">
            No trading periods recorded.
          </p>
        ) : (
          <ResponsiveTable
            caption="Trading periods and what was shared out"
            columns={tradingColumns}
            rows={[...trading.cycles].reverse()}
            rowKey={(c) => c.id}
          />
        )}
      </Box>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[16px] border border-line bg-surface">
      <h2 className="px-[22px] pt-[18px] text-[1.0625rem] tracking-[-0.015em] text-ink">{title}</h2>
      <div className="pt-[12px]">{children}</div>
    </section>
  );
}

interface Receivable {
  declared: number;
  paid: number;
  outstanding: number;
  perHolder: Array<{ name: string; outstanding: number }>;
}
interface Coverage {
  frequency: string;
  expected: number;
  paid: number;
  missing: string[];
  lastDeclared: string | null;
}
interface CycleRow {
  id: number;
  periodLabel: string;
  net: number;
  retained: number;
  distributable: number;
}
interface Trading {
  cycles: CycleRow[];
}