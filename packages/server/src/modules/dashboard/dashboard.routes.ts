import { Hono } from 'hono'
import { prisma } from '../../db/client'

export const dashboardRoutes = new Hono()

dashboardRoutes.get('/summary', async (c) => {
  const totalBusinesses = await prisma.business.count()

  const revenueAgg = await prisma.transaction.aggregate({
    where: { type: 'income' },
    _sum: { amount: true },
  })
  const totalRevenue = revenueAgg._sum.amount ?? 0

  const expenseAgg = await prisma.transaction.aggregate({
    where: { type: 'expense' },
    _sum: { amount: true },
  })
  const totalExpenses = expenseAgg._sum.amount ?? 0

  const activeTasksCount = await prisma.task.count({
    where: { status: { not: 'done' } },
  })

  const recentActivity = await prisma.activityEvent.findMany({
    orderBy: { timestamp: 'desc' },
    take: 20,
  })

  return c.json({
    data: {
      totalBusinesses,
      totalRevenue,
      totalExpenses,
      activeTasksCount,
      recentActivity,
    },
  })
})
