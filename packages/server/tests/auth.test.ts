import { describe, it, expect } from 'vitest'
import { createTestApp, registerUser, loginUser, authHeader } from './helpers'

const testUser = {
  email: `auth-test-${Date.now()}@test.com`,
  password: 'testpass123',
  name: 'Auth Test User',
}

describe('Auth Routes', () => {
  describe('POST /api/auth/register', () => {
    it('registers a new user successfully', async () => {
      const app = createTestApp()
      const { status, token, user } = await registerUser(app, testUser)

      expect(status).toBe(201)
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(user.email).toBe(testUser.email)
      expect(user.name).toBe(testUser.name)
    })

    it('returns 409 for duplicate email', async () => {
      const app = createTestApp()
      await registerUser(app, testUser)

      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser),
      })

      expect(res.status).toBe(409)
    })

    it('returns 400 for missing fields', async () => {
      const app = createTestApp()

      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const app = createTestApp()
      await registerUser(app, testUser)

      const { status, token, user } = await loginUser(app, {
        email: testUser.email,
        password: testUser.password,
      })

      expect(status).toBe(200)
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(user.email).toBe(testUser.email)
    })

    it('returns 401 for wrong password', async () => {
      const app = createTestApp()
      await registerUser(app, testUser)

      const { status } = await loginUser(app, {
        email: testUser.email,
        password: 'wrongpassword',
      })

      expect(status).toBe(401)
    })

    it('returns 401 for nonexistent user', async () => {
      const app = createTestApp()

      const { status } = await loginUser(app, {
        email: 'nonexistent@test.com',
        password: 'testpass123',
      })

      expect(status).toBe(401)
    })
  })

  describe('GET /api/auth/me', () => {
    it('returns current user with valid token', async () => {
      const app = createTestApp()
      const { token } = await registerUser(app, testUser)

      const res = await app.request('/api/auth/me', {
        headers: authHeader(token),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.user.email).toBe(testUser.email)
    })

    it('returns 401 without token', async () => {
      const app = createTestApp()

      const res = await app.request('/api/auth/me')
      expect(res.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const app = createTestApp()

      const res = await app.request('/api/auth/me', {
        headers: { Authorization: 'Bearer invalid-token' },
      })

      expect(res.status).toBe(401)
    })
  })
})
