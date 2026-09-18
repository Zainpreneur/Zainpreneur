import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { getCurrentUser } from '../../middleware/auth'
import { settingsUpdateSchema, profileUpdateSchema } from '@zainpreneur/shared'

export const settingsRoutes = new Hono()

settingsRoutes.get('/', async (c) => {
  const user = getCurrentUser(c)

  const profile = await prisma.userProfile.findUnique({ where: { userId: user.userId } })
  const settings = await prisma.appSettings.findUnique({ where: { userId: user.userId } })

  return c.json({
    data: {
      profile: profile ?? {
        userId: user.userId,
        name: '',
        bio: '',
        timezone: 'Asia/Karachi',
        avatarColor: '#6366f1',
      },
      settings: settings ?? {
        theme: 'system',
        currency: 'PKR',
        compactSidebar: false,
        showFinancialTotals: true,
        defaultCategoryFilter: 'all',
        notifications: {
          taskReminders: true,
          paymentAlerts: true,
          weeklyDigest: true,
          milestoneAlerts: true,
          marketingEmails: false,
        },
      },
    },
  })
})

settingsRoutes.patch('/', async (c) => {
  const user = getCurrentUser(c)
  const body = await c.req.json()
  const parsed = settingsUpdateSchema.parse(body)

  const existing = await prisma.appSettings.findUnique({ where: { userId: user.userId } })

  let settings
  if (existing) {
    const data: Record<string, any> = {}
    if (parsed.theme !== undefined) data.theme = parsed.theme
    if (parsed.currency !== undefined) data.currency = parsed.currency
    if (parsed.compactSidebar !== undefined) data.compactSidebar = parsed.compactSidebar
    if (parsed.showFinancialTotals !== undefined) data.showFinancialTotals = parsed.showFinancialTotals
    if (parsed.defaultCategoryFilter !== undefined) data.defaultCategoryFilter = parsed.defaultCategoryFilter
    if (parsed.notifications !== undefined) data.notifications = parsed.notifications

    settings = await prisma.appSettings.update({
      where: { userId: user.userId },
      data,
    })
  } else {
    settings = await prisma.appSettings.create({
      data: {
        userId: user.userId,
        theme: parsed.theme ?? 'system',
        currency: parsed.currency ?? 'PKR',
        compactSidebar: parsed.compactSidebar ?? false,
        showFinancialTotals: parsed.showFinancialTotals ?? true,
        defaultCategoryFilter: parsed.defaultCategoryFilter ?? 'all',
        notifications: parsed.notifications ?? {
          taskReminders: true,
          paymentAlerts: true,
          weeklyDigest: true,
          milestoneAlerts: true,
          marketingEmails: false,
        },
      },
    })
  }

  return c.json({ data: settings })
})

settingsRoutes.patch('/profile', async (c) => {
  const user = getCurrentUser(c)
  const body = await c.req.json()
  const parsed = profileUpdateSchema.parse(body)

  const existing = await prisma.userProfile.findUnique({ where: { userId: user.userId } })

  let profile
  if (existing) {
    const data: Record<string, any> = {}
    if (parsed.name !== undefined) data.name = parsed.name
    if (parsed.bio !== undefined) data.bio = parsed.bio
    if (parsed.timezone !== undefined) data.timezone = parsed.timezone
    if (parsed.avatarColor !== undefined) data.avatarColor = parsed.avatarColor

    profile = await prisma.userProfile.update({
      where: { userId: user.userId },
      data,
    })
  } else {
    profile = await prisma.userProfile.create({
      data: {
        userId: user.userId,
        name: parsed.name ?? '',
        bio: parsed.bio ?? '',
        timezone: parsed.timezone ?? 'Asia/Karachi',
        avatarColor: parsed.avatarColor ?? '#6366f1',
      },
    })
  }

  return c.json({ data: profile })
})

settingsRoutes.post('/reset', async (c) => {
  getCurrentUser(c)

  await prisma.$transaction(async (tx: any) => {
    await tx.activityEvent.deleteMany()
    await tx.task.deleteMany()
    await tx.transaction.deleteMany()
    await tx.invoice.deleteMany()
    await tx.ledgerLine.deleteMany()
    await tx.ledgerEntry.deleteMany()
    await tx.ledgerAccount.deleteMany()
    await tx.timesheet.deleteMany()
    await tx.hrContract.deleteMany()
    await tx.pOItem.deleteMany()
    await tx.purchaseOrder.deleteMany()
    await tx.vendor.deleteMany()
    await tx.assetDeployment.deleteMany()
    await tx.asset.deleteMany()
    await tx.teamMember.deleteMany()
    await tx.capShare.deleteMany()
    await tx.owner.deleteMany()
    await tx.branch.deleteMany()
    await tx.projectMilestone.deleteMany()
    await tx.projectDetails.deleteMany()
    await tx.consultingDetails.deleteMany()
    await tx.equityDetails.deleteMany()
    await tx.business.deleteMany()
  })

  return c.json({ success: true, message: 'All data has been reset. User account preserved.' })
})
