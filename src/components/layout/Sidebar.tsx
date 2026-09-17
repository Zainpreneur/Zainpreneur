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
  'group relative flex min-h-[38px] items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50'

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
      className="flex items-center gap-3 rounded-lg px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-violet-500 to-fuchsia-500 font-display text-lg font-extrabold text-white shadow-lg shadow-brand-500/30">
        Z
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
          Zainpreneur
        </span>
        <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">Business OS</span>
      </span>
    </NavLink>
  )

  const navBody = (
    <>
      {navigation.map((section) => (
        <div key={section.label} className="mt-6">
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
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
                        ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-white/10 dark:text-white dark:ring-white/10'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100',
                    )
                  }
                >
                  {({ isActive }) =>
                    isActive ? (
                      <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-indigo-500" />
                    ) : null
                  }
                  <item.icon className="size-[18px] shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10">
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
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Categories</p>
          <Sparkles className="size-3 text-slate-400 dark:text-slate-600" />
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
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
                >
                  <span className={cn('size-2 rounded-full', meta.dotClass)} />
                  <span className="flex-1 truncate text-left">{meta.label}</span>
                  <span className="text-xs font-semibold text-slate-500">{categoryCounts[category]}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )

  const sidebarInner = (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex h-16 items-center justify-between px-4">
        {brand}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateSettings({ compactSidebar: true })}
            aria-label="Collapse sidebar"
            className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 lg:block dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <PanelLeftClose className="size-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4">
        {navBody}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-white/10">
        <button
          type="button"
          onClick={() => {
            navigate('/settings')
            onClose()
          }}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:hover:bg-white/5"
        >
          <Avatar name={authUser?.name ?? 'User'} initials="ZP" color="#6366f1" size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
              {authUser?.name ?? 'Zain Pirzada'}
            </span>
            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
              {authUser?.email ?? 'zain@zainpreneur.io'}
            </span>
          </span>
          <Settings className="size-4 shrink-0 text-slate-400 dark:text-slate-500" />
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
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-2xl">{sidebarInner}</div>
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
    <div className="flex h-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex h-16 items-center justify-center">
        <NavLink
          to="/"
          onClick={onNavigate}
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-violet-500 to-fuchsia-500 font-display text-lg font-extrabold text-white shadow-lg shadow-brand-500/30">
            Z
          </span>
        </NavLink>
      </div>
      <nav aria-label="Primary" className="flex-1 space-y-1.5 overflow-y-auto px-2.5 py-4">
        {items.map((item) => (
          <CompactNavItem key={item.path} {...item} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="flex flex-col items-center gap-2 border-t border-slate-200 p-3 dark:border-white/10">
        <button
          type="button"
          onClick={() => {
            navigate('/settings')
            onNavigate()
          }}
          title={userName}
          aria-label="Open settings"
          className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
        >
          <Avatar name={userName} initials="ZP" color="#6366f1" size="sm" />
        </button>
        <button
          type="button"
          onClick={onExpand}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          className="flex size-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-200"
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
          'flex size-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
          isActive
            ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:bg-white/10 dark:text-white dark:ring-white/10'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-slate-200',
        )
      }
    >
      <Icon className="size-5" />
    </NavLink>
  )
}