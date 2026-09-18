import { createMiddleware } from 'hono/factory'
import type { ZodSchema } from 'zod'
import { ValidationError } from '../lib/errors'

export function validate(schema: ZodSchema, source: 'json' | 'query' | 'param' = 'json') {
  return createMiddleware(async (c, next) => {
    let data: unknown
    if (source === 'json') {
      data = await c.req.json()
    } else if (source === 'query') {
      data = Object.fromEntries(new URL(c.req.url).searchParams)
    } else {
      data = c.req.param()
    }

    const result = schema.safeParse(data)
    if (!result.success) {
      const errors: Record<string, string[]> = {}
      for (const issue of result.error.issues) {
        const path = issue.path.join('.')
        if (!errors[path]) errors[path] = []
        errors[path].push(issue.message)
      }
      throw new ValidationError(errors)
    }

    c.set('validatedData', result.data)
    await next()
  })
}
