import type { ChartPoint } from '../../types'

import { cn } from '../../utils/cn'
import { formatCompactNumber } from '../../utils/number'

export interface BarSeries {
  name: string
  color: string
  data: ChartPoint[]
}

interface BarChartProps {
  series: BarSeries[]
  height?: number
  groupGap?: number
  showGrid?: boolean
  valueFormatter?: (value: number) => string
  className?: string
}

export function BarChart({
  series,
  height = 240,
  groupGap = 18,
  showGrid = true,
  valueFormatter = formatCompactNumber,
  className,
}: BarChartProps) {
  const labels = series[0]?.data.map((point) => point.label) ?? []
  const allValues = series.flatMap((s) => s.data.map((p) => p.value))
  const maxValue = Math.max(...allValues, 1)
  const gridLines = 4
  const summary = `Bar chart comparing ${series.map((s) => s.name).join(' and ')} across ${labels.length} periods.`

  return (
    <div className={cn('w-full', className)} role="img" aria-label={summary}>
      <span className="sr-only">{summary}</span>
      <div className="relative flex" style={{ height: height + 28, paddingTop: 28 }}>
        {showGrid && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-7 flex flex-col justify-between">
            {Array.from({ length: gridLines + 1 }, (_, i) =>
              <div key={`grid-${i}`} className="flex items-center" style={{ height: 'auto' }}>
                <span className="mr-2 w-10 text-right text-[10.5px] font-medium tabular-nums text-[var(--text-2)] dark:text-[var(--text-3)]">
                  {valueFormatter((maxValue / gridLines) * (gridLines - i))}
                </span>
                <div className="h-px flex-1 border-t border-dashed border-[var(--hairline)]" />
              </div>,
            )}
          </div>
        )}
        <div
          className="relative flex w-full items-end justify-around gap-1"
          style={{ paddingLeft: showGrid ? 48 : 0 }}
        >
          {labels.map((label, index) => {
            const _tallest = Math.max(...series.map((s) => s.data[index]?.value ?? 0), 1)
            return (
              <div key={`group-${label}-${index}`} className="group relative flex h-full flex-1 items-end justify-center">
                <div className="flex h-full w-full items-end justify-center gap-1" style={{ gap: groupGap }}>
                  {series.map((s) => {
                    const value = s.data[index]?.value ?? 0
                    const percentOfMax = (value / maxValue) * 100
                    return (
                      <div
                        key={`${s.name}-${label}`}
                        className="relative flex h-full flex-1 flex-col items-center justify-end"
                      >
                        <div className="pointer-events-none absolute -top-1 z-20 -translate-y-full scale-95 whitespace-nowrap rounded-[999px] border border-[var(--hairline)] bg-[var(--surface-1)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-1)] shadow-[var(--sh-raised-sm)] transition-all duration-100 group-hover:shadow-[var(--sh-inset-sm)] dark:border-[var(--hairline-strong)] dark:bg-[var(--surface-2)] dark:text-[var(--text-1)]">
                          <div className="text-[var(--text-2)] dark:text-[var(--text-3)]">
                            {label} · {s.name}
                          </div>
                          {valueFormatter(value)}
                        </div>
                        <div
                          className="w-full max-w-7 rounded-t-md transition-opacity hover:opacity-80"
                          style={{
                            height: `${Math.max(percentOfMax, 1)}%`,
                            background:
                              value > 0
                                ? 'var(--accent)' + 'var(--accent-glow)'
                                : 'var(--surface-2)',
                          }}
                        />
                        <div className="mt-2 hidden h-3 text-[10.5px] font-medium text-[var(--text-2)] dark:text-[var(--text-3)] sm:block">
                          {index % 2 === 0 ? label : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--hairline)] pt-3">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-2)] dark:text-[var(--text-3)]">
            <span className="size-2.5 rounded-[999px]" style={{ background: 'var(--accent-tint)' }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}