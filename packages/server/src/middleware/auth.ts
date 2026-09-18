import { createMiddleware } from 'hono/factory'
import { verify } from 'jsonwebtoken'
import { env } from '../env'

export interface JwtPayload {
  userId: string
  email: string
}

export const authMiddleware = () =>
  createMiddleware(async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401)
    }

    const token = header.slice(7)
    try {
      const payload = verify(token, env.JWT_SECRET) as JwtPayload
      c.set('jwtPayload', payload)
      await next()
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }
  })

export function getCurrentUser(c: any): JwtPayload {
  return c.get('jwtPayload') as JwtPayload
}
