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
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('h-full rounded-full bg-brand-500 transition-all duration-500', barClass)} style={{ width: `${clamped}%` }} />
    </div>
  )
}