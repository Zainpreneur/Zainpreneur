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
  sparklineColor = '#6366f1',
  className,
  children,
}: StatCardProps) {
  const hasDelta = delta !== undefined

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 sm:p-5 dark:border-slate-800 dark:bg-slate-900',
        hero && 'sm:p-6',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
              iconClass,
            )}
          >
            <Icon className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
            <p
              className={cn(
                'mt-0.5 truncate font-display font-bold tracking-tight tabular-nums text-slate-900 dark:text-white',
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
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                : delta < 0
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
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
      {caption && <p className="mt-3 truncate text-[11.5px] font-medium text-slate-500 dark:text-slate-400" title={caption}>{caption}</p>}
      {children}
    </div>
  )
}