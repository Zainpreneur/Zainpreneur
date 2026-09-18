import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { NotFoundError } from '../../lib/errors'
import { branchCreateSchema, branchUpdateSchema } from '@zainpreneur/shared'

export const branchRoutes = new Hono()

branchRoutes.get('/', async (c) => {
  const businessId = c.req.param('businessId')
  const branches = await prisma.branch.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ data: branches })
})

branchRoutes.post('/', async (c) => {
  const businessId = c.req.param('businessId')
  const body = await c.req.json()
  const parsed = branchCreateSchema.parse(body)

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) throw new NotFoundError('Business', businessId)

  const branch = await prisma.$transaction(async (tx: any) => {
    const created = await tx.branch.create({
      data: {
        businessId,
        name: parsed.name,
        location: parsed.location ?? '',
        address: parsed.address ?? '',
        city: parsed.city ?? '',
        country: parsed.country ?? '',
        phone: parsed.phone ?? '',
        email: parsed.email ?? '',
        manager: parsed.manager ?? '',
        status: parsed.status ?? 'active',
        openedYear: parsed.openedYear ?? new Date().getFullYear(),
        monthlyRevenue: parsed.monthlyRevenue ?? 0,
        monthlyExpenses: parsed.monthlyExpenses ?? 0,
        employees: parsed.employees ?? 0,
        isHeadquarters: parsed.isHeadquarters ?? false,
      },
    })

    await tx.activityEvent.create({
      data: {
        businessId,
        type: 'branch',
        message: `Branch "${created.name}" added to "${business.name}"`,
      },
    })

    return created
  })

  return c.json({ data: branch }, 201)
})

branchRoutes.patch('/:branchId', async (c) => {
  const businessId = c.req.param('businessId')
  const branchId = c.req.param('branchId')
  const body = await c.req.json()
  const parsed = branchUpdateSchema.parse(body)

  const existing = await prisma.branch.findFirst({ where: { id: branchId, businessId } })
  if (!existing) throw new NotFoundError('Branch', branchId)

  const updated = await prisma.branch.update({
    where: { id: branchId },
    data: {
      name: parsed.name,
      location: parsed.location,
      address: parsed.address,
      city: parsed.city,
      country: parsed.country,
      phone: parsed.phone,
      email: parsed.email,
      manager: parsed.manager,
      status: parsed.status,
      monthlyRevenue: parsed.monthlyRevenue,
      monthlyExpenses: parsed.monthlyExpenses,
      employees: parsed.employees,
      isHeadquarters: parsed.isHeadquarters,
    },
  })

  return c.json({ data: updated })
})

branchRoutes.delete('/:branchId', async (c) => {
  const businessId = c.req.param('businessId')
  const branchId = c.req.param('branchId')

  const existing = await prisma.branch.findFirst({ where: { id: branchId, businessId } })
  if (!existing) throw new NotFoundError('Branch', branchId)

  await prisma.branch.delete({ where: { id: branchId } })
  return c.json({ success: true })
})
