// @ts-nocheck
import { Check } from 'lucide-react'

import { cn } from '../../utils/cn'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  className?: string
}

/**
 * Neo-depth checkbox (Rule 6): raised circle, accent glow when checked.
 * 44px touch target below 768px, exact 18px box on desktop.
 */
export function Checkbox({ checked, onChange, label, className }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('grid shrink-0 cursor-pointer place-items-center rounded-full md:size-[18px] md:p-0 bg-[var(--surface-1)] shadow-[var(--sh-raised-sm)]', 'size-11', className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-[18px] place-items-center rounded-full transition-colors duration-150',
          checked
            ? 'bg-[var(--accent)] shadow-[var(--sh-accent)]'
            : 'border border-[var(--hairline)] hover:bg-[var(--surface-2)]',
        )}
      >
        <Check className="size-3 stroke-2 stroke-white" />
      </span>
    </button>
  )
}