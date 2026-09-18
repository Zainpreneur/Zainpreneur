// @ts-nocheck
import type { ReactNode } from 'react'

import { TrendingDown, TrendingUp, Minus, type LucideIcon } from 'lucide-react'

import { cn } from '../../utils/cn'
import { Sparkline } from '../ui/Sparkline'

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  iconClass?: string
  delta?: number
  deltaSuffix?: string
  caption?: string
  hero?: boolean
  sparkline?: number[]
  sparklineColor?: string
  className?: string
  children?: ReactNode
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  delta,
  deltaSuffix = '%',
  caption,
  hero = false,
  sparkline,
  sparklineColor = '#007AFF',
  className,
  children,
}: StatCardProps) {
  const hasDelta = delta !== undefined

  return (
    <div
      className={cn(
        'rounded-[var(--r-card)] bg-[var(--surface-1)] shadow-[var(--sh-raised)] transition-shadows hover:shadow-[var(--sh-raised)] group-hover:translate-y-[-2px] transition-transform duration-150',
        hero && 'sm:p-6',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-[var(r-chip)] bg-[var(--surface-2)] text-[var(--text-2)] dark:text-[var(--text-3)]',
              iconClass,
            )}
          >
            <Icon className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-2)] dark:text-[var(--text-3)]">{label}</p>
            <p
              className={cn(
                'mt-0.5 truncate font-display font-bold tracking-tight tabular-nums text-[var(--text-1)]',
                hero ? 'text-[32px] leading-9' : 'text-[26px] leading-8',
              )}
              title={value}
            >
              {value}
            </p>
          </div>
        </div>
        {hasDelta && (
          <span
            className={cn(
              'inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
              delta > 0
                ? 'bg-[var(--success-tint)] text-[var(--success)]'
                : delta < 0
                  ? 'bg-[var(--danger-tint)] text-[var(--danger)]'
                  : 'bg-[var(--surface-2)] text-[var(--text-2)]',
            )}
          >
            {delta > 0 ? <TrendingUp className="size-3" /> : delta < 0 ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
            {delta > 0 ? '+' : ''}
            {delta}
            {deltaSuffix}
          </span>
        )}
      </div>
      {sparkline && sparkline.length > 1 && (
        <div className="mt-3">
          <Sparkline
            values={sparkline}
            color={sparklineColor}
            width={260}
            height={hero ? 56 : 40}
            className="h-auto w-full"
          />
        </div>
      )}
      {caption && <p className="mt-3 truncate text-[11.5px] font-medium text-[var(--text-2)] dark:text-[var(--text-3)]" title={caption}>{caption}</p>}
      {children}
    </div>
  )
}