// @ts-nocheck
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
    <header
      className="z-30 border-[var(--hairline)] bg-[var(--surface-3)] shadow-[var(--sh-float)] backdrop-blur-[20px] saturate-[180%]"
    >
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="grid size-9 shrink-0 place-items-center rounded-[var(r-control)] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search businesses, tasks and pages"
          className="hidden h-10 w-full max-w-xs cursor-pointer items-center gap-2 rounded-[var(r-control)] border border-[var(--hairline)] bg-[var(--surface-1)] text-[var(--text-1)] shadow-[var(--sh-inset-sm)] transition-colors hover:border-[var(--hairline)] hover:text-[var(--text-1)] md:flex"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded-[var(r-control)] border border-[var(--hairline)] bg-[var(--surface-1)] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[var(--text-2)]">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search"
            className="grid size-9 shrink-0 place-items-center rounded-[var(r-control)] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] md:hidden"
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
                  <span
                    className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--danger)] text-white ring-2 ring-[var(--surface-1)] dark:ring-slate-950"
                  />
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