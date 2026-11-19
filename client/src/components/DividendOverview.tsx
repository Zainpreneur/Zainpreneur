import { useEffect, useState } from "react";
import { formatMoney } from "@zainpreneur/shared";
import { api } from "../lib/api";
import { ResponsiveTable, FigureStrip, type Column } from "./Table";

/**
 * Dividends across the whole book.
 *
 * Three figures, and the gap between the first two is the answer: a dividend that
 * has been declared is not money that has been received. The original had a `basis`
 * column for that distinction, hardcoded it to "declared", never read it, and had
 * nowhere at all to record that a holder had actually been paid.
 */
interface OverviewRow {
  businessId: number;
  businessName: string;
  declared: number;
  received: number;
  outstanding: number;
  coverage: { frequency: string; expected: number; paid: number; missing: string[] } | null;
}

const overviewColumns: Array<Column<OverviewRow>> = [
  { key: "name", label: "Business", render: (b) => b.businessName },
  { key: "declared", label: "Declared", align: "right", render: (b) => formatMoney(b.declared) },
  { key: "received", label: "Received", align: "right", render: (b) => formatMoney(b.received) },
  {
    key: "outstanding",
    label: "Outstanding",
    align: "right",
    render: (b) =>
      b.outstanding > 0 ? (
        <span style={{ color: "var(--zp-bad)" }}>{formatMoney(b.outstanding)}</span>
      ) : (
        <span className="text-ink-3">—</span>
      ),
  },
  {
    key: "cadence",
    label: "Cadence",
    render: (b) =>
      b.coverage ? (
        <>
          <span className="tnum">
            {b.coverage.paid}/{b.coverage.expected}
          </span>{" "}
          {b.coverage.frequency}
          {b.coverage.missing.length > 0 && (
            <span style={{ color: "var(--zp-warn)" }}>
              {" "}· {b.coverage.missing.length} missing
            </span>
          )}
        </>
      ) : (
        <span className="text-ink-3">—</span>
      ),
  },
];

export function DividendOverview() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    let alive = true;
    api.dividendsOverview()
      .then((d) => alive && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data) {
    // Not `null`. A component that renders nothing while it fetches leaves a blank
    // gap with no explanation, which is the same failure as throwing — a blank page
    // behind a successful build.
    return (
      <Panel title="Dividends across the book">
        <Skeleton rows={4} />
      </Panel>
    );
  }

  if (data.payingCount === 0) {
    return (
      <Panel title="Dividends">
        <p className="px-[22px] pb-[22px] text-[0.875rem] text-ink-3">
          No dividends have been declared yet.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Dividends across the book">
      {/* One panel, three cells, divided by a painted 1px gap — figures are cells,
          not cards inside cards. Below a phone they stack, because three money
          figures side by side is a layout that only looks right on a monitor. */}
      <FigureStrip
        figures={[
          { label: "Declared", value: formatMoney(data.declared) },
          { label: "Received", value: formatMoney(data.received) },
          {
            label: "Outstanding",
            value: formatMoney(data.outstanding),
            tone: data.outstanding > 0 ? "bad" : "ok",
          },
        ]}
      />

      <ResponsiveTable
        caption="Dividends by business"
        columns={overviewColumns}
        rows={data.businesses}
        rowKey={(b) => b.businessId}
      />

      {(data.behindCount > 0 || data.staleMarkCount > 0) && (
        <p className="px-[22px] py-[14px] text-[0.8125rem] text-muted">
          {data.behindCount > 0 && (
            <span style={{ color: "var(--zp-warn)" }}>
              {data.behindCount} business behind its own dividend cadence.
            </span>
          )}
          {data.behindCount > 0 && data.staleMarkCount > 0 && " "}
          {data.staleMarkCount > 0 && (
            <span>
              {data.staleMarkCount} holding awaiting a valuation.
            </span>
          )}
        </p>
      )}
    </Panel>
  );
}

/**
 * Placeholder rows while a figure is being fetched.
 *
 * Motion is a slow opacity pulse, and `prefers-reduced-motion` removes it in
 * `index.css` — so a motion-sensitive user gets a static placeholder rather than
 * losing the only pending signal there is. The original made its one loading
 * indicator `aria-hidden="true"`, which told assistive technology to ignore the
 * only in-flight signal in the app.
 */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="px-[22px] pb-[22px]">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="mb-[9px] h-[13px] rounded-full bg-[var(--zp-surface-2)] motion-safe:animate-[zp-pulse_1.6s_ease-in-out_infinite]"
          style={{ width: `${88 - i * 14}%` }}
        />
      ))}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="rounded-[16px] border border-line bg-surface">
      <h2 className="px-[22px] pt-[18px] text-[1.0625rem] tracking-[-0.015em] text-ink">
        {title}
      </h2>
      <div className="pt-[12px]">{children}</div>
    </section>
  );
}

interface Overview {
  declared: number;
  received: number;
  outstanding: number;
  payingCount: number;
  behindCount: number;
  staleMarkCount: number;
  businesses: OverviewRow[];
}