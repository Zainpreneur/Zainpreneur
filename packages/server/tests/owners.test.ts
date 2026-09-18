import { describe, it, expect, beforeEach } from 'vitest'
import { createTestApp, registerUser, authHeader } from './helpers'

const testUser = {
  email: `owner-test-${Date.now()}@test.com`,
  password: 'testpass123',
  name: 'Owner Test User',
}

const ownerData = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  location: 'New York',
  role: 'CEO',
  bio: 'Test owner',
  color: '#6366f1',
}

describe('Owner Routes', () => {
  let token: string

  beforeEach(async () => {
    const app = createTestApp()
    const result = await registerUser(app, testUser)
    token = result.token
  })

  describe('POST /api/owners', () => {
    it('creates an owner', async () => {
      const app = createTestApp()
      const res = await app.request('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(ownerData),
      })
      const body = await res.json() as any

      expect(res.status).toBe(201)
      expect(body.data.name).toBe(ownerData.name)
      expect(body.data.email).toBe(ownerData.email)
      expect(body.data.initials).toBe('JD')
    })

    it('returns 400 for invalid data', async () => {
      const app = createTestApp()
      const res = await app.request('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ name: 'Test' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/owners', () => {
    it('returns all owners', async () => {
      const app = createTestApp()

      await app.request('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(ownerData),
      })

      await app.request('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          ...ownerData,
          name: 'Jane Smith',
          email: 'jane@example.com',
        }),
      })

      const res = await app.request('/api/owners', {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.length).toBe(2)
    })

    it('returns empty array initially', async () => {
      const app = createTestApp()
      const res = await app.request('/api/owners', {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data).toEqual([])
    })
  })

  describe('PATCH /api/owners/:id', () => {
    it('updates an owner', async () => {
      const app = createTestApp()

      const createRes = await app.request('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(ownerData),
      })
      const { data: created } = await createRes.json() as any

      const res = await app.request(`/api/owners/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ name: 'John Updated', role: 'CTO' }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.name).toBe('John Updated')
      expect(body.data.role).toBe('CTO')
      expect(body.data.initials).toBe('JU')
    })

    it('returns 404 for nonexistent owner', async () => {
      const app = createTestApp()
      const res = await app.request('/api/owners/nonexistent-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ name: 'Test' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/owners/:id', () => {
    it('deletes an owner', async () => {
      const app = createTestApp()

      const createRes = await app.request('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(ownerData),
      })
      const { data: created } = await createRes.json() as any

      const res = await app.request(`/api/owners/${created.id}`, {
        method: 'DELETE',
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)

      // Verify it's deleted
      const listRes = await app.request('/api/owners', {
        headers: authHeader(token),
      })
      const { data: owners } = await listRes.json() as any
      expect(owners.length).toBe(0)
    })

    it('returns 404 for nonexistent owner', async () => {
      const app = createTestApp()
      const res = await app.request('/api/owners/nonexistent-id', {
        method: 'DELETE',
        headers: authHeader(token),
      })

      expect(res.status).toBe(404)
    })
  })
})
