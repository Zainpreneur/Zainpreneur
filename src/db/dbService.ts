/**
 * Main-thread gateway to the SQLite worker.
 *
 * Single Worker instance, promise-based RPC with timeouts, boot handshake
 * (including journal replay for the in-memory fallback backend), and
 * journal persistence to localStorage.
 */
import type {
  BatchStatement,
  JournalPush,
  SqlParams,
  WorkerBackend,
  WorkerReady,
} from './sqlite.worker'
import type { SqlStatement } from './schema'

const JOURNAL_KEY = 'zainpreneur:sqlite:journal:v1'
const RPC_TIMEOUT_MS = 30000
const JOURNAL_CAP = 10000

export type DbStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface DbReadyInfo {
  backend: WorkerBackend
}

interface Pending {
  resolve: (value: WorkerResult) => void
  reject: (err: Error) => void
  timer: number
}

export interface WorkerResult {
  rows?: Record<string, string | number | bigint | null | Uint8Array>[]
  changes?: number
  backend?: WorkerBackend
  seeded?: boolean
  counts?: Record<string, number>
  buffer?: ArrayBuffer
}

interface RpcMessage {
  id: number
  ok: boolean
  error?: string
  rows?: WorkerResult['rows']
  changes?: number
  backend?: WorkerBackend
  seeded?: boolean
  counts?: Record<string, number>
  buffer?: ArrayBuffer
}

function readJournal(): BatchStatement[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as BatchStatement[]) : []
  } catch {
    return []
  }
}

function writeJournal(entries: BatchStatement[]): void {
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries.slice(-JOURNAL_CAP)))
  } catch {
    // Quota or privacy mode — journaling is best-effort.
  }
}

class DbService {
  private worker: Worker | null = null
  private seq = 0
  private pending = new Map<number, Pending>()
  private readyPromise: Promise<DbReadyInfo> | null = null
  private backend: WorkerBackend | null = null
  private listeners = new Set<(status: DbStatus) => void>()
  private status: DbStatus = 'idle'

  onStatus(listener: (status: DbStatus) => void): () => void {
    this.listeners.add(listener)
    listener(this.status)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setStatus(status: DbStatus): void {
    this.status = status
    for (const listener of this.listeners) listener(status)
  }

  getBackend(): WorkerBackend | null {
    return this.backend
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker(new URL('./sqlite.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent) => this.handleMessage(event.data)
    worker.onerror = (event: ErrorEvent) => {
      this.failAll(new Error(`SQLite worker error: ${event.message}`))
      this.setStatus('error')
    }
    this.worker = worker
    return worker
  }

  private failAll(err: Error): void {
    for (const [, pending] of this.pending) {
      window.clearTimeout(pending.timer)
      pending.reject(err)
    }
    this.pending.clear()
  }

  private handleMessage(data: RpcMessage | JournalPush | WorkerReady): void {
    if (typeof data === 'object' && data !== null && 'type' in data) {
      if (data.type === 'journal') writeJournal(data.entries)
      return
    }
    const msg = data as RpcMessage
    const pending = this.pending.get(msg.id)
    if (!pending) return
    this.pending.delete(msg.id)
    window.clearTimeout(pending.timer)
    if (msg.ok) {
      pending.resolve({
        rows: msg.rows,
        changes: msg.changes,
        backend: msg.backend,
        seeded: msg.seeded,
        counts: msg.counts,
        buffer: msg.buffer,
      })
    } else {
      pending.reject(new Error(msg.error ?? 'SQLite request failed'))
    }
  }

  private request(op: object): Promise<WorkerResult> {
    const worker = this.ensureWorker()
    const id = (this.seq += 1)
    return new Promise<WorkerResult>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('SQLite request timed out'))
      }, RPC_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      worker.postMessage({ ...op, id })
    })
  }

  /** Boot the worker, replaying the mutation journal on fallback backends. */
  ready(): Promise<DbReadyInfo> {
    if (!this.readyPromise) {
      this.setStatus('loading')
      this.readyPromise = (async (): Promise<DbReadyInfo> => {
        this.ensureWorker()
        const boot = await this.waitForBoot()
        this.backend = boot
        if (boot === 'memory') {
          const journal = readJournal()
          if (journal.length > 0) {
            try {
              await this.sendBatch(journal)
            } catch (err) {
              console.warn('[sqlite] journal replay failed, starting from seed', err)
              writeJournal([])
            }
          }
        }
        this.setStatus('ready')
        return { backend: boot }
      })().catch((err: unknown) => {
        this.readyPromise = null
        this.setStatus('error')
        throw err instanceof Error ? err : new Error(String(err))
      })
    }
    return this.readyPromise
  }

  /**
   * Resolve once the worker posts its boot handshake. The listener is
   * attached before the ping that triggers worker-side initialization,
   * so the handshake can never be missed.
   */
  private waitForBoot(): Promise<WorkerBackend> {
    return new Promise<WorkerBackend>((resolve, reject) => {
      const worker = this.ensureWorker()
      const timer = window.setTimeout(() => {
        worker.removeEventListener('message', onBoot)
        reject(new Error('SQLite worker boot timed out'))
      }, RPC_TIMEOUT_MS)
      const onBoot = (event: MessageEvent): void => {
        const data = event.data as Partial<WorkerReady>
        if (data && data.type === 'worker-ready' && data.backend) {
          window.clearTimeout(timer)
          worker.removeEventListener('message', onBoot)
          resolve(data.backend)
        }
      }
      worker.addEventListener('message', onBoot)
      // Ping triggers worker-side init; its response resolves via the RPC map.
      void this.request({ op: 'status' }).catch(() => {})
    })
  }

  async query<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T[]> {
    await this.ready()
    const res = await this.request({ op: 'query', sql, params })
    return (res.rows ?? []) as T[]
  }

  async run(sql: string, params?: SqlParams): Promise<number> {
    await this.ready()
    const res = await this.request({ op: 'run', sql, params })
    return res.changes ?? 0
  }

  /** Execute statements atomically (single transaction). Accepts seed/journal statements. */
  async batch(stmts: SqlStatement[] | BatchStatement[]): Promise<number> {
    await this.ready()
    return this.sendBatch(stmts)
  }

  /**
   * Batch without the readiness gate. Used ONLY by `ready()` itself during
   * journal replay — routing replay through `batch()` would await the very
   * promise being constructed and deadlock the reboot path.
   */
  private async sendBatch(stmts: SqlStatement[] | BatchStatement[]): Promise<number> {
    const res = await this.request({ op: 'batch', stmts })
    return res.changes ?? 0
  }

  async counts(): Promise<Record<string, number>> {
    await this.ready()
    const res = await this.request({ op: 'status' })
    return res.counts ?? {}
  }

  async exportDatabase(): Promise<ArrayBuffer> {
    await this.ready()
    const res = await this.request({ op: 'export' })
    if (!res.buffer) throw new Error('Database export returned no data')
    return res.buffer
  }

  async reset(): Promise<Record<string, number>> {
    await this.ready()
    const res = await this.request({ op: 'reset' })
    return res.counts ?? {}
  }

  terminate(): void {
    this.failAll(new Error('SQLite worker terminated'))
    this.worker?.terminate()
    this.worker = null
    this.readyPromise = null
    this.backend = null
    this.setStatus('idle')
  }
}

export const dbService = new DbService()
