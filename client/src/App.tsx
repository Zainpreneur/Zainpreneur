import { useEffect, useState } from "react";
import { api, ApiFailure, type BusinessList, type BusinessRow } from "./lib/api";
import { BusinessTable } from "./components/BusinessTable";
import { DividendOverview } from "./components/DividendOverview";
import { DividendPanel } from "./components/DividendPanel";
import { TrackRecordPanel } from "./components/TrackRecordPanel";
import { ReceivablesPanel } from "./components/ReceivablesPanel";
import { IntercompanyPanel } from "./components/IntercompanyPanel";
import { CurrencyPanel } from "./components/CurrencyPanel";

/**
 * Phase 6 shell.
 *
 * The book-level dividend figures sit above the register because they are the
 * first thing worth knowing about a book that pays monthly, and hiding them
 * behind a click would make the capability invisible.
 */
export function App() {
  const [data, setData] = useState<BusinessList | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A server that is not running is a different problem from a server that refused,
  // and the message should say which.
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState<BusinessRow | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .businesses()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
        setOffline(false);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
        setOffline(e instanceof ApiFailure && e.offline);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1180px] px-[clamp(16px,4vw,34px)] py-[clamp(16px,4vw,34px)]">
      <header className="mb-8">
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] tracking-[-0.02em] after:mt-[14px] after:block after:h-[5px] after:w-[46px] after:rounded-full after:bg-[linear-gradient(90deg,var(--zp-gold),var(--zp-gold-deep))]">
          Zainpreneur Business Portfolio
        </h1>
        <p className="mt-4 max-w-[62ch] text-[0.9375rem] text-muted">
          An internal portfolio and operations platform for Zainpreneur Nominees Ltd — every
          business, stake, valuation, dividend and exit in one register.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-[12px] border px-4 py-3 text-[0.875rem]"
          style={{
            borderColor: "var(--zp-border)",
            background: "color-mix(in srgb, var(--zp-danger) 9%, var(--zp-surface))",
            color: "var(--zp-danger)",
          }}
        >
          <strong className="font-semibold">
            {offline ? "The register cannot reach the API." : "Something went wrong."}
          </strong>{" "}
          {error}
        </div>
      )}

{/* The track record leads, because it is what the register is for. It reads its
            own data, so it appears without waiting on the business list. */}
        <div className="mb-6">
          <TrackRecordPanel />
        </div>

        {!data && !error && (
          <p className="text-[0.875rem] text-ink-3" role="status">
            Loading the register…
          </p>
        )}

      {data && (
        <div className="space-y-6">
          <DividendOverview />

          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[1.0625rem] tracking-[-0.015em] text-ink">The register</h2>
              <p className="text-[0.75rem] text-ink-3 tnum">
                {data.total} business{data.total === 1 ? "" : "es"}
              </p>
            </div>
            <BusinessTable rows={data.items as BusinessRow[]} onSelect={setSelected} />
            <p className="mt-2 text-[0.75rem] text-ink-3">
              Choose a business to see its valuations and monthly dividends.
            </p>
          </div>

          {selected && <DividendPanel business={selected} />}
        </div>
      )}
    </div>
  );
}