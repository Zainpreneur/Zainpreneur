import { createMiddleware } from 'hono/factory'
import { logger } from '../lib/logger'

export const requestLogger = () =>
  createMiddleware(async (c, next) => {
    const start = Date.now()
    const { method, url } = c.req

    await next()

    const ms = Date.now() - start
    const status = c.res.status
    const requestId = c.get('requestId') as string | undefined

    const log = { method, url, status, ms, requestId }

    if (status >= 500) {
      logger.error(log, 'request completed')
    } else if (status >= 400) {
      logger.warn(log, 'request completed')
    } else {
      logger.info(log, 'request completed')
    }
  })
