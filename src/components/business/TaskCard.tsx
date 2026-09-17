import { CalendarDays, MoreHorizontal } from 'lucide-react'

import type { Business, Task, TaskStatus } from '../../types'
import { TASK_STATUS_LABELS } from '../../types'
import { formatShortDate } from '../../utils/format'
import { isOverdue as isTaskOverdue } from '../../utils/time'
import { PRIORITY_META } from '../../utils/meta'
import { cn } from '../../utils/cn'
import { Badge } from '../common/Badge'
import { Checkbox } from '../common/Checkbox'
import { Dropdown } from '../ui/Dropdown'

interface TaskCardProps {
  task: Task
  business?: Business
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
  showBusiness?: boolean
}

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

export function TaskCard({ task, business, onEdit, onDelete, onStatusChange, showBusiness = true }: TaskCardProps) {
  const priority = PRIORITY_META[task.priority]
  const isDone = task.status === 'done'
  const isOverdue = !isDone && isTaskOverdue(task.dueDate)

  return (
    <div
      className={cn(
        'group rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
        isDone && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-2.5">
        <Checkbox
          checked={isDone}
          onChange={(checked) => onStatusChange(task, checked ? 'done' : 'todo')}
          label={isDone ? `Reopen task: ${task.title}` : `Mark task complete: ${task.title}`}
          className="mt-0.5 md:mt-[3px]"
        />

        <button type="button" onClick={() => onEdit(task)} className="min-w-0 flex-1 cursor-pointer text-left">
          <p
            className={cn(
              'text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100',
              isDone && 'line-through decoration-slate-400',
            )}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{task.description}</p>
          )}
        </button>

        <Dropdown
          label={`Actions for ${task.title}`}
          trigger={<MoreHorizontal className="size-4" />}
          items={[
            ...STATUS_ORDER.filter((status) => status !== task.status).map((status) => ({
              label: `Move to ${TASK_STATUS_LABELS[status]}`,
              icon: MoreHorizontal,
              onClick: () => onStatusChange(task, status),
            })),
            { label: '', separator: true },
            { label: 'Edit task', icon: MoreHorizontal, onClick: () => onEdit(task) },
            { label: 'Delete task', icon: MoreHorizontal, danger: true, onClick: () => onDelete(task) },
          ]}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
        <Badge className={priority.badgeClass}>{priority.label}</Badge>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500',
          )}
        >
          <CalendarDays className="size-3.5" />
          {formatShortDate(task.dueDate)}
        </span>
        {showBusiness && business && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="size-2 rounded-full" style={{ backgroundColor: business.color }} />
            {business.name}
          </span>
        )}
      </div>
    </div>
  )
}