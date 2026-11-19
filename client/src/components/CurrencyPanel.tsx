import { useEffect, useState } from "react";
import { fxApi, type RateQuote } from "../lib/api";
import { ResponsiveTable, FigureStrip } from "./Table";

/**
 * Currencies.
 *
 * The screen exists mostly to make one thing visible: what the book is kept in, and
 * which figures are in something else. Every amount elsewhere in this app is in the
 * currency of the row it came from, and this is where that stops being invisible.
 *
 * It also states the rule the rest of the system obeys, because a reader who does not
 * know a conversion needs a rate will assume one did not happen: **no rate, no
 * conversion.** A missing rate is refused rather than treated as a rate of one.
 */

/** Split out from the wrapper so it renders to a string in a test without a browser. */
export function CurrencyView({
  bookCurrency,
  inUse,
  rates,
  stale,
}: {
  bookCurrency: string;
  inUse: Array<{ currency: string; businesses: number; invoices: number }>;
  rates: RateQuote[];
  stale: Array<{ from: string; to: string; quotedOn: string; ageDays: number }>;
}): React.ReactElement {
  const missing = rates.filter((r) => r.rate === 0);
  const usable = rates.filter((r) => r.rate > 0);

  return (
    <section aria-labelledby="currency-heading">
      <h2 id="currency-heading" className="sr-only">
        Currencies
      </h2>

      <FigureStrip
        figures={[
          { label: "Book currency", value: bookCurrency },
          { label: "Currencies in use", value: String(inUse.length) },
          {
            label: "Rates needing attention",
            value: String(missing.length + stale.length),
            tone: missing.length + stale.length > 0 ? "bad" : undefined,
          },
        ]}
      />

      <p className="mt-3 text-[0.8125rem] text-ink-3">
        The book is kept in {bookCurrency}. Anything in another currency is left in that currency until it is
        converted, and converting needs a rate for the date in question — there is no default, so a missing
        rate stops the figure rather than quietly turning it into the same number.
      </p>

      {missing.length > 0 && (
        <div
          role="alert"
          className="mt-3 rounded-[12px] border px-3 py-2 text-[0.8125rem]"
          style={{
            borderColor: "var(--zp-border)",
            background: "color-mix(in srgb, var(--zp-danger) 9%, var(--zp-surface))",
            color: "var(--zp-danger)",
          }}
        >
          <strong className="font-semibold">No rate recorded.</strong>{" "}
          {missing.map((r) => `${r.from}→${r.to}`).join(", ")}{" "}
          {missing.length === 1 ? "is" : "are"} in use, so anything in{" "}
          {missing.map((r) => r.from).join(", ")} cannot be converted into {bookCurrency} at all.
        </div>
      )}

      {inUse.length > 1 && (
        <div className="mt-4">
          <ResponsiveTable
            caption="Currencies something is recorded in"
            columns={[
              { key: "currency", label: "Currency", render: (r: { currency: string }) => r.currency },
              {
                key: "businesses",
                label: "Businesses",
                align: "right",
                render: (r: { businesses: number }) => String(r.businesses),
              },
              {
                key: "invoices",
                label: "Invoices",
                align: "right",
                render: (r: { invoices: number }) => String(r.invoices),
              },
              {
                key: "rate",
                label: `Rate into ${bookCurrency}`,
                align: "right",
                render: (r: { currency: string }) => {
                  if (r.currency === bookCurrency) return <span className="text-ink-3">the book itself</span>;
                  const q = usable.find((x) => x.from === r.currency);
                  if (!q) return <span style={{ color: "var(--zp-bad)" }}>none recorded</span>;
                  return (
                    <span style={{ color: q.stale ? "var(--zp-warn)" : undefined }}>
                      {q.rate.toFixed(4)}
                      {q.stale && <span className="ml-1 text-ink-3">{q.ageDays}d old</span>}
                    </span>
                  );
                },
              },
            ]}
            rows={inUse}
            rowKey={(r) => r.currency}
          />
        </div>
      )}

      {usable.length > 0 && (
        <p className="mt-2 text-[0.75rem] text-ink-3">
          A converted figure carries the rate and the day it used, so it can be checked rather than taken on
          trust. {usable.map((q) => `${q.from}→${q.to} ${q.rate.toFixed(4)} on ${q.quotedOn}`).join(" · ")}.
        </p>
      )}

      {stale.length > 0 && (
        <p className="mt-2 text-[0.75rem]" style={{ color: "var(--zp-warn)" }}>
          {stale.map((s) => `${s.from}→${s.to} last quoted ${s.quotedOn} (${s.ageDays}d ago)`).join(" · ")}.
          Old rates still convert — for a past date an old rate is the correct rate — but a current figure
          should not be built on one.
        </p>
      )}
    </section>
  );
}

export function CurrencyPanel(): React.ReactElement {
  const [data, setData] = useState<Parameters<typeof CurrencyView>[0] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fxApi
      .position()
      .then((p) => alive && setData(p))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <p className="text-[0.875rem]" style={{ color: "var(--zp-danger)" }}>
        The currency position could not be read: {error}
      </p>
    );
  }
  if (!data) {
    return (
      <p aria-busy="true" className="text-[0.875rem] text-ink-3">
        Reading the currency position…
      </p>
    );
  }
  return <CurrencyView {...data} />;
}
