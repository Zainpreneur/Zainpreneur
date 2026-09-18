import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { NotFoundError, AppError } from '../../lib/errors'

export const hrRoutes = new Hono()

hrRoutes.get('/contracts', async (c) => {
  const contracts = await prisma.hrContract.findMany({
    include: {
      member: { select: { name: true, engagementType: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ data: contracts })
})

hrRoutes.post('/contracts', async (c) => {
  const body = await c.req.json()
  const { memberId, kind, baseAmount, currency, startDate, endDate, billingCycle } = body

  if (!memberId) throw new AppError('Member ID is required', 400)
  if (!kind) throw new AppError('Contract kind is required', 400)

  const member = await prisma.teamMember.findUnique({ where: { id: memberId } })
  if (!member) throw new NotFoundError('Team member', memberId)

  const contract = await prisma.hrContract.create({
    data: {
      memberId,
      kind,
      baseAmount: baseAmount ?? 0,
      currency: currency ?? 'PKR',
      startDate: startDate ?? new Date().toISOString().slice(0, 10),
      endDate: endDate ?? null,
      billingCycle: billingCycle ?? 'monthly',
      isActive: true,
    },
  })

  return c.json({ data: contract }, 201)
})

hrRoutes.get('/timesheets', async (c) => {
  const memberId = c.req.query('memberId')
  const unsyncedOnly = c.req.query('unsyncedOnly') === 'true'

  const where: Record<string, any> = {}
  if (memberId) where.memberId = memberId
  if (unsyncedOnly) where.synced = false

  const timesheets = await prisma.timesheet.findMany({
    where,
    orderBy: { workDate: 'desc' },
    take: 200,
  })

  return c.json({ data: timesheets })
})

hrRoutes.post('/timesheets', async (c) => {
  const body = await c.req.json()
  const { memberId, businessId, date, hours, billable, milestoneRef, note } = body

  if (!memberId) throw new AppError('Member ID is required', 400)
  if (hours === undefined || hours < 0) throw new AppError('Hours must be zero or more', 400)

  const member = await prisma.teamMember.findUnique({ where: { id: memberId } })
  if (!member) throw new NotFoundError('Team member', memberId)

  const timesheet = await prisma.timesheet.create({
    data: {
      memberId,
      businessId: businessId ?? null,
      workDate: date ?? new Date().toISOString().slice(0, 10),
      hours,
      billable: billable !== false,
      milestoneRef: milestoneRef ?? null,
      note: note ?? null,
      synced: true,
    },
  })

  return c.json({ data: timesheet }, 201)
})

hrRoutes.post('/payroll/calculate', async (c) => {
  const body = await c.req.json()
  const { from, to, memberIds } = body as { from: string; to: string; memberIds?: string[] }

  if (!from || !to) throw new AppError('From and to dates are required', 400)

  const whereClause: Record<string, any> = { isActive: true }
  if (memberIds && memberIds.length > 0) {
    whereClause.memberId = { in: memberIds }
  }

  const contracts = await prisma.hrContract.findMany({
    where: whereClause,
    include: {
      member: { select: { name: true, engagementType: true } },
    },
  })

  const lines: Array<{
    memberId: string
    memberName: string
    engagement: string
    kind: string
    currency: string
    amount: number
    detail: string
  }> = []
  const warnings: string[] = []
  const totals: Record<string, number> = {}

  for (const contract of contracts) {
    if (contract.kind === 'salary' || contract.kind === 'retainer') {
      const amount = contract.baseAmount
      lines.push({
        memberId: contract.memberId,
        memberName: contract.member?.name ?? 'Unknown',
        engagement: contract.member?.engagementType ?? '',
        kind: contract.kind,
        currency: contract.currency,
        amount,
        detail: `${contract.billingCycle} ${contract.kind} @ ${contract.baseAmount}`,
      })
      totals[contract.member?.engagementType ?? ''] =
        (totals[contract.member?.engagementType ?? ''] ?? 0) + amount
    } else {
      const timesheetAgg = await prisma.timesheet.aggregate({
        where: {
          memberId: contract.memberId,
          billable: true,
          workDate: { gte: from, lte: to },
        },
        _sum: { hours: true },
      })

      const hours = timesheetAgg._sum.hours ?? 0
      if (hours === 0) {
        warnings.push(`${contract.member?.name ?? 'Unknown'} logged no billable hours in range — skipped`)
        continue
      }
      const amount = Math.round(hours * contract.baseAmount * 100) / 100
      lines.push({
        memberId: contract.memberId,
        memberName: contract.member?.name ?? 'Unknown',
        engagement: contract.member?.engagementType ?? '',
        kind: contract.kind,
        currency: contract.currency,
        amount,
        detail: `${hours}h × ${contract.baseAmount}/${contract.currency === 'USD' ? 'hr' : 'unit'}`,
      })
      totals[contract.member?.engagementType ?? ''] =
        (totals[contract.member?.engagementType ?? ''] ?? 0) + amount
    }
  }

  const run = {
    period: `${from} → ${to}`,
    lines,
    totals,
    grandTotal: lines.reduce((sum, line) => sum + line.amount, 0),
    warnings,
  }

  return c.json({ data: run })
})

hrRoutes.post('/payroll/post', async (c) => {
  const body = await c.req.json()
  const { period, lines, grandTotal } = body as {
    period: string
    lines: Array<{ kind: string; amount: number }>
    grandTotal: number
  }

  if (!lines || lines.length === 0) throw new AppError('Nothing to post — payroll run is empty', 400)

  const now = new Date().toISOString()

  const salary = lines.filter((l) => l.kind === 'salary').reduce((s, l) => s + l.amount, 0)
  const contractor = grandTotal - salary

  const entry = await prisma.$transaction(async (tx: any) => {
    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        entryDate: now.slice(0, 10),
        memo: `Payroll run ${period} (${lines.length} payouts)`,
        source: 'payroll',
        createdAt: now,
      },
    })

    const lineData: Array<{ entryId: string; accountCode: string; debit: number; credit: number }> = []
    if (salary > 0) {
      lineData.push({ entryId: ledgerEntry.id, accountCode: '5100', debit: salary, credit: 0 })
    }
    if (contractor > 0) {
      lineData.push({ entryId: ledgerEntry.id, accountCode: '5200', debit: contractor, credit: 0 })
    }
    lineData.push({ entryId: ledgerEntry.id, accountCode: '2100', debit: 0, credit: grandTotal })

    await tx.ledgerLine.createMany({ data: lineData })

    return ledgerEntry
  })

  return c.json({ data: { entryId: entry.id } }, 201)
})
