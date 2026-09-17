import { Check } from 'lucide-react'

import { cn } from '../../utils/cn'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  className?: string
}

/**
 * Custom 18px indigo checkbox (Rule 6): 44px touch target below 768px,
 * exact 18px box on desktop.
 */
export function Checkbox({ checked, onChange, label, className }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('grid shrink-0 cursor-pointer place-items-center rounded-md md:size-[18px] md:p-0', 'size-11', className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-[18px] place-items-center rounded-md border transition-colors duration-150',
          checked
            ? 'border-indigo-500 bg-indigo-500 text-white dark:border-indigo-400 dark:bg-indigo-500'
            : 'border-slate-300 text-transparent hover:border-indigo-500 hover:text-indigo-500 dark:border-slate-600',
        )}
      >
        <Check className="size-3" strokeWidth={3.5} />
      </span>
    </button>
  )
}
