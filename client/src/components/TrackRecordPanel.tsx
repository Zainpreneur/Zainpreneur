import { useEffect, useState } from "react";
import { formatMoney } from "@zainpreneur/shared";
import { returnsApi, type Multiple, type TrackRecord } from "../lib/api";
import { ResponsiveTable, FigureStrip, type Column } from "./Table";

/**
 * The track record.
 *
 * This is the screen the whole register exists to produce, and it is built around one
 * distinction the original flattened: **capital that came home is not a return.**
 * Getting your own money back is not income, so it does not appear as a gain — and a
 * multiple with no capital behind it is left blank rather than printed as 0x, because
 * "0x" and "nothing to measure" are different facts.
 *
 * Everything here is read from derived figures. Nothing on this screen is stored, so
 * nothing on it can drift away from the events that produced it.
 */

/** A multiple, or the reason there isn't one. */
function multiple(value: Multiple): React.ReactElement {
  if (value === null) {
    return <span className="text-ink-3">—</span>;
  }
  return <span>{value.toFixed(2)}x</span>;
}

/** IRR is a rate, so it is a percentage; the multiples beside it are not. */
function rate(value: number | null): React.ReactElement {
  if (value === null) {
    return <span className="text-ink-3">—</span>;
  }
  return (
    <span style={{ color: value < 0 ? "var(--zp-bad)" : "var(--zp-ok)" }}>
      {(value * 100).toFixed(1)}%
    </span>
  );
}

const openColumns: Array<Column<TrackRecord["open"][number]>> = [
  { key: "name", label: "Business", render: (p) => p.businessName },
  { key: "equity", label: "Held", align: "right", render: (p) => `${p.equity}%` },
  { key: "cost", label: "Cost", align: "right", render: (p) => formatMoney(p.cost) },
  {
    key: "value",
    label: "Value",
    align: "right",
    // An unmarked holding is shown at cost, and *says* so in the same cell. Showing a
    // cost beside a mark without distinguishing them is how a portfolio comes to look
    // worth more than anyone can support.
    render: (p) => (
      <span>
        {formatMoney(p.value)}
        {p.basis === "cost" && (
          <span className="ml-1 text-ink-3" title="No valuation on record — shown at cost">
            at cost
          </span>
        )}
      </span>
    ),
  },
  {
    key: "dividends",
    label: "Dividends",
    align: "right",
    render: (p) => (p.distributionsReceived > 0 ? formatMoney(p.distributionsReceived) : <span className="text-ink-3">—</span>),
  },
];

const realisedColumns: Array<Column<TrackRecord["realised"][number]>> = [
  { key: "name", label: "Business", render: (p) => p.businessName },
  { key: "cost", label: "Cost", align: "right", render: (p) => formatMoney(p.cost) },
  { key: "proceeds", label: "Proceeds", align: "right", render: (p) => formatMoney(p.proceeds) },
  {
    key: "profit",
    label: "Profit",
    align: "right",
    render: (p) => (
      <span style={{ color: p.profit < 0 ? "var(--zp-bad)" : "var(--zp-ok)" }}>
        {formatMoney(p.profit)}
      </span>
    ),
  },
  { key: "moic", label: "Multiple", align: "right", render: (p) => multiple(p.moic) },
  { key: "held", label: "Held", align: "right", render: (p) => `${p.yearsHeld.toFixed(1)}y` },
];

/**
 * The presentational half, taking its data as a prop.
 *
 * Split from the fetching wrapper so it can be rendered to a string in a test without a
 * browser — which is the only way to catch a thrown render behind a clean build.
 */
export function TrackRecordView({ data }: { data: TrackRecord }): React.ReactElement {
  if (!data.totals) {
    return <p className="text-[0.875rem] text-ink-3">{data.note ?? "No track record yet."}</p>;
  }

  const t = data.totals;

  return (
    <section aria-labelledby="track-heading">
      <h2 id="track-heading" className="sr-only">
        Track record
      </h2>

      <FigureStrip
        figures={[
          { label: "Paid in", value: formatMoney(t.realisedCost + t.openCost) },
          { label: "Received", value: formatMoney(t.realisedProceeds + t.distributionsReceived) },
          {
            label: "Capital at work",
            value: formatMoney(t.openCost),
          },
        ]}
      />

      {/* Multiples are on their own row because they are not money, and printing them
          in the same strip as money invites reading one as the other. */}
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "MOIC", value: multiple(t.moic) },
          { label: "TVPI", value: multiple(t.tvpi) },
          { label: "DPI", value: multiple(t.dpi) },
          { label: "IRR, annualised", value: rate(t.irr) },
        ].map((f) => (
          <div key={f.label} className="rounded-[12px] border border-hairline bg-surface-2 px-3 py-2">
            <dt className="text-[0.6875rem] tracking-[0.08em] text-ink-3 uppercase">{f.label}</dt>
            <dd className="mt-0.5 text-[1.125rem] font-semibold tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>

      {/* IRR counts only cash that has actually moved, so on a portfolio still holding
          most of its value it reads far worse than TVPI does. Neither figure is wrong;
          they answer different questions, and saying so is the difference between an
          honest return figure and an alarming one. */}
      <p className="mt-2 text-[0.75rem] text-ink-3">
        IRR counts only cash that has actually moved in or out, so with {formatMoney(t.openCost)}{" "}
        still at work it reads well below TVPI. TVPI counts what is still held; DPI counts
        only what has come back.
      </p>

      {t.unmarkedPositions > 0 && (
        <p
          className="mt-3 rounded-[12px] border px-3 py-2 text-[0.8125rem]"
          style={{
            borderColor: "var(--zp-border)",
            background: "color-mix(in srgb, var(--zp-warn) 8%, var(--zp-surface))",
            color: "var(--zp-warn)",
          }}
        >
          {t.unmarkedPositions === 1
            ? "One holding has no valuation on record and is shown at cost."
            : `${t.unmarkedPositions} holdings have no valuation on record and are shown at cost.`}
        </p>
      )}

      <div className="mt-5">
        <h3 className="mb-2 text-[0.9375rem] font-semibold">Still held</h3>
        {data.open.length === 0 ? (
          <p className="text-[0.875rem] text-ink-3">Nothing is held at the moment.</p>
        ) : (
          <ResponsiveTable
            caption={`${data.open.length} holding${data.open.length === 1 ? "" : "s"} still held`}
            columns={openColumns}
            rows={data.open}
            rowKey={(p) => String(p.businessId)}
          />
        )}
      </div>

      {data.realised.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-[0.9375rem] font-semibold">Sold</h3>
          <ResponsiveTable
            caption={`${data.realised.length} position${data.realised.length === 1 ? "" : "s"} sold`}
            columns={realisedColumns}
            rows={data.realised}
            rowKey={(p) => `${p.businessId}-${p.closedOn}`}
          />
        </div>
      )}
    </section>
  );
}

export function TrackRecordPanel(): React.ReactElement {
  const [data, setData] = useState<TrackRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    returnsApi
      .track()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <p className="text-[0.875rem]" style={{ color: "var(--zp-danger)" }}>
        The track record could not be read: {error}
      </p>
    );
  }

  // A skeleton that says what is loading, rather than a blank panel.
  if (!data) {
    return (
      <p aria-busy="true" className="text-[0.875rem] text-ink-3">
        Reading the dated cash flows…
      </p>
    );
  }

  return <TrackRecordView data={data} />;
}

