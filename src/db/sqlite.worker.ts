/**
 * SQLite WASM worker — owns the database connection off the main thread.
 *
 * Primary backend: OPFS synchronous-access-handle pool VFS
 * (`opfs-sahpool`), which persists `zainpreneur.sqlite3` across sessions and
 * service-worker updates. Requires a secure context + COOP/COEP headers.
 *
 * Fallback backend: in-memory database re-seeded on boot, with every
 * mutation journaled to the main thread (persisted in localStorage) and
 * replayed on the next boot, so no write is silently lost.
 */
import sqlite3InitModule, {
  type Database,
  type Sqlite3Static,
  type SqlValue,
} from '@sqlite.org/sqlite-wasm'

import { DB_FILENAME, SCHEMA_DDL, SCHEMA_VERSION } from './schema'
import { buildSeedStatements } from './seed'
import { v3MigrationPlan } from './migrate'
import { buildEnterpriseSeedStatements } from '../enterprise/seed'

export type SqlParams = SqlValue[] | Record<string, SqlValue>

export interface BatchStatement {
  sql: string
  params?: SqlParams
}

export type WorkerBackend = 'opfs' | 'memory'

type WorkerRequest =
  | { id: number; op: 'status' }
  | { id: number; op: 'query'; sql: string; params?: SqlParams }
  | { id: number; op: 'run'; sql: string; params?: SqlParams }
  | { id: number; op: 'batch'; stmts: BatchStatement[] }
  | { id: number; op: 'export' }
  | { id: number; op: 'reset' }

interface WorkerSuccess {
  id: number
  ok: true
  rows?: Record<string, SqlValue>[]
  changes?: number
  backend?: WorkerBackend
  seeded?: boolean
  counts?: Record<string, number>
  buffer?: ArrayBuffer
}

interface WorkerFailure {
  id: number
  ok: false
  error: string
}

type WorkerResponse = WorkerSuccess | WorkerFailure

/** Unsolicited message pushing the mutation journal to the main thread. */
export interface JournalPush {
  type: 'journal'
  entries: BatchStatement[]
}

/** Unsolicited boot message so the main thread can replay a saved journal. */
export interface WorkerReady {
  type: 'worker-ready'
  backend: WorkerBackend
}

let sqlite3: Sqlite3Static | null = null
let db: Database | null = null
let backend: WorkerBackend = 'memory'
/** Mutations since boot — replayed after reseed when on the memory backend. */
let journal: BatchStatement[] = []
const JOURNAL_CAP = 10000

function getDb(): Database {
  if (!db) throw new Error('Database is not initialized yet')
  return db
}

function postResponse(res: WorkerResponse, transfer?: Transferable[]): void {
  self.postMessage(res, transfer ?? [])
}

function recordJournal(entry: BatchStatement): void {
  if (backend !== 'memory') return
  journal.push(entry)
  if (journal.length > JOURNAL_CAP) journal = journal.slice(-JOURNAL_CAP)
  const push: JournalPush = { type: 'journal', entries: journal }
  self.postMessage(push)
}

function runBatch(stmts: BatchStatement[]): number {
  const database = getDb()
  let changes = 0
  database.exec('BEGIN IMMEDIATE')
  try {
    for (const stmt of stmts) {
      database.exec({ sql: stmt.sql, bind: stmt.params ?? [] })
      changes += database.changes()
    }
    database.exec('COMMIT')
  } catch (err) {
    try {
      database.exec('ROLLBACK')
    } catch {
      // already failing — surface the original error below
    }
    throw err
  }
  return changes
}

function tableCounts(): Record<string, number> {
  const rows = getDb().selectObjects(
    `SELECT 'businesses' AS t, COUNT(*) AS n FROM businesses
     UNION ALL SELECT 'branches', COUNT(*) FROM branches
     UNION ALL SELECT 'owners', COUNT(*) FROM owners
     UNION ALL SELECT 'cap_table', COUNT(*) FROM cap_table
     UNION ALL SELECT 'team_members', COUNT(*) FROM team_members
     UNION ALL SELECT 'assets', COUNT(*) FROM assets
     UNION ALL SELECT 'asset_deployments', COUNT(*) FROM asset_deployments`,
  )
  const counts: Record<string, number> = {}
  for (const row of rows) counts[String(row['t'])] = Number(row['n'])
  return counts
}

/**
 * v3 migration, idempotent and journal-free (runs before any replay).
 * Statements come from the pure `v3MigrationPlan` planner (unit-tested
 * against real SQLite); this wrapper only executes them transactionally.
 */
function migrateToV3(database: Database): void {
  const meta = database.selectObjects("SELECT value FROM schema_meta WHERE key = 'schema_version'")
  if (Number(meta[0]?.['value'] ?? 1) >= 3) return

  const assetDdl = database.selectObjects(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'assets'",
  )
  const plan = v3MigrationPlan({
    assetTableSql: assetDdl.length > 0 ? String(assetDdl[0]?.['sql'] ?? '') : null,
    teamColumns: database.selectObjects('PRAGMA table_info(team_members)').map((row) => String(row['name'])),
    vendorColumns: database.selectObjects('PRAGMA table_info(vendors)').map((row) => String(row['name'])),
  })

  database.exec('BEGIN IMMEDIATE')
  try {
    for (const stmt of plan) {
      database.exec({ sql: stmt.sql, bind: stmt.params ?? [] })
    }
    database.exec('COMMIT')
  } catch (err) {
    try {
      database.exec('ROLLBACK')
    } catch {
      // already failing — surface the original error below
    }
    try {
      database.exec('PRAGMA foreign_keys = ON')
    } catch {
      // best-effort restore
    }
    throw err
  }

  const violations = database.selectObjects('PRAGMA foreign_key_check')
  if (violations.length > 0) {
    console.warn('[sqlite] v3 migration left FK violations', violations)
  }
}

