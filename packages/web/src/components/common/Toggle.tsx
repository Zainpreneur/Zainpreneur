// @ts-nocheck
import { cn } from '../../utils/cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  id: string
  disabled?: boolean
  className?: string
}

export function Toggle({ checked, onChange, label, id, disabled, className }: ToggleProps) {
  return (
    <label htmlFor={id} className={cn('inline-flex w-fit cursor-pointer items-center gap-3', disabled && 'cursor-not-allowed opacity-60', className)}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-shadows duration-200',
          checked ? 'shadow-[var(--sh-accent)]' : 'shadow-[var(--sh-raised-sm)]',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-4 rounded-full bg-white transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-1',
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-[var(--text-2)] dark:text-[var(--text-3)]">{label}</span>}
    </label>
  )
}