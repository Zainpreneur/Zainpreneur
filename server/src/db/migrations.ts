import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { all, closeDb, conn, now, num, one, run, schemaVersion, setSchemaVersion } from "./client.js";

/**
 * Schema creation and migration.
 *
 * `schema.sql` is a byte-for-byte copy of the original's, and that is deliberate.
 * Two of its indexes are load-bearing and non-obvious:
 *
 *   ux_bs_one_current  ON business_stakeholders(business_id, stakeholder_id)
 *                      WHERE exited_on IS NULL
 *   ux_brs_one_current  (the same, for branches)
 *
 * These allow at most *one open* row per holder while permitting any number of
 * closed ones — which is what makes the cap table a history rather than a
 * balance. A sold-then-rebought stake is two rows, one closed and one open, and
 * the database refuses to let the second open row exist.
 *
 * The `COLLATE NOCASE` unique indexes do case-insensitive name uniqueness. On
 * Postgres those would need `citext`; on SQLite they are just an index collation.
 *
 * Every statement in the file is `IF NOT EXISTS`, so applying it is idempotent and
 * re-running it on every boot — as the original does — costs nothing.
 */

export const SCHEMA_VERSION = 1;

const here = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = resolve(here, "schema.sql");

/**
 * Columns added after the original schema was written. SQLite has no
 * `ADD COLUMN IF NOT EXISTS`, so each is guarded by inspecting the table first.
 *
 * `dividends` gains three: a named recipient, a kind, and whether it has been paid.
 * `stakeholder_id` and `kind` are needed because a distribution can be either a
 * business-wide declaration or a payment to one holder. `paid_on` is needed
 * because "declared" and "paid" are different facts — a dividend declared in March
 * and never paid is not revenue received.
 */
const EXTRA_COLUMNS: Record<string, Array<[string, string]>> = {
  dividends: [
    ["stakeholder_id", "INTEGER REFERENCES stakeholders(id) ON DELETE SET NULL"],
    ["kind", "TEXT NOT NULL DEFAULT 'dividend'"],
    ["basis", "TEXT NOT NULL DEFAULT 'declared'"],
    // D5: the entitlement boundary. `record_date` is the cap table on the
    // declaration date; `contractual` is an explicit override for the case a
    // shareholders' agreement covers. It is a column on the declaration rather
    // than a global setting, because a global switch would change what every past
    // dividend meant.
    ["entitlement_mode", "TEXT NOT NULL DEFAULT 'record_date'"],
    ["contractual_basis", "TEXT NOT NULL DEFAULT 'explicit'"],
    // Declared and paid are different facts. A dividend declared in March and never
    // paid is not cash received, and the original had no column able to say so.
    ["paid_on", "TEXT"],
    ["paid_amount", "REAL"],
    ["settlement_method", "TEXT"],
    ["settlement_reference", "TEXT NOT NULL DEFAULT ''"],
    ["period_key", "TEXT NOT NULL DEFAULT ''"],
  ],
  profit_cycles: [
    // Net is `gross - expenses - retained`, worked out on read and never stored.
    // The original distributed the *full* net with no reserve, so a venture that
    // retained a share of profit recorded a dividend it never paid.
    ["retained", "REAL NOT NULL DEFAULT 0"],
    // A canonical `YYYY-MM` alongside the free-text label, so "Oct 2026" and
    // "2026-10" cannot both exist for the same month.
    ["period_key", "TEXT NOT NULL DEFAULT ''"],
    ["frequency", "TEXT NOT NULL DEFAULT 'monthly'"],
  ],
  valuations: [
    ["method", "TEXT NOT NULL DEFAULT ''"],
    ["source", "TEXT NOT NULL DEFAULT ''"],
    ["audited", "INTEGER NOT NULL DEFAULT 0"],
  ],
};

function tableExists(table: string): boolean {
  return (
    num("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", [table]) > 0
  );
}

function columnsOf(table: string): Set<string> {
  if (!tableExists(table)) return new Set();
  return new Set(all<{ name: string }>(`PRAGMA table_info(${table})`).map((r) => r.name));
}

function addMissingColumns(): void {
  for (const [table, columns] of Object.entries(EXTRA_COLUMNS)) {
    const present = columnsOf(table);
    for (const [column, decl] of columns) {
      if (present.has(column)) continue;
      // SQLite refuses a non-constant default in ADD COLUMN; none are needed here.
      run(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
    }
  }
}

/**
 * Create anything missing. Safe to call on every boot.
 *
 * Every statement in `schema.sql` is `IF NOT EXISTS`, so applying it twice costs
 * nothing — which is what makes running it on every boot safe rather than
 * merely convenient.
 */
export function initDb(): { version: number; created: number } {
  conn();
  const before = tableCount();
  // `exec`, not `prepare`/`run`: schema.sql is a script of many statements and
  // `prepare` binds exactly one. `exec` also wraps them, so a failure part-way
  // leaves nothing half-created.
  conn().exec(readFileSync(SCHEMA_PATH, "utf8"));
  addMissingColumns();
  setSchemaVersion(SCHEMA_VERSION);
  return { version: schemaVersion(), created: tableCount() - before };
}

function tableCount(): number {
  return num(
    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
}

/**
 * The relationship vocabulary is created correctly in `schema.sql` itself:
 * `client` · `equity` · `fully_owned`, with `served` as a separate recorded fact.
 *
 * There is deliberately no migration that rebuilds `businesses` to convert a legacy
 * `client_equity` value. Every database here is created fresh — the old seed data
 * was demo data and is being regenerated — so there is nothing to convert, and
 * rebuilding a table to change a CHECK constraint is the right tool when
 * migrating real rows and the wrong one when there are none.
 */

/** Bring a database up to date. Called on every boot. */
export function migrate(): { version: number; created: number } {
  const result = initDb();
  if (!tableExists("settings")) throw new Error("schema.sql did not create the settings table");
  if (num("SELECT COUNT(*) FROM settings WHERE key='schema_boot'") === 0) {
    run("INSERT INTO settings (key, value) VALUES ('schema_boot', ?)", [now()]);
  }
  return result;
}