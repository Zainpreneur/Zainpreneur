import { useId } from 'react'

import { formatCompactNumber } from '../../utils/number'

interface SparklineProps {
  values: number[]
  color?: string
  width?: number
  height?: number
  strokeWidth?: number
  fill?: boolean
  className?: string
  label?: string
  formatValue?: (value: number) => string
}

export function Sparkline({
  values,
  color = '#007AFF',
  width = 120,
  height = 36,
  strokeWidth = 2,
  fill = true,
  className,
  label = 'Trend',
  formatValue = formatCompactNumber,
}: SparklineProps) {
  const gradientId = useId()
  if (values.length < 2) return null

  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const step = width / (values.length - 1)

  const points = values.map((value, index) => {
    const x = index * step
    const y = height - 3 - ((value - min) / range) * (height - 6)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const line = points.join(' ')
  const area = `0,${height} ${line} ${width},${height}`
  const first = values[0]
  const last = values[values.length - 1]
  const [lastX, lastY] = points[points.length - 1].split(',').map(Number)
  const trend = last >= first ? 'up' : 'down'
  const summary = `${label}: ${formatValue(first)} to ${formatValue(last)}, trending ${trend}.`

  return (
    <span className="group/spot relative block">
      <span className="sr-only">{summary}</span>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={summary}
        className={className ? `overflow-visible ${className}` : 'overflow-visible'}
      >
        {fill && (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#${gradientId})`} />
          </>
        )}
        <polyline points={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <circle
          cx={lastX}
          cy={lastY}
          r={3.5}
          fill={color}
          stroke="white"
          strokeWidth={1.5}
          className="opacity-0 transition-opacity duration-150 group-hover/spot:opacity-100"
        >
          <title>{`${label}: ${formatValue(last)}`}</title>
        </circle>
      </svg>
      <span className="pointer-events-none absolute -top-1 right-0 rounded-[var(r-chip)] border border-[var(--hairline)] bg-[var(--surface-1)] px-2 py-1 text-[11px] font-bold tabular-nums text-[var(--text-1)] shadow-[var(--sh-raised-sm)] transition-opacity duration-150 group-hover/spot:opacity-100 dark:border-[var(--hairline-strong)] dark:bg-[var(--surface-2)] dark:text-[var(--text-1)]">
        {formatValue(last)}
      </span>
    </span>
  )
}