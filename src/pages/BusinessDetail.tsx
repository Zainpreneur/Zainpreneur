import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  CircleDollarSign,
  Globe,
  Handshake,
  Mail,
  MapPin,
  Phone,
  Pencil,
  Plus,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'

import type { Branch, Task, TaskStatus, Transaction } from '../types'
import { BUSINESS_CATEGORY_LABELS, CLIENT_TIER_LABELS } from '../types'
import { useBusinesses } from '../context/BusinessContext'
import { formatCurrency } from '../utils/format'
import { businessFinancials } from '../utils/calculations'
import { CATEGORY_META, MODEL_META, STATUS_META } from '../utils/meta'
import { cn } from '../utils/cn'
import { getBusinessSeries } from '../data'
import { PageContainer, PageHeader } from '../components/layout/PageContainer'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/common/Card'
import { Avatar } from '../components/common/Avatar'
import { BusinessLogo } from '../components/common/BusinessLogo'
import { EmptyState } from '../components/common/EmptyState'
import { ConfirmDialog } from '../components/common/Modal'
import { StatCard } from '../components/common/StatCard'
import { BusinessFormModal } from '../components/business/BusinessFormModal'
import { TransactionFormModal } from '../components/business/TransactionFormModal'
import { TaskFormModal } from '../components/business/TaskFormModal'
import { TransactionTable } from '../components/business/TransactionTable'
import { TaskCard } from '../components/business/TaskCard'
import { CapTableCard } from '../components/business/CapTableCard'
import { ModelView } from '../components/business/ModelView'
import { BranchList } from '../components/business/BranchList'
import { BranchFormModal } from '../components/business/BranchFormModal'
import { BarChart } from '../components/ui/BarChart'
import { ScoreRing } from '../components/ui/ScoreRing'

type Tab = 'overview' | 'capTable' | 'branches' | 'model' | 'financials' | 'tasks'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'capTable', label: 'Cap Table' },
  { value: 'branches', label: 'Branches' },
  { value: 'model', label: 'Model' },
  { value: 'financials', label: 'Financials' },
  { value: 'tasks', label: 'Tasks' },
]

