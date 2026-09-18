// @ts-nocheck
import { useRef } from 'react'

import { Search, X } from 'lucide-react'

import { cn } from '../../utils/cn'
import { useDebounced } from '../../hooks/useDebounced'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  fullWidth?: boolean
  debounceDelay?: number
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  fullWidth,
  debounceDelay = 250,
}: SearchInputProps) {
  const debouncedValue = useDebounced(value, debounceDelay)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn('relative', fullWidth && 'w-full', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 left-3 select-none pointer-events-none text-[var(--text-2)]" />
      <input
        ref={inputRef}
        type="search"
        value={debouncedValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-2)] px-9 pl-9 text-sm text-[var(--text-1)] shadow-[var(--sh-inset)] transition-colors placeholder-color-[var(--text-3)] focus:border-transparent focus:outline-none focus:ring-2 focus-ring-[var(--accent-tint)] disabled:cursor-not-allowed disabled:bg-[var(--surface-3)] dark:border-[var(--hairline-strong)] dark:bg-[var(--surface-3)] dark:text-[var(--text-1)] dark:placeholder-color-[var(--text-3)]"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[999px] p-0.5 text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] dark:hover:bg-[var(--surface-3)] dark:hover:text-[var(--text-1)]"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}