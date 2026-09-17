/**
 * Relational schema for the offline-first Zainpreneur database.
 *
 * SQLite WASM (OPFS-backed) mirror of the app domain. Timestamps are stored
 * as ISO-8601 TEXT. Money is REAL in the reporting currency (PKR).
 */

/** SQLite file mounted in OPFS. */
export const DB_FILENAME = 'zainpreneur.sqlite3'

export const SCHEMA_VERSION = 1

export type DbBusinessModel = 'project' | 'consulting' | 'equity'
export type DbBusinessCategory = 'owned' | 'equity' | 'client'
export type DbEngagementType = 'internal' | 'freelancer' | 'agency_partner'
export type DbAssetCategory = 'hardware' | 'machinery' | 'equipment' | 'other'
export type DbAssetStatus = 'available' | 'in-use' | 'maintenance'
export type DbDeploymentEntity = 'owned_branch' | 'equity_branch' | 'client_project'

export interface BusinessRow {
  id: string
  name: string
  model: DbBusinessModel
  category: DbBusinessCategory
  status: string
  created_at: string
}

export interface BranchRow {
  id: string
  business_id: string
  name: string
  location: string
  monthly_revenue: number
  monthly_expenses: number
}

export interface OwnerRow {
  id: string
  name: string
  email: string
  avatar: string | null
}

export interface CapShareRow {
  id: string
  business_id: string
  owner_id: string
  equity_percentage: number
}

export interface TeamMemberRow {
  id: string
  name: string
  email: string
  engagement_type: DbEngagementType
  role: string
  rate_or_terms: string | null
}

export interface AssetRow {
  id: string
  name: string
  category: DbAssetCategory
  asset_owner: string
  serial_number: string
  purchase_value: number
  status: DbAssetStatus
}

export interface AssetDeploymentRow {
  id: string
  asset_id: string
  entity_type: DbDeploymentEntity
  entity_id: string
  assigned_member_id: string | null
  assigned_date: string
  notes: string | null
}

export const SCHEMA_DDL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT NOT NULL CHECK (model IN ('project', 'consulting', 'equity')),
  category TEXT NOT NULL CHECK (category IN ('owned', 'equity', 'client')),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  monthly_revenue REAL NOT NULL DEFAULT 0,
  monthly_expenses REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_branches_business ON branches (business_id);

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT
);

CREATE TABLE IF NOT EXISTS cap_table (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES owners (id) ON DELETE CASCADE,
  equity_percentage REAL NOT NULL CHECK (equity_percentage >= 0 AND equity_percentage <= 100),
  UNIQUE (business_id, owner_id)
);
CREATE INDEX IF NOT EXISTS idx_cap_business ON cap_table (business_id);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  engagement_type TEXT NOT NULL CHECK (engagement_type IN ('internal', 'freelancer', 'agency_partner')),
  role TEXT NOT NULL DEFAULT '',
  rate_or_terms TEXT
);
CREATE INDEX IF NOT EXISTS idx_team_engagement ON team_members (engagement_type);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('hardware', 'machinery', 'equipment', 'other')),
  asset_owner TEXT NOT NULL DEFAULT 'Zainpreneur',
  serial_number TEXT NOT NULL DEFAULT '',
  purchase_value REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in-use', 'maintenance'))
);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets (status);

CREATE TABLE IF NOT EXISTS asset_deployments (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('owned_branch', 'equity_branch', 'client_project')),
  entity_id TEXT NOT NULL,
  assigned_member_id TEXT REFERENCES team_members (id) ON DELETE SET NULL,
  assigned_date TEXT NOT NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_deploy_asset ON asset_deployments (asset_id);
CREATE INDEX IF NOT EXISTS idx_deploy_member ON asset_deployments (assigned_member_id);
`

/**
 * A parameterized statement. Params are positional (`?` placeholders) and
 * must be JSON-serializable — the worker protocol crosses thread boundaries.
 */
export interface SqlStatement {
  sql: string
  params?: Array<string | number | null>
}

export const TABLE_NAMES = [
  'businesses',
  'branches',
  'owners',
  'cap_table',
  'team_members',
  'assets',
  'asset_deployments',
] as const

export type TableName = (typeof TABLE_NAMES)[number]
