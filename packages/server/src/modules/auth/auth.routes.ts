import { Hono } from 'hono'
import { sign, verify } from 'jsonwebtoken'
import { compare, hash } from 'bcryptjs'
import { prisma } from '../../db/client'
import { env } from '../../env'
import { AppError } from '../../lib/errors'
import { loginSchema, registerSchema } from '@zainpreneur/shared'

function parseExpiresIn(val: string): number {
  const match = val.match(/^(\d+)([smhd])$/)
  if (!match) return 604800 // 7 days default
  const n = parseInt(match[1], 10)
  switch (match[2]) {
    case 's': return n
    case 'm': return n * 60
    case 'h': return n * 3600
    case 'd': return n * 86400
    default: return 604800
  }
}

export const authRoutes = new Hono()

authRoutes.post('/login', async (c) => {
  const body = await c.req.json()
  const parsed = loginSchema.parse(body)

  const user = await prisma.user.findUnique({ where: { email: parsed.email } })
  if (!user) throw new AppError('Invalid email or password', 401)

  const valid = await compare(parsed.password, user.passwordHash)
  if (!valid) throw new AppError('Invalid email or password', 401)

  const token = sign(
    { userId: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: parseExpiresIn(env.JWT_EXPIRES_IN) },
  )

  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } })
  const settings = await prisma.appSettings.findUnique({ where: { userId: user.id } })

  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    profile: profile ?? {
      id: user.id, name: user.name, email: user.email, role: user.role,
      enterprise: 'Zainpreneur' as const,
      initials: user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      bio: '', timezone: 'Asia/Karachi', businessSince: '', avatarColor: '#6366f1',
    },
    settings: settings ? { ...settings, notifications: settings.notifications as any } : {
      theme: 'system', currency: 'PKR', compactSidebar: false, showFinancialTotals: true,
      defaultCategoryFilter: 'all',
      notifications: { taskReminders: true, paymentAlerts: true, weeklyDigest: true, milestoneAlerts: true, marketingEmails: false },
    },
  })
})

authRoutes.post('/register', async (c) => {
  const body = await c.req.json()
  const parsed = registerSchema.parse(body)

  const existing = await prisma.user.findUnique({ where: { email: parsed.email } })
  if (existing) throw new AppError('Email already registered', 409)

  const passwordHash = await hash(parsed.password, 12)

  const user = await prisma.user.create({
    data: { email: parsed.email, passwordHash, name: parsed.name },
  })

  await prisma.userProfile.create({
    data: {
      userId: user.id,
      initials: parsed.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
    },
  })

  await prisma.appSettings.create({ data: { userId: user.id } })

  const token = sign(
    { userId: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: parseExpiresIn(env.JWT_EXPIRES_IN) },
  )

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name } }, 201)
})

authRoutes.get('/me', async (c) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) return c.json({ error: 'Not authenticated' }, 401)

  const token = header.slice(7)
  const payload = verify(token, env.JWT_SECRET) as { userId: string; email: string }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) return c.json({ error: 'User not found' }, 404)

  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } })
  const settings = await prisma.appSettings.findUnique({ where: { userId: user.id } })

  return c.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    profile,
    settings: settings ? { ...settings, notifications: settings.notifications as any } : null,
  })
})
