import { describe, it, expect, beforeEach } from 'vitest'
import { createTestApp, registerUser, authHeader } from './helpers'

const testUser = {
  email: `business-test-${Date.now()}@test.com`,
  password: 'testpass123',
  name: 'Business Test User',
}

const businessData = {
  name: 'Test Business',
  category: 'owned',
  model: 'project',
  industry: 'Technology',
  status: 'active',
  tagline: 'A test business',
  description: 'Testing business creation',
  foundedYear: 2024,
  color: '#6366f1',
  monthlyRevenue: 10000,
  monthlyExpenses: 5000,
  employees: 10,
  tags: ['test', 'tech'],
  project: {
    budget: 50000,
    deliverables: 5,
  },
}

const consultingBusinessData = {
  name: 'Consulting Business',
  category: 'client',
  model: 'consulting',
  industry: 'Consulting',
  consulting: {
    hourlyRate: 150,
    retainerMonthly: 5000,
    billableHoursTarget: 160,
    billableHoursLogged: 80,
    contracts: 3,
  },
}

const equityBusinessData = {
  name: 'Equity Business',
  category: 'equity',
  model: 'equity',
  industry: 'Finance',
  equity: {
    valuation: 1000000,
    dividendYield: 5,
    dividendsReceived: 25000,
  },
}

describe('Business Routes', () => {
  let token: string

  beforeEach(async () => {
    const app = createTestApp()
    const result = await registerUser(app, testUser)
    token = result.token
  })

  describe('GET /api/businesses', () => {
    it('returns empty array initially', async () => {
      const app = createTestApp()
      const res = await app.request('/api/businesses', {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data).toEqual([])
    })

    it('returns created business', async () => {
      const app = createTestApp()

      // Create business
      await app.request('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(businessData),
      })

      // Get businesses
      const res = await app.request('/api/businesses', {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.length).toBe(1)
      expect(body.data[0].name).toBe(businessData.name)
    })
  })

  describe('POST /api/businesses', () => {
    it('creates a project business', async () => {
      const app = createTestApp()
      const res = await app.request('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(businessData),
      })
      const body = await res.json() as any

      expect(res.status).toBe(201)
      expect(body.data.name).toBe(businessData.name)
      expect(body.data.model).toBe('project')
      expect(body.data.project).toBeDefined()
    })

    it('creates a consulting business', async () => {
      const app = createTestApp()
      const res = await app.request('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(consultingBusinessData),
      })
      const body = await res.json() as any

      expect(res.status).toBe(201)
      expect(body.data.consulting).toBeDefined()
    })

    it('creates an equity business', async () => {
      const app = createTestApp()
      const res = await app.request('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(equityBusinessData),
      })
      const body = await res.json() as any

      expect(res.status).toBe(201)
      expect(body.data.equity).toBeDefined()
    })

    it('returns 400 on invalid data', async () => {
      const app = createTestApp()
      const res = await app.request('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ name: 'Test' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/businesses/:id', () => {
    it('returns business with details', async () => {
      const app = createTestApp()

      // Create business
      const createRes = await app.request('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(businessData),
      })
      const { data: created } = await createRes.json() as any

      // Get business by ID
      const res = await app.request(`/api/businesses/${created.id}`, {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.id).toBe(created.id)
      expect(body.data.name).toBe(businessData.name)
      expect(body.data.project).toBeDefined()
    })

    it('returns 404 for nonexistent business', async () => {
      const app = createTestApp()
      const res = await app.request('/api/businesses/nonexistent-id', {
        headers: authHeader(token),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/businesses/:id', () => {
    it('updates a business', async () => {
      const app = createTestApp()

      // Create business
      const createRes = await app.request('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(businessData),
      })
      const { data: created } = await createRes.json() as any

      // Update business
      const res = await app.request(`/api/businesses/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ name: 'Updated Business', monthlyRevenue: 20000 }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.name).toBe('Updated Business')
      expect(body.data.monthlyRevenue).toBe(20000)
    })

    it('returns 404 for nonexistent business', async () => {
      const app = createTestApp()
      const res = await app.request('/api/businesses/nonexistent-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ name: 'Test' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/businesses/:id', () => {
    it('deletes a business', async () => {
      const app = createTestApp()

      // Create business
      const createRes = await app.request('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(businessData),
      })
      const { data: created } = await createRes.json() as any

      // Delete business
      const res = await app.request(`/api/businesses/${created.id}`, {
        method: 'DELETE',
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)

      // Verify it's deleted
      const getRes = await app.request(`/api/businesses/${created.id}`, {
        headers: authHeader(token),
      })
      expect(getRes.status).toBe(404)
    })

    it('returns 404 for nonexistent business', async () => {
      const app = createTestApp()
      const res = await app.request('/api/businesses/nonexistent-id', {
        method: 'DELETE',
        headers: authHeader(token),
      })

      expect(res.status).toBe(404)
    })
  })
})
