import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { NotFoundError, AppError } from '../../lib/errors'

export const procurementRoutes = new Hono()

procurementRoutes.get('/vendors', async (c) => {
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: 'asc' },
  })
  return c.json({ data: vendors })
})

procurementRoutes.post('/vendors', async (c) => {
  const body = await c.req.json()
  const { name, email, phone, address, taxId, paymentTerms, rating } = body

  if (!name || !name.trim()) throw new AppError('Vendor name is required', 400)

  const vendor = await prisma.vendor.create({
    data: {
      name: name.trim(),
      email: email ?? null,
      phone: phone ?? null,
      address: address ?? null,
      taxId: taxId ?? null,
      paymentTerms: paymentTerms ?? 'net-30',
      rating: rating ?? null,
    },
  })

  return c.json({ data: vendor }, 201)
})

procurementRoutes.get('/purchase-orders', async (c) => {
  const status = c.req.query('status')

  const where: Record<string, any> = {}
  if (status) where.status = status

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      vendor: { select: { name: true } },
      items: true,
    },
    orderBy: { orderDate: 'desc' },
  })

  const data = orders.map((order: any) => ({
    ...order,
    vendorName: order.vendor?.name ?? 'Unknown',
  }))

  return c.json({ data })
})

procurementRoutes.post('/purchase-orders', async (c) => {
  const body = await c.req.json()
  const { vendorId, businessId, expectedDate, notes, items } = body

  if (!vendorId) throw new AppError('Vendor ID is required', 400)
  if (!items || items.length === 0) throw new AppError('At least one item is required', 400)

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
  if (!vendor) throw new NotFoundError('Vendor', vendorId)

  for (const item of items) {
    if (!item.name || !item.name.trim()) throw new AppError('Every PO item needs a name', 400)
    if (!item.qty || item.qty <= 0) throw new AppError(`Invalid quantity for "${item.name}"`, 400)
    if (item.unitPrice < 0) throw new AppError(`Invalid unit price for "${item.name}"`, 400)
  }

  const subtotal = items.reduce((sum: number, item: any) => sum + item.qty * item.unitPrice, 0)

  const order = await prisma.$transaction(async (tx: any) => {
    const po = await tx.purchaseOrder.create({
      data: {
        vendorId,
        businessId: businessId ?? null,
        status: 'draft',
        orderDate: new Date().toISOString().slice(0, 10),
        expectedDate: expectedDate ?? null,
        subtotal,
        tax: 0,
        total: subtotal,
        notes: notes ?? null,
      },
    })

    await tx.pOItem.createMany({
      data: items.map((item: any) => ({
        poId: po.id,
        name: item.name.trim(),
        category: item.category ?? 'other',
        qty: item.qty,
        unitPrice: item.unitPrice,
        serialNumber: item.serialNumber ?? null,
      })),
    })

    return po
  })

  return c.json({ data: order }, 201)
})

const PO_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['approved', 'cancelled'],
  approved: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

procurementRoutes.patch('/purchase-orders/:id/status', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { status } = body as { status: string }

  const validStatuses = ['sent', 'approved', 'received', 'cancelled']
  if (!validStatuses.includes(status)) {
    throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400)
  }

  const order = await prisma.purchaseOrder.findUnique({ where: { id } })
  if (!order) throw new NotFoundError('Purchase order', id)

  const allowed = PO_TRANSITIONS[order.status] ?? []
  if (!allowed.includes(status)) {
    throw new AppError(`Cannot move PO from ${order.status} to ${status}`, 400)
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status },
  })

  return c.json({ data: updated })
})
