export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  businessId: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string
  tags: string[]
  createdAt: string
  completedAt?: string
}

export type ActivityType = 'task' | 'transaction' | 'team' | 'business' | 'milestone' | 'branch' | 'owner' | 'asset'

export interface ActivityEvent {
  id: string
  businessId: string
  type: ActivityType
  message: string
  timestamp: string
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}