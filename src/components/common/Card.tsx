import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-display text-sm font-bold tracking-tight text-slate-900 dark:text-white', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-0.5 text-xs text-slate-500 dark:text-slate-400', className)} {...props} />
}

const PADDING_UTILITY = /(?:^|\s)p[trblxy]?-/;

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // cn() is a plain join (no tailwind-merge), so an explicit padding utility
  // must suppress the default — otherwise both classes apply and the winner
  // depends on generated CSS order.
  return <div className={cn(className && PADDING_UTILITY.test(className) ? undefined : 'p-6', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 dark:border-slate-800', className)}
      {...props}
    />
  )
}