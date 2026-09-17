import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  BarChart3,
  Building2,
  CheckSquare,
  CornerDownLeft,
  Landmark,
  LayoutDashboard,
  Package,
  Search,
  Settings as SettingsIcon,
  Truck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'

import type { BusinessCategory } from '../../types'
import { useBusinesses } from '../../context/BusinessContext'
import { CATEGORY_META } from '../../utils/meta'
import { cn } from '../../utils/cn'

interface CommandItem {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  accent?: string
  run: () => void
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { businesses, owners, tasks } = useBusinesses()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<CommandItem[]>(() => {
    const pages: CommandItem[] = [
      { id: 'page-dashboard', label: 'Dashboard', hint: 'Page', icon: LayoutDashboard, run: () => navigate('/') },
      { id: 'page-businesses', label: 'Businesses', hint: 'Page', icon: Building2, run: () => navigate('/businesses') },
      { id: 'page-owners', label: 'Owners', hint: 'Page', icon: Users, run: () => navigate('/owners') },
      { id: 'page-financials', label: 'Financials', hint: 'Page', icon: BarChart3, run: () => navigate('/financials') },
      { id: 'page-assets', label: 'Assets', hint: 'Page', icon: Package, run: () => navigate('/assets') },
      { id: 'page-team', label: 'Team (HR)', hint: 'Page', icon: Users, run: () => navigate('/team') },
      { id: 'page-purchasing', label: 'Vendors & Purchasing', hint: 'Page', icon: Truck, run: () => navigate('/purchasing') },
      { id: 'page-accounting', label: 'Accounting & Ledger', hint: 'Page', icon: Landmark, run: () => navigate('/accounting') },
      { id: 'page-tasks', label: 'Tasks', hint: 'Page', icon: CheckSquare, run: () => navigate('/tasks') },
      { id: 'page-settings', label: 'Settings', hint: 'Page', icon: SettingsIcon, run: () => navigate('/settings') },
    ]

    const businessItems: CommandItem[] = businesses.map((business) => ({
      id: `biz-${business.id}`,
      label: business.name,
      hint: CATEGORY_META[business.category as BusinessCategory].label,
      icon: Building2,
      accent: business.color,
      run: () => navigate(`/businesses/${business.id}`),
    }))

    const ownerItems: CommandItem[] = owners.map((owner) => ({
      id: `owner-${owner.id}`,
      label: owner.name,
      hint: owner.role ? `Owner · ${owner.role}` : 'Owner',
      icon: Users,
      accent: owner.color,
      run: () => navigate('/owners'),
    }))

    const taskItems: CommandItem[] = tasks.slice(0, 40).map((task) => ({
      id: `task-${task.id}`,
      label: task.title,
      hint: 'Task',
      icon: CheckSquare,
      run: () => navigate('/tasks'),
    }))

    return [...pages, ...businessItems, ...ownerItems, ...taskItems]
  }, [businesses, owners, tasks, navigate])

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items.slice(0, 8)
    return items
      .filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(normalized))
      .slice(0, 12)
  }, [items, query])

  useEffect(() => {
    const node = listRef.current?.querySelector('[data-active="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const select = (item: CommandItem | undefined) => {
    if (!item) return
    item.run()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Zainpreneur"
        className="animate-fade-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((prev) => Math.min(prev + 1, results.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((prev) => Math.max(prev - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                select(results[active])
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
            }}
            placeholder="Search businesses, tasks and pages…"
            aria-label="Search"
            className="h-14 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <div ref={listRef} role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">No matches found.</p>
          ) : (
            results.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={index === active}
                data-active={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => select(item)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  index === active ? 'bg-brand-50 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                )}
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                  style={item.accent ? { backgroundColor: `${item.accent}1a`, color: item.accent } : undefined}
                >
                  <item.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                  <span className="block truncate text-xs text-slate-400">{item.hint}</span>
                </span>
                {index === active && <CornerDownLeft className="size-3.5 shrink-0 text-slate-400" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}