// @ts-nocheck
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  HeartPulse,
  Laptop,
  Package,
  Cog,
  Wrench,
} from 'lucide-react'

import type { Business, BusinessCategory, DonutSlice, Task, TaskStatus } from '../types'
import { useBusinesses } from '../context/BusinessContext'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatNumber } from '../utils/format'
import { businessFinancials, portfolioSummary } from '../utils/calculations'
import { Button } from '../components/common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/common/Card'
import { PageContainer, PageHeader } from '../components/layout/PageContainer'
import { Badge } from '../components/common/Badge'
import { StatCard } from '../components/common/StatCard'
import { BusinessLogo } from '../components/common/BusinessLogo'
import { Checkbox } from '../components/common/Checkbox'
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
  const { businesses, tasks, activity, settings, zainOwnerId, addBusiness, addTask, updateTask, updateBusiness, addBranch, assets, teamMembers } =
    useBusinesses()
  const { authUser, profile } = useAuth()

  const [businessModalOpen, setBusinessModalOpen] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<Business | undefined>(undefined)
  const [taskModalOpen, setTaskModalOpen] = useState(false)

  const totals = useMemo(() => computeTotals(businesses), [businesses])
  const portfolio = useMemo(() => portfolioSummary(businesses, zainOwnerId), [businesses, zainOwnerId])
  const history = useMemo(() => getPortfolioHistory(businesses), [businesses])

  const assetUtilization = useMemo(() => {
    const total = assets?.length ?? 0
    const deployed = assets?.filter((a) => a.status === 'in-use').length ?? 0
    const available = assets?.filter((a) => a.status === 'available').length ?? 0
    const maintenance = assets?.filter((a) => a.status === 'maintenance').length ?? 0
    const retired = assets?.filter((a) => a.status === 'retired').length ?? 0
    const totalValue = assets?.reduce((sum, a) => sum + a.value, 0) ?? 0
    const deployedValue = assets?.filter((a) => a.status === 'in-use').reduce((sum, a) => sum + a.value, 0) ?? 0
    const byCategory: Record<string, { count: number; value: number }> = {
      hardware: { count: 0, value: 0 },
      machinery: { count: 0, value: 0 },
      equipment: { count: 0, value: 0 },
      other: { count: 0, value: 0 },
    }
    assets?.forEach((a) => {
      byCategory[a.category].count++
      byCategory[a.category].value += a.value
    })
    const active = total - (retired ?? 0)
    const utilizationRate = active > 0 ? (deployed / active) * 100 : 0
    return {
      total,
      deployed,
      available,
      maintenance,
      retired,
      totalValue,
      deployedValue,
      utilizationRate: Math.round(utilizationRate),
      byCategory,
    }
  }, [assets])

  const teamBreakdown = useMemo(() => {
    const internal = teamMembers.filter((m) => m.engagementType === 'internal').length
    const freelancer = teamMembers.filter((m) => m.engagementType === 'freelancer').length
    const agency = teamMembers.filter((m) => m.engagementType === 'agency_partner').length
    const modelCounts = businesses.reduce<Record<string, number>>((acc, b) => {
      acc[b.model] = (acc[b.model] ?? 0) + 1
      return acc
    }, {})
    return { internal, freelancer, agency, total: teamMembers.length, modelCounts }
  }, [teamMembers, businesses])

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
          delta={revenueDelta}
          caption={`Across ${portfolio.businesses} businesses · EV ${formatCurrency(portfolio.enterpriseValue, settings.currency, { compact: true })}`}
          sparkline={history.revenue.map((point) => point.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3 xl:col-span-7 xl:grid-cols-3">
          <StatCard
            label="Net profit"
            value={formatCurrency(portfolio.monthlyProfit, settings.currency, { compact: true, signed: false })}
            icon={CircleDollarSign}
            delta={profitDelta}
            caption={`${portfolio.margin.toFixed(0)}% margin`}
          />
          <StatCard
            label="Your net worth"
            value={formatCurrency(portfolio.userNetWorth, settings.currency, { compact: true })}
            icon={Building2}
            caption={`${formatCurrency(portfolio.userMonthlyProfit, settings.currency, { compact: true })}/mo net share · ${portfolio.branches} branches`}
          />
          <StatCard
            label="Avg health"
            value={String(totals.avgHealth)}
            icon={HeartPulse}
            caption={`${formatNumber(portfolio.employees)} people · ${totals.owned} owned · ${totals.equity} equity · ${totals.client} client`}
          />
          <StatCard
            label="Assets deployed"
            value={String(assetUtilization.deployed)}
            icon={Laptop}
          />
          <StatCard
            label="Assets available"
            value={String(assetUtilization.available)}
            icon={Package}
          />
          <StatCard
            label="Assets in maintenance"
            value={String(assetUtilization.maintenance)}
            icon={Cog}
          />
          <StatCard
            label="Assets retired"
            value={String(assetUtilization.retired)}
            icon={Wrench}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)]">Team breakdown</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{teamBreakdown.total} <span className="text-sm font-medium text-[var(--text-2)]">people & partners</span></p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[var(r-chip)] bg-[var(--accent)]" />Internal</span><span className="font-bold">{teamBreakdown.internal}</span></div>
              <div className="flex justify-between"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[var(r-chip)] bg-[var(--surface-2)]" />Freelancers</span><span className="font-bold">{teamBreakdown.freelancer}</span></div>
              <div className="flex justify-between"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[var(r-chip)] bg-[var(--surface-2)]" />Agencies</span><span className="font-bold">{teamBreakdown.agency}</span></div>
            </div>
            <Link to="/team" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">Open team hub <ArrowRight className="size-3" /></Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)]">Asset utilization</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{assetUtilization.utilizationRate}% <span className="text-sm font-medium text-[var(--text-2)]">in-use</span></p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)] dark:bg-[var(--surface-3)]">
              <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${assetUtilization.utilizationRate}%` }} />
            </div>
            <p className="mt-2 text-xs text-[var(--text-2)]">{assetUtilization.deployed} deployed · {assetUtilization.available} available · {assetUtilization.maintenance} maintenance</p>
            <Link to="/assets" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">Open asset hub <ArrowRight className="size-3" /></Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)]">Business models</p>
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex justify-between"><span>Project-based</span><span className="font-bold">{teamBreakdown.modelCounts.project ?? 0}</span></div>
              <div className="flex justify-between"><span>Consulting-based</span><span className="font-bold">{teamBreakdown.modelCounts.consulting ?? 0}</span></div>
              <div className="flex justify-between"><span>Equity-based</span><span className="font-bold">{teamBreakdown.modelCounts.equity ?? 0}</span></div>
            </div>
            <p className="mt-3 text-xs text-[var(--text-2)]">Project · Consulting · Equity coverage across portfolio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)]">Net share</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{formatCurrency(portfolio.userMonthlyProfit, settings.currency, { compact: true })}<span className="text-sm font-medium text-[var(--text-2)]">/mo</span></p>
            <p className="mt-2 text-xs text-[var(--text-2)]">Net worth {formatCurrency(portfolio.userNetWorth, settings.currency, { compact: true })} · EV {formatCurrency(portfolio.enterpriseValue, settings.currency, { compact: true })}</p>
            <Link to="/financials" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">Open financials <ArrowRight className="size-3" /></Link>
          </CardContent>
        </Card>
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
                { name: 'Revenue', color: '#007AFF', data: history.revenue },
                { name: 'Expenses', color: '#6B7280', data: history.expenses },
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
                <div key={slice.label} className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2 font-medium text-[var(--text-2)] dark:text-[var(--text-3)]">
                    <span className="size-2.5 rounded-[var(r-chip)]" style={{ background: 'var(--accent-tint)' }} />
                    {slice.label}
                  </span>
                  <span className="font-semibold text-[var(--text-1)] dark:text-[var(--text-1)]">
                    {formatCurrency(slice.value, settings.currency, { compact: true })}
                    <span className="ml-1.5 text-[10px] font-medium text-[var(--text-2)]">
                      {Math.round((slice.value / (/* totalDonutValue(donutData) */ 1) || 1) * 100)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 xl:grid-cols-12">
        <Card className="lg:col-span-2">
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
                  className="flex items-center gap-3 rounded-full p-3 transition-all hover:border-[var(--hairline)] hover:bg-[var(--surface-2)] dark:border-[var(--hairline-strong)] dark:hover:bg-[var(--surface-3)]"
                >
                  <span className="font-display text-xs font-extrabold text-[var(--text-2)] dark:text-[var(--text-3)]">{index + 1}</span>
                  <BusinessLogo glyph={business.logoGlyph} color={business.color} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--text-1)] dark:text-white">{business.name}</span>
                    <span className="block text-xs text-[var(--text-2)]">{CATEGORY_META[business.category].shortLabel}</span>
                  </span>
                  <span className="text-right">
                    <span className="font-display text-sm font-bold">
                      {formatCurrency(profit, settings.currency, { compact: true, signed: true })}
                    </span>
                    <span className="block text-[10px] text-[var(--text-2)]">/ month</span>
                  </span>
                </Link>
              )
            })}
            <Link
              to="/businesses"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)] dark:text-[var(--accent-hover)]"
            >
              Manage all businesses
              <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <div>
              <CardTitle>Upcoming tasks</CardTitle>
              <CardDescription>{openCount} open · {completionRate}% completed overall</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingTasks.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--text-2)]">All clear — no open tasks.</p>
            ) : (
              upcomingTasks.map((task: Task) => {
                const business = businesses.find((b) => b.id === task.businessId)
                const isOverdue = isPast(task.dueDate)
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 rounded-full border border-[var(--hairline)] p-3 transition-all hover:border-[var(--hairline)] hover:bg-[var(--surface-2)] dark:border-[var(--hairline-strong)] dark:hover:bg-[var(--surface-3)]"
                  >
                    <Checkbox
                      checked={false}
                      onChange={() => updateTask(task.id, { status: 'done' as TaskStatus })}
                      label={`Mark task complete: ${task.title}`}
                      className="mt-0.5 md:mt-[3px]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text-1)] dark:text-white">{task.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-2)]">
                        {business && (
                          <span className="inline-flex items-center gap-1">
                            <span className="size-1.5 rounded-[var(r-chip)]" style={{ background: business.color }} />
                            {business.name}
                          </span>
                        )}
                        <span className="text-[var(--text-2)] dark:text-[var(--text-3)]">·</span>
                        <span className={isOverdue ? 'font-semibold text-[var(--danger)]' : undefined}>
                          due {isPast(task.dueDate) ? 'overdue' : formatShortDateLabel(task.dueDate)}
                        </span>
                      </span>
                    </span>
                    <Badge className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold">
                      {task.priority}
                    </Badge>
                  </div>
                )
              })
            )}
            <Link
              to="/tasks"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)] dark:text-[var(--accent-hover)]"
            >
              Open task board
              <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
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
          onSubmit={(draft, initialBranches) => {
            if (editingBusiness) {
              updateBusiness(editingBusiness.id, draft)
            } else {
              const created = addBusiness(draft)
              initialBranches.forEach((branch) => addBranch(created.id, branch))
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

function formatShortDateLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