export function BusinessDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    businesses,
    owners,
    transactions,
    tasks,
    settings,
    updateBusiness,
    deleteBusiness,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addTask,
    updateTask,
    deleteTask,
    addBranch,
    updateBranch,
    deleteBranch,
    logActivity,
    teamMembers,
  } = useBusinesses()

  const business = businesses.find((b) => b.id === id)

  const [tab, setTab] = useState<Tab>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [transactionModal, setTransactionModal] = useState<{ open: boolean; editing?: Transaction }>({ open: false })
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)
  const [deleting, setDeleting] = useState(false)
  const [branchModal, setBranchModal] = useState<{ open: boolean; editing?: Branch }>({ open: false })
  const [deletingBranch, setDeletingBranch] = useState<Branch | undefined>(undefined)

  const businessTx = useMemo(
    () => transactions.filter((t) => t.businessId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, id],
  )
  const businessTasks = useMemo(() => tasks.filter((t) => t.businessId === id), [tasks, id])

  const series = useMemo(() => (business ? getBusinessSeries(business, 12) : null), [business])

  if (!business || !series) {
    return (
      <PageContainer>
        <Card>
          <EmptyState
            icon={Building2}
            title="Business not found"
            description="This business may have been removed, or the link is incorrect."
            action={
              <Link to="/businesses">
                <Button variant="secondary" icon={<ArrowLeft className="size-4" />}>
                  Back to businesses
                </Button>
              </Link>
            }
          />
        </Card>
      </PageContainer>
    )
  }

  const meta = CATEGORY_META[business.category]
  const modelMeta = MODEL_META[business.model]
  const status = STATUS_META[business.status]
  const financials = businessFinancials(business)
  const profit = financials.profit
  const margin = financials.margin
  const doneCount = businessTasks.filter((t) => t.status === 'done').length

  const openTaskModal = () => {
    setEditingTask(undefined)
    setTaskModalOpen(true)
  }

  return (
    <PageContainer>
      <PageHeader
        breadcrumb={[
          { label: 'Businesses', to: '/businesses' },
          { label: business.name },
        ]}
        title={business.name}
        subtitle={business.tagline}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Plus className="size-4" />}
              onClick={() => setTransactionModal({ open: true })}
            >
              Add transaction
            </Button>
            <Button variant="secondary" icon={<Plus className="size-4" />} onClick={openTaskModal}>
              New task
            </Button>
            <Button
              variant="ghost"
              icon={<Pencil className="size-4" />}
              onClick={() => setEditOpen(true)}
            />
            <Button
              variant="ghost"
              icon={<Trash2 className="size-4" />}
              className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              onClick={() => setDeleting(true)}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <BusinessLogo glyph={business.logoGlyph} color={business.color} size="xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={meta.badgeClass}>
                    {meta.label}
                  </Badge>
                  <Badge className={modelMeta.badgeClass}>
                    <modelMeta.icon className="mr-1 size-3" />
                    {modelMeta.label}
                  </Badge>
                  <Badge className={status.badgeClass}>
                    <span className={cn('mr-1 size-1.5 rounded-full', status.dotClass)} />
                    {status.label}
                  </Badge>
                </div>
                {business.category === 'equity' && business.equityShare !== undefined && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Handshake className="size-4" />
                    {business.equityShare}% equity held
                  </p>
                )}
                {business.category === 'client' && business.clientTier && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    <Briefcase className="size-4" />
                    {CLIENT_TIER_LABELS[business.clientTier]} engagement
                  </p>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <ScoreRing value={business.healthScore} size={76} strokeWidth={7} label="health" />
              </div>
            </div>

            <dl className="mt-5 space-y-2.5 text-sm">
              <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
                <Building2 className="size-4 shrink-0" />
                <span>{business.industry}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  Est. {business.foundedYear}
                </span>
              </div>
              {business.location && (
                <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
                  <MapPin className="size-4 shrink-0" />
                  {business.location}
                </div>
              )}
              {business.website && (
                <a
                  href={`https://${business.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2.5 py-0.5 text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  <Globe className="size-4 shrink-0" />
                  {business.website}
                  <ArrowUpRight className="size-3.5" />
                </a>
              )}
              {business.email && (
                <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
                  <Mail className="size-4 shrink-0" />
                  {business.email}
                </div>
              )}
              {business.phone && (
                <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
                  <Phone className="size-4 shrink-0" />
                  {business.phone}
                </div>
              )}
            </dl>

            {business.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {business.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Team & leadership</CardTitle>
                <CardDescription>{financials.employees} total employees</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamMembers.filter((m) => m.activeBusinessId === business.id).map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <Avatar name={member.name} initials={member.initials} color={member.color} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{member.name}</p>
                    <p className="truncate text-xs text-slate-400">{member.role}</p>
                  </div>
                  <span className="hidden text-xs text-slate-400 sm:block">{member.email}</span>
                </div>
              ))}
            </CardContent>
            </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6 xl:col-span-2">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Revenue" value={formatCurrency(financials.revenue, settings.currency, { compact: true })} icon={CircleDollarSign} />
            <StatCard
              label="Expenses"
              value={formatCurrency(financials.expenses, settings.currency, { compact: true })}
              icon={Wallet}
              iconClass="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
            />
            <StatCard
              label="Net profit"
              value={formatCurrency(profit, settings.currency, { compact: true, signed: true }).replace(/^\+/, '')}
              icon={CircleDollarSign}
              iconClass={profit >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'}
            />
            <StatCard
              label="Margin"
              value={`${margin.toFixed(1)}%`}
              icon={Users}
              iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
            />
          </div>

          <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50/90 px-1 py-2 backdrop-blur dark:bg-slate-950/80">
            <div className="relative flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={cn(
                    'cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors',
                    tab === t.value
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
                  )}
                  >
                    {t.label}
                    {t.value === 'branches' && business.branches.length > 0 && (
                      <span className="ml-1.5 text-xs font-semibold text-slate-400">{business.branches.length}</span>
                    )}
                  </button>
                ))}
              </div>
              {tab === 'tasks' && (
              <span className="ml-auto inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <CheckSquare className="size-4" />
                {doneCount}/{businessTasks.length} done
              </span>
            )}
          </div>

          {tab === 'overview' && (
            <>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>12-month financial trend</CardTitle>
                    <CardDescription>Estimated monthly revenue and expenses</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <BarChart
                    series={[
                      { name: 'Revenue', color: business.color, data: series.revenue },
                      { name: 'Expenses', color: '#cbd5e1', data: series.expenses },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>About</CardTitle>
                    <CardDescription>{BUSINESS_CATEGORY_LABELS[business.category]}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {business.description || 'No description provided yet.'}
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {tab === 'capTable' && (
            <div className="space-y-6">
              <CapTableCard
                business={business}
                owners={owners}
                currency={settings.currency}
                onManage={() => setEditOpen(true)}
              />
              <Card className="p-5">
                <CardTitle>Ownership structure</CardTitle>
                <CardDescription className="mt-1">
                  {business.capTable.length} stakeholder{business.capTable.length === 1 ? '' : 's'} hold equity in {business.name}.
                  Percentages must always total 100%.
                </CardDescription>
              </Card>
            </div>
          )}

          {tab === 'model' && <ModelView business={business} currency={settings.currency} />}

          {tab === 'branches' && (
            <Card className="p-5">
              <BranchList
                business={business}
                currency={settings.currency}
                onAdd={() => setBranchModal({ open: true })}
                onEdit={(branch) => setBranchModal({ open: true, editing: branch })}
                onDelete={(branch) => setDeletingBranch(branch)}
              />
            </Card>
          )}

          {tab === 'financials' && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Transactions</CardTitle>
                  <CardDescription>
                    {businessTx.length} records · {formatCurrency(series.totalRevenue, settings.currency, { compact: true })} total income
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="size-3.5" />}
                  onClick={() => setTransactionModal({ open: true })}
                >
                  Record
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {businessTx.length === 0 ? (
                  <EmptyState
                    icon={Wallet}
                    title="No transactions yet"
                    description="Record your first income or expense for this business."
                    action={
                      <Button
                        size="sm"
                        icon={<Plus className="size-3.5" />}
                        onClick={() => setTransactionModal({ open: true })}
                      >
                        Record transaction
                      </Button>
                    }
                  />
                ) : (
                  <div className="px-1 py-1">
                    <TransactionTable
                      transactions={businessTx}
                      businesses={[business]}
                      currency={settings.currency}
                      showBusiness={false}
                      onEdit={(tx) => setTransactionModal({ open: true, editing: tx })}
                      onDelete={(tx) => {
                        deleteTransaction(tx.id)
                        logActivity(business.id, 'transaction', `Transaction ${tx.description} deleted`)
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'tasks' && (
            <>
              {businessTasks.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={CheckSquare}
                    title="No tasks for this business"
                    description="Create tasks to keep momentum moving."
                    action={
                      <Button
                        size="sm"
                        icon={<Plus className="size-3.5" />}
                        onClick={openTaskModal}
                      >
                        Create task
                      </Button>
                    }
                  />
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {businessTasks
                    .slice()
                    .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || a.dueDate.localeCompare(b.dueDate))
                    .map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        business={business}
                        showBusiness={false}
                        onEdit={(t) => {
                          setEditingTask(t)
                          setTaskModalOpen(true)
                        }}
                        onDelete={(t) => deleteTask(t.id)}
                        onStatusChange={(t, status: TaskStatus) => {
                          updateTask(t.id, { status })
                          if (status === 'done') {
                            logActivity(business.id, 'task', `Completed: ${t.title}`)
                          }
                        }}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editOpen && (
        <BusinessFormModal
          open
          onClose={() => setEditOpen(false)}
          initial={business}
          onSubmit={(draft) => {
            updateBusiness(business.id, draft)
          }}
        />
      )}

      {transactionModal.open && (
        <TransactionFormModal
          open
          onClose={() => setTransactionModal({ open: false })}
          businesses={[business]}
          initial={transactionModal.editing}
          lockedBusinessId={business.id}
          onSubmit={(draft) => {
            if (transactionModal.editing) {
              updateTransaction(transactionModal.editing.id, draft)
            } else {
              addTransaction(draft)
            }
          }}
        />
      )}

      {taskModalOpen && (
        <TaskFormModal
          open
          onClose={() => setTaskModalOpen(false)}
          businesses={[business]}
          initial={editingTask}
          defaultBusinessId={business.id}
          onSubmit={(draft) => {
            if (editingTask) {
              updateTask(editingTask.id, draft)
            } else {
              addTask(draft)
            }
          }}
        />
      )}

      {branchModal.open && (
        <BranchFormModal
          open
          onClose={() => setBranchModal({ open: false })}
          businessName={business.name}
          initial={branchModal.editing}
          onSubmit={(draft) => {
            if (branchModal.editing) {
              updateBranch(business.id, branchModal.editing.id, draft)
              logActivity(business.id, 'branch', `Branch ${draft.name} updated`)
            } else {
              addBranch(business.id, draft)
              logActivity(business.id, 'branch', `Branch ${draft.name} added`)
            }
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletingBranch)}
        onClose={() => setDeletingBranch(undefined)}
        onConfirm={() => {
          if (deletingBranch) {
            deleteBranch(business.id, deletingBranch.id)
            logActivity(business.id, 'branch', `Branch ${deletingBranch.name} removed`)
          }
        }}
        title={`Delete ${deletingBranch?.name ?? 'branch'}?`}
        message="This removes the branch and recalculates the business totals from its remaining branches."
        confirmLabel="Delete branch"
      />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          deleteBusiness(business.id)
          navigate('/businesses')
        }}
        title={`Delete ${business.name}?`}
        message="This permanently removes the business, its transactions, tasks and activity history. This action cannot be undone."
        confirmLabel="Delete permanently"
      />
    </PageContainer>
  )
}