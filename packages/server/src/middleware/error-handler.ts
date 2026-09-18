import { createMiddleware } from 'hono/factory'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AppError, ValidationError, NotFoundError, AuthorizationError, ConflictError } from '../lib/errors'
import { logger } from '../lib/logger'

export const errorHandler = () =>
  createMiddleware(async (c, next) => {
    try {
      await next()
    } catch (err) {
      if (err instanceof ValidationError) {
        return c.json({ error: 'Validation failed', details: err.errors }, 400 as ContentfulStatusCode)
      }
      if (err instanceof NotFoundError) {
        return c.json({ error: err.message }, 404 as ContentfulStatusCode)
      }
      if (err instanceof AuthorizationError) {
        return c.json({ error: 'Forbidden' }, 403 as ContentfulStatusCode)
      }
      if (err instanceof ConflictError) {
        return c.json({ error: err.message }, 409 as ContentfulStatusCode)
      }
      if (err instanceof AppError) {
        return c.json({ error: err.message }, err.statusCode as ContentfulStatusCode)
      }

      logger.error({ err }, 'Unhandled error')
      return c.json({ error: 'Internal server error' }, 500 as ContentfulStatusCode)
    }
  })
