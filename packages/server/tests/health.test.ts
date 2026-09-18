import { describe, it, expect } from 'vitest'
import { createTestApp } from './helpers'

describe('Health Check', () => {
  it('GET /health returns 200 with status ok', async () => {
    const app = createTestApp()
    const res = await app.request('/health')
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
    expect(body.checks).toBeDefined()
    expect(body.checks.database).toBe('ok')
  })
})
