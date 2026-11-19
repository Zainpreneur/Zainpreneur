import { useEffect, useState } from "react";
import { formatMoney } from "@zainpreneur/shared";
import { invoicingApi, type Invoice, type ReceivableRow } from "../lib/api";
import { ResponsiveTable, FigureStrip, type Column } from "./Table";

/**
 * What clients owe.
 *
 * A separate ledger from the dividends above it, and deliberately not merged with
 * them: money owed to Zainpreneur is not money received from it. The original carried
 * a `revenue` column that could be set on any business with no invoice behind it, which
 * is how a figure stopped meaning anything at all.
 *
 * The two distinctions this screen exists to keep visible:
 *
 *   **owed is not overdue.** An invoice inside its terms is not late, and a report
 *   that lumps them together hides the one that is actually a problem.
 *   **an invoice issued is not money in.** Only payments count as received.
 */

/** Plain-language status. The stored vocabulary is for code, not for readers. */
const STATUS_TEXT: Record<Invoice["status"], string> = {
  draft: "Draft",
  issued: "Unpaid",
  part_paid: "Part paid",
  paid: "Paid",
  overpaid: "In credit",
  credited: "Credited",
  void: "Void",
};

const STATUS_TONE: Record<Invoice["status"], string | undefined> = {
  draft: undefined,
  issued: "var(--zp-warn)",
  part_paid: "var(--zp-warn)",
  paid: "var(--zp-ok)",
  overpaid: "var(--zp-ok)",
  credited: "var(--zp-ok)",
  void: "var(--zp-ink-3)",
};

const invoiceColumns: Array<Column<Invoice>> = [
  { key: "number", label: "Invoice", render: (i) => i.number },
  { key: "business", label: "Client", render: (i) => i.businessName },
  { key: "issued", label: "Issued", render: (i) => i.issuedOn },
  {
    key: "total",
    label: "Total",
    align: "right",
    render: (i) => formatMoney(i.total),
  },
  {
    key: "paid",
    label: "Paid",
    align: "right",
    render: (i) => (i.paid > 0 ? formatMoney(i.paid) : <span className="text-ink-3">—</span>),
  },
  {
    key: "outstanding",
    label: "Outstanding",
    align: "right",
    render: (i) =>
      i.voidedOn !== null ? (
        <span className="text-ink-3">—</span>
      ) : i.outstanding > 0 ? (
        <span style={{ color: "var(--zp-bad)" }}>{formatMoney(i.outstanding)}</span>
      ) : i.overpaid > 0 ? (
        // Being in credit is not a negative bill, and saying so stops someone reading
        // the zero as "nothing happened".
        <span style={{ color: "var(--zp-ok)" }}>{formatMoney(i.overpaid)} credit</span>
      ) : (
        <span className="text-ink-3">—</span>
      ),
  },
  {
    key: "late",
    label: "Due",
    align: "right",
    render: (i) =>
      i.daysOverdue !== null ? (
        <span style={{ color: "var(--zp-bad)" }}>
          {i.daysOverdue}d late
        </span>
      ) : i.dueOn ? (
        <span className="text-ink-3">by {i.dueOn}</span>
      ) : (
        <span className="text-ink-3">—</span>
      ),
  },
  {
    key: "status",
    label: "Status",
    render: (i) => (
      <span style={{ color: STATUS_TONE[i.status] }}>{STATUS_TEXT[i.status]}</span>
    ),
  },
];

const clientColumns: Array<Column<ReceivableRow>> = [
  { key: "name", label: "Client", render: (r) => r.businessName },
  { key: "issued", label: "Invoiced", align: "right", render: (r) => formatMoney(r.issued) },
  {
    key: "paid",
    label: "Received",
    align: "right",
    render: (r) => (r.paid > 0 ? formatMoney(r.paid) : <span className="text-ink-3">—</span>),
  },
  {
    key: "outstanding",
    label: "Outstanding",
    align: "right",
    render: (r) =>
      r.outstanding > 0 ? (
        <span style={{ color: "var(--zp-bad)" }}>{formatMoney(r.outstanding)}</span>
      ) : (
        <span className="text-ink-3">—</span>
      ),
  },
  {
    key: "overdue",
    label: "Overdue",
    align: "right",
    render: (r) =>
      r.overdue > 0 ? (
        <span style={{ color: "var(--zp-bad)" }}>
          {formatMoney(r.overdue)}
          {r.oldestOverdueDays !== null && (
            <span className="ml-1 text-ink-3">({r.oldestOverdueDays}d)</span>
          )}
        </span>
      ) : (
        <span className="text-ink-3">—</span>
      ),
  },
];

/**
 * Split out from the fetching wrapper so it can be rendered to a string in a test
 * without a browser, which is the only way to catch a thrown render behind a clean
 * build.
 */
