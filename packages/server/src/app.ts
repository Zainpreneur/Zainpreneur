import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { timing } from 'hono/timing'
import { swaggerUI } from '@hono/swagger-ui'
import { env } from './env'
import { errorHandler } from './middleware/error-handler'
import { rateLimiter } from './middleware/rate-limit'
import { authMiddleware } from './middleware/auth'
import { requestLogger } from './middleware/request-logger'
import { prisma } from './db/client'
import { openApiConfig } from './docs/openapi-config'

import { authRoutes } from './modules/auth/auth.routes'
import { businessRoutes } from './modules/businesses/businesses.routes'
import { branchRoutes } from './modules/branches/branches.routes'
import { ownerRoutes } from './modules/owners/owners.routes'
import { taskRoutes } from './modules/tasks/tasks.routes'
import { transactionRoutes } from './modules/transactions/transactions.routes'
import { teamRoutes } from './modules/team/team.routes'
import { assetRoutes } from './modules/assets/assets.routes'
import { procurementRoutes } from './modules/procurement/procurement.routes'
import { hrRoutes } from './modules/hr/hr.routes'
import { ledgerRoutes } from './modules/ledger/ledger.routes'
import { invoiceRoutes } from './modules/invoices/invoices.routes'
import { dashboardRoutes } from './modules/dashboard/dashboard.routes'
import { settingsRoutes } from './modules/settings/settings.routes'

export function createApp(): Hono {
  const app = new Hono()

  // ── Global middleware ──
  app.use('*', requestId())
  app.use('*', timing())
  app.use('*', secureHeaders())
  app.use('*', cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }))
  app.use('*', errorHandler())
  app.use('*', rateLimiter({ windowMs: 60_000, max: 100 }))
  app.use('*', requestLogger())

  // ── Health check ──
  app.get('/health', async (c) => {
    const checks: Record<string, string> = {}

    try {
      await prisma.$queryRaw`SELECT 1`
      checks.database = 'ok'
    } catch {
      checks.database = 'error'
    }

    const healthy = Object.values(checks).every((v) => v === 'ok')

    return c.json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
      checks,
      uptime: process.uptime(),
    }, healthy ? 200 : 503)
  })

  // ── Public routes ──
  app.route('/api/auth', authRoutes)

  // ── Protected routes ──
  const protectedGroup = new Hono()
  protectedGroup.use('*', authMiddleware())

  protectedGroup.route('/businesses', businessRoutes)
  protectedGroup.route('/businesses/:businessId/branches', branchRoutes)
  protectedGroup.route('/owners', ownerRoutes)
  protectedGroup.route('/tasks', taskRoutes)
  protectedGroup.route('/transactions', transactionRoutes)
  protectedGroup.route('/team', teamRoutes)
  protectedGroup.route('/assets', assetRoutes)
  protectedGroup.route('/procurement', procurementRoutes)
  protectedGroup.route('/hr', hrRoutes)
  protectedGroup.route('/ledger', ledgerRoutes)
  protectedGroup.route('/invoices', invoiceRoutes)
  protectedGroup.route('/dashboard', dashboardRoutes)
  protectedGroup.route('/settings', settingsRoutes)

  app.route('/api', protectedGroup)

  // ── OpenAPI docs ──
  ;(app as any).doc('/api/docs/openapi.json', openApiConfig)
  app.get('/api/docs', swaggerUI({ url: '/api/docs/openapi.json' }))

  // ── 404 ──
  app.notFound((c) => c.json({ error: 'Not found' }, 404))

  return app
}
