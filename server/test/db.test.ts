import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Database-level rules.
 *
 * These run against a real SQLite file rather than a stub, because the properties
 * under test *are* database properties: two partial unique indexes and a CHECK
 * constraint do the work that application code in the original only appeared to do.
 *
 * A scratch file is used so nothing here touches the development database.
 */
const DB = resolve(process.cwd(), "db/test-scratch.db");

process.env.ZP_DB = DB;

let db: typeof import("../src/db/client.js");
let migrate: typeof import("../src/db/migrations.js").migrate;

before(async () => {
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`${DB}${suffix}`, { force: true });
  }
  db = await import("../src/db/client.js");
  ({ migrate } = await import("../src/db/migrations.js"));
  migrate();
});

after(() => {
  db.closeDb();
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${DB}${suffix}`, { force: true });
});

/* -------------------------------------------------------------------------- */

function stakeholder(name: string): number {
  const ts = db.now();
  const cur = db
    .conn()
    .prepare(
      `INSERT INTO stakeholders (name, kind, created_at, updated_at, rev)
       VALUES (?, 'company', ?, ?, 1)`,
    )
    .run(name, ts, ts);
  return Number(cur.lastInsertRowid);
}

function business(name: string, relationship: string): number {
  const ts = db.now();
  const cur = db
    .conn()
    .prepare(
      `INSERT INTO businesses (name, status, relationship_type, created_at, updated_at, rev)
       VALUES (?, 'active', ?, ?, ?, 1)`,
    )
    .run(name, relationship, ts, ts);
  return Number(cur.lastInsertRowid);
}

function hold(businessId: number, stakeholderId: number, equity: number): void {
  const ts = db.now();
  db.run(
    `INSERT INTO business_stakeholders
       (business_id, stakeholder_id, relationship, equity, is_equity, invested_on, created_at, updated_at, rev)
     VALUES (?, ?, 'equity', ?, 1, '2024-01-01', ?, ?, 1)`,
    [businessId, stakeholderId, equity, ts, ts],
  );
}

/* -------------------------------------------------------------------------- */

test("migrations are idempotent — applying twice creates nothing and changes nothing", () => {
  const before = db.num("SELECT COUNT(*) FROM sqlite_master WHERE type='table'");
  const result = migrate();
  const after = db.num("SELECT COUNT(*) FROM sqlite_master WHERE type='table'");
  assert.equal(after, before, "a second migrate() created a table");
  assert.equal(result.created, 0, "a second migrate() reported creating tables");
});

test("the schema carries the two partial unique indexes that make a cap table a history", () => {
  const rows = db.all<{ name: string; sql: string }>(
    "SELECT name, sql FROM sqlite_master WHERE type='index' AND name LIKE '%one_current'",
  );
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.match(r.sql ?? "", /exited_on IS NULL/);
  }
});

test("the relationship vocabulary has three values, not four", () => {
  assert.throws(
    () => business("Client Equity Ltd", "client_equity"),
    /CHECK constraint failed|client_equity/,
  );
  for (const ok of ["client", "equity", "fully_owned"]) {
    assert.doesNotThrow(() => business(`${ok} Co`, ok));
  }
});

test("a fully-allocated business is accepted", () => {
  const a = stakeholder("Allocator One Ltd");
  const b = stakeholder("Allocator Two Ltd");
  const id = business("Exactly One Hundred Ltd", "equity");
  hold(id, a, 60);
  hold(id, b, 40);
  const total = db.num(
    "SELECT COALESCE(SUM(equity),0) FROM business_stakeholders WHERE business_id=? AND exited_on IS NULL",
    [id],
  );
  assert.equal(total, 100);
});

test("a second open row for the same holder is refused by the index", () => {
  const holder = stakeholder("Repeat Holder Ltd");
  const id = business("Repeat Holder Ltd Co", "equity");
  hold(id, holder, 50);
  assert.throws(() => hold(id, holder, 50), /UNIQUE constraint failed/);
});

test("a closed row does not block a new open one — a stake can be sold and rebought", () => {
  const holder = stakeholder("Rebuilder Ltd");
  const id = business("Rebuilder Co", "equity");
  hold(id, holder, 100);
  db.run(
    "UPDATE business_stakeholders SET exited_on='2025-01-01' WHERE business_id=? AND stakeholder_id=?",
    [id, holder],
  );
  assert.doesNotThrow(() => hold(id, holder, 100), "rebuying a stake must be possible");
  const open = db.num(
    "SELECT COUNT(*) FROM business_stakeholders WHERE business_id=? AND exited_on IS NULL",
    [id],
  );
  assert.equal(open, 1);
});

test("branch cap tables are allocated independently of the parent business", () => {
  const parent = stakeholder("Parent Owner Ltd");
  const other = stakeholder("Other Owner Ltd");
  const id = business("Two Level Co", "equity");

  // The business totals 100% through one holder...
  hold(id, parent, 100);

  const ts = db.now();
  const br = db
    .conn()
    .prepare(
      `INSERT INTO branches (business_id, name, code, is_active, created_at, updated_at, rev)
       VALUES (?, 'Branch', 'BR-1', 1, ?, ?, 1)`,
    )
    .run(id, ts, ts);
  const branchId = Number(br.lastInsertRowid);

  // ...while the branch totals 100% through a completely different set of people.
  db.run(
    `INSERT INTO branch_stakeholders
       (branch_id, stakeholder_id, relationship, equity, is_equity, invested_on, created_at, updated_at, rev)
     VALUES (?, ?, 'subsidiary', 70, 1, '2024-01-01', ?, ?, 1)`,
    [branchId, other, ts, ts],
  );
  const third = stakeholder("Third Party Ltd");
  db.run(
    `INSERT INTO branch_stakeholders
       (branch_id, stakeholder_id, relationship, equity, is_equity, invested_on, created_at, updated_at, rev)
     VALUES (?, ?, 'subsidiary', 30, 1, '2024-01-01', ?, ?, 1)`,
    [branchId, third, ts, ts],
  );

  const branchTotal = db.num(
    "SELECT COALESCE(SUM(equity),0) FROM branch_stakeholders WHERE branch_id=?",
    [branchId],
  );
  const businessTotal = db.num(
    "SELECT COALESCE(SUM(equity),0) FROM business_stakeholders WHERE business_id=? AND exited_on IS NULL",
    [id],
  );
  assert.equal(branchTotal, 100, "the branch must total 100%");
  assert.equal(businessTotal, 100, "the parent must still total 100%");

  // And the two holders are genuinely disjoint.
  const shared = db.num(
    `SELECT COUNT(*) FROM branch_stakeholders bs
       JOIN business_stakeholders ss ON ss.stakeholder_id = bs.stakeholder_id
      WHERE bs.branch_id = ? AND ss.business_id = ?`,
    [branchId, id],
  );
  assert.equal(shared, 0);
});

test("case-insensitive name uniqueness holds", () => {
  business("Case Test Ltd", "client");
  assert.throws(() => business("CASE TEST LTD", "client"), /UNIQUE constraint failed/);
});

test("reading the book writes nothing", () => {
  const before = db.num("SELECT COALESCE(SUM(rev),0) FROM businesses");
  db.all("SELECT * FROM businesses");
  db.all("SELECT * FROM business_stakeholders");
  db.num("SELECT COUNT(*) FROM branches");
  const after = db.num("SELECT COALESCE(SUM(rev),0) FROM businesses");
  assert.equal(after, before, "a read changed a row");
});