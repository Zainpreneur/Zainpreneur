// @ts-nocheck
import { cn } from '../../utils/cn'

interface ProgressBarProps {
  value: number
  className?: string
  barClass?: string
}

export function ProgressBar({ value, className, barClass }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-[14px] bg-[var(--surface-2)]', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-[14px] transition-all duration-500 ease-out',
          barClass,
        )}
        style={{
          width: `${clamped}%`,
          background:
            clamped >= 50
              ? 'var(--accent)' + 'var(--accent-glow)'
              : clamped >= 30
                ? 'var(--success)' + 'var(--success-glow)'
                : clamped >= 10
                  ? 'var(--warn)' + 'var(--warn-glow)'
                  : 'var(--danger)' + 'var(--danger-glow)',
        }}
      />
    </div>
  )
}