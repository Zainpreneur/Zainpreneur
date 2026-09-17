import type { CSSProperties } from 'react'

import { cn } from '../../utils/cn'

interface ScoreRingProps {
  value: number
  size?: number
  strokeWidth?: number
  color?: string
  label?: string
  className?: string
}

export function ScoreRing({ value, size = 72, strokeWidth = 7, color, label, className }: ScoreRingProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  const ringColor =
    color ??
    (clamped >= 80 ? '#10b981' : clamped >= 60 ? '#f59e0b' : '#f43f5e')

  const styleVars = { '--ring-color': ringColor } as CSSProperties

  return (
    <div className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={styleVars}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke="var(--ring-color)"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[13px] font-bold tabular-nums tracking-tight" style={{ color: ringColor }}>
          {clamped}
        </span>
        {label && <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</span>}
      </div>
    </div>
  )
}