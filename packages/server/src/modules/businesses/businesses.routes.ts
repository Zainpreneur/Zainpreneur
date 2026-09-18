import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { NotFoundError } from '../../lib/errors'
import { businessCreateSchema, businessUpdateSchema } from '@zainpreneur/shared'

export const businessRoutes = new Hono()

// GET /api/businesses
businessRoutes.get('/', async (c) => {
  const businesses = await prisma.business.findMany({
    include: {
      branches: true,
      capTable: { include: { owner: true } },
      project: { include: { milestones: true } },
      consulting: true,
      equity: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ data: businesses })
})

// GET /api/businesses/:id
businessRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      branches: true,
      capTable: { include: { owner: true } },
      project: { include: { milestones: true } },
      consulting: true,
      equity: true,
      tasks: { orderBy: { createdAt: 'desc' } },
      transactions: { orderBy: { date: 'desc' } },
      activity: { orderBy: { timestamp: 'desc' }, take: 50 },
    },
  })
  if (!business) throw new NotFoundError('Business', id)
  return c.json({ data: business })
})

// POST /api/businesses
businessRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const parsed = businessCreateSchema.parse(body)
  const business = await prisma.$transaction(async (tx: any) => {
    const created = await tx.business.create({
      data: {
        name: parsed.name,
        model: parsed.model,
        category: parsed.category,
        status: parsed.status ?? 'active',
        tagline: parsed.tagline ?? '',
        description: parsed.description ?? '',
        industry: parsed.industry,
        foundedYear: parsed.foundedYear ?? new Date().getFullYear(),
        color: parsed.color ?? '#6366f1',
        monthlyRevenue: parsed.monthlyRevenue ?? 0,
        monthlyExpenses: parsed.monthlyExpenses ?? 0,
        employees: parsed.employees ?? 0,
        tags: parsed.tags ?? [],
      },
    })

    // Model-specific details
    if (parsed.model === 'project' && parsed.project) {
      await tx.projectDetails.create({
        data: {
          businessId: created.id,
          budget: parsed.project.budget,
          deliverables: parsed.project.deliverables,
        },
      })
    }

    if (parsed.model === 'consulting' && parsed.consulting) {
      await tx.consultingDetails.create({
        data: {
          businessId: created.id,
          hourlyRate: parsed.consulting.hourlyRate,
          retainerMonthly: parsed.consulting.retainerMonthly,
          billableHoursTarget: parsed.consulting.billableHoursTarget,
          billableHoursLogged: parsed.consulting.billableHoursLogged,
          contracts: parsed.consulting.contracts,
        },
      })
    }

    if (parsed.model === 'equity' && parsed.equity) {
      await tx.equityDetails.create({
        data: {
          businessId: created.id,
          valuation: parsed.equity.valuation,
          dividendYield: parsed.equity.dividendYield,
          dividendsReceived: parsed.equity.dividendsReceived,
        },
      })
    }

    // Cap table
    if (parsed.capTable?.length) {
      await tx.capShare.createMany({
        data: parsed.capTable.map((share) => ({
          businessId: created.id,
          ownerId: share.ownerId,
          percentage: share.percentage,
          role: share.role,
          isPrimary: share.primary ?? false,
        })),
      })
    }

    // Activity log
    await tx.activityEvent.create({
      data: {
        businessId: created.id,
        type: 'business',
        message: `Business "${created.name}" created`,
      },
    })

    return created
  })

  return c.json({ data: business }, 201)
})

// PATCH /api/businesses/:id
businessRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = businessUpdateSchema.parse(body)

  const existing = await prisma.business.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Business', id)

  const updated = await prisma.$transaction(async (tx: any) => {
    const biz = await tx.business.update({
      where: { id },
      data: {
        name: parsed.name,
        category: parsed.category,
        model: parsed.model,
        status: parsed.status,
        industry: parsed.industry,
        tagline: parsed.tagline,
        description: parsed.description,
        color: parsed.color,
        monthlyRevenue: parsed.monthlyRevenue,
        monthlyExpenses: parsed.monthlyExpenses,
        employees: parsed.employees,
        tags: parsed.tags,
      },
    })

    await tx.activityEvent.create({
      data: {
        businessId: id,
        type: 'business',
        message: `Business "${biz.name}" updated`,
      },
    })

    return biz
  })

  return c.json({ data: updated })
})

// DELETE /api/businesses/:id
businessRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await prisma.business.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Business', id)

  await prisma.business.delete({ where: { id } })
  return c.json({ success: true })
})
