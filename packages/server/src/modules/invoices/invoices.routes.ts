import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { NotFoundError, AppError } from '../../lib/errors'

export const invoiceRoutes = new Hono()

invoiceRoutes.get('/', async (c) => {
  const status = c.req.query('status')

  const where: Record<string, any> = {}
  if (status) where.status = status

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      business: { select: { name: true } },
    },
    orderBy: { dueDate: 'asc' },
  })

  return c.json({ data: invoices })
})

invoiceRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const { businessId, amount, dueDate, milestoneRef } = body

  if (!businessId) throw new AppError('Business ID is required', 400)
  if (!amount || amount <= 0) throw new AppError('Invoice amount must be positive', 400)

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) throw new NotFoundError('Business', businessId)

  const existingCount = await prisma.invoice.count({ where: { businessId } })
  const short = business.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'CL'
  const invoiceNo = `INV-${short}-${String(existingCount + 1).padStart(4, '0')}`
  const now = new Date().toISOString()

  const invoice = await prisma.$transaction(async (tx: any) => {
    const inv = await tx.invoice.create({
      data: {
        businessId,
        invoiceNo,
        issueDate: now.slice(0, 10),
        dueDate: dueDate ?? now.slice(0, 10),
        amount,
        amountPaid: 0,
        status: 'sent',
        milestoneRef: milestoneRef ?? null,
      },
    })

    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        entryDate: now.slice(0, 10),
        memo: `Invoice ${invoiceNo} issued`,
        businessId,
        source: 'billing',
        createdAt: now,
      },
    })

    await tx.ledgerLine.createMany({
      data: [
        { entryId: ledgerEntry.id, accountCode: '1100', debit: amount, credit: 0 },
        { entryId: ledgerEntry.id, accountCode: '4000', debit: 0, credit: amount },
      ],
    })

    return inv
  })

  return c.json({ data: invoice }, 201)
})

invoiceRoutes.post('/:id/pay', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { amount } = body as { amount: number }

  if (!amount || amount <= 0) throw new AppError('Payment amount must be positive', 400)

  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) throw new NotFoundError('Invoice', id)

  const outstanding = invoice.amount - invoice.amountPaid
  if (amount - outstanding > 0.01) {
    throw new AppError(`Overpayment: ${outstanding.toFixed(2)} outstanding`, 400)
  }

  const paid = invoice.amountPaid + amount
  const status = paid >= invoice.amount - 0.01 ? 'paid' : 'partial'
  const now = new Date().toISOString()

  const result = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.invoice.update({
      where: { id },
      data: { amountPaid: paid, status },
    })

    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        entryDate: now.slice(0, 10),
        memo: `Payment on ${invoice.invoiceNo}`,
        businessId: invoice.businessId,
        source: 'billing',
        createdAt: now,
      },
    })

    await tx.ledgerLine.createMany({
      data: [
        { entryId: ledgerEntry.id, accountCode: '1000', debit: amount, credit: 0 },
        { entryId: ledgerEntry.id, accountCode: '1100', debit: 0, credit: amount },
      ],
    })

    return { status: updated.status, outstanding: Math.max(0, outstanding - amount) }
  })

  return c.json({ data: result })
})

invoiceRoutes.get('/aging', async (c) => {
  const asOf = c.req.query('asOf') ?? new Date().toISOString().slice(0, 10)

  const openInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['sent', 'partial', 'overdue'] },
    },
    select: {
      id: true,
      dueDate: true,
      amount: true,
      amountPaid: true,
    },
  })

  interface AgingBucket {
    bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+'
    outstanding: number
    invoices: number
  }

  const buckets: AgingBucket[] = [
    { bucket: 'current', outstanding: 0, invoices: 0 },
    { bucket: '1-30', outstanding: 0, invoices: 0 },
    { bucket: '31-60', outstanding: 0, invoices: 0 },
    { bucket: '61-90', outstanding: 0, invoices: 0 },
    { bucket: '90+', outstanding: 0, invoices: 0 },
  ]

  const nowMs = new Date(asOf).getTime()
  for (const row of openInvoices) {
    const outstanding = row.amount - row.amountPaid
    if (outstanding <= 0.01) continue

    const daysPast = Math.floor((nowMs - new Date(row.dueDate).getTime()) / 86_400_000)
    const bucket =
      daysPast <= 0
        ? buckets[0]
        : daysPast <= 30
          ? buckets[1]
          : daysPast <= 60
            ? buckets[2]
            : daysPast <= 90
              ? buckets[3]
              : buckets[4]

    bucket.outstanding += outstanding
    bucket.invoices += 1
  }

  const total = buckets.reduce((sum, b) => sum + b.outstanding, 0)

  return c.json({ data: { buckets, total } })
})
