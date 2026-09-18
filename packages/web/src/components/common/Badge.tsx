// @ts-nocheck
import type { HTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

export type BadgeTone = 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const TONES: Record<BadgeTone, string> = {
  default:
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--surface-1)] text-[var(--text-1)] shadow-[var(--sh-raised-sm)]',
  brand:
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--accent-tint)] text-[var(--accent)] shadow-[var(--sh-raised-sm)]',
  success:
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--success-tint)] text-[var(--success)] shadow-[var(--sh-raised-sm)]',
  warning:
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--warn-tint)] text-[var(--warn)] shadow-[var(--sh-raised-sm)]',
  danger:
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--danger-tint)] text-[var(--danger)] shadow-[var(--sh-raised-sm)]',
  info:
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--surface-1)] text-[var(--text-2)] shadow-[var(--sh-raised-sm)]',
  neutral:
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--surface-1)] text-[var(--text-2)] shadow-[var(--sh-raised-sm)]',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  dot?: 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'slate' | 'brand'
}

const DOTS: Record<'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'slate' | 'brand', string> = {
  emerald: 'w-2 h-2 rounded-full bg-[var(--success)] shadow-[0_0_0px_2px_var(--success)]',
  amber: 'w-2 h-2 rounded-full bg-[var(--warn)] shadow-[0_0_0px_2px_var(--warn)]',
  rose: 'w-2 h-2 rounded-full bg-[var(--danger)] shadow-[0_0_0px_2px_var(--danger)]',
  sky: 'w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_0px_2px_var(--accent)]',
  violet: 'w-2 h-2 rounded-full bg-[var(--text-2)]',
  slate: 'w-2 h-2 rounded-full bg-[var(--surface-2)]',
  brand: 'w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_0px_2px_var(--accent)]',
}

export function Badge({ tone = 'default', dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('size-1.5 rounded-full', DOTS[dot])}>{children}</span>}
    </span>
  )
}