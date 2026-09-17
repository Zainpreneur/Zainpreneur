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

  return (
    <div className={cn('w-full', className)}>
      <div className="relative flex" style={{ height: height + 28, paddingTop: 28 }}>
        {showGrid && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-7 flex flex-col justify-between">
            {Array.from({ length: gridLines + 1 }, (_, i) =>
              <div key={`grid-${i}`} className="flex items-center" style={{ height: 'auto' }}>
                <span className="mr-2 w-10 text-right text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  {valueFormatter((maxValue / gridLines) * (gridLines - i))}
                </span>
                <div className="h-px flex-1 border-t border-dashed border-slate-200 dark:border-slate-800" />
              </div>,
            )}
          </div>
        )}
        <div
          className="relative flex w-full items-end justify-around gap-1"
          style={{ paddingLeft: showGrid ? 48 : 0 }}
        >
          {labels.map((label, index) => {
            const tallest = Math.max(...series.map((s) => s.data[index]?.value ?? 0), 1)
            return (
              <div key={`group-${label}-${index}`} className="group relative flex h-full flex-1 items-end justify-center">
                <div className="flex h-full w-full items-end justify-center gap-1" style={{ gap: groupGap }}>
                  {series.map((s) => {
                    const value = s.data[index]?.value ?? 0
                    const percentOfGroup = (value / tallest) * 100
                    const percentOfMax = (value / maxValue) * 100
                    return (
                      <div
                        key={`${s.name}-${label}`}
                        className="relative flex h-full flex-1 flex-col items-center justify-end"
                      >
                        <div className="pointer-events-none absolute -top-1 z-20 -translate-y-full scale-95 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 opacity-0 shadow-lg transition-all duration-100 group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                          <div className="text-slate-400 dark:text-slate-400">
                            {label} · {s.name}
                          </div>
                          {valueFormatter(value)}
                        </div>
                        <div
                          className="w-full max-w-7 rounded-t-md transition-opacity hover:opacity-80"
                          style={{
                            height: `${Math.max(percentOfMax, 1)}%`,
                            backgroundColor: s.color,
                            minHeight: percentOfGroup > 0 ? 3 : 1,
                          }}
                        />
                        <div className="mt-2 hidden h-3 text-[10px] font-medium text-slate-400 dark:text-slate-500 sm:block">
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
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}