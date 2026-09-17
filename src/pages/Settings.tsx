import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Bell,
  Database,
  Download,
  HardDrive,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Smartphone,
  Sun,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react'

import type { CurrencyCode, ThemeMode } from '../types'
import { CURRENCY_LABELS } from '../types'
import { useAuth } from '../context/AuthContext'
import { useBusinesses } from '../context/BusinessContext'
import { cn } from '../utils/cn'
import { PageContainer, PageHeader, SectionHeader } from '../components/layout/PageContainer'
import { Button } from '../components/common/Button'
import { Avatar } from '../components/common/Avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/common/Card'
import { Field, Select, TextInput, Textarea } from '../components/common/Input'
import { Toggle } from '../components/common/Toggle'
import { ConfirmDialog } from '../components/common/Modal'
import { DatabasePanel } from '../components/business/DatabasePanel'
import { formatBytes } from '../utils/format'
import { usePwaInstall } from '../hooks/usePwaInstall'

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function Settings() {
  const navigate = useNavigate()
  const { authUser, logout } = useAuth()
  const {
    businesses,
    transactions,
    tasks,
    activity,
    settings,
    profile,
    updateSettings,
    updateProfile,
    resetData,
  } = useBusinesses()

  const [confirmReset, setConfirmReset] = useState(false)
  const [saved, setSaved] = useState(false)
  const [installing, setInstalling] = useState(false)
  const { canInstall, installed, online, swActive, promptInstall } = usePwaInstall()

  const [form, setForm] = useState(() => ({
    name: profile.name,
    email: profile.email,
    role: profile.role,
    bio: profile.bio,
    timezone: profile.timezone,
  }))

  const underlyingStorage = [
    ...businesses.map((b) => JSON.stringify(b)),
    ...transactions.map((t) => JSON.stringify(t)),
    ...tasks.map((t) => JSON.stringify(t)),
    ...activity.map((a) => JSON.stringify(a)),
  ]
  const storageBytes = new Blob([underlyingStorage.join('')]).size

  const saveProfile = () => {
    updateProfile({
      name: form.name.trim() || profile.name,
      email: form.email.trim() || profile.email,
      role: form.role.trim(),
      bio: form.bio.trim(),
      timezone: form.timezone,
    })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      settings,
      businessCount: businesses.length,
      businesses,
      transactions,
      tasks,
      activity,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `zainpreneur-export-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Profile, preferences and data controls for your command center." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <UserRound className="size-5" />
              </span>
              <div>
                <CardTitle>Profile</CardTitle>
                <CardDescription>How you appear across Zainpreneur</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={profile.name} initials={profile.initials} color={profile.avatarColor} size="lg" />
              <div>
                <p className="font-display text-base font-bold text-slate-900 dark:text-white">{profile.name}</p>
                <p className="text-sm text-slate-400">{profile.email}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="set-name">
                <TextInput id="set-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Email" htmlFor="set-email">
                <TextInput id="set-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Role" htmlFor="set-role">
                <TextInput id="set-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </Field>
              <Field label="Enterprise">
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 ring-1 ring-inset ring-slate-200 dark:bg-white/5 dark:text-slate-100 dark:ring-white/10">
                  {profile.enterprise} HQ
                </p>
              </Field>
            </div>

            <Field label="Bio" htmlFor="set-bio">
              <Textarea id="set-bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </Field>

            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-slate-400">{saved ? 'Saved' : ' '}</span>
              <Button onClick={saveProfile}>Save profile</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                  <Palette className="size-5" />
                </span>
                <div>
                  <CardTitle>Preferences</CardTitle>
                  <CardDescription>Appearance and default behaviour</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Theme">
                <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSettings({ theme: option.value })}
                      className={cn(
                        'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                        settings.theme === option.value
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
                      )}
                    >
                      <option.icon className="size-4" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Currency" htmlFor="set-currency" hint="Used across financial views and charts">
                <Select
                  id="set-currency"
                  value={settings.currency}
                  onChange={(e) => updateSettings({ currency: e.target.value as CurrencyCode })}
                >
                  {(Object.keys(CURRENCY_LABELS) as CurrencyCode[]).map((currency) => (
                    <option key={currency} value={currency}>
                      {CURRENCY_LABELS[currency]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Default portfolio filter" htmlFor="set-default-filter">
                <Select
                  id="set-default-filter"
                  value={settings.defaultCategoryFilter}
                  onChange={(e) =>
                    updateSettings({ defaultCategoryFilter: e.target.value as 'owned' | 'equity' | 'client' | 'all' })
                  }
                >
                  <option value="all">All categories</option>
                  <option value="owned">Owned businesses</option>
                  <option value="equity">Equity stakes</option>
                  <option value="client">Client businesses</option>
                </Select>
              </Field>

              <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40">
                <Toggle
                  id="set-compact"
                  checked={settings.compactSidebar}
                  onChange={(checked) => updateSettings({ compactSidebar: checked })}
                  label="Compact sidebar"
                />
                <Toggle
                  id="set-totals"
                  checked={settings.showFinancialTotals}
                  onChange={(checked) => updateSettings({ showFinancialTotals: checked })}
                  label="Show financial totals"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                <Bell className="size-5" />
              </span>
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>What you want to hear about</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40">
              <Toggle
                id="set-notif-tasks"
                checked={settings.notifications.taskReminders}
                onChange={(checked) => updateSettings({ notifications: { ...settings.notifications, taskReminders: checked } })}
                label="Task reminders"
              />
              <Toggle
                id="set-notif-payments"
                checked={settings.notifications.paymentAlerts}
                onChange={(checked) => updateSettings({ notifications: { ...settings.notifications, paymentAlerts: checked } })}
                label="Payment & payout alerts"
              />
              <Toggle
                id="set-notif-digest"
                checked={settings.notifications.weeklyDigest}
                onChange={(checked) => updateSettings({ notifications: { ...settings.notifications, weeklyDigest: checked } })}
                label="Weekly performance digest"
              />
              <Toggle
                id="set-notif-milestones"
                checked={settings.notifications.milestoneAlerts}
                onChange={(checked) => updateSettings({ notifications: { ...settings.notifications, milestoneAlerts: checked } })}
                label="Milestone alerts"
              />
              <Toggle
                id="set-notif-marketing"
                checked={settings.notifications.marketingEmails}
                onChange={(checked) => updateSettings({ notifications: { ...settings.notifications, marketingEmails: checked } })}
                label="Product news & marketing"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                <Database className="size-5" />
              </span>
              <div>
                <CardTitle>Data & storage</CardTitle>
                <CardDescription>Everything lives locally in your browser</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <HardDrive className="size-4 text-slate-400" />
                Local data
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatBytes(storageBytes)} · {businesses.length} businesses
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportData} className="flex-1">
                Export data (JSON)
              </Button>
              <Button
                variant="secondary"
                icon={<RotateCcw className="size-4" />}
                className="flex-1 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                onClick={() => setConfirmReset(true)}
              >
                Reset demo data
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
              Zainpreneur stores your mock business data in localStorage. Export a backup before resetting if you made
              changes you want to keep.
            </p>
          </CardContent>
        </Card>

        <DatabasePanel />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Smartphone className="size-5" />
              </span>
              <div>
                <CardTitle>Install app (PWA)</CardTitle>
                <CardDescription>Run Zainpreneur as a standalone app, with offline support</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                {online ? <Wifi className="size-4 text-emerald-500" /> : <WifiOff className="size-4 text-rose-500" />}
                {online ? 'Online' : 'Offline — cached shell serving'}
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {installed ? 'Installed' : swActive ? 'SW active' : 'Browser mode'}
              </span>
            </div>
            {installed ? (
              <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                Zainpreneur is installed and launches standalone. The service worker keeps the app shell
                available offline; your data stays in localStorage on this device.
              </p>
            ) : canInstall ? (
              <Button
                icon={<Smartphone className="size-4" />}
                className="w-full"
                onClick={() => {
                  setInstalling(true)
                  promptInstall().finally(() => setInstalling(false))
                }}
              >
                {installing ? 'Opening install…' : 'Install Zainpreneur'}
              </Button>
            ) : (
              <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                Open this page in Chrome or Edge (production build) and use the browser menu → “Install
                Zainpreneur” — or look for the install icon in the address bar. Offline caching activates
                once the service worker registers.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-sm font-bold text-slate-900 dark:text-white">Session</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Signed in as {authUser?.email ?? 'zain@zainpreneur.io'}
            </p>
          </div>
          <Button
            variant="secondary"
            icon={<LogOut className="size-4" />}
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            Sign out
          </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 text-center">
        <SectionHeader title="Zainpreneur" subtitle="Business OS · v1.0" className="justify-center text-center" />
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetData()
          setConfirmReset(false)
        }}
        title="Reset all demo data?"
        message="This restores the original seed businesses, transactions, tasks and settings. Any changes you made will be lost."
        confirmLabel="Reset everything"
      />
    </PageContainer>
  )
}