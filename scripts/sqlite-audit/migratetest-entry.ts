import { v3MigrationPlan } from '../../src/db/migrate.ts';
import { SCHEMA_DDL } from '../../src/db/schema.ts';

const scenarios = {
  legacy: {
    assetTableSql:
      "CREATE TABLE assets (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, asset_owner TEXT NOT NULL DEFAULT 'Zainpreneur', serial_number TEXT, purchase_value REAL, status TEXT)",
    teamColumns: ['id', 'name', 'email', 'engagement_type', 'role', 'rate_or_terms'],
    vendorColumns: ['id', 'name', 'email', 'created_at'],
  },
  current: {
    assetTableSql:
      "CREATE TABLE assets (id TEXT PRIMARY KEY, asset_owner TEXT NOT NULL DEFAULT 'Zainpreneur' CHECK (asset_owner = 'Zainpreneur'))",
    teamColumns: ['id', 'vendor_id'],
    vendorColumns: ['id', 'team_member_id'],
  },
};

const out = JSON.stringify({
  legacyPlan: v3MigrationPlan(scenarios.legacy),
  currentPlan: v3MigrationPlan(scenarios.current),
  ddl: SCHEMA_DDL,
});
console.log(out);
