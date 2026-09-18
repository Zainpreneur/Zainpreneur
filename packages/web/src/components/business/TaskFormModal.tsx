// @ts-nocheck
import { useState } from 'react'
import { useToast } from '../../context/ToastContext'

import type { Business, Task, TaskPriority, TaskStatus } from '../../types'
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '../../types'
import type { TaskDraft } from '../../context/BusinessContext'
import { Button } from '../common/Button'
import { Field, Select, Textarea, TextInput } from '../common/Input'
import { Modal } from '../common/Modal'

interface TaskFormModalProps {
  open: boolean
  onClose: () => void
  businesses: Business[]
  initial?: Task
  defaultBusinessId?: string
  onSubmit: (draft: TaskDraft) => void
  onDelete?: (task: Task) => void
}

interface FormState {
  businessId: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string
  tags: string
}

function inDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function TaskFormModal({ open, onClose, businesses, initial, defaultBusinessId, onSubmit, onDelete }: TaskFormModalProps) {
  const { addTask, updateTask } = useBusinesses()
  const { toast } = useToast()
  const [form, setForm] = useState<FormState>(() => ({
    businessId: initial?.businessId ?? defaultBusinessId ?? businesses[0]?.id ?? '',
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    status: initial?.status ?? 'todo',
    priority: initial?.priority ?? 'medium',
    dueDate: initial?.dueDate ?? inDays(7),
    tags: initial?.tags.join(', ') ?? '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {}
    if (!form.title.trim()) nextErrors.title = 'Task title is required.'
    if (!form.businessId) nextErrors.businessId = 'Choose a business.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSaving(true)
    try {
      if (initial) {
        await updateTask(initial.id, {
          title: form.title.trim(),
          description: form.description.trim(),
          status: form.status,
          priority: form.priority,
          dueDate: form.dueDate,
          tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        })
      } else {
        await addTask({
          businessId: form.businessId,
          title: form.title.trim(),
          description: form.description.trim(),
          status: form.status,
          priority: form.priority,
          dueDate: form.dueDate,
          tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        })
      }
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save task'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit task' : 'New task'}
      description="Keep work moving across every business."
      footer={
        <>
          {initial && onDelete && (
            <Button
              variant="ghost"
              className="mr-auto text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              onClick={() => {
                onDelete(initial)
                onClose()
              }}
            >
              Delete task
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>{initial ? 'Save changes' : 'Create task'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Task title" htmlFor="task-title" required error={errors.title}>
          <TextInput
            id="task-title"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Renegotiate supplier contract"
          />
        </Field>

        <Field label="Business" htmlFor="task-business" required error={errors.businessId}>
          <Select id="task-business" value={form.businessId} onChange={(e) => update('businessId', e.target.value)}>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description" htmlFor="task-description">
          <Textarea
            id="task-description"
            rows={3}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Add details, acceptance criteria or blockers"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status" htmlFor="task-status">
            <Select id="task-status" value={form.status} onChange={(e) => update('status', e.target.value as TaskStatus)}>
              {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="task-priority">
            <Select
              id="task-priority"
              value={form.priority}
              onChange={(e) => update('priority', e.target.value as TaskPriority)}
            >
              {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((priority) => (
                <option key={priority} value={priority}>
                  {TASK_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" htmlFor="task-due">
            <TextInput id="task-due" type="date" value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} />
          </Field>
        </div>

        <Field label="Tags" htmlFor="task-tags" hint="Comma separated">
          <TextInput id="task-tags" value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="marketing, growth" />
        </Field>
      </div>
    </Modal>
  )
}