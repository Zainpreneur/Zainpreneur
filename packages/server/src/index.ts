import { serve } from '@hono/node-server'
import { createApp } from './app'
import { env } from './env'
import { prisma } from './db/client'
import { logger } from './lib/logger'

async function main() {
  const app = createApp()

  const server = serve(
    {
      fetch: app.fetch,
      port: env.PORT,
      hostname: env.HOST,
    },
    (info) => {
      logger.info(`Zainpreneur API running on http://${info.address}:${info.port}`)
      logger.info(`Environment: ${env.NODE_ENV}`)
    },
  )

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`)

    server.close(async () => {
      logger.info('HTTP server closed')
      await prisma.$disconnect()
      logger.info('Database disconnected')
      process.exit(0)
    })

    // Force kill after 10s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10_000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  logger.error('Fatal startup error', err)
  process.exit(1)
})
