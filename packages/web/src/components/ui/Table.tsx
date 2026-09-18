// @ts-nocheck
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
        'sticky top-0 z-10 border-b border-[var(--hairline)] bg-[var(--surface-1)] text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] dark:border-[var(--hairline-strong)] dark:bg-[var(--surface-2)] dark:text-[var(--text-2)]',
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
        stacked ? 'md:divide-y md:divide-[var(--hairline)] md:dark:divide-[var(--hairline-strong)]' : 'divide-y divide-[var(--hairline)] dark:divide-[var(--hairline-strong)]',
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
      className={cn('transition-colors hover:bg-[var(--surface-2)]', className)}
      {...props}
    />
  )
}

export function Td({ stackedLabel, noStackLabel, className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { stackedLabel?: string; noStackLabel?: boolean }) {
  return (
    <td
      data-label={noStackLabel ? undefined : stackedLabel}
      data-nolabel={noStackLabel || undefined}
      className={cn('whitespace-nowrap px-4 py-3 text-[var(--text-2)] md:px-4 md:py-3 dark:text-[var(--text-3)]', className)}
      {...props}
    />
  )
}