import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { NotFoundError, AppError } from '../../lib/errors'
import { assetCreateSchema, assetUpdateSchema, assetDeploySchema } from '@zainpreneur/shared'

export const assetRoutes = new Hono()

assetRoutes.get('/', async (c) => {
  const assets = await prisma.asset.findMany({
    include: {
      deployments: {
        where: { returnedAt: null },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ data: assets })
})

assetRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const parsed = assetCreateSchema.parse(body)

  const asset = await prisma.asset.create({
    data: {
      name: parsed.name,
      category: parsed.category,
      serialNumber: parsed.serialNumber ?? '',
      purchaseDate: parsed.purchaseDate,
      value: parsed.value,
      status: parsed.status ?? 'available',
      condition: parsed.condition ?? 'good',
      tag: parsed.tag ?? '',
      location: parsed.location ?? '',
      notes: parsed.notes ?? '',
    },
  })

  return c.json({ data: asset }, 201)
})

assetRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = assetUpdateSchema.parse(body)

  const existing = await prisma.asset.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Asset', id)

  const data: Record<string, any> = {}
  if (parsed.name !== undefined) data.name = parsed.name
  if (parsed.category !== undefined) data.category = parsed.category
  if (parsed.serialNumber !== undefined) data.serialNumber = parsed.serialNumber
  if (parsed.purchaseDate !== undefined) data.purchaseDate = parsed.purchaseDate
  if (parsed.value !== undefined) data.value = parsed.value
  if (parsed.status !== undefined) data.status = parsed.status
  if (parsed.condition !== undefined) data.condition = parsed.condition
  if (parsed.tag !== undefined) data.tag = parsed.tag
  if (parsed.location !== undefined) data.location = parsed.location
  if (parsed.notes !== undefined) data.notes = parsed.notes

  const updated = await prisma.asset.update({ where: { id }, data })
  return c.json({ data: updated })
})

assetRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await prisma.asset.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Asset', id)

  await prisma.asset.delete({ where: { id } })
  return c.json({ success: true })
})

assetRoutes.post('/:id/deploy', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = assetDeploySchema.parse(body)

  const asset = await prisma.asset.findUnique({ where: { id } })
  if (!asset) throw new NotFoundError('Asset', id)
  if (asset.status === 'retired') throw new AppError('Cannot deploy a retired asset', 400)

  const deployment = await prisma.$transaction(async (tx: any) => {
    const dep = await tx.assetDeployment.create({
      data: {
        assetId: id,
        entityType: parsed.entityType,
        entityId: parsed.entityId,
        branchId: parsed.branchId,
        memberId: parsed.memberId,
        deployedDate: parsed.deployedDate ?? new Date().toISOString().slice(0, 10),
        notes: parsed.notes,
      },
    })

    await tx.asset.update({
      where: { id },
      data: { status: 'in-use' },
    })

    return dep
  })

  return c.json({ data: deployment }, 201)
})

assetRoutes.post('/:id/return', async (c) => {
  const id = c.req.param('id')

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: { deployments: { where: { returnedAt: null } } },
  })
  if (!asset) throw new NotFoundError('Asset', id)

  const activeDeployment = asset.deployments[0]
  if (!activeDeployment) throw new AppError('No active deployment for this asset', 400)

  await prisma.$transaction(async (tx: any) => {
    await tx.assetDeployment.update({
      where: { id: activeDeployment.id },
      data: { returnedAt: new Date().toISOString() },
    })

    await tx.asset.update({
      where: { id },
      data: { status: 'available' },
    })
  })

  return c.json({ success: true })
})

assetRoutes.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { status } = body as { status: string }

  if (!['available', 'maintenance', 'retired'].includes(status)) {
    throw new AppError('Invalid status. Must be: available, maintenance, or retired', 400)
  }

  const asset = await prisma.asset.findUnique({ where: { id } })
  if (!asset) throw new NotFoundError('Asset', id)

  if (status !== 'maintenance' && asset.status === 'in-use') {
    const activeDeployments = await prisma.assetDeployment.findMany({
      where: { assetId: id, returnedAt: null },
    })
    if (activeDeployments.length > 0) {
      throw new AppError('Cannot change status while asset is deployed. Return it first.', 400)
    }
  }

  const updated = await prisma.asset.update({
    where: { id },
    data: { status },
  })

  return c.json({ data: updated })
})
