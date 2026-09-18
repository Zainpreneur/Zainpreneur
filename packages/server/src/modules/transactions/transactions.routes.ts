import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { NotFoundError } from '../../lib/errors'
import { transactionCreateSchema, transactionUpdateSchema } from '@zainpreneur/shared'

export const transactionRoutes = new Hono()

transactionRoutes.get('/', async (c) => {
  const businessId = c.req.query('businessId')
  const type = c.req.query('type')
  const category = c.req.query('category')
  const status = c.req.query('status')
  const from = c.req.query('from')
  const to = c.req.query('to')

  const where: Record<string, any> = {}
  if (businessId) where.businessId = businessId
  if (type) where.type = type
  if (category) where.category = category
  if (status) where.status = status
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = from
    if (to) where.date.lte = to
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
  })
  return c.json({ data: transactions })
})

transactionRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const parsed = transactionCreateSchema.parse(body)

  const business = await prisma.business.findUnique({ where: { id: parsed.businessId } })
  if (!business) throw new NotFoundError('Business', parsed.businessId)

  const transaction = await prisma.$transaction(async (tx: any) => {
    const created = await tx.transaction.create({
      data: {
        businessId: parsed.businessId,
        date: parsed.date,
        description: parsed.description,
        category: parsed.category,
        type: parsed.type,
        amount: parsed.amount,
        paymentMethod: parsed.paymentMethod ?? '',
        reference: parsed.reference ?? '',
        status: parsed.status ?? 'cleared',
        notes: parsed.notes,
      },
    })

    await tx.activityEvent.create({
      data: {
        businessId: parsed.businessId,
        type: 'transaction',
        message: `${parsed.type === 'income' ? 'Income' : 'Expense'}: ${parsed.description} (${parsed.amount})`,
      },
    })

    return created
  })

  return c.json({ data: transaction }, 201)
})

transactionRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = transactionUpdateSchema.parse(body)

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Transaction', id)

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      date: parsed.date,
      description: parsed.description,
      category: parsed.category,
      type: parsed.type,
      amount: parsed.amount,
      paymentMethod: parsed.paymentMethod,
      reference: parsed.reference,
      status: parsed.status,
      notes: parsed.notes,
    },
  })

  return c.json({ data: updated })
})

transactionRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Transaction', id)

  await prisma.transaction.delete({ where: { id } })
  return c.json({ success: true })
})
