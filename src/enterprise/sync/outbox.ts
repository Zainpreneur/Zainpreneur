/**
 * Durable offline outbox. Mutations performed while offline are stored here
 * and replayed by the sync engine with idempotency keys (client UUIDs).
 */
import { dbService } from '../../db/dbService'
import type { OutboxRow } from '../../db/schema'
import { enterpriseId, todayIso } from '../ids'

export const MAX_ATTEMPTS = 5

export async function enqueueOutbox(kind: string, payload: Record<string, unknown>): Promise<{ id: string }> {
  const id = enterpriseId('ob')
  await dbService.run(
    'INSERT INTO outbox (id, created_at, kind, payload_json, attempts, last_error, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, todayIso(), kind, JSON.stringify({ ...payload, _idempotencyKey: id }), 0, null, 'pending'],
  )
  return { id }
}

export async function claimBatch(limit = 50): Promise<OutboxRow[]> {
  return dbService.query<OutboxRow>(
    'SELECT * FROM outbox WHERE status = ? ORDER BY created_at LIMIT ?',
    ['pending', limit],
  )
}

export async function markSent(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await dbService.batch(
    ids.map((id) => ({ sql: "UPDATE outbox SET status = 'sent' WHERE id = ?", params: [id] })),
  )
}

export async function markAttempted(id: string, error: string | null, failed: boolean): Promise<void> {
  await dbService.run(
    "UPDATE outbox SET attempts = attempts + 1, last_error = ?, status = ? WHERE id = ?",
    [error, failed ? 'failed' : 'pending', id],
  )
}

export async function pendingCount(): Promise<number> {
  const rows = await dbService.query<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'")
  return rows[0]?.n ?? 0
}

export async function failedEntries(): Promise<OutboxRow[]> {
  return dbService.query<OutboxRow>("SELECT * FROM outbox WHERE status = 'failed' ORDER BY created_at DESC LIMIT 50")
}
