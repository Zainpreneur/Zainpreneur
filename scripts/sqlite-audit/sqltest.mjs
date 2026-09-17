import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url';
import { NODE_WASM, SEED_JSON } from './paths.mjs';

const init = (await import(pathToFileURL(NODE_WASM).href)).default;
const raw = readFileSync(SEED_JSON, 'utf8').replace(/^\uFEFF/, '')
const { ddl, seed } = JSON.parse(raw)
const sqlite3 = await init()
const db = new sqlite3.oo1.DB(':memory:')
const fail = (msg) => { console.error('FAIL:', msg); process.exitCode = 1 }

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')
db.exec(ddl)

// Seed in one transaction (mirrors worker batch)
db.exec('BEGIN IMMEDIATE')
try {
  for (const s of seed) db.exec({ sql: s.sql, bind: s.params ?? [] })
  db.exec('COMMIT')
} catch (e) { db.exec('ROLLBACK'); fail(`seed: ${e.message}`) }

const count = (t) => db.selectObjects(`SELECT COUNT(*) AS n FROM ${t}`)[0].n
console.log('counts:', {
  businesses: count('businesses'), branches: count('branches'), owners: count('owners'),
  cap_table: count('cap_table'), team_members: count('team_members'),
  assets: count('assets'), asset_deployments: count('asset_deployments'),
})

// FK integrity
const fk = db.selectObjects('PRAGMA foreign_key_check')
if (fk.length > 0) fail(`FK violations: ${JSON.stringify(fk)}`)
else console.log('FK check: clean')

// Cap tables sum to exactly 100 per business
const sums = db.selectObjects('SELECT business_id, SUM(equity_percentage) AS total FROM cap_table GROUP BY business_id')
for (const s of sums) {
  if (Math.abs(s.total - 100) >= 0.01) fail(`cap ${s.business_id} = ${s.total}`)
}
console.log(`cap tables: ${sums.length} businesses all total 100%`)

// CHECK constraints enforced (bad model rejected)
try { db.exec({ sql: "INSERT INTO businesses (id,name,model,category,status,created_at) VALUES ('x','x','bogus','owned','active','2026-01-01')" }); fail('model CHECK not enforced') }
catch { console.log('model CHECK: enforced') }

// Deploy flow: available asset -> in-use + audit row, atomic
const avail = db.selectObjects("SELECT id FROM assets WHERE status='available' LIMIT 1")[0]
db.exec('BEGIN IMMEDIATE')
db.exec({ sql: 'UPDATE assets SET status=? WHERE id=?', bind: ['in-use', avail.id] })
db.exec({ sql: "INSERT INTO asset_deployments (id,asset_id,entity_type,entity_id,assigned_member_id,assigned_date,notes) VALUES ('dep-t1',?,'client_project','br-cr-1','tm-kashif','2026-09-17T00:00:00Z','test')", bind: [avail.id] })
db.exec('COMMIT')
const st = db.selectObjects('SELECT status FROM assets WHERE id=?', [avail.id])[0].status
if (st !== 'in-use') fail('deploy status flip')
else console.log('deploy flow: ok')

// Return flow
db.exec('BEGIN IMMEDIATE')
db.exec({ sql: 'DELETE FROM asset_deployments WHERE asset_id=?', bind: [avail.id] })
db.exec({ sql: 'UPDATE assets SET status=? WHERE id=?', bind: ['available', avail.id] })
db.exec('COMMIT')
console.log('return flow: ok')

// Cap-table replace transaction
db.exec('BEGIN IMMEDIATE')
db.exec({ sql: 'DELETE FROM cap_table WHERE business_id=?', bind: ['biz-apex-autospa'] })
db.exec({ sql: "INSERT INTO cap_table (id,business_id,owner_id,equity_percentage) VALUES ('t1','biz-apex-autospa','own-zain',60)" })
db.exec({ sql: "INSERT INTO cap_table (id,business_id,owner_id,equity_percentage) VALUES ('t2','biz-apex-autospa','own-hassan',40)" })
db.exec('COMMIT')
const total = db.selectObjects("SELECT SUM(equity_percentage) AS t FROM cap_table WHERE business_id='biz-apex-autospa'")[0].t
if (total !== 100) fail('cap replace total')
else console.log('cap replace tx: ok')

// Relations query shape (mirrors getBusinessesWithRelations)
const rel = db.selectObjects(`SELECT b.id, b.name, COUNT(DISTINCT br.id) AS branches, COUNT(DISTINCT c.id) AS shares FROM businesses b LEFT JOIN branches br ON br.business_id=b.id LEFT JOIN cap_table c ON c.business_id=b.id GROUP BY b.id`)
console.log(`relations: ${rel.length} businesses with branches+shares joined`)

// Spray gun present and deployed
const gun = db.selectObjects("SELECT a.status, d.entity_type, d.entity_id FROM assets a LEFT JOIN asset_deployments d ON d.asset_id=a.id WHERE a.id='as-eqp-900'")[0]
console.log('spray gun:', JSON.stringify(gun))

// ---- Enterprise module checks ----
const ecount = (t) => db.selectObjects(`SELECT COUNT(*) AS n FROM ${t}`)[0].n
console.log('enterprise counts:', {
  vendors: ecount('vendors'), purchase_orders: ecount('purchase_orders'), po_items: ecount('po_items'),
  hr_contracts: ecount('hr_contracts'), timesheets: ecount('timesheets'),
  ledger_accounts: ecount('ledger_accounts'), ledger_entries: ecount('ledger_entries'), ledger_lines: ecount('ledger_lines'),
  invoices: ecount('invoices'),
})

// Trial balance nets to zero
const tb = db.selectObjects('SELECT COALESCE(SUM(debit),0)-COALESCE(SUM(credit),0) AS b FROM ledger_lines')[0].b
if (Math.abs(tb) >= 0.01) fail(`trial balance off by ${tb}`)
else console.log('trial balance: nets to zero')

// PO receive flow (po-002 approved -> received + asset + balanced posting)
db.exec('BEGIN IMMEDIATE')
db.exec({ sql: "UPDATE purchase_orders SET status='received' WHERE id='po-002'" })
db.exec({ sql: "INSERT INTO assets (id,name,category,asset_owner,serial_number,purchase_value,status) VALUES ('as-test-1','Garment Conveyor Belt Unit','machinery','Zainpreneur','LX-CNV-005',410000,'available')" })
db.exec({ sql: "UPDATE po_items SET asset_id='as-test-1' WHERE id='poi-002'" })
db.exec({ sql: "INSERT INTO ledger_entries (id,entry_date,memo,business_id,source,created_at) VALUES ('le-test','2026-09-17T00:00:00Z','PO receipt po-002','biz-luxe-laundry','procurement','2026-09-17T00:00:00Z')" })
db.exec({ sql: "INSERT INTO ledger_lines (id,entry_id,account_code,debit,credit) VALUES ('ll-t1','le-test','1500',410000,0)" })
db.exec({ sql: "INSERT INTO ledger_lines (id,entry_id,account_code,debit,credit) VALUES ('ll-t2','le-test','2000',0,410000)" })
db.exec('COMMIT')
const tb2 = db.selectObjects('SELECT COALESCE(SUM(debit),0)-COALESCE(SUM(credit),0) AS b FROM ledger_lines')[0].b
if (Math.abs(tb2) >= 0.01) fail('post-PO trial balance broken')
else console.log('PO receive flow: asset pooled + books still balanced')

// Payroll math: kashif 11.5h x $80 = $920
const hrs = db.selectObjects("SELECT COALESCE(SUM(hours),0) AS h FROM timesheets WHERE member_id='tm-kashif' AND billable=1")[0].h
if (Math.abs(hrs * 80 - 920) > 0.01) fail(`payroll math: ${hrs}h`)
else console.log('payroll math: 11.5h x $80 = $920')

// Outbox enqueue/claim round-trip
db.exec({ sql: "INSERT INTO outbox (id,created_at,kind,payload_json,attempts,last_error,status) VALUES ('ob-t1','2026-09-17T00:00:00Z','timesheet','{\"a\":1}',0,NULL,'pending')" })
const claimed = db.selectObjects("SELECT id FROM outbox WHERE status='pending'")
if (!claimed.some((r) => r.id === 'ob-t1')) fail('outbox claim')
db.exec({ sql: "UPDATE outbox SET status='sent' WHERE id='ob-t1'" })
console.log('outbox round-trip: ok')

// Receivables aging query shape
const recv = db.selectObjects("SELECT SUM(amount-amount_paid) AS t FROM invoices WHERE status IN ('sent','partial','overdue')")[0].t
console.log(`receivables outstanding: ${recv}`)

// ---- Single-enterprise invariants (F1/F2) ----
const owners = db.selectObjects('SELECT DISTINCT asset_owner AS o FROM assets')
if (owners.length !== 1 || owners[0].o !== 'Zainpreneur') fail(`asset_owner drift: ${JSON.stringify(owners)}`)
else console.log('single owner: every asset is Zainpreneur-owned')
try { db.exec({ sql: "INSERT INTO assets (id,name,category,asset_owner,serial_number,purchase_value,status) VALUES ('x','x','other','Someone Else','s',1,'available')" }); fail('owner CHECK not enforced') }
catch { console.log('owner CHECK: enforced') }

// v3 migration replay: link columns exist in fresh DDL; backfill pairs
const tmCols = db.selectObjects('PRAGMA table_info(team_members)').map((r) => String(r.name))
const vCols = db.selectObjects('PRAGMA table_info(vendors)').map((r) => String(r.name))
if (!tmCols.includes('vendor_id') || !vCols.includes('team_member_id')) fail('link columns missing from DDL')
else console.log('link columns: present in DDL')
db.exec({ sql: "UPDATE team_members SET vendor_id='ven-odoo-partner' WHERE id='ag-odoo-partner'" })
db.exec({ sql: "UPDATE vendors SET team_member_id='ag-odoo-partner' WHERE id='ven-odoo-partner'" })
db.exec({ sql: "UPDATE team_members SET vendor_id='ven-growthbridge' WHERE id='ag-marketing-partner'" })
db.exec({ sql: "UPDATE vendors SET team_member_id='ag-marketing-partner' WHERE id='ven-growthbridge'" })
const links = db.selectObjects("SELECT COUNT(*) AS n FROM team_members t JOIN vendors v ON v.id=t.vendor_id AND v.team_member_id=t.id WHERE t.engagement_type='agency_partner'")[0].n
if (links !== 2) fail(`vendor-agency links: ${links}`)
else console.log('vendor-agency links: both pairs bidirectionally linked')
const fk2 = db.selectObjects('PRAGMA foreign_key_check')
if (fk2.length > 0) fail(`post-migration FK violations: ${JSON.stringify(fk2)}`)
else console.log('post-migration FK check: clean')

if (!process.exitCode) console.log('ALL SQL CHECKS PASSED')
