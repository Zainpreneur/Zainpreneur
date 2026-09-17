import type { ScoreRingSlice } from '../../types'

import { cn } from '../../utils/cn'

interface ScoreRingProps {
  data: ScoreRingSlice[]
  size?: number
  className?: string
}

export function ScoreRing({ data, size = 160, className }: ScoreRingProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1
  const radius = size / 2 - 8
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  const summary = `Score ring: ${data.map((slice) => `${slice.label} ${Math.round((slice.value / total) * 100)}%`).join(', ')}.`

  return (
    <div className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <span className="sr-only">{summary}</span>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={summary}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,.1)"
          strokeWidth={16}
        />
        <g transform={`rotate(-90 ${center} ${center})`}>
          {data.map((slice, _index) => {
            const stroke =
              slice.label === 'Revenue'
                ? 'var(--accent)'
                : slice.label === 'Profit'
                  ? 'var(--success)'
                  : slice.label === 'Expenses'
                    ? 'var(--warn)'
                    : 'var(--danger)'

            return (
              <circle
                key={slice.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={stroke}
                strokeWidth={16}
                strokeDasharray={`${(slice.value / total) * circumference} ${circumference - (slice.value / total) * circumference}`}
                strokeDashoffset={-slice.value / total * circumference}
                strokeLinecap="round"
              >
                <title>{`${slice.label}: ${slice.value}`}</title>
              </circle>
            )
          })}
        </g>
      </svg>
      {data.map((slice) => {
        const value = (slice.value / total) * 100
        return (
          <div
            key={slice.label}
            className="absolute inset-0 flex flex-col items-center justify-center text-center"
          >
            <span className="text-xs font-medium uppercase tracking-wider [var(--text-2)]">{slice.label}</span>
            <span className="font-display font-bold text-[2xl] [var(--text-1)]">{Math.round(value)}%</span>
          </div>
        )
      })}
    </div>
  )
}