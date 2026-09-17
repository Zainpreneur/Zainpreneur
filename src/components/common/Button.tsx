import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

const _SHADOW_RAISED = '0 8px 18px rgba(0,0,0,.55), -8px -8px 18px rgba(255,255,255,.045), inset 0 1px 0 rgba(255,255,255,.06)'
const _SHADOW_RAISED_SM = '0 4px 10px rgba(0,0,0,.5), -4px -4px 10px rgba(255,255,255,.04), inset 0 1px 0 rgba(255,255,255,.05)'
const _SHADOW_INSET = 'inset 4px 4px 9px rgba(0,0,0,.5), inset -4px -4px 9px rgba(255,255,255,.04)'
const _SHADOW_INSET_SM = 'inset 2px 2px 6px rgba(0,0,0,.45), inset -2px -2px 6px rgba(255,255,255,.035)'
const _SHADOW_ACCENT = '0 6px 20px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.25)'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-white shadow-[_SHADOW_ACCENT] hover:bg-[var(--accent-hover)] focus-visible:ring-[var(--accent-tint)] active:shadow-[inset_0_1px_0_rgba(255,255,255,.25)]',
  secondary:
    'bg-[var(--surface-1)] text-[var(--text-1)] shadow-[_SHADOW_RAISED_SM] hover:bg-[var(--surface-2)] focus-visible:ring-[var(--accent-tint)] active:shadow-[_SHADOW_INSET_SM]',
  ghost:
    'text-[var(--text-2)] hover:bg-transparent focus-visible:ring-[var(--accent-tint)]',
  danger:
    'bg-[var(--danger)] text-white shadow-[var(--sh-accent)] hover:bg-[#ff5a4a] focus-visible:ring-[var(--danger-glow)]',
  success:
    'bg-[var(--success)] text-white shadow-[var(--sh-accent)] hover:bg-[var(--success)] focus-visible:ring-[var(--success-tint)]',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-[14px] px-3 text-xs',
  // 44px touch targets below 768px, 38px desktop control height.
  md: 'h-11 rounded-[14px] px-4 text-[13px] md:h-[38px]',
  lg: 'h-11 rounded-xl px-5 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex cursor-pointer items-center justify-center whitespace-nowrap font-semibold transition-shadows duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--accent)] dark:focus-visible:ring-offset-slate-950',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  )
}