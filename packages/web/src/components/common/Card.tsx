// @ts-nocheck
import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[22px] bg-[var(--surface-1)] shadow-[var(--sh-raised)] transition-shadows hover:shadow-[var(--sh-raised)] group-hover:translate-y-[-2px] transition-transform duration-150',
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
      className={cn('flex items-start justify-between gap-4 rounded-t-[22px] px-5 py-4', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-display text-sm font-bold tracking-tight text-[var(--text-1)]', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-0.5 text-xs text-[var(--text-2)] dark:text-[var(--text-3)]', className)} {...props} />
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
      className={cn('flex items-center justify-between gap-3 rounded-b-[22px] px-5 py-3.5', className)}
      {...props}
    />
  )
}