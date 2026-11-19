import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The database is one SQLite file. `node:sqlite` is built into Node, so there is no
 * native addon to compile — which matters here because the npm registry is
 * unreachable and a prebuilt binary could not be fetched.
 *
 * Everything the original enforced through Python is preserved: WAL so a reader
 * never blocks the writer, foreign keys on (SQLite defaults them *off*, and the
 * schema's cascades depend on them), a busy timeout for concurrent writers, and a
 * transaction wrapper that takes `BEGIN IMMEDIATE` and retries.
 */

/**
 * Where the database lives.
 *
 * Resolved from *this file's* location, not the working directory. The distinction
 * cost an hour: `tools/dev.sh` runs the API from the repo root, so `cwd()` pointed at
 * `zainpreneur/db/portfolio.db` while the seed — run from `server/` — wrote
 * `zainpreneur/server/db/portfolio.db`. Two files, one empty, and an app that reported
 * an empty register with no error anywhere.
 *
 * `ZP_DB` still wins when it is set, for tests and for pointing at a scratch file.
 */
const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_DB = resolve(SERVER_ROOT, "db/portfolio.db");

let handle: DatabaseSync | null = null;
let path: string | null = null;
let txDepth = 0;

const BUSY_TIMEOUT_MS = 8_000;
const MAX_BEGIN_ATTEMPTS = 6;

export function dbPath(): string {
  return path ?? (process.env.ZP_DB ? resolve(process.env.ZP_DB) : DEFAULT_DB);
}

/** Open (once) and return the connection. Safe to call repeatedly. */
export function conn(): DatabaseSync {
  if (handle) return handle;

  const file = dbPath();
  mkdirSync(dirname(file), { recursive: true });
  path = file;

  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  db.exec("PRAGMA synchronous = NORMAL");

  handle = db;
  return db;
}

export function closeDb(): void {
  if (!handle) return;
  handle.close();
  handle = null;
  txDepth = 0;
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                      */
/* -------------------------------------------------------------------------- */

type Params = Array<string | number | bigint | null | Uint8Array>;

export function all<T = Record<string, unknown>>(sql: string, params: Params = []): T[] {
  return conn().prepare(sql).all(...params) as T[];
}

export function one<T = Record<string, unknown>>(sql: string, params: Params = []): T | null {
  const row = conn().prepare(sql).get(...params);
  return (row as T) ?? null;
}

export function scalar(sql: string, params: Params = []): number | string | bigint | null {
  const row = conn().prepare(sql).get(...params) as Record<string, unknown> | undefined;
  if (!row) return null;
  const first = Object.values(row)[0];
  return (first ?? null) as number | string | bigint | null;
}

export function num(sql: string, params: Params = []): number {
  const v = scalar(sql, params);
  return v === null ? 0 : Number(v);
}

/**
 * Execute a statement. Returns the driver result so callers that insert can read
 * `lastInsertRowid` — the original Python returned the cursor for the same reason.
 */
export function run(sql: string, params: Params = []) {
  return conn().prepare(sql).run(...params);
}

/* -------------------------------------------------------------------------- */
/* Transactions                                                                 */
/* -------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run `fn` inside a transaction, taking the write lock up front.
 *
 * `BEGIN IMMEDIATE` rather than the default deferred begin, because every write
 * path here is read-validate-write and a deferred begin would take the lock later,
 * widening the window in which two writers both read stale facts and then both
 * write.
 *
 * Nesting is refused rather than silently flattened. The original raised here too,
 * and it is right: a nested "transaction" that is really just a statement would
 * hide the fact that an inner failure rolls back only part of an outer unit.
 */
export async function tx<T>(fn: (db: DatabaseSync) => Promise<T> | T): Promise<T> {
  const db = conn();
  if (txDepth > 0) {
    throw new Error("A transaction cannot start inside another transaction");
  }

  let begun = false;
  for (let attempt = 0; attempt < MAX_BEGIN_ATTEMPTS; attempt++) {
    try {
      db.exec("BEGIN IMMEDIATE");
      begun = true;
      break;
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      if (!/busy|locked/i.test(message) || attempt === MAX_BEGIN_ATTEMPTS - 1) throw err;
      await sleep(150 * (attempt + 1));
    }
  }
  if (!begun) throw new Error("Could not begin a transaction");

  txDepth++;
  try {
    const result = await fn(db);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* the transaction was already rolled back by SQLite */
    }
    throw err;
  } finally {
    txDepth--;
  }
}

/* -------------------------------------------------------------------------- */
/* Time                                                                         */
/* -------------------------------------------------------------------------- */

/** ISO date, `YYYY-MM-DD`. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO timestamp, seconds precision. */
export function now(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

/* -------------------------------------------------------------------------- */
/* Schema level                                                                 */
/* -------------------------------------------------------------------------- */

export function schemaVersion(): number {
  return num("PRAGMA user_version");
}

export function setSchemaVersion(version: number): void {
  conn().exec(`PRAGMA user_version = ${version}`);
}