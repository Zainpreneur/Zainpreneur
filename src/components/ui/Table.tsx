import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

export function Table({ stacked, className, ...props }: HTMLAttributes<HTMLTableElement> & { stacked?: boolean }) {
  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className={cn('w-full border-collapse text-left text-sm', stacked && 'zp-stacked', className)} {...props} />
    </div>
  )
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400',
        className,
      )}
      {...props}
    />
  )
}

export function TBody({ stacked, className, ...props }: HTMLAttributes<HTMLTableSectionElement> & { stacked?: boolean }) {
  return (
    <tbody
      className={cn(
        stacked ? 'md:divide-y md:divide-slate-100 md:dark:divide-slate-800' : 'divide-y divide-slate-100 dark:divide-slate-800',
        className,
      )}
      {...props}
    />
  )
}

export function Th({ scope = 'col', className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope={scope} className={cn('whitespace-nowrap px-4 py-3 font-semibold', className)} {...props} />
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40', className)}
      {...props}
    />
  )
}

export function Td({ stackedLabel, noStackLabel, className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { stackedLabel?: string; noStackLabel?: boolean }) {
  return (
    <td
      data-label={noStackLabel ? undefined : stackedLabel}
      data-nolabel={noStackLabel || undefined}
      className={cn('whitespace-nowrap px-4 py-3 text-slate-600 md:px-4 md:py-3 dark:text-slate-300', className)}
      {...props}
    />
  )
}