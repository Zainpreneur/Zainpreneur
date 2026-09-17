import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url';
import { MIGRATE_JSON, NODE_WASM } from './paths.mjs';

const init = (await import(pathToFileURL(NODE_WASM).href)).default;
const raw = readFileSync(MIGRATE_JSON, 'utf8').replace(/^\uFEFF/, '')
const { legacyPlan, currentPlan } = JSON.parse(raw)
const fail = (msg) => { console.error('FAIL:', msg); process.exitCode = 1 }
const sqlite3 = await init()

// Planner shape assertions (tests the shipped planner logic)
const legacySql = legacyPlan.map((s) => s.sql).join('\n')
const currentSql = currentPlan.map((s) => s.sql).join('\n')
if (!legacySql.includes('RENAME TO assets_migrate_backup')) fail('legacy plan skips rebuild')
else console.log('planner: legacy state triggers rebuild')
if (currentSql.includes('RENAME TO')) fail('current plan rebuilds unnecessarily')
else console.log('planner: current state skips rebuild')
if (currentSql.includes('ADD COLUMN')) fail('current plan re-adds columns')
else console.log('planner: current state skips ADD COLUMN')

// Execute legacy plan against a simulated v2 database
const db = new sqlite3.oo1.DB(':memory:')
db.exec('PRAGMA foreign_keys = ON')
db.exec(`CREATE TABLE team_members (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, engagement_type TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', rate_or_terms TEXT)`)
db.exec(`CREATE TABLE vendors (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, tax_id TEXT, payment_terms TEXT DEFAULT 'net-30', rating REAL, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL)`)
db.exec(`CREATE TABLE assets (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, asset_owner TEXT NOT NULL DEFAULT 'Zainpreneur', serial_number TEXT, purchase_value REAL, status TEXT)`)
db.exec({ sql: "INSERT INTO assets (id,name,category,asset_owner,serial_number,purchase_value,status) VALUES ('as-old','Old Laptop','hardware','Someone Else','SN-1',100000,'available')" })
db.exec({ sql: "INSERT INTO team_members (id,name,email,engagement_type,role) VALUES ('ag-odoo-partner','Odoo','c@o.pk','agency_partner','Partner')" })
db.exec({ sql: "INSERT INTO vendors (id,name,created_at) VALUES ('ven-odoo-partner','Odoo','2026-01-01')" })

db.exec('BEGIN IMMEDIATE')
try {
  // Execute every planned statement exactly as the worker does.
  for (const s of legacyPlan) db.exec({ sql: s.sql, bind: s.params ?? [] })
  db.exec('COMMIT')
} catch (e) { try { db.exec('ROLLBACK') } catch {} fail(`plan execution: ${e.message}`) }

const owner = db.selectObjects("SELECT asset_owner AS o FROM assets WHERE id='as-old'")[0]?.o
if (owner !== 'Zainpreneur') fail(`legacy owner not normalized: ${owner}`)
else console.log('migration: legacy row preserved + owner normalized')
const check = db.selectObjects("SELECT sql FROM sqlite_master WHERE type='table' AND name='assets'")[0]?.sql ?? ''
if (!String(check).includes("asset_owner = 'Zainpreneur'")) fail('CHECK missing after rebuild')
else console.log('migration: CHECK enforced on rebuilt table')
const link = db.selectObjects("SELECT vendor_id AS v FROM team_members WHERE id='ag-odoo-partner'")[0]?.v
const back = db.selectObjects("SELECT team_member_id AS t FROM vendors WHERE id='ven-odoo-partner'")[0]?.t
if (link !== 'ven-odoo-partner' || back !== 'ag-odoo-partner') fail('backfill links')
else console.log('migration: vendor-agency backfill linked')
try { db.exec({ sql: "INSERT INTO assets (id,name,category,asset_owner,status) VALUES ('x','x','other','Rogue','available')" }); fail('new CHECK not enforced') }
catch { console.log('migration: new CHECK rejects drifted owners') }
const fk = db.selectObjects('PRAGMA foreign_key_check')
if (fk.length > 0) fail(`FK violations: ${JSON.stringify(fk)}`)
else console.log('migration: FK check clean')

// Idempotency: current-state plan executes cleanly a second time
db.exec('BEGIN IMMEDIATE')
try {
  for (const s of currentPlan) db.exec({ sql: s.sql, bind: s.params ?? [] })
  db.exec('COMMIT')
  console.log('migration: rerun is a clean no-op')
} catch (e) { try { db.exec('ROLLBACK') } catch {} fail(`rerun: ${e.message}`) }

if (!process.exitCode) console.log('ALL MIGRATION CHECKS PASSED')
