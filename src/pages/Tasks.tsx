import { useMemo, useState } from 'react'

import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  Plus,
  Timer,
} from 'lucide-react'

import type { Task, TaskPriority, TaskStatus } from '../types'
import { TASK_STATUS_LABELS } from '../types'
import { useBusinesses } from '../context/BusinessContext'
import { isDueWithinDays, isOverdue as isTaskOverdue } from '../utils/time'
import { cn } from '../utils/cn'
import { PageContainer, PageHeader } from '../components/layout/PageContainer'
import { Button } from '../components/common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/common/Card'
import { Select } from '../components/common/Input'
import { EmptyState } from '../components/common/EmptyState'
import { SearchInput } from '../components/ui/SearchInput'
import { StatCard } from '../components/common/StatCard'
import { TaskCard } from '../components/business/TaskCard'
import { TaskFormModal } from '../components/business/TaskFormModal'
import { Toggle } from '../components/common/Toggle'

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

export function Tasks() {
  const { businesses, tasks, addTask, updateTask, deleteTask, logActivity } = useBusinesses()

  const [view, setView] = useState<'board' | 'list'>('board')
  const [query, setQuery] = useState('')
  const [businessFilter, setBusinessFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [hideDone, setHideDone] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Task | undefined>(undefined)
  const [collapsed, setCollapsed] = useState<Record<TaskStatus, boolean>>({
    todo: false,
    in_progress: false,
    review: false,
    done: false,
  })

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return tasks
      .filter((task) => {
        if (businessFilter !== 'all' && task.businessId !== businessFilter) return false
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
        if (statusFilter !== 'all' && task.status !== statusFilter) return false
        if (hideDone && task.status === 'done') return false
        if (!normalized) return true
        return [task.title, task.description, ...task.tags].join(' ').toLowerCase().includes(normalized)
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [tasks, businessFilter, priorityFilter, statusFilter, query, hideDone])

  const allOpen = tasks.filter((t) => t.status !== 'done')
  const allDone = tasks.filter((t) => t.status === 'done')
  const overdue = allOpen.filter((t) => isTaskOverdue(t.dueDate))
  const dueWeek = allOpen.filter((t) => isDueWithinDays(t.dueDate, 7))
  const completionRate = tasks.length > 0 ? Math.round((allDone.length / tasks.length) * 100) : 0

  const columns = useMemo(
    () => COLUMNS.map((status) => ({ status, items: filtered.filter((task) => task.status === status) })),
    [filtered],
  )

  const openNewTask = () => {
    setEditing(undefined)
    setModalOpen(true)
  }

  return (
    <PageContainer>
      <PageHeader
        title="Tasks"
        subtitle="Keep every business moving with a unified work board."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={openNewTask}>
            New task
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open tasks" value={String(allOpen.length)} icon={CheckSquare} caption="Across all businesses" />
        <StatCard
          label="Overdue"
          value={String(overdue.length)}
          icon={AlertCircle}
          iconClass="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
          caption={overdue.length > 0 ? `${overdue.length} need attention` : 'Nothing overdue'}
        />
        <StatCard
          label="Due this week"
          value={String(dueWeek.length)}
          icon={Timer}
          iconClass="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
          caption="Next 7 days"
        />
        <StatCard
          label="Completed"
          value={`${completionRate}%`}
          icon={CheckCircle2}
          iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
          caption={`${allDone.length} of ${tasks.length} tasks done`}
        />
      </div>

      <Card className="mt-6 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="w-full sm:w-64">
              <SearchInput value={query} onChange={setQuery} placeholder="Search tasks…" fullWidth />
            </div>
            <Select value={businessFilter} onChange={(e) => setBusinessFilter(e.target.value)} aria-label="Filter by business" className="w-full sm:w-auto">
              <option value="all">All businesses</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </Select>
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')} aria-label="Filter by priority" className="w-full sm:w-auto">
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            {view === 'list' && (
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')} aria-label="Filter by status" className="w-full sm:w-auto">
                <option value="all">All statuses</option>
                {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              <Toggle id="hide-done" checked={hideDone} onChange={setHideDone} label="Hide done" />
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(
                [
                  { value: 'board', icon: LayoutGrid, label: 'Board' },
                  { value: 'list', icon: List, label: 'List' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setView(option.value)}
                  aria-label={option.label}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                    view === option.value
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
                  )}
                >
                  <option.icon className="size-4" />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={CheckSquare}
            title="No tasks match your filters"
            description="Try adjusting filters, or create a new task."
            action={
              <Button size="sm" icon={<Plus className="size-3.5" />} onClick={openNewTask}>
                New task
              </Button>
            }
          />
        </Card>
      ) : view === 'board' ? (
        <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
          {columns.map((column) => {
            const isCollapsed = collapsed[column.status]
            return (
              <div
                key={column.status}
                className={cn(
                  'flex shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-100/60 p-3 transition-[width] dark:border-slate-800 dark:bg-slate-900/50',
                  isCollapsed ? 'w-14' : 'w-72 sm:w-80',
                )}
              >
                {isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [column.status]: false }))}
                    aria-expanded={false}
                    aria-label={`Expand ${TASK_STATUS_LABELS[column.status]} column`}
                    className="flex h-full w-full cursor-pointer flex-col items-center gap-3 py-1 text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
                      {column.items.length}
                    </span>
                    <ChevronRight className="size-4 shrink-0" />
                    <span className="[writing-mode:vertical-rl] text-xs font-bold tracking-wide text-slate-600 dark:text-slate-300">
                      {TASK_STATUS_LABELS[column.status]}
                    </span>
                  </button>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between px-1">
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {TASK_STATUS_LABELS[column.status]}
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
                          {column.items.length}
                        </span>
                      </span>
                      <span className="flex items-center gap-0.5">
                        {column.status !== 'done' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(undefined)
                              setModalOpen(true)
                            }}
                            className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:hover:bg-slate-800"
                            aria-label={`New task in ${TASK_STATUS_LABELS[column.status]}`}
                          >
                            <Plus className="size-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setCollapsed((prev) => ({ ...prev, [column.status]: true }))}
                          aria-expanded
                          aria-label={`Collapse ${TASK_STATUS_LABELS[column.status]} column`}
                          className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:hover:bg-slate-800"
                        >
                          <ChevronLeft className="size-4" />
                        </button>
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2.5">
                      {column.items.length === 0 ? (
                        <p className="px-1 py-6 text-center text-xs text-slate-400 dark:text-slate-600">Nothing here</p>
                      ) : (
                        column.items.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            business={businesses.find((b) => b.id === task.businessId)}
                            onEdit={(t) => {
                              setEditing(t)
                              setModalOpen(true)
                            }}
                            onDelete={(t) => deleteTask(t.id)}
                            onStatusChange={(t, status) => {
                              updateTask(t.id, { status })
                              if (status === 'done') logActivity(t.businessId, 'task', `Completed: ${t.title}`)
                            }}
                          />
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <Card className="mt-6">
          <CardHeader>
            <div>
              <CardTitle>All tasks</CardTitle>
              <CardDescription>{filtered.length} tasks in the current view</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filtered.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  business={businesses.find((b) => b.id === task.businessId)}
                  onEdit={(t) => {
                    setEditing(t)
                    setModalOpen(true)
                  }}
                  onDelete={(t) => deleteTask(t.id)}
                  onStatusChange={(t, status) => {
                    updateTask(t.id, { status })
                    if (status === 'done') logActivity(t.businessId, 'task', `Completed: ${t.title}`)
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {modalOpen && (
        <TaskFormModal
          open
          onClose={() => setModalOpen(false)}
          businesses={businesses}
          initial={editing}
          onSubmit={(draft) => {
            if (editing) {
              updateTask(editing.id, draft)
            } else {
              addTask(draft)
            }
          }}
          onDelete={(task) => deleteTask(task.id)}
        />
      )}
    </PageContainer>
  )
}