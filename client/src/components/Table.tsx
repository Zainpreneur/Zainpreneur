/**
 * The table, and the one place responsive behaviour is decided.
 *
 * A data table has two jobs it cannot do at once: on a wide screen it is a table,
 * and on a narrow one the columns no longer fit. The original solved this three
 * separate times in `app.css` — three overlapping `max-width: 640px` blocks, one
 * of which applied `::before` to *every* `td` and so painted an empty label on the
 * thirty cells that had none. Its `.rel-table` was then clipped at 1001–1080px with
 * `overflow-x: hidden`, so columns were unreachable and the user could not scroll
 * to them either.
 *
 * So: one implementation, two behaviours, decided by width.
 *
 *   ≥ 640px   a real table
 *   < 640px   each row becomes a card, each cell shows its own column label
 *
 * The label comes from `data-label` on the cell. A cell without one is *omitted*
 * rather than rendered with a blank label — which is the mistake the original made.
 */

export interface Column<T> {
  key: string;
  /** Header text. Also the label a cell shows itself when the row becomes a card. */
  label: string;
  align?: "left" | "right";
  /** Hidden on the narrow layout, where it would only crowd the card. */
  secondary?: boolean;
  render: (row: T) => React.ReactNode;
}

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  caption,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  caption: string;
}) {
  const clickable = Boolean(onRowClick);
  return (
    <div
      className="zp-table-scroll"
      // A scroll container that cannot be focused is unreachable by keyboard: the
      // arrow keys do nothing and there is no scrollbar to grab.
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="zp-table w-full text-[0.875rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                data-label={c.label}
                className={[
                  "border-b border-line px-[22px] py-[10px] text-left",
                  "text-[0.6875rem] uppercase tracking-[0.08em] text-ink-3",
                  c.align === "right" ? "text-right" : "",
                  c.secondary ? "zp-col-secondary" : "",
                ].join(" ")}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={clickable ? "zp-row-clickable" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  data-label={c.label}
                  className={[
                    "border-b border-line px-[22px] py-[11px] align-top",
                    c.align === "right" ? "text-right" : "",
                    c.secondary ? "zp-col-secondary" : "",
                  ].join(" ")}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The strip of grouped figures.
 *
 * One panel, cells divided by a painted 1px gap — so it reads as a ruled table of
 * numbers rather than three boxes. Below `sm` the cells stack: three money figures
 * side by side on a phone is a layout that only looks right on a monitor.
 */
export function FigureStrip({
  figures,
}: {
  figures: Array<{ label: string; value: string; tone?: "ok" | "bad" }>;
}) {
  return (
    <div
      className="zp-figures grid grid-cols-1 gap-px bg-[var(--zp-border)] sm:grid-cols-3"
    >
      {figures.map((f) => (
        <div key={f.label} className="bg-surface px-[22px] py-[16px]">
          <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-3">
            {f.label}
          </div>
          <div
            className="mt-1 font-display text-[1.5rem] tracking-[-0.01em] tabular-nums"
            style={{
              color:
                f.tone === "bad"
                  ? "var(--zp-bad)"
                  : f.tone === "ok"
                    ? "var(--zp-ok)"
                    : "var(--zp-ink)",
            }}
          >
            {f.value}
          </div>
        </div>
      ))}
    </div>
  );
}