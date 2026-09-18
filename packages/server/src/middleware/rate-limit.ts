import { createMiddleware } from 'hono/factory'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

export function rateLimiter(opts: { windowMs: number; max: number }) {
  return createMiddleware(async (c, next) => {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'
    const now = Date.now()
    const entry = store.get(ip)

    if (entry && entry.resetAt > now) {
      if (entry.count >= opts.max) {
        c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
        return c.json({ error: 'Too many requests' }, 429)
      }
      entry.count++
    } else {
      store.set(ip, { count: 1, resetAt: now + opts.windowMs })
    }

    // Cleanup old entries periodically
    if (store.size > 10000) {
      for (const [key, val] of store) {
        if (val.resetAt < now) store.delete(key)
      }
    }

    await next()
  })
}
