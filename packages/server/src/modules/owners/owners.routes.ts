import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { NotFoundError } from '../../lib/errors'
import { ownerCreateSchema, ownerUpdateSchema } from '@zainpreneur/shared'

export const ownerRoutes = new Hono()

ownerRoutes.get('/', async (c) => {
  const owners = await prisma.owner.findMany({
    include: {
      _count: { select: { shares: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const enriched = owners.map((o: typeof owners[number]) => ({
    ...o,
    totalOwnedBusinessesCount: o._count.shares,
    _count: undefined,
  }))

  return c.json({ data: enriched })
})

ownerRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const parsed = ownerCreateSchema.parse(body)

  const initials = parsed.name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const owner = await prisma.owner.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      location: parsed.location,
      role: parsed.role,
      bio: parsed.bio,
      color: parsed.color ?? '#6366f1',
      initials,
    },
  })

  return c.json({ data: owner }, 201)
})

ownerRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = ownerUpdateSchema.parse(body)

  const existing = await prisma.owner.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Owner', id)

  const updated = await prisma.owner.update({
    where: { id },
    data: {
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      location: parsed.location,
      role: parsed.role,
      bio: parsed.bio,
      color: parsed.color,
      initials: parsed.name
        ? parsed.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : undefined,
    },
  })

  return c.json({ data: updated })
})

ownerRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await prisma.owner.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Owner', id)

  await prisma.owner.delete({ where: { id } })
  return c.json({ success: true })
})
