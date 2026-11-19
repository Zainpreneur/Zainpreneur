import type { BusinessRow } from "../lib/api";
import { FigureStrip, ResponsiveTable, type Column } from "./Table";

/**
 * The register.
 *
 * A panel: surface, hairline, no shadow. Shadows belong only to things that leave
 * the page — sheets, menus, toasts, chrome. A card never casts one, and it never
 * moves on hover: the one cue it gets is its edge warming to gold, which does not
 * shift a grid of cards by a pixel.
 */
export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[16px] border border-line bg-surface ${className}`}>
      {title && (
        <h2 className="px-[22px] pt-[18px] text-[1.0625rem] tracking-[-0.015em] text-ink">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

const BADGE_TONE: Record<string, { bg: string; fg: string }> = {
  fully_owned: { bg: "var(--zp-gold-soft)", fg: "var(--zp-gold-deep)" },
  equity: { bg: "var(--zp-teal-soft)", fg: "var(--zp-teal)" },
  client: { bg: "color-mix(in srgb, var(--zp-blue) 10%, var(--zp-surface))", fg: "var(--zp-blue)" },
  none: { bg: "var(--zp-surface-2)", fg: "var(--zp-muted)" },
};

export function Badge({ label }: { label: string }) {
  const tone =
    label === "Client + Equity"
      ? BADGE_TONE.equity!
      : BADGE_TONE[Object.keys(BADGE_TONE).find((k) =>
          label.toLowerCase().includes(k === "fully_owned" ? "fully" : k === "none" ? "no " : k),
        ) ?? "none"]!;
  return (
    <span
      className="inline-flex items-center rounded-full px-[10px] py-[2px] text-[0.75rem] font-medium"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {label}
    </span>
  );
}

export function BusinessTable({
  rows,
  onSelect,
}: {
  rows: BusinessRow[];
  onSelect?: (b: BusinessRow) => void;
}) {
  const columns: Array<Column<BusinessRow>> = [
    {
      key: "name",
      label: "Business",
      render: (b) => (
        // A real button, so the row is reachable by keyboard. The row's own
        // onClick covers pointer users; this covers everyone else.
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(b);
          }}
          className="text-left font-display text-[0.9375rem] text-ink hover:text-[var(--zp-teal)]"
        >
          {b.name}
        </button>
      ),
    },
    { key: "badge", label: "Relationship", render: (b) => <Badge label={b.portfolio.badge} /> },
    {
      key: "stake",
      label: "Zainpreneur stake",
      align: "right",
      render: (b) => (
        <span className="tnum">
          {b.portfolio.principalEquity > 0 ? `${b.portfolio.principalEquity}%` : "—"}
        </span>
      ),
    },
    { key: "industry", label: "Industry", secondary: true, render: (b) => b.industry || "—" },
    {
      key: "where",
      label: "Where",
      secondary: true,
      render: (b) => [b.city, b.country].filter(Boolean).join(", ") || "—",
    },
    { key: "status", label: "Status", render: (b) => b.status },
  ];

  return (
    <ResponsiveTable
      caption="Businesses in the register"
      columns={columns}
      rows={rows}
      rowKey={(b) => b.id}
      onRowClick={onSelect ? (b) => onSelect(b) : undefined}
    />
  );
}

export { FigureStrip };