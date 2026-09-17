import {
  Building2,
  Flag,
  Receipt,
  Settings as SettingsIcon,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'

import type { ActivityType, Business } from '../../types'
import { timeAgo } from '../../utils/format'

interface ActivityFeedProps {
  events: Array<{ id: string; businessId: string; type: ActivityType; message: string; timestamp: string }>
  businesses: Business[]
  limit?: number
}

const ICONS: Record<ActivityType, LucideIcon> = {
  task: Sparkles,
  transaction: Receipt,
  team: Users,
  business: SettingsIcon,
  milestone: Flag,
  branch: Building2,
  owner: UserRound,
}

const ICON_STYLES: Record<ActivityType, string> = {
  task: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  transaction: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  team: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  business: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  milestone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  branch: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
  owner: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
}

export function ActivityFeed({ events, businesses, limit }: ActivityFeedProps) {
  const items = (limit ? events.slice(0, limit) : events).slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  return (
    <ol className="relative space-y-4">
      {items.map((event) => {
        const Icon = ICONS[event.type] ?? TrendingUp
        const business = businesses.find((b) => b.id === event.businessId)
        return (
          <li key={event.id} className="flex gap-3">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${ICON_STYLES[event.type]}`}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-slate-700 dark:text-slate-200">{event.message}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                {business && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: business.color }} />
                    {business.name}
                  </span>
                )}
                <span>·</span>
                <span>{timeAgo(event.timestamp)}</span>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}