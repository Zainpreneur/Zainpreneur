import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Bell,
  Building2,
  ChevronRight,
  Flag,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Package,
  Receipt,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  UserRound,
  Users,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react'

import type { ActivityType, ThemeMode } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { useBusinesses } from '../../context/BusinessContext'
import { Avatar } from '../common/Avatar'
import { Dropdown } from '../ui/Dropdown'

interface NavbarProps {
  onMenuClick: () => void
  onOpenSearch: () => void
}

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  task: Sparkles,
  transaction: Receipt,
  team: Users,
  business: SettingsIcon,
  milestone: Flag,
  branch: Building2,
  owner: UserRound,
  asset: Package,
}

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: LucideIcon }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function Navbar({ onMenuClick, onOpenSearch }: NavbarProps) {
  const navigate = useNavigate()
  const { authUser, logout } = useAuth()
  const { activity, businesses, settings, updateSettings } = useBusinesses()

  const recentActivity = useMemo(
    () =>
      [...activity]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 6)
        .map((event) => ({
          ...event,
          businessName: businesses.find((b) => b.id === event.businessId)?.name ?? 'Portfolio',
        })),
    [activity, businesses],
  )

  const currentTheme = THEME_OPTIONS.find((option) => option.value === settings.theme) ?? THEME_OPTIONS[2]

  return (
    <header className="z-30 border-b border-slate-200 bg-white/85 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Menu className="size-5" />
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search businesses, tasks and pages"
          className="hidden h-10 w-full max-w-xs cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-400 shadow-sm transition-colors hover:border-slate-400 hover:text-slate-600 md:flex dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-slate-600 dark:hover:text-slate-200"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 md:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Search className="size-5" />
          </button>

          <Dropdown
            hideChevron
            label="Appearance"
            trigger={
              <span className="inline-flex items-center gap-1.5 px-1">
                <currentTheme.icon className="size-[18px]" />
                <span className="hidden text-xs font-semibold sm:inline">{currentTheme.label}</span>
              </span>
            }
            items={THEME_OPTIONS.map((option) => ({
              label: option.label,
              icon: option.icon,
              onClick: () => updateSettings({ theme: option.value }),
            }))}
          />

          <Dropdown
            hideChevron
            label="Notifications"
            trigger={
              <span className="relative inline-flex">
                <Bell className="size-[18px]" />
                {recentActivity.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950" />
                )}
              </span>
            }
            items={[
              ...recentActivity.slice(0, 4).map((event) => ({
                label: event.message.length > 34 ? `${event.message.slice(0, 34)}…` : event.message,
                icon: ACTIVITY_ICONS[event.type],
                onClick: () => navigate(`/businesses/${event.businessId}`),
              })),
              { label: '', separator: true },
              { label: 'View all activity', icon: ChevronRight, onClick: () => navigate('/') },
            ]}
          />

          <Dropdown
            hideChevron
            label="Account menu"
            trigger={<Avatar name={authUser?.name ?? 'User'} initials="ZP" color="#6366f1" size="sm" />}
            items={[
              { label: authUser?.email ?? 'zain@zainpreneur.io', icon: UserIcon, onClick: () => navigate('/settings') },
              { label: '', separator: true },
              { label: 'Settings', icon: SettingsIcon, onClick: () => navigate('/settings') },
              {
                label: 'Log out',
                icon: LogOut,
                danger: true,
                onClick: () => {
                  logout()
                  navigate('/login')
                },
              },
              { label: 'Assets', icon: Package, onClick: () => navigate('/assets') },
              { label: 'Team', icon: Users, onClick: () => navigate('/team') },
            ]}
          />
        </div>
      </div>
    </header>
  )
}