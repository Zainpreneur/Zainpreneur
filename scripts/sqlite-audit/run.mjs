import { Worker as RealWorker } from 'node:worker_threads';

// ---------- environment shims ----------
const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => { memStore.set(k, String(v)); },
  removeItem: (k) => { memStore.delete(k); },
  clear: () => memStore.clear(),
  get length() { return memStore.size; },
  key: (i) => [...memStore.keys()][i] ?? null,
};
globalThis.window = {
  setTimeout: (...a) => setTimeout(...a),
  clearTimeout: (...a) => clearTimeout(...a),
  addEventListener() {},
  removeEventListener() {},
};
class WorkerFacade {
  constructor(spec) {
    this._w = new RealWorker(new URL(spec), {});
    this._w.on('error', () => {});
  }
  postMessage(m, t) { this._w.postMessage(m, t); }
  set onmessage(fn) { this._w.removeAllListeners('message'); if (fn) this._w.on('message', (d) => fn({ data: d })); }
  addEventListener(t, fn) { this._w.on(t, (d) => fn({ data: d })); }
  removeEventListener(t, fn) { this._w.off(t, fn); }
  terminate() { return this._w.terminate(); }
}
globalThis.Worker = WorkerFacade;
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true, userAgent: 'audit-harness' },
  configurable: true,
  writable: true,
});

setTimeout(() => { console.error('WATCHDOG: forced exit, printing partial results'); console.error(JSON.stringify(results)); process.exit(3); }, 200000).unref?.();

import { pathToFileURL } from 'node:url';
import { DIST as DIST_DIR } from './paths.mjs';

const app = await import(pathToFileURL(`${DIST_DIR}/app.mjs`).href);
const { dbService } = app;
const results = [];
let failures = 0;

function pass(phase, id, detail) {
  results.push({ phase, id, status: 'PASS', detail });
  console.log(`  ✓ [${id}] ${detail}`);
}
function fail(phase, id, detail) {
  failures += 1;
  results.push({ phase, id, status: 'FAIL', detail });
  console.log(`  ✗ [${id}] ${detail}`);
}
console.log('BOOT: starting real SQLite worker via dbService...');
const boot = await dbService.ready();
console.log(`BOOT: backend=${boot.backend} (expect memory in Node)`);
if (boot.backend !== 'memory') console.log('NOTE: unexpected backend, continuing');

// ================= PHASE 1 =================
console.log('\nPHASE 1 — Business portfolio & cap table');

const bizRows = await dbService.query('SELECT id, model, category FROM businesses');
const models = new Set(bizRows.map((b) => b.model));
const cats = new Set(bizRows.map((b) => b.category));
if ([...models].every((m) => ['project', 'consulting', 'equity'].includes(m)) && [...cats].every((c) => ['owned', 'equity', 'client'].includes(c)) && bizRows.length === 8) {
  pass(1, 'T1.1', `segregation strict: models=[${[...models]}] categories=[${[...cats]}] across 8 businesses`);
} else fail(1, 'T1.1', `segregation violated: ${JSON.stringify(bizRows)}`);

let rollupOk = true;
for (const b of app.businesses) {
  const t = app.branchUtils.branchTotals(app.allBranches.filter((br) => br.businessId === b.id));
  if (t.revenue !== b.monthlyRevenue || t.expenses !== b.monthlyExpenses) {
    rollupOk = false;
    fail(1, 'T1.2', `${b.id}: branches(${t.revenue}/${t.expenses}) vs business(${b.monthlyRevenue}/${b.monthlyExpenses})`);
  }
}
if (rollupOk) pass(1, 'T1.2', 'branch rollups equal parent totals exactly (integer-exact, no float drift)');

// T1.3A valid
await app.updateCapTableSplit('biz-apex-autospa', [{ ownerId: 'own-zain', percentage: 60 }, { ownerId: 'own-hassan', percentage: 40 }]);
const sharesA = await dbService.query('SELECT owner_id, equity_percentage FROM cap_table WHERE business_id=? ORDER BY owner_id', ['biz-apex-autospa']);
const shareSet = new Set(sharesA.map((s) => `${s.owner_id}:${s.equity_percentage}`));
if (sharesA.length === 2 && shareSet.has('own-zain:60') && shareSet.has('own-hassan:40')) pass(1, 'T1.3A', '100% split committed atomically (60/40)');
else fail(1, 'T1.3A', `unexpected rows: ${JSON.stringify(sharesA)}`);

// T1.3B invalid 99% and 101%
for (const bad of [99, 101]) {
  const pct = bad === 99 ? [59, 40] : [61, 40];
  let threw = null;
  try {
    await app.updateCapTableSplit('biz-apex-autospa', [{ ownerId: 'own-zain', percentage: pct[0] }, { ownerId: 'own-hassan', percentage: pct[1] }]);
  } catch (e) { threw = e; }
  const after = await dbService.query('SELECT SUM(equity_percentage) AS t FROM cap_table WHERE business_id=?', ['biz-apex-autospa']);
  if (threw && threw.name === 'CapTableError' && after[0].t === 100) pass(1, 'T1.3B', `${bad}% rejected with CapTableError("${threw.message}"), rows intact at 100%`);
  else fail(1, 'T1.3B', `${bad}%: threw=${threw?.name}, total=${after[0]?.t}`);
}

// T1.3C net share via REAL getBusinessesWithRelations + REAL userNetShare
const rel = await app.getBusinessesWithRelations();
const apex = rel.find((b) => b.id === 'biz-apex-autospa');
const apexBiz = {
  monthlyRevenue: 0, monthlyExpenses: 0, employees: 0, model: apex.model,
  branches: apex.branches.map((br) => ({ monthlyRevenue: br.monthly_revenue, monthlyExpenses: br.monthly_expenses, employees: 0, status: 'active' })),
  capTable: apex.capTable.map((s) => ({ ownerId: s.owner_id, percentage: s.equity_percentage })),
};
const net = app.calc.userNetShare(apexBiz, app.ZAIN_OWNER_ID);
// Independent fixture: (52000+29500+15000) - (33000+17000+11200) = 35300 × 60% = 21180
if (net === 21180) pass(1, 'T1.3C', `net share = 21180 (35300 profit × 60%) via live relations`);
else fail(1, 'T1.3C', `net share = ${net}, expected 21180`);

// ================= PHASE 2 =================
console.log('\nPHASE 2 — Asset pool & procurement');
const ownersDistinct = await dbService.query('SELECT DISTINCT asset_owner AS o FROM assets');
if (ownersDistinct.length === 1 && ownersDistinct[0].o === 'Zainpreneur') pass(2, 'T2.1', `sole owner enforced in data (1 distinct owner)`);
else fail(2, 'T2.1', JSON.stringify(ownersDistinct));
let checkEnforced = false;
try { await dbService.run("INSERT INTO assets (id,name,category,asset_owner,status) VALUES ('x','x','other','Rogue','available')"); }
catch { checkEnforced = true; }
if (checkEnforced) pass(2, 'T2.1b', `CHECK(asset_owner='Zainpreneur') rejects drifted owners`);
else fail(2, 'T2.1b', 'drifted owner accepted!');

// Spray-gun full cycle through REAL repositories
await app.returnAsset('as-eqp-900');
let gun = (await dbService.query("SELECT status FROM assets WHERE id='as-eqp-900'"))[0];
let gunDep = await dbService.query("SELECT COUNT(*) AS n FROM asset_deployments WHERE asset_id='as-eqp-900'");
if (gun.status === 'available' && gunDep[0].n === 0) pass(2, 'T2.2a', 'return-to-base: available + 0 mappings');
else fail(2, 'T2.2a', `${gun.status}/${gunDep[0].n}`);
const dep = await app.deployAsset('as-eqp-900', { entityType: 'client_project', entityId: 'br-cr-1', memberId: 'tm-ali', notes: 'audit-test' });
gun = (await dbService.query("SELECT status FROM assets WHERE id='as-eqp-900'"))[0];
const audit = (await dbService.query('SELECT entity_type, entity_id, assigned_member_id, assigned_date, notes FROM asset_deployments WHERE id=?', [dep.deploymentId]))[0];
if (gun.status === 'in-use' && audit.entity_type === 'client_project' && audit.entity_id === 'br-cr-1' && audit.assigned_member_id === 'tm-ali' && audit.assigned_date && audit.notes === 'audit-test') {
  pass(2, 'T2.2b', `deploy: available→in-use + audit row ${JSON.stringify(audit)}`);
} else fail(2, 'T2.2b', `${gun.status} ${JSON.stringify(audit)}`);
await app.returnAsset('as-eqp-900');
let badDeploy = null;
try { await app.deployAsset('as-lt-001', { entityType: 'owned_branch', entityId: 'br-aa-1' }); }
catch (e) { badDeploy = e; }
if (badDeploy && badDeploy.name === 'AssetStateError') pass(2, 'T2.2c', `double-deploy blocked: "${badDeploy.message}"`);
else fail(2, 'T2.2c', 'in-use asset redeployed!');

// PO receive through REAL procurementService
const po = await app.procurement.createPurchaseOrder({ vendorId: 'ven-techsource', businessId: 'biz-apex-autospa', items: [{ name: 'Audit Spray Gun', category: 'equipment', qty: 2, unitPrice: 50000, serialNumber: 'AUDIT-1' }] });
let illegal = null;
try { await app.procurement.receivePurchaseOrder(po.id); } catch (e) { illegal = e; }
if (illegal && illegal.name === 'ProcurementError') pass(2, 'T2.3a', `draft→received blocked: "${illegal.message}"`);
else fail(2, 'T2.3a', 'illegal transition allowed!');
await app.procurement.setPurchaseOrderStatus(po.id, 'sent');
await app.procurement.approvePurchaseOrder(po.id);
const received = await app.procurement.receivePurchaseOrder(po.id);
const pooled = await dbService.query("SELECT id, status, asset_owner, serial_number FROM assets WHERE id IN ('" + received.assetIds.join("','") + "')");
const linked = await dbService.query('SELECT asset_id FROM po_items WHERE po_id=?', [po.id]);
const tbAfterPo = await app.ledger.trialBalance();
const serials = new Set(pooled.map((a) => a.serial_number));
if (pooled.length === 2 && pooled.every((a) => a.status === 'available' && a.asset_owner === 'Zainpreneur') && serials.has('AUDIT-1-U1') && serials.has('AUDIT-1-U2') && linked.length === 1 && Boolean(linked[0].asset_id) && tbAfterPo.balanced) {
  pass(2, 'T2.3b', `receive: 2 assets pooled (serials AUDIT-1/-U2), items linked, books balanced`);
} else fail(2, 'T2.3b', JSON.stringify({ pooled, linked, balanced: tbAfterPo.balanced }));

// ================= PHASE 3 =================
console.log('\nPHASE 3 — Team & HR');
const seg = await dbService.query('SELECT engagement_type, COUNT(*) AS n FROM team_members GROUP BY engagement_type');
const segMap = Object.fromEntries(seg.map((r) => [r.engagement_type, r.n]));
if (segMap.internal > 0 && segMap.freelancer > 0 && segMap.agency_partner > 0) pass(3, 'T3.1', `segmentation live: ${JSON.stringify(segMap)}`);
else fail(3, 'T3.1', JSON.stringify(segMap));

const run = await app.payroll.calculatePayroll({ from: '2026-09-01T00:00:00Z', to: '2026-09-30T23:59:59Z' });
const kashif = run.lines.find((l) => l.memberId === 'tm-kashif');
if (kashif && kashif.amount === 920) pass(3, 'T3.2a', `freelancer math: Kashif 11.5h × $80 = $920`);
else fail(3, 'T3.2a', JSON.stringify(kashif));
if (run.totals.agency_partner === 400000) pass(3, 'T3.2b', `agency retainers total 400000 (250k+150k)`);
else fail(3, 'T3.2b', JSON.stringify(run.totals));
await app.payroll.postPayrollRun(run);
const tbAfterPay = await app.ledger.trialBalance();
if (tbAfterPay.balanced) pass(3, 'T3.2c', `payroll posted (Dr salary/contractor, Cr liability), books balanced`);
else fail(3, 'T3.2c', `imbalance ${tbAfterPay.imbalance}`);

// Offline queue through REAL logTimesheet + syncNow
globalThis.navigator.onLine = false;
const logged = await app.payroll.logTimesheet({ memberId: 'tm-ali', businessId: 'biz-nova-fitness', date: '2026-09-17T00:00:00Z', hours: 3 });
const pendingRow = await dbService.query("SELECT synced FROM timesheets WHERE id=?", [logged.id]);
const outboxRow = await dbService.query("SELECT status FROM outbox WHERE kind='timesheet' ORDER BY created_at DESC LIMIT 1");
if (logged.queued && pendingRow[0].synced === 0 && outboxRow[0]?.status === 'pending') pass(3, 'T3.3a', 'offline write: optimistic row (synced=0) + outbox pending');
else fail(3, 'T3.3a', JSON.stringify({ logged, pendingRow, outboxRow }));
globalThis.navigator.onLine = true;
const syncRes = await app.sync.syncNow(new app.sync.InMemoryRemotePort());
const drained = await dbService.query("SELECT COUNT(*) AS n FROM outbox WHERE status='pending'");
if (syncRes.sent >= 1 && drained[0].n === 0) pass(3, 'T3.3b', `reconnect: sync sent=${syncRes.sent}, queue drained to 0`);
else fail(3, 'T3.3b', JSON.stringify(syncRes));

// ================= PHASE 4 =================
console.log('\nPHASE 4 — Consolidated ledger');
const pnl = await app.ledger.profitAndLoss();
if (Math.abs(pnl.profit - (pnl.revenue - pnl.expenses)) < 0.01 && pnl.revenue > 0) pass(4, 'T4.1', `P&L consistent: rev=${pnl.revenue} exp=${pnl.expenses} profit=${pnl.profit}`);
else fail(4, 'T4.1', JSON.stringify(pnl));
const apexPnl = await app.ledger.profitAndLoss('biz-apex-autospa');
if (apexPnl.revenue === 320000) pass(4, 'T4.2', `segment filter: apex revenue=320000 isolated from portfolio`);
else fail(4, 'T4.2', JSON.stringify(apexPnl));

const dist1 = await app.ledger.postCapTableDistribution('biz-mobicom', 100000, '2026-09');
const distLines = await dbService.query('SELECT account_code, SUM(debit) AS d, SUM(credit) AS c, COUNT(*) AS n FROM ledger_lines WHERE entry_id=? GROUP BY account_code', [dist1.entryId]);
const dist2 = await app.ledger.postCapTableDistribution('biz-mobicom', 100000, '2026-09');
const dr = distLines.find((r) => r.account_code === '3000');
const cr = distLines.find((r) => r.account_code === '2200');
if (!dist1.skipped && dist2.skipped && dist2.entryId === dist1.entryId && dr && cr && dr.d === 100000 && cr.c === 100000 && dr.n + cr.n === 6) {
  pass(4, 'T4.3', 'distribution: 3 owners × Dr3000/Cr2200 = 100000, posted once, rerun idempotent');
} else fail(4, 'T4.3', JSON.stringify({ dist1, dist2, lines: distLines }));

const dep1 = await app.ledger.postDepreciation('2026-09');
const dep2 = await app.ledger.postDepreciation('2026-09');
if (!dep1.skipped && dep2.skipped && dep1.assets > 0) pass(4, 'T4.4', `depreciation: ${dep1.assets} assets charged once, rerun skipped`);
else fail(4, 'T4.4', JSON.stringify({ dep1, dep2 }));

const inv = await app.crm.createInvoice({ businessId: 'biz-craft-coffee', amount: 50000, dueDate: '2026-10-17T00:00:00Z' });
const pay1 = await app.crm.recordPayment(inv.id, 20000);
let overpay = null;
try { await app.crm.recordPayment(inv.id, 999999); } catch (e) { overpay = e; }
const pay2 = await app.crm.recordPayment(inv.id, 30000);
const aging = await app.crm.receivablesAging();
if (pay1.status === 'partial' && overpay && overpay.name === 'BillingError' && pay2.status === 'paid' && aging.total === 230000) {
  pass(4, 'T4.5', 'invoicing: partial→paid, overpayment blocked, aging total=230000');
} else fail(4, 'T4.5', JSON.stringify({ pay1, overpay: overpay?.name, pay2, total: aging.total }));

const tbFinal = await app.ledger.trialBalance();
if (tbFinal.balanced) pass(4, 'T4.6', `master books balanced after ALL postings (imbalance=${tbFinal.imbalance})`);
else fail(4, 'T4.6', `imbalance=${tbFinal.imbalance}`);

// ================= PHASE 5 =================
console.log('\nPHASE 5 — Resilience');
const journalRaw = globalThis.localStorage.getItem('zainpreneur:sqlite:journal:v1');
const journal = journalRaw ? JSON.parse(journalRaw) : [];
if (journal.length > 10) pass(5, 'T5.1', `journal persisted ${journal.length} mutations to localStorage`);
else fail(5, 'T5.1', `journal has ${journal.length} entries`);

// Reload survival: terminate worker, reboot, journal replays
const probe = await app.payroll.logTimesheet({ memberId: 'tm-ali', businessId: 'biz-nova-fitness', date: '2026-09-16T00:00:00Z', hours: 2 });
await app.dbService.terminate();
await app.dbService.ready();
const survived = await app.dbService.query('SELECT hours FROM timesheets WHERE id=?', [probe.id]);
if (survived[0]?.hours === 2) pass(5, 'T5.2', 'worker restart: journal replayed, offline-era write survived');
else fail(5, 'T5.2', `row missing after restart: ${JSON.stringify(survived)}`);

const exported = await app.dbService.exportDatabase();
const magic = Buffer.from(exported.slice(0, 16)).toString('utf8');
if (exported.byteLength > 10000 && magic.startsWith('SQLite format 3')) pass(5, 'T5.3', `export: ${exported.byteLength} bytes, valid SQLite header`);
else fail(5, 'T5.3', `export invalid (${exported.byteLength} bytes)`);

// Reset LAST — restores seed deterministically
await app.dbService.reset();
const afterReset = await app.dbService.counts();
if (afterReset.businesses === 8 && afterReset.vendors === 4) pass(5, 'T5.4', 'reset: deterministic reseed (8 businesses, 4 vendors)');
else fail(5, 'T5.4', JSON.stringify(afterReset));

await app.dbService.terminate();
console.log(`\nRESULT: ${results.filter((r) => r.status === 'PASS').length} PASS, ${failures} FAIL`);
process.exit(failures > 0 ? 1 : 0);
