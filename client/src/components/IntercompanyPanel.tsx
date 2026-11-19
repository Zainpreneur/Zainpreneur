import { useEffect, useState } from "react";
import { formatMoney } from "@zainpreneur/shared";
import {
  intercompanyApi,
  type ConsolidationRow,
  type IntercompanyCharge,
} from "../lib/api";
import { ResponsiveTable, FigureStrip, type Column } from "./Table";

/**
 * Work done inside the group.
 *
 * Shown because it is the one figure in this system that is not what it looks like.
 * A management fee from the portfolio owner to a company it wholly owns is revenue to
 * one and a cost to the other — and to nobody outside. Presenting either side alone is
 * how internal work ends up reported as growth.
 *
 * Two numbers, side by side, and the point of the screen is the disagreement between
 * them:
 *
 *   **the group total never changes** when group companies trade with each other,
 *   because the transfer was income to one and a cost to another. That is not a bug to
 *   be corrected; it is the proof that nothing was created.
 *   **a charge to the owner really does leave**, and is never added back, because its
 *   other half is not in this set at all.
 */

/** Split out from the wrapper so it renders to a string in a test without a browser. */
export function IntercompanyView({
  charges,
  consolidation,
}: {
  charges: IntercompanyCharge[];
  consolidation: {
    rows: ConsolidationRow[];
    groupBusinesses: number;
    reportedNet: number;
    eliminatedWithinGroup: number;
    standaloneTotal: number;
    paidToPrincipal: number;
    proposed: number;
    proposedAmount: number;
    reconciles: boolean;
    problems: string[];
  };
}): React.ReactElement {
  const c = consolidation;
  const settled = charges.filter((x) => x.status === "settled");
  const proposed = charges.filter((x) => x.status === "proposed");

  return (
    <section aria-labelledby="intercompany-heading">
      <h2 id="intercompany-heading" className="sr-only">
        Intercompany
      </h2>

      <FigureStrip
        figures={[
          { label: "Group result", value: formatMoney(c.reportedNet) },
          { label: "Charged to the owner", value: formatMoney(c.paidToPrincipal), tone: "bad" },
          { label: "Proposed, not yet recognised", value: formatMoney(c.proposedAmount) },
        ]}
      />

      {/* If this reconciliation fails, something is half recorded. It is stated rather
          than left for the reader to infer from a total that looks plausible. */}
      {!c.reconciles && (
        <div
          role="alert"
          className="mt-3 rounded-[12px] border px-3 py-2 text-[0.8125rem]"
          style={{
            borderColor: "var(--zp-border)",
            background: "color-mix(in srgb, var(--zp-danger) 9%, var(--zp-surface))",
            color: "var(--zp-danger)",
          }}
        >
          <strong className="font-semibold">The group does not reconcile.</strong>
          <ul className="mt-1 list-inside list-disc">
            {c.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[0.8125rem] text-ink-3">
        {c.groupBusinesses === 1
          ? "One company is wholly owned, so there is nothing inside the group to eliminate — a charge to the owner leaves it and is never added back."
          : "Trading between group companies is removed from each company's own figure. It does not change the group total, because it was income to one and a cost to another."}{" "}
        Removing it moved the total by {formatMoney(c.eliminatedWithinGroup)}.
      </p>

      {c.rows.length > 0 && (
        <div className="mt-4">
          <ResponsiveTable
            caption={`${c.rows.length} company in the group`}
            columns={[
              { key: "name", label: "Company", render: (r: ConsolidationRow) => r.businessName },
              {
                key: "reported",
                label: "As reported",
                align: "right",
                render: (r: ConsolidationRow) => formatMoney(r.reportedNet),
              },
              {
                key: "toGroup",
                label: "Charged to the group",
                align: "right",
                render: (r: ConsolidationRow) =>
                  r.chargedToGroup > 0 ? (
                    <span style={{ color: "var(--zp-ok)" }}>{formatMoney(r.chargedToGroup)}</span>
                  ) : (
                    <span className="text-ink-3">—</span>
                  ),
              },
              {
                key: "byGroup",
                label: "Charged by the group",
                align: "right",
                render: (r: ConsolidationRow) =>
                  r.chargedByGroup > 0 ? (
                    <span style={{ color: "var(--zp-bad)" }}>{formatMoney(r.chargedByGroup)}</span>
                  ) : (
                    <span className="text-ink-3">—</span>
                  ),
              },
              {
                key: "standalone",
                label: "Standalone",
                align: "right",
                render: (r: ConsolidationRow) => formatMoney(r.standaloneNet),
              },
            ]}
            rows={c.rows}
            rowKey={(r) => String(r.businessId)}
          />
        </div>
      )}

      <div className="mt-5">
        <h3 className="mb-2 text-[0.9375rem] font-semibold">Charges</h3>
        {charges.length === 0 ? (
          <p className="text-[0.875rem] text-ink-3">Nothing has been charged internally.</p>
        ) : (
          <ResponsiveTable
            caption={`${charges.length} internal charge${charges.length === 1 ? "" : "s"}`}
            columns={[
              { key: "number", label: "Reference", render: (c: IntercompanyCharge) => c.number },
              {
                key: "parties",
                label: "From → to",
                render: (c: IntercompanyCharge) => `${c.sides[0].name} → ${c.sides[1].name}`,
              },
              { key: "basis", label: "For", render: (c: IntercompanyCharge) => c.basisLabel },
              {
                key: "amount",
                label: "Amount",
                align: "right",
                render: (c: IntercompanyCharge) => formatMoney(c.amount),
              },
              {
                key: "status",
                label: "Status",
                render: (c: IntercompanyCharge) => (
                  <span style={{ color: c.status === "proposed" ? "var(--zp-warn)" : "var(--zp-ok)" }}>
                    {c.status === "proposed"
                      ? "Proposed"
                      : c.status === "confirmed"
                        ? "Confirmed"
                        : "Settled"}
                  </span>
                ),
              },
            ]}
            rows={charges}
            rowKey={(c) => String(c.id)}
          />
        )}
        {proposed.length > 0 && (
          <p className="mt-2 text-[0.75rem] text-ink-3">
            {proposed.length} charge{proposed.length === 1 ? " is" : "s are"} proposed only. A fee nobody
            has agreed to has not been recognised, so it is shown and not taken into the group result.
            {settled.length > 0 && ` ${settled.length} settled.`}
          </p>
        )}
      </div>
    </section>
  );
}

export function IntercompanyPanel(): React.ReactElement {
  const [data, setData] = useState<{
    charges: IntercompanyCharge[];
    consolidation: Parameters<typeof IntercompanyView>[0]["consolidation"];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([intercompanyApi.charges(), intercompanyApi.consolidation()])
      .then(([ch, consolidation]) => alive && setData({ charges: ch.charges, consolidation }))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <p className="text-[0.875rem]" style={{ color: "var(--zp-danger)" }}>
        The group position could not be read: {error}
      </p>
    );
  }
  if (!data) {
    return (
      <p aria-busy="true" className="text-[0.875rem] text-ink-3">
        Reading the group position…
      </p>
    );
  }
  return <IntercompanyView {...data} />;
}