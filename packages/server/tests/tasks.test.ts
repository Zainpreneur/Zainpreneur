import { describe, it, expect, beforeEach } from 'vitest'
import { createTestApp, registerUser, authHeader } from './helpers'

const testUser = {
  email: `task-test-${Date.now()}@test.com`,
  password: 'testpass123',
  name: 'Task Test User',
}

const businessData = {
  name: 'Task Test Business',
  category: 'owned' as const,
  model: 'project' as const,
  industry: 'Technology',
  project: {
    budget: 50000,
    deliverables: 5,
  },
}

describe('Task Routes', () => {
  let token: string
  let businessId: string

  beforeEach(async () => {
    const app = createTestApp()
    const result = await registerUser(app, testUser)
    token = result.token

    // Create a business for tasks
    const bizRes = await app.request('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify(businessData),
    })
    const { data: business } = await bizRes.json() as any
    businessId = business.id
  })

  describe('POST /api/tasks', () => {
    it('creates a task', async () => {
      const app = createTestApp()
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          title: 'Test Task',
          description: 'A test task',
          priority: 'high',
          dueDate: '2025-12-31',
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(201)
      expect(body.data.title).toBe('Test Task')
      expect(body.data.priority).toBe('high')
      expect(body.data.status).toBe('todo')
    })

    it('returns 400 for invalid data', async () => {
      const app = createTestApp()
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ title: 'Test' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/tasks', () => {
    it('returns all tasks', async () => {
      const app = createTestApp()

      // Create tasks
      await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          title: 'Task 1',
          priority: 'high',
          dueDate: '2025-12-31',
        }),
      })

      await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          title: 'Task 2',
          priority: 'low',
          dueDate: '2025-12-31',
        }),
      })

      const res = await app.request('/api/tasks', {
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

      // Create tasks for different businesses
      await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          title: 'Task for Biz 1',
          priority: 'high',
          dueDate: '2025-12-31',
        }),
      })

      await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId: anotherBiz.id,
          title: 'Task for Biz 2',
          priority: 'low',
          dueDate: '2025-12-31',
        }),
      })

      const res = await app.request(`/api/tasks?businessId=${businessId}`, {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.length).toBe(1)
      expect(body.data[0].title).toBe('Task for Biz 1')
    })

    it('filters by status', async () => {
      const app = createTestApp()

      await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          title: 'Todo Task',
          priority: 'high',
          dueDate: '2025-12-31',
        }),
      })

      await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          title: 'Done Task',
          priority: 'low',
          dueDate: '2025-12-31',
        }),
      })

      // Mark second task as done
      const listRes = await app.request('/api/tasks', {
        headers: authHeader(token),
      })
      const { data: tasks } = await listRes.json() as any

      await app.request(`/api/tasks/${tasks[1].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ status: 'done' }),
      })

      const res = await app.request('/api/tasks?status=todo', {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.length).toBe(1)
      expect(body.data[0].title).toBe('Todo Task')
    })

    it('filters by priority', async () => {
      const app = createTestApp()

      await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          title: 'High Priority',
          priority: 'high',
          dueDate: '2025-12-31',
        }),
      })

      await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          title: 'Low Priority',
          priority: 'low',
          dueDate: '2025-12-31',
        }),
      })

      const res = await app.request('/api/tasks?priority=high', {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.length).toBe(1)
      expect(body.data[0].title).toBe('High Priority')
    })
  })

  describe('PATCH /api/tasks/:id', () => {
    it('updates a task', async () => {
      const app = createTestApp()

      // Create task
      const createRes = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          title: 'Original Title',
          priority: 'medium',
          dueDate: '2025-12-31',
        }),
      })
      const { data: created } = await createRes.json() as any

      // Update task
      const res = await app.request(`/api/tasks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ title: 'Updated Title', status: 'in_progress' }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.title).toBe('Updated Title')
      expect(body.data.status).toBe('in_progress')
    })

    it('returns 404 for nonexistent task', async () => {
      const app = createTestApp()
      const res = await app.request('/api/tasks/nonexistent-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ title: 'Test' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/tasks/:id', () => {
    it('deletes a task', async () => {
      const app = createTestApp()

      // Create task
      const createRes = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          businessId,
          title: 'To Delete',
          priority: 'high',
          dueDate: '2025-12-31',
        }),
      })
      const { data: created } = await createRes.json() as any

      // Delete task
      const res = await app.request(`/api/tasks/${created.id}`, {
        method: 'DELETE',
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('returns 404 for nonexistent task', async () => {
      const app = createTestApp()
      const res = await app.request('/api/tasks/nonexistent-id', {
        method: 'DELETE',
        headers: authHeader(token),
      })

      expect(res.status).toBe(404)
    })
  })
})
