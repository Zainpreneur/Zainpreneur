// @ts-nocheck
import { cn } from '../../utils/cn'

export interface TabOption<T extends string> {
  value: T
  label: string
  count?: number
}

/**
 * Single segmented-tab component (Rule 5): container --bg-elev r12 p4,
 * items 32h r9, active surface + border. Horizontal scroll with edge fade
 * under 640px — never wraps.
 */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Tabs',
}: {
  options: Array<TabOption<T>>
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="relative -mx-1 px-1">
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70"
      >
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] px-4 text-sm font-semibold transition-colors duration-150 ease-out',
                active
                  ? 'border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-white'
                  : 'border border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {option.label}
              {option.count !== undefined && (
                <sup className="text-[10px] font-bold tabular-nums text-slate-400 dark:text-slate-500">
                  {option.count}
                </sup>
              )}
            </button>
          )
        })}
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-6 bg-gradient-to-l from-slate-50 to-transparent max-sm:block dark:from-slate-950" />
    </div>
  )
}
