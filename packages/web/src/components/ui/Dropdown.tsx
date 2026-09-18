// @ts-nocheck
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { ChevronDown } from 'lucide-react'

import { cn } from '../../utils/cn'

export interface DropdownItem {
  label: string
  icon?: LucideIcon
  onClick?: () => void
  danger?: boolean
  separator?: boolean
}

interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
  label?: string
  hideChevron?: boolean
}

export function Dropdown({ trigger, items, align = 'right', label, hideChevron }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex cursor-pointer items-center rounded-[14px] p-1.5 text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
      >
        {trigger}
        {!hideChevron && (
          <ChevronDown className={cn('ml-0.5 size-3.5 transition-transform duration-150', open && 'rotate-180')} />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-40 min-w-[160px] overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--surface-1)] shadow-[var(--sh-raised)] backdrop-blur-[8px]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, index) =>
            item.separator ? (
              <div key={`sep-${index}`} className="my-1.5 border-t border-[var(--hairline)]" />
            ) : (
              <button
                key={`${item.label}-${index}`}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onClick?.()
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors',
                  item.danger
                    ? 'text-[var(--danger)] hover:bg-[var(--danger-tint)]'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]',
                )}
              >
                {item.icon && <item.icon className="size-4 shrink-0" />}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}