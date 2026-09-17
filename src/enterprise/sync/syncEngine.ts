/**
 * Offline-first synchronization engine.
 *
 * - Listens for connectivity changes and syncs automatically on `online`.
 * - Replays outbox rows through a `RemotePort` (stub upstream by default).
 * - Client-generated UUIDs act as idempotency keys; attempts cap at
 *   MAX_ATTEMPTS before a row is parked as `failed` (poison pills never
 *   block the queue).
 * - Broadcasts completion on `BroadcastChannel('zp-sync')` so other tabs
 *   refresh their counts.
 */
import { claimBatch, markAttempted, markSent, MAX_ATTEMPTS, pendingCount } from './outbox'

export interface SyncEntry {
  id: string
  kind: string
  payload: Record<string, unknown>
}

export interface RemotePort {
  readonly name: string
  apply: (entry: SyncEntry) => Promise<void>
}

/** Default upstream: in-memory acknowledgement (offline-capable). */
export class InMemoryRemotePort implements RemotePort {
  readonly name = 'in-memory'
  readonly applied: string[] = []
  async apply(entry: SyncEntry): Promise<void> {
    this.applied.push(entry.id)
  }
}

export interface SyncResult {
  attempted: number
  sent: number
  failed: number
  pending: number
}

type SyncListener = (result: SyncResult) => void

const CHANNEL_NAME = 'zp-sync'
let channel: BroadcastChannel | null = null
let running = false
let syncing = false
const listeners = new Set<SyncListener>()

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'synced') {
        void pendingCount()
          .then((pending) => {
            for (const listener of listeners) {
              listener({ attempted: 0, sent: 0, failed: 0, pending })
            }
          })
          .catch(() => {})
      }
    }
  }
  return channel
}

function broadcastSynced(): void {
  try {
    getChannel()?.postMessage({ type: 'synced', at: new Date().toISOString() })
  } catch {
    // Broadcast is best-effort.
  }
}

export function onSync(listener: SyncListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

export async function syncNow(port: RemotePort = new InMemoryRemotePort()): Promise<SyncResult> {
  if (syncing) {
    const pending = await pendingCount().catch(() => 0)
    return { attempted: 0, sent: 0, failed: 0, pending }
  }
  syncing = true
  try {
    const batch = await claimBatch()
    let sent = 0
    let failed = 0
    for (const row of batch) {
      let payload: Record<string, unknown> = {}
      try {
        payload = JSON.parse(row.payload_json) as Record<string, unknown>
      } catch {
        await markAttempted(row.id, 'unparseable payload', true)
        failed += 1
        continue
      }
      try {
        await port.apply({ id: row.id, kind: row.kind, payload })
        await markSent([row.id])
        sent += 1
      } catch (err) {
        const attempts = row.attempts + 1
        const message = err instanceof Error ? err.message : String(err)
        await markAttempted(row.id, message, attempts >= MAX_ATTEMPTS)
        if (attempts >= MAX_ATTEMPTS) failed += 1
      }
    }
    const pending = await pendingCount()
    const result: SyncResult = { attempted: batch.length, sent, failed, pending }
    for (const listener of listeners) listener(result)
    if (sent > 0) broadcastSynced()
    return result
  } finally {
    syncing = false
  }
}

function handleOnline(): void {
  void syncNow().catch(() => {})
}

export function startSyncEngine(): () => void {
  if (running) return () => stopSyncEngine()
  running = true
  getChannel()
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    if (navigator.onLine) void syncNow().catch(() => {})
  }
  return () => stopSyncEngine()
}

export function stopSyncEngine(): void {
  running = false
  if (typeof window !== 'undefined') window.removeEventListener('online', handleOnline)
}
