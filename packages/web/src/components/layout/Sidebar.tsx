// @ts-nocheck
import { useEffect, useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import {
  BarChart3,
  Building2,
  CheckSquare,
  Landmark,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Truck,
  Users,
  X,
  Package,
} from 'lucide-react'

import type { BusinessCategory, NavSection } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { useBusinesses } from '../../context/BusinessContext'
import { CATEGORY_META } from '../../utils/meta'
import { cn } from '../../utils/cn'
import { Avatar } from '../common/Avatar'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const NAV_LINK_BASE =
  'group relative flex min-h-[38px] items-center gap-3 rounded-[var(r-control)] px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]'

export function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const { authUser } = useAuth()
  const { businesses, owners, tasks, settings, updateSettings } = useBusinesses()

  const compact = settings.compactSidebar
  const openTaskCount = tasks.filter((task) => task.status !== 'done').length

  const navigation: NavSection[] = useMemo(
    () => [
      {
        label: 'Command Center',
        items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }],
      },
      {
        label: 'Portfolio',
        items: [
          { label: 'Businesses', path: '/businesses', icon: Building2, badge: businesses.length },
          { label: 'Owners', path: '/owners', icon: Users, badge: owners.length },
          { label: 'Financials', path: '/financials', icon: BarChart3 },
        ],
      },
      {
        label: 'Operations & Management',
        items: [
          { label: 'Assets', path: '/assets', icon: Package },
          { label: 'Team (HR)', path: '/team', icon: Users },
          { label: 'Vendors & Purchasing', path: '/purchasing', icon: Truck },
          { label: 'Accounting & Ledger', path: '/accounting', icon: Landmark },
          { label: 'Tasks', path: '/tasks', icon: CheckSquare, badge: openTaskCount },
        ],
      },
      {
        label: 'Workspace & System',
        items: [{ label: 'Settings', path: '/settings', icon: Settings }],
      },
    ],
    [businesses.length, owners.length, openTaskCount],
  )

  const categoryCounts = useMemo(() => {
    const counts: Record<BusinessCategory, number> = { owned: 0, equity: 0, client: 0 }
    for (const business of businesses) counts[business.category] += 1
    return counts
  }, [businesses])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const brand = (
    <NavLink
      to="/"
      onClick={onClose}
      className="flex items-center gap-3 rounded-full px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
    >
      <span className="flex size-10 items-center justify-center rounded-[var(r-chip)] bg-gradient-to-br from-[var(--accent)] via-[var(--accent-hover)] to-[var(--accent-press)] font-display text-lg font-extrabold text-white shadow-[var(--sh-accent)]">
        Z
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-extrabold tracking-tight text-[var(--text-1)]">
          Zainpreneur
        </span>
        <span className="block text-[11px] font-medium text-[var(--text-2)]">Business OS</span>
      </span>
    </NavLink>
  )

  const navBody = (
    <>
      {navigation.map((section) => (
        <div key={section.label} className="mt-6">
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-2)]">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      NAV_LINK_BASE,
                      isActive
                        ? 'bg-[var(--surface-1)] shadow-[var(--sh-raised-sm)] text-[var(--text-1)]'
                        : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]',
                    )
                  }
                >
                  {({ isActive }) =>
                    isActive ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-1.5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent)]"
                      />
                    ) : null
                  }
                  <item.icon className="size-[18px] shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="ml-auto rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-2)] ring-1 ring-[var(--hairline)] dark:ring-[var(--hairline-strong)]">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="mt-7">
        <div className="mb-1.5 flex items-center justify-between px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-2)]">Categories</p>
          <Sparkles className="size-3 text-[var(--text-3)]" />
        </div>
        <ul className="space-y-0.5">
          {(Object.keys(CATEGORY_META) as BusinessCategory[]).map((category) => {
            const meta = CATEGORY_META[category]
            return (
              <li key={category}>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/businesses?category=${category}`)
                    onClose()
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-[var(r-control)] px-3 py-2 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)] dark:text-[var(--text-3)] dark:hover:bg-[var(--surface-1)] dark:hover:text-[var(--text-1)]"
                >
                  <span className={cn('size-2 rounded-full', meta.dotClass)} />
                  <span className="flex-1 truncate text-left">{meta.label}</span>
                  <span className="text-xs font-semibold text-[var(--text-2)]">{categoryCounts[category]}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )

  const sidebarInner = (
    <div className="flex h-full flex-col rounded-[var(r-well)] border border-[var(--hairline)] bg-[var(--surface-1)] shadow-[var(--sh-raised)]">
      <div className="flex h-16 items-center justify-between px-4">
        {brand}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateSettings({ compactSidebar: true })}
            aria-label="Collapse sidebar"
            className="hidden rounded-[var(r-control)] p-1.5 text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)] lg:block"
          >
            <PanelLeftClose className="size-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-[var(r-control)] p-1.5 text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4">
        {navBody}
      </nav>

      <div className="border-t border-[var(--hairline)] p-3">
        <button
          type="button"
          onClick={() => {
            navigate('/settings')
            onClose()
          }}
          className="flex w-full cursor-pointer items-center gap-3 rounded-[var(r-control)] p-2 text-left transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
        >
          <Avatar name={authUser?.name ?? 'User'} initials="ZP" color="#6366f1" size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[var(--text-1)]">
              {authUser?.name ?? 'Zain Pirzada'}
            </span>
            <span className="block truncate text-[11px] text-[var(--text-2)]">
              {authUser?.email ?? 'zain@zainpreneur.io'}
            </span>
          </span>
          <Settings className="size-4 shrink-0 text-[var(--text-2)]" />
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className={cn('hidden h-full shrink-0 lg:block', compact ? 'w-[68px]' : 'w-60')}>
        {compact ? (
          <CompactSidebar
            navigation={navigation}
            onNavigate={onClose}
            onExpand={() => updateSettings({ compactSidebar: false })}
            userName={authUser?.name ?? 'Zain Pirzada'}
          />
        ) : (
          sidebarInner
        )}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] rounded-[var(r-well)] bg-[var(--surface-1)] shadow-[var(--sh-raised)]">{sidebarInner}</div>
        </div>
      )}
    </>
  )
}

interface CompactSidebarProps {
  navigation: NavSection[]
  onNavigate: () => void
  onExpand: () => void
  userName: string
}

function CompactSidebar({ navigation, onNavigate, onExpand, userName }: CompactSidebarProps) {
  const navigate = useNavigate()
  const items = navigation.flatMap((section) => section.items)

  return (
    <div className="flex h-full flex-col rounded-[var(r-well)] border border-[var(--hairline)] bg-[var(--surface-1)] shadow-[var(--sh-raised)]">
      <div className="flex h-16 items-center justify-center">
        <NavLink
          to="/"
          onClick={onNavigate}
          className="rounded-[var(r-chip)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
        >
          <span className="flex size-10 items-center justify-center rounded-[var(r-chip)] bg-gradient-to-br from-[var(--accent)] via-[var(--accent-hover)] to-[var(--accent-press)] font-display text-lg font-extrabold text-white shadow-[var(--sh-accent)]">
            Z
          </span>
        </NavLink>
      </div>
      <nav aria-label="Primary" className="flex-1 space-y-1.5 overflow-y-auto px-2.5 py-4">
        {items.map((item) => (
          <CompactNavItem key={item.path} {...item} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="flex flex-col items-center gap-2 border-t border-[var(--hairline)] p-3">
        <button
          type="button"
          onClick={() => {
            navigate('/settings')
            onNavigate()
          }}
          title={userName}
          aria-label="Open settings"
          className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
        >
          <Avatar name={userName} initials="ZP" color="#6366f1" size="sm" />
        </button>
        <button
          type="button"
          onClick={onExpand}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          className="flex size-10 items-center justify-center rounded-[var(r-chip)] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
        >
          <PanelLeftOpen className="size-5" />
        </button>
      </div>
    </div>
  )
}

function CompactNavItem({
  label,
  path,
  icon: Icon,
  onNavigate,
}: NavSection['items'][number] & { onNavigate: () => void }) {
  return (
    <NavLink
      to={path}
      end={path === '/'}
      onClick={onNavigate}
      title={label}
      className={({ isActive }) =>
        cn(
          'flex size-10 items-center justify-center rounded-[var(r-chip)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]',
          isActive
            ? 'bg-[var(--surface-1)] shadow-[var(--sh-raised-sm)] text-[var(--text-1)]'
            : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]',
        )
      }
    >
      <Icon className="size-5" />
    </NavLink>
  )
}