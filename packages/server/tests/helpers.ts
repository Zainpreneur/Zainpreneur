import { createApp } from '../src/app'

export function createTestApp() {
  return createApp()
}

export async function registerUser(
  app: ReturnType<typeof createApp>,
  { email, password, name }: { email: string; password: string; name: string },
) {
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
  const body = await res.json() as any
  return { status: res.status, token: body.token, user: body.user }
}

export async function loginUser(
  app: ReturnType<typeof createApp>,
  { email, password }: { email: string; password: string },
) {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json() as any
  return { status: res.status, token: body.token, user: body.user }
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}
