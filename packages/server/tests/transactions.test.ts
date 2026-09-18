import { describe, it, expect, beforeEach } from 'vitest'
import { createTestApp, registerUser, authHeader } from './helpers'

const testUser = {
  email: `transaction-test-${Date.now()}@test.com`,
  password: 'testpass123',
  name: 'Transaction Test User',
}

const businessData = {
  name: 'Transaction Test Business',
  category: 'owned' as const,
  model: 'project' as const,
  industry: 'Technology',
  project: {
    budget: 50000,
    deliverables: 5,
  },
}

describe('Transaction Routes', () => {
  let token: string
  let businessId: string

  beforeEach(async () => {
    const app = createTestApp()
    const result = await registerUser(app, testUser)
    token = result.token

    // Create a business for transactions
    const bizRes = await app.request('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify(businessData),
    })
    const { data: business } = await bizRes.json() as any
    businessId = business.id
  })

  describe('POST /api/transactions', () => {
    it('creates an income transaction', async () => {
      const app = createTestApp()
      const res = await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          date: '2025-01-15',
          description: 'Client Payment',
          category: 'revenue',
          type: 'income',
          amount: 5000,
          paymentMethod: 'bank_transfer',
          status: 'cleared',
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(201)
      expect(body.data.description).toBe('Client Payment')
      expect(body.data.type).toBe('income')
      expect(body.data.amount).toBe(5000)
    })

    it('creates an expense transaction', async () => {
      const app = createTestApp()
      const res = await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          date: '2025-01-15',
          description: 'Office Supplies',
          category: 'operations',
          type: 'expense',
          amount: 200,
          status: 'cleared',
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(201)
      expect(body.data.type).toBe('expense')
    })

    it('returns 400 for invalid data', async () => {
      const app = createTestApp()
      const res = await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ businessId, amount: 100 }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/transactions', () => {
    it('returns all transactions', async () => {
      const app = createTestApp()

      await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          date: '2025-01-15',
          description: 'Income 1',
          category: 'revenue',
          type: 'income',
          amount: 1000,
        }),
      })

      await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          date: '2025-01-16',
          description: 'Expense 1',
          category: 'operations',
          type: 'expense',
          amount: 500,
        }),
      })

      const res = await app.request('/api/transactions', {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.length).toBe(2)
    })

    it('filters by businessId', async () => {
      const app = createTestApp()

      // Create another business
      const bizRes = await app.request('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          ...businessData,
          name: 'Another Business',
        }),
      })
      const { data: anotherBiz } = await bizRes.json() as any

      await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          date: '2025-01-15',
          description: 'For Biz 1',
          category: 'revenue',
          type: 'income',
          amount: 1000,
        }),
      })

      await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId: anotherBiz.id,
          date: '2025-01-15',
          description: 'For Biz 2',
          category: 'revenue',
          type: 'income',
          amount: 2000,
        }),
      })

      const res = await app.request(`/api/transactions?businessId=${businessId}`, {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.length).toBe(1)
      expect(body.data[0].description).toBe('For Biz 1')
    })

    it('filters by category', async () => {
      const app = createTestApp()

      await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          date: '2025-01-15',
          description: 'Revenue',
          category: 'revenue',
          type: 'income',
          amount: 1000,
        }),
      })

      await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          date: '2025-01-15',
          description: 'Operations',
          category: 'operations',
          type: 'expense',
          amount: 500,
        }),
      })

      const res = await app.request('/api/transactions?category=revenue', {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.length).toBe(1)
      expect(body.data[0].category).toBe('revenue')
    })

    it('filters by date range', async () => {
      const app = createTestApp()

      await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          date: '2025-01-10',
          description: 'Early',
          category: 'revenue',
          type: 'income',
          amount: 1000,
        }),
      })

      await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          date: '2025-01-20',
          description: 'Late',
          category: 'revenue',
          type: 'income',
          amount: 2000,
        }),
      })

      const res = await app.request('/api/transactions?from=2025-01-15&to=2025-01-25', {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.length).toBe(1)
      expect(body.data[0].description).toBe('Late')
    })
  })

  describe('PATCH /api/transactions/:id', () => {
    it('updates a transaction', async () => {
      const app = createTestApp()

      const createRes = await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          date: '2025-01-15',
          description: 'Original',
          category: 'revenue',
          type: 'income',
          amount: 1000,
        }),
      })
      const { data: created } = await createRes.json() as any

      const res = await app.request(`/api/transactions/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ description: 'Updated', amount: 2000 }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.description).toBe('Updated')
      expect(body.data.amount).toBe(2000)
    })

    it('returns 404 for nonexistent transaction', async () => {
      const app = createTestApp()
      const res = await app.request('/api/transactions/nonexistent-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ description: 'Test' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/transactions/:id', () => {
    it('deletes a transaction', async () => {
      const app = createTestApp()

      const createRes = await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          date: '2025-01-15',
          description: 'To Delete',
          category: 'revenue',
          type: 'income',
          amount: 1000,
        }),
      })
      const { data: created } = await createRes.json() as any

      const res = await app.request(`/api/transactions/${created.id}`, {
        method: 'DELETE',
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('returns 404 for nonexistent transaction', async () => {
      const app = createTestApp()
      const res = await app.request('/api/transactions/nonexistent-id', {
        method: 'DELETE',
        headers: authHeader(token),
      })

      expect(res.status).toBe(404)
    })
  })
})
