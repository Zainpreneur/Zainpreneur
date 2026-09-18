import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { NotFoundError } from '../../lib/errors'
import { taskCreateSchema, taskUpdateSchema } from '@zainpreneur/shared'

export const taskRoutes = new Hono()

taskRoutes.get('/', async (c) => {
  const businessId = c.req.query('businessId')
  const status = c.req.query('status')
  const priority = c.req.query('priority')

  const where: Record<string, unknown> = {}
  if (businessId) where.businessId = businessId
  if (status) where.status = status
  if (priority) where.priority = priority

  const tasks = await prisma.task.findMany({
    where,
    include: { business: { select: { id: true, name: true, color: true } } },
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
    ],
  })

  return c.json({ data: tasks })
})

taskRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const parsed = taskCreateSchema.parse(body)

  const business = await prisma.business.findUnique({ where: { id: parsed.businessId } })
  if (!business) throw new NotFoundError('Business', parsed.businessId)

  const task = await prisma.$transaction(async (tx: any) => {
    const created = await tx.task.create({
      data: {
        businessId: parsed.businessId,
        title: parsed.title,
        description: parsed.description ?? '',
        status: parsed.status ?? 'todo',
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        tags: parsed.tags ?? [],
      },
    })

    await tx.activityEvent.create({
      data: {
        businessId: parsed.businessId,
        type: 'task',
        message: `Task "${created.title}" created`,
      },
    })

    return created
  })

  return c.json({ data: task }, 201)
})

taskRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = taskUpdateSchema.parse(body)

  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Task', id)

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: parsed.title,
      description: parsed.description,
      status: parsed.status,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      tags: parsed.tags,
      completedAt: parsed.status === 'done' ? new Date() : undefined,
    },
  })

  if (parsed.status === 'done' && existing.status !== 'done') {
    await prisma.activityEvent.create({
      data: {
        businessId: existing.businessId,
        type: 'task',
        message: `Task "${updated.title}" completed`,
      },
    })
  }

  return c.json({ data: updated })
})

taskRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Task', id)

  await prisma.task.delete({ where: { id } })
  return c.json({ success: true })
})
