import { randomBytes } from 'node:crypto'

export function generateId(prefix?: string): string {
  const id = randomBytes(12).toString('base64url').replace(/[_-]/g, '').slice(0, 20)
  return prefix ? `${prefix}_${id}` : id
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