export function ReceivablesView({
  rows,
  invoices,
  byCurrency = [],
  bookTotal = null,
  cannotTotal = null,
}: {
  rows: ReceivableRow[];
  invoices: Invoice[];
  /** One entry per currency. The per-currency split is the real output. */
  byCurrency?: Array<{ currency: string; issued: number; paid: number; outstanding: number; overdue: number }>;
  /** Present only when every currency has a rate into the book's currency. */
  bookTotal?: { currency: string; issued: number; paid: number; outstanding: number; overdue: number } | null;
  cannotTotal?: string | null;
}): React.ReactElement {
  const totals = rows.reduce(
    (a, r) => ({
      issued: a.issued + r.issued,
      paid: a.paid + r.paid,
      outstanding: a.outstanding + r.outstanding,
      overdue: a.overdue + r.overdue,
    }),
    { issued: 0, paid: 0, outstanding: 0, overdue: 0 },
  );
  const live = invoices.filter((i) => i.voidedOn === null);

  return (
    <section aria-labelledby="receivables-heading">
      <h2 id="receivables-heading" className="sr-only">
        Client receivables
      </h2>

      {/* The figure strip carries a currency label. A receivables total without one is
          the number this whole feature exists to stop being printed. */}
      <FigureStrip
        figures={
          bookTotal
            ? [
                { label: `Invoiced, ${bookTotal.currency}`, value: formatMoney(bookTotal.issued) },
                { label: `Received, ${bookTotal.currency}`, value: formatMoney(bookTotal.paid) },
                {
                  label: `Outstanding, ${bookTotal.currency}`,
                  value: formatMoney(bookTotal.outstanding),
                  tone: bookTotal.outstanding > 0 ? "bad" : undefined,
                },
              ]
            : [
                {
                  label: "Invoiced",
                  value: byCurrency.map((c) => `${formatMoney(c.issued)} ${c.currency}`).join("  ·  "),
                },
                {
                  label: "Received",
                  value: byCurrency.map((c) => `${formatMoney(c.paid)} ${c.currency}`).join("  ·  "),
                },
                {
                  label: "Outstanding",
                  value: byCurrency.map((c) => `${formatMoney(c.outstanding)} ${c.currency}`).join("  ·  "),
                  tone: totals.outstanding > 0 ? "bad" : undefined,
                },
              ]
        }
      />

      {cannotTotal && (
        <p
          className="mt-3 rounded-[12px] border px-3 py-2 text-[0.8125rem]"
          style={{
            borderColor: "var(--zp-border)",
            background: "color-mix(in srgb, var(--zp-warn) 8%, var(--zp-surface))",
            color: "var(--zp-warn)",
          }}
        >
          {cannotTotal}. The figures above are left in their own currencies rather than added
          together — a total across currencies would be a number that means nothing.
        </p>
      )}

      {/* Overdue is separated from outstanding on purpose. An invoice inside its terms
          is not late, and a figure that adds the two together tells a reader nothing
          about which client needs chasing. */}
      {totals.overdue > 0 && (
        <p
          className="mt-3 rounded-[12px] border px-3 py-2 text-[0.8125rem]"
          style={{
            borderColor: "var(--zp-border)",
            background: "color-mix(in srgb, var(--zp-warn) 8%, var(--zp-surface))",
            color: "var(--zp-warn)",
          }}
        >
          {formatMoney(totals.overdue)} of the {formatMoney(totals.outstanding)} outstanding is past its
          due date.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-4 text-[0.875rem] text-ink-3">Nothing has been invoiced yet.</p>
      ) : (
        <>
          <div className="mt-5">
            <ResponsiveTable
              caption={`${rows.length} client${rows.length === 1 ? "" : "s"} billed`}
              columns={clientColumns}
              rows={rows}
              rowKey={(r) => String(r.businessId)}
            />
          </div>

          {live.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-[0.9375rem] font-semibold">Invoices</h3>
              <ResponsiveTable
                caption={`${live.length} live invoice${live.length === 1 ? "" : "s"}`}
                columns={invoiceColumns}
                rows={live}
                rowKey={(i) => String(i.id)}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function ReceivablesPanel(): React.ReactElement {
  const [data, setData] = useState<Parameters<typeof ReceivablesView>[0] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([invoicingApi.receivables(), invoicingApi.invoices()])
      .then(([r, i]) =>
        alive &&
        setData({
          rows: r.rows,
          invoices: i.invoices,
          byCurrency: r.byCurrency,
          bookTotal: r.bookTotal,
          cannotTotal: r.cannotTotal,
        }),
      )
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <p className="text-[0.875rem]" style={{ color: "var(--zp-danger)" }}>
        The receivables could not be read: {error}
      </p>
    );
  }
  if (!data) {
    return (
      <p aria-busy="true" className="text-[0.875rem] text-ink-3">
        Reading the client ledger…
      </p>
    );
  }
  return <ReceivablesView rows={data.rows} invoices={data.invoices} />;
}