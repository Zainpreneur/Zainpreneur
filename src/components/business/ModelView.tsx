import { useState } from 'react'

import { CalendarDays, CheckCircle2, Circle, Clock, FolderKanban, Plus, Target, Trash2, Wallet } from 'lucide-react'

import type { Business, Milestone, MilestoneStatus } from '../../types'
import { useBusinesses } from '../../context/BusinessContext'
import { formatCurrency } from '../../utils/format'
import { modelMetrics } from '../../utils/calculations'
import { MILESTONE_STATUS_META, MODEL_META } from '../../utils/meta'
import { cn } from '../../utils/cn'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'
import { Field, TextInput } from '../common/Input'
import { StatCard } from '../common/StatCard'

interface ModelViewProps {
  business: Business
  currency: Parameters<typeof formatCurrency>[1]
}

const NEXT_STATUS: Record<MilestoneStatus, MilestoneStatus> = {
  planned: 'in_progress',
  in_progress: 'done',
  done: 'planned',
}

function MilestoneRow({
  business,
  milestone,
  currency,
}: {
  business: Business
  milestone: Milestone
  currency: Parameters<typeof formatCurrency>[1]
}) {
  const { updateMilestone, deleteMilestone } = useBusinesses()
  const meta = MILESTONE_STATUS_META[milestone.status]
  const Icon = milestone.status === 'done' ? CheckCircle2 : milestone.status === 'in_progress' ? Clock : Circle

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
      <button
        type="button"
        aria-label={`Mark ${milestone.name} as ${NEXT_STATUS[milestone.status]}`}
        onClick={() => updateMilestone(business.id, milestone.id, { status: NEXT_STATUS[milestone.status] })}
        className={cn(
          'shrink-0 rounded-lg p-1 transition-colors',
          milestone.status === 'done'
            ? 'text-emerald-500'
            : milestone.status === 'in_progress'
              ? 'text-sky-500'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
        )}
      >
        <Icon className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-semibold text-slate-800 dark:text-slate-100',
            milestone.status === 'done' && 'text-slate-400 line-through dark:text-slate-500',
          )}
        >
          {milestone.name}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <CalendarDays className="size-3" />
          {new Date(milestone.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      <Badge className={meta.badgeClass}>{meta.label}</Badge>
      <span className="hidden shrink-0 text-sm font-bold tabular-nums text-slate-700 sm:block dark:text-slate-200">
        {formatCurrency(milestone.budget, currency, { compact: true })}
      </span>
      <button
        type="button"
        aria-label={`Delete ${milestone.name}`}
        onClick={() => deleteMilestone(business.id, milestone.id)}
        className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}

function ProjectView({ business, currency }: ModelViewProps) {
  const { addMilestone } = useBusinesses()
  const metrics = modelMetrics(business)
  const milestones = business.project?.milestones ?? []

  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [budget, setBudget] = useState('')

  if (metrics.model !== 'project') return null

  const handleAdd = () => {
    if (!name.trim() || !dueDate) return
    addMilestone(business.id, {
      name: name.trim(),
      status: 'planned',
      dueDate,
      budget: Number(budget) || 0,
    })
    setName('')
    setDueDate('')
    setBudget('')
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Completion" value={`${metrics.completionRate}%`} icon={Target} iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400" />
        <StatCard label="Milestones" value={`${metrics.milestonesDone}/${metrics.milestonesTotal}`} icon={CheckCircle2} />
        <StatCard label="Budget" value={formatCurrency(metrics.budget, currency, { compact: true })} icon={Wallet} />
        <StatCard label="Deliverables" value={String(metrics.deliverables)} icon={FolderKanban} caption={`${formatCurrency(metrics.budgetPerDeliverable, currency, { compact: true })} each`} />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Milestones</CardTitle>
            <CardDescription>Track deliverables and payment milestones for this project.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {milestones.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No milestones yet — add the first one below.</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((milestone) => (
                <MilestoneRow key={milestone.id} business={business} milestone={milestone} currency={currency} />
              ))}
            </div>
          )}

          <div className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end dark:border-slate-800">
            <Field label="Milestone">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Discovery workshops" />
            </Field>
            <Field label="Due date">
              <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Budget">
              <TextInput type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" />
            </Field>
            <Button type="button" icon={<Plus className="size-4" />} onClick={handleAdd} disabled={!name.trim() || !dueDate}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function ConsultingView({ business, currency }: ModelViewProps) {
  const metrics = modelMetrics(business)
  if (metrics.model !== 'consulting') return null

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Utilization" value={`${metrics.utilization}%`} icon={Target} iconClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" />
        <StatCard label="Billable hours" value={`${metrics.hoursLogged}/${metrics.hoursTarget}`} icon={Clock} />
        <StatCard label="Effective rate" value={formatCurrency(metrics.effectiveHourlyRate, currency, { compact: true })} icon={Wallet} caption={`Billed at ${formatCurrency(metrics.billedRate, currency)}/hr`} />
        <StatCard label="Contracts" value={String(metrics.contracts)} icon={FolderKanban} caption={`${formatCurrency(metrics.retainerMonthly, currency, { compact: true })} retainer/mo`} />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Retainer & utilization</CardTitle>
            <CardDescription>Logged billable hours against target for this period.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Billable utilization</span>
              <span className="tabular-nums">{metrics.utilization}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cn('h-full rounded-full', metrics.utilization >= 80 ? 'bg-emerald-500' : metrics.utilization >= 50 ? 'bg-indigo-500' : 'bg-amber-500')}
                style={{ width: `${Math.min(100, metrics.utilization)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              {metrics.hoursLogged} of {metrics.hoursTarget} target hours logged · {metrics.contracts} active contracts.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function EquityView({ business, currency }: ModelViewProps) {
  const { zainOwnerId } = useBusinesses()
  const metrics = modelMetrics(business, zainOwnerId)
  if (metrics.model !== 'equity') return null

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Valuation" value={formatCurrency(metrics.valuation, currency, { compact: true })} icon={Wallet} iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" />
        <StatCard label="Dividend yield" value={`${metrics.dividendYield}%`} icon={Target} />
        <StatCard label="Dividends received" value={formatCurrency(metrics.dividendsReceived, currency, { compact: true })} icon={Wallet} />
        <StatCard label="Your net asset value" value={formatCurrency(metrics.netAssetValue, currency, { compact: true })} icon={FolderKanban} caption={`${metrics.userPercentage}% stake`} />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Equity position</CardTitle>
            <CardDescription>Your proportional ownership of this venture.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl bg-emerald-50/60 px-4 py-3 dark:bg-emerald-500/5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
                Your stake
              </p>
              <p className="font-display text-lg font-bold text-emerald-800 dark:text-emerald-200">{metrics.userPercentage}%</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
                Net asset value
              </p>
              <p className="font-display text-lg font-bold text-emerald-800 dark:text-emerald-200">
                {formatCurrency(metrics.netAssetValue, currency, { compact: true })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

export function ModelView({ business, currency }: ModelViewProps) {
  const meta = MODEL_META[business.model]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
        <meta.icon className="size-4" />
        {meta.label} metrics
      </div>
      {business.model === 'project' && <ProjectView business={business} currency={currency} />}
      {business.model === 'consulting' && <ConsultingView business={business} currency={currency} />}
      {business.model === 'equity' && <EquityView business={business} currency={currency} />}
    </div>
  )
}