async function initDatabase(): Promise<{ backend: WorkerBackend; seeded: boolean }> {
  sqlite3 = await sqlite3InitModule()

  // OPFS SAH-pool VFS needs a worker thread plus cross-origin isolation.
  if (self.crossOriginIsolated && 'opfs' in sqlite3) {
    try {
      const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'zainpreneur-opfs-pool' })
      db = new pool.OpfsSAHPoolDb(`/${DB_FILENAME}`)
      backend = 'opfs'
    } catch (err) {
      console.warn('[sqlite] OPFS backend unavailable, using in-memory fallback', err)
      backend = 'memory'
    }
  }

  if (!db && sqlite3) {
    db = new sqlite3.oo1.DB(':memory:')
    backend = 'memory'
  }

  const database = getDb()
  database.exec('PRAGMA journal_mode = WAL')
  database.exec('PRAGMA foreign_keys = ON')
  database.exec('PRAGMA synchronous = NORMAL')
  database.exec(SCHEMA_DDL)

  const existing = database.selectObjects('SELECT COUNT(*) AS n FROM businesses')
  const seeded = Number(existing[0]?.['n'] ?? 0) === 0
  if (seeded) {
    runBatch(buildSeedStatements())
  }
  // Enterprise module tables seed independently so v1 databases migrate
  // forward without a wipe: DDL above already created any missing tables.
  const vendors = database.selectObjects('SELECT COUNT(*) AS n FROM vendors')
  if (Number(vendors[0]?.['n'] ?? 0) === 0) {
    runBatch(buildEnterpriseSeedStatements())
  }
  migrateToV3(database)
  database.exec({
    sql: 'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)',
    bind: ['schema_version', String(SCHEMA_VERSION)],
  })

  const ready: WorkerReady = { type: 'worker-ready', backend }
  self.postMessage(ready)
  return { backend, seeded }
}

function handleRequest(req: WorkerRequest): void {
  try {
    switch (req.op) {
      case 'status': {
        postResponse({ id: req.id, ok: true, backend, counts: tableCounts() })
        break
      }
      case 'query': {
        const rows = getDb().selectObjects(req.sql, req.params ?? [])
        postResponse({ id: req.id, ok: true, rows })
        break
      }
      case 'run': {
        getDb().exec({ sql: req.sql, bind: req.params ?? [] })
        const changes = getDb().changes()
        recordJournal({ sql: req.sql, params: req.params })
        postResponse({ id: req.id, ok: true, changes })
        break
      }
      case 'batch': {
        const changes = runBatch(req.stmts)
        for (const stmt of req.stmts) recordJournal(stmt)
        postResponse({ id: req.id, ok: true, changes })
        break
      }
      case 'export': {
        if (!sqlite3) throw new Error('SQLite is not initialized')
        const bytes = sqlite3.capi.sqlite3_js_db_export(getDb())
        const copy = bytes.slice().buffer as ArrayBuffer
        postResponse({ id: req.id, ok: true, buffer: copy }, [copy])
        break
      }
      case 'reset': {
        const database = getDb()
        database.exec('PRAGMA foreign_keys = OFF')
        database.exec(
          'DROP TABLE IF EXISTS outbox; DROP TABLE IF EXISTS invoices; DROP TABLE IF EXISTS ledger_lines; DROP TABLE IF EXISTS ledger_entries; DROP TABLE IF EXISTS ledger_accounts; DROP TABLE IF EXISTS timesheets; DROP TABLE IF EXISTS hr_contracts; DROP TABLE IF EXISTS po_items; DROP TABLE IF EXISTS purchase_orders; DROP TABLE IF EXISTS vendors; DROP TABLE IF EXISTS asset_deployments; DROP TABLE IF EXISTS assets; DROP TABLE IF EXISTS team_members; DROP TABLE IF EXISTS cap_table; DROP TABLE IF EXISTS owners; DROP TABLE IF EXISTS branches; DROP TABLE IF EXISTS businesses; DROP TABLE IF EXISTS schema_meta;',
        )
        database.exec('PRAGMA foreign_keys = ON')
        database.exec(SCHEMA_DDL)
        runBatch(buildSeedStatements())
        runBatch(buildEnterpriseSeedStatements())
        journal = []
        if (backend === 'memory') {
          const push: JournalPush = { type: 'journal', entries: journal }
          self.postMessage(push)
        }
        postResponse({ id: req.id, ok: true, counts: tableCounts() })
        break
      }
    }
  } catch (err) {
    const failure: WorkerFailure = {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
    postResponse(failure)
  }
}

let bootPromise: Promise<{ backend: WorkerBackend; seeded: boolean }> | null = null

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  if (!bootPromise) bootPromise = initDatabase()
  const req = event.data
  void bootPromise
    .then(() => handleRequest(req))
    .catch((err: unknown) => {
      const failure: WorkerFailure = {
        id: req.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
      postResponse(failure)
    })
})
