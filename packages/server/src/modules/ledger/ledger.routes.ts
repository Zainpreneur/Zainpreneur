import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { AppError } from '../../lib/errors'

export const ledgerRoutes = new Hono()

ledgerRoutes.get('/trial-balance', async (c) => {
  const accounts = await prisma.ledgerAccount.findMany({
    orderBy: { code: 'asc' },
  })

  const rows = await Promise.all(
    accounts.map(async (account: { code: string; name: string; type: string; parentCode: string | null }) => {
      const agg = await prisma.ledgerLine.aggregate({
        where: { accountCode: account.code },
        _sum: { debit: true, credit: true },
      })
      const debit = agg._sum.debit ?? 0
      const credit = agg._sum.credit ?? 0
      return {
        code: account.code,
        name: account.name,
        type: account.type,
        parentCode: account.parentCode,
        debit,
        credit,
        balance: debit - credit,
      }
    }),
  )

  const imbalance = rows.reduce((sum: number, row: { balance: number }) => sum + row.balance, 0)
  const balanced = Math.abs(imbalance) < 0.01

  return c.json({
    data: {
      rows,
      balanced,
      imbalance,
    },
  })
})

ledgerRoutes.get('/statements', async (c) => {
  const accounts = await prisma.ledgerAccount.findMany({
    orderBy: { code: 'asc' },
  })

  const trial = await Promise.all(
    accounts.map(async (account: { code: string; name: string; type: string; parentCode: string | null }) => {
      const agg = await prisma.ledgerLine.aggregate({
        where: { accountCode: account.code },
        _sum: { debit: true, credit: true },
      })
      const debit = agg._sum.debit ?? 0
      const credit = agg._sum.credit ?? 0
      return {
        code: account.code,
        name: account.name,
        type: account.type,
        parentCode: account.parentCode,
        debit,
        credit,
        balance: debit - credit,
      }
    }),
  )

  const imbalance = trial.reduce((sum: number, row: { balance: number }) => sum + row.balance, 0)
  const balanced = Math.abs(imbalance) < 0.01

  const revenueRows = trial.filter((r) => r.type === 'revenue')
  const expenseRows = trial.filter((r) => r.type === 'expense')
  const revenue = revenueRows.reduce((sum, r) => sum + (r.credit - r.debit), 0)
  const expenses = expenseRows.reduce((sum, r) => sum + (r.debit - r.credit), 0)

  return c.json({
    data: {
      enterprise: 'Zainpreneur',
      asOf: new Date().toISOString(),
      trial,
      balanced,
      pnl: { revenue, expenses, profit: revenue - expenses },
    },
  })
})

ledgerRoutes.get('/pnl', async (c) => {
  const businessId = c.req.query('businessId')

  const entryWhere: Record<string, any> = {}
  if (businessId) entryWhere.businessId = businessId

  const entries = await prisma.ledgerEntry.findMany({
    where: entryWhere,
    select: { id: true },
  })
  const entryIds = entries.map((e: { id: string }) => e.id)

  const revenueAgg = await prisma.ledgerLine.aggregate({
    where: {
      entryId: { in: entryIds },
      account: { type: 'revenue' },
    },
    _sum: { debit: true, credit: true },
  })
  const revenue = (revenueAgg._sum.credit ?? 0) - (revenueAgg._sum.debit ?? 0)

  const expenseAgg = await prisma.ledgerLine.aggregate({
    where: {
      entryId: { in: entryIds },
      account: { type: 'expense' },
    },
    _sum: { debit: true, credit: true },
  })
  const expenses = (expenseAgg._sum.debit ?? 0) - (expenseAgg._sum.credit ?? 0)

  return c.json({
    data: {
      revenue,
      expenses,
      profit: revenue - expenses,
    },
  })
})

const USEFUL_LIFE_YEARS: Record<string, number> = {
  hardware: 4,
  machinery: 8,
  equipment: 6,
  other: 5,
}

ledgerRoutes.post('/depreciation', async (c) => {
  const body = await c.req.json()
  const { periodMonth } = body as { periodMonth: string }

  if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new AppError('periodMonth must be in YYYY-MM format', 400)
  }

  const memo = `Depreciation ${periodMonth}`
  const existing = await prisma.ledgerEntry.findFirst({
    where: { memo, source: 'depreciation' },
  })
  if (existing) {
    return c.json({ data: { entryId: existing.id, skipped: true, assets: 0 } })
  }

  const assets = await prisma.asset.findMany({
    where: { status: { not: 'retired' } },
  })

  const charges = assets
    .map((asset: { id: string; value: number; category: string }) => ({
      id: asset.id,
      amount: Math.round(asset.value / ((USEFUL_LIFE_YEARS[asset.category] ?? 5) * 12)),
    }))
    .filter((charge: { id: string; amount: number }) => charge.amount > 0)

  if (charges.length === 0) {
    return c.json({ data: { entryId: null, skipped: true, assets: 0 } })
  }

  const total = charges.reduce((sum: number, charge: { id: string; amount: number }) => sum + charge.amount, 0)
  const now = new Date().toISOString()

  const entry = await prisma.$transaction(async (tx: any) => {
    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        entryDate: now.slice(0, 10),
        memo,
        source: 'depreciation',
        createdAt: now,
      },
    })

    await tx.ledgerLine.createMany({
      data: [
        { entryId: ledgerEntry.id, accountCode: '5000', debit: total, credit: 0 },
        { entryId: ledgerEntry.id, accountCode: '1500', debit: 0, credit: total },
      ],
    })

    return ledgerEntry
  })

  return c.json({ data: { entryId: entry.id, skipped: false, assets: charges.length } }, 201)
})
