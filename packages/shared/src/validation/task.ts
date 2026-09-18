import { z } from 'zod'

export const taskCreateSchema = z.object({
  businessId: z.string().min(1, 'Business is required'),
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional().default(''),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional().default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.string().min(1, 'Due date is required'),
  tags: z.array(z.string()).optional().default([]),
})

export const taskUpdateSchema = taskCreateSchema.omit({ businessId: true }).partial()

export type TaskCreateInput = z.infer<typeof taskCreateSchema>
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>
