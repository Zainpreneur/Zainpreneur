import { useMemo } from 'react'

import type { DonutSlice } from '../../types'

import { cn } from '../../utils/cn'

interface DonutChartProps {
  data: DonutSlice[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
  className?: string
}

export function DonutChart({ data, size = 180, thickness = 22, centerLabel, centerValue, className }: DonutChartProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1
  const summary = `Donut chart: ${data.map((slice) => `${slice.label} ${Math.round((slice.value / total) * 100)} percent`).join(', ')}.`
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  const segments = useMemo(
    () =>
      data.map((slice, index) => {
        const fraction = slice.value / total
        const before = data.slice(0, index).reduce((sum, item) => sum + item.value, 0) / total
        return {
          slice,
          dashLength: fraction * circumference,
          offset: -before * circumference,
        }
      }),
    [data, total, circumference],
  )

  return (
    <div className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <span className="sr-only">{summary}</span>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={summary}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-slate-100 dark:text-slate-800"
        />
        <g transform={`rotate(-90 ${center} ${center})`}>
          {segments.map(({ slice, dashLength, offset }, index) => (
            <circle
              key={`${slice.label}-${index}`}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, dashLength - 2)} ${circumference - Math.max(0, dashLength - 2)}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
            >
              <title>{`${slice.label}: ${slice.value}`}</title>
            </circle>
          ))}
        </g>
      </svg>
      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <span className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{centerValue}</span>
          )}
          {centerLabel && <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{centerLabel}</span>}
        </div>
      )}
    </div>
  )
}