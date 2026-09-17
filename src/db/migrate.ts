import { SCHEMA_DDL, type SqlStatement } from './schema'

export interface MigrationInputs {
  /** Live `sqlite_master` DDL for the assets table, if it exists. */
  assetTableSql: string | null
  teamColumns: string[]
  vendorColumns: string[]
}

const VENDOR_AGENCY_PAIRS: Array<[memberId: string, vendorId: string]> = [
  ['ag-odoo-partner', 'ven-odoo-partner'],
  ['ag-marketing-partner', 'ven-growthbridge'],
]

/**
 * Pure v3 migration planner. Returns idempotent, journal-free statements:
 * - rebuilds `assets` (SQLite cannot ALTER in a CHECK) only when the owner
 *   CHECK is absent, normalizing legacy owners first so the copy cannot fail
 * - adds vendor↔agency link columns only when missing
 * - backfills known pairs, guarded by EXISTS + IS NULL so reruns are no-ops
 *
 * Pure input→output shape keeps this unit-testable against real SQLite.
 */
export function v3MigrationPlan(inputs: MigrationInputs): SqlStatement[] {
  const stmts: SqlStatement[] = []
  const push = (sql: string, params?: Array<string | number | null>): void => {
    stmts.push(params ? { sql, params } : { sql })
  }

  const needsRebuild =
    inputs.assetTableSql !== null && !inputs.assetTableSql.includes("asset_owner = 'Zainpreneur'")
  if (needsRebuild) {
    push('PRAGMA foreign_keys = OFF')
    push("UPDATE assets SET asset_owner = 'Zainpreneur' WHERE asset_owner != 'Zainpreneur'")
    push('ALTER TABLE assets RENAME TO assets_migrate_backup')
    push(SCHEMA_DDL)
    push(
      'INSERT INTO assets (id, name, category, asset_owner, serial_number, purchase_value, status) SELECT id, name, category, asset_owner, serial_number, purchase_value, status FROM assets_migrate_backup',
    )
    push('DROP TABLE assets_migrate_backup')
  } else {
    push(SCHEMA_DDL)
  }

  if (!inputs.teamColumns.includes('vendor_id')) {
    push('ALTER TABLE team_members ADD COLUMN vendor_id TEXT REFERENCES vendors (id) ON DELETE SET NULL')
  }
  if (!inputs.vendorColumns.includes('team_member_id')) {
    push('ALTER TABLE vendors ADD COLUMN team_member_id TEXT REFERENCES team_members (id) ON DELETE SET NULL')
  }

  for (const [memberId, vendorId] of VENDOR_AGENCY_PAIRS) {
    push(
      'UPDATE team_members SET vendor_id = ? WHERE id = ? AND vendor_id IS NULL AND EXISTS (SELECT 1 FROM vendors WHERE id = ?)',
      [vendorId, memberId, vendorId],
    )
    push(
      'UPDATE vendors SET team_member_id = ? WHERE id = ? AND team_member_id IS NULL AND EXISTS (SELECT 1 FROM team_members WHERE id = ?)',
      [memberId, vendorId, memberId],
    )
  }

  push('PRAGMA foreign_keys = ON')
  return stmts
}
