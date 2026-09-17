import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  ArrowRight,
  Banknote,
  Building2,
  CircleDollarSign,
  HeartPulse,
  Plus,
} from 'lucide-react'

import type { Business, BusinessCategory, DonutSlice, Task, TaskStatus } from '../types'
import { useBusinesses } from '../context/BusinessContext'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatNumber } from '../utils/format'
import { businessFinancials, portfolioSummary } from '../utils/calculations'
import { CATEGORY_META } from '../utils/meta'
import { isPast } from '../utils/time'
import { cn } from '../utils/cn'
import { computeTotals, getPortfolioHistory } from '../utils/stats'
import { Button } from '../components/common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/common/Card'
import { PageContainer, PageHeader } from '../components/layout/PageContainer'
import { Badge } from '../components/common/Badge'
import { StatCard } from '../components/common/StatCard'
import { BusinessLogo } from '../components/common/BusinessLogo'
import { BusinessFormModal } from '../components/business/BusinessFormModal'
import { TaskFormModal } from '../components/business/TaskFormModal'
import { ActivityFeed } from '../components/business/ActivityFeed'
import { BarChart } from '../components/ui/BarChart'
import { DonutChart } from '../components/ui/DonutChart'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard() {
  const { businesses, tasks, activity, settings, zainOwnerId, addBusiness, addTask, updateTask, updateBusiness } =
    useBusinesses()
  const { authUser, profile } = useAuth()

  const [businessModalOpen, setBusinessModalOpen] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<Business | undefined>(undefined)
  const [taskModalOpen, setTaskModalOpen] = useState(false)

  const totals = useMemo(() => computeTotals(businesses), [businesses])
  const portfolio = useMemo(() => portfolioSummary(businesses, zainOwnerId), [businesses, zainOwnerId])
  const history = useMemo(() => getPortfolioHistory(businesses), [businesses])

  const location = useMemo(() => {
    const today = new Date()
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(today)
  }, [])

  const revenueDelta = useMemo(() => {
    if (history.revenue.length < 2) return 0
    const prev = history.revenue[history.revenue.length - 2].value
    const curr = history.revenue[history.revenue.length - 1].value
    if (prev <= 0) return 0
    return Math.round(((curr - prev) / prev) * 100)
  }, [history])

  const profitDelta = useMemo(() => {
    if (history.profit.length < 2) return 0
    const prev = history.profit[history.profit.length - 2].value
    const curr = history.profit[history.profit.length - 1].value
    if (prev <= 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / Math.abs(prev)) * 100)
  }, [history])

  const donutData: DonutSlice[] = useMemo(() => {
    const byCategory = businesses.reduce<Record<string, number>>((acc, b) => {
      acc[b.category] = (acc[b.category] ?? 0) + businessFinancials(b).revenue
      return acc
    }, {})
    return (Object.keys(byCategory) as BusinessCategory[])
      .map((category) => ({
        label: CATEGORY_META[category].shortLabel,
        value: byCategory[category],
        color: CATEGORY_META[category].chartColor,
      }))
      .sort((a, b) => b.value - a.value)
  }, [businesses])

  const topBusinesses = useMemo(
    () => [...businesses].sort((a, b) => businessFinancials(b).profit - businessFinancials(a).profit).slice(0, 4),
    [businesses],
  )

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== 'done')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 6),
    [tasks],
  )

  const openCount = tasks.filter((t) => t.status !== 'done').length
  const doneCount = tasks.filter((t) => t.status === 'done').length
  const completionRate = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0

  const firstName = authUser?.name?.split(' ')[0] ?? profile.name.split(' ')[0]

  return (
    <PageContainer>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={`${location} · Here's your portfolio at a glance.`}
        actions={
          <>
            <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setTaskModalOpen(true)}>
              <span className="hidden sm:inline">New task</span>
            </Button>
            <Button
              icon={<Plus className="size-4" />}
              onClick={() => {
                setEditingBusiness(undefined)
                setBusinessModalOpen(true)
              }}
            >
              <span className="hidden sm:inline">Add business</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-12">
        <StatCard
          hero
          className="lg:col-span-3 xl:col-span-5"
          label="Monthly revenue"
          value={formatCurrency(portfolio.monthlyRevenue, settings.currency, { compact: true })}
          icon={Banknote}
          delta={revenueDelta}
          caption={`Across ${portfolio.businesses} businesses · EV ${formatCurrency(portfolio.enterpriseValue, settings.currency, { compact: true })}`}
          sparkline={history.revenue.map((point) => point.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3 xl:col-span-7 xl:grid-cols-3">
          <StatCard
            label="Net profit"
            value={formatCurrency(portfolio.monthlyProfit, settings.currency, { compact: true, signed: false })}
            icon={CircleDollarSign}
            iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            delta={profitDelta}
            caption={`${portfolio.margin.toFixed(0)}% margin`}
          />
          <StatCard
            label="Your net worth"
            value={formatCurrency(portfolio.userNetWorth, settings.currency, { compact: true })}
            icon={Building2}
            iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
            caption={`${formatCurrency(portfolio.userMonthlyProfit, settings.currency, { compact: true })}/mo net share · ${portfolio.branches} branches`}
          />
          <StatCard
            label="Avg health"
            value={String(totals.avgHealth)}
            icon={HeartPulse}
            iconClass="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
            caption={`${formatNumber(portfolio.employees)} people · ${totals.owned} owned · ${totals.equity} equity · ${totals.client} client`}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Revenue vs expenses</CardTitle>
              <CardDescription>Aggregated 12-month trend across all businesses</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              series={[
                { name: 'Revenue', color: '#6366f1', data: history.revenue },
                { name: 'Expenses', color: '#cbd5e1', data: history.expenses },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Revenue by category</CardTitle>
              <CardDescription>Share of monthly portfolio revenue</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <DonutChart
              data={donutData}
              centerValue={formatCurrency(portfolio.monthlyRevenue, settings.currency, { compact: true })}
              centerLabel="total"
            />
            <div className="w-full space-y-2.5">
              {donutData.map((slice) => (
                <div key={slice.label} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                    <span className="size-2.5 rounded-sm" style={{ backgroundColor: slice.color }} />
                    {slice.label}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(slice.value, settings.currency, { compact: true })}
                    <span className="ml-1.5 text-xs font-medium text-slate-400">
                      {Math.round((slice.value / (totalDonutValue(donutData) || 1)) * 100)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Top performers</CardTitle>
              <CardDescription>Ranked by monthly profit</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {topBusinesses.map((business, index) => {
              const profit = businessFinancials(business).profit
              return (
                <Link
                  key={business.id}
                  to={`/businesses/${business.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-all hover:border-slate-200 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                >
                  <span className="font-display text-xs font-extrabold text-slate-300 dark:text-slate-600">{index + 1}</span>
                  <BusinessLogo glyph={business.logoGlyph} color={business.color} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{business.name}</span>
                    <span className="block text-xs text-slate-400">{CATEGORY_META[business.category].shortLabel}</span>
                  </span>
                  <span className="text-right">
                    <span className={cn('block font-display text-sm font-bold', profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                      {formatCurrency(profit, settings.currency, { compact: true, signed: true })}
                    </span>
                    <span className="block text-[10px] font-medium text-slate-400">/ month</span>
                  </span>
                </Link>
              )
            })}
            <Link
              to="/businesses"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400"
            >
              Manage all businesses
              <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader>
            <div>
              <CardTitle>Upcoming tasks</CardTitle>
              <CardDescription>{openCount} open · {completionRate}% completed overall</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">All clear — no open tasks.</p>
            ) : (
              upcomingTasks.map((task: Task) => {
                const business = businesses.find((b) => b.id === task.businessId)
                const isOverdue = isPast(task.dueDate)
                return (
                  <label
                    key={task.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 transition-all hover:border-slate-200 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => updateTask(task.id, { status: 'done' as TaskStatus })}
                      className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-brand-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">{task.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                        {business && (
                          <span className="inline-flex items-center gap-1">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: business.color }} />
                            {business.name}
                          </span>
                        )}
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className={isOverdue ? 'font-semibold text-rose-500' : undefined}>
                          due {formatShortDateLabel(task.dueDate)}
                        </span>
                      </span>
                    </span>
                    <Badge className={PRIORITY_CLASS(task.priority)}>{task.priority}</Badge>
                  </label>
                )
              })
            )}
            <Link
              to="/tasks"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400"
            >
              Open task board
              <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest across the portfolio</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ActivityFeed events={activity} businesses={businesses} limit={6} />
          </CardContent>
        </Card>
      </div>

      {businessModalOpen && (
        <BusinessFormModal
          open
          onClose={() => setBusinessModalOpen(false)}
          initial={editingBusiness}
          onSubmit={(draft) => {
            if (editingBusiness) {
              updateBusiness(editingBusiness.id, draft)
            } else {
              addBusiness(draft)
            }
          }}
        />
      )}
      {taskModalOpen && (
        <TaskFormModal open onClose={() => setTaskModalOpen(false)} businesses={businesses} onSubmit={(draft) => addTask(draft)} />
      )}
    </PageContainer>
  )
}

function totalDonutValue(slices: DonutSlice[]): number {
  return slices.reduce((sum, slice) => sum + slice.value, 0)
}

function formatShortDateLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PRIORITY_CLASS = (priority: string): string =>
  priority === 'urgent'
    ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400'
    : priority === 'high'
      ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-400'
      : priority === 'medium'
        ? 'bg-sky-50 text-sky-600 ring-1 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400'
        : 'bg-slate-100 text-slate-500 ring-1 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400'