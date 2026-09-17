/**
 * Relational schema for the offline-first Zainpreneur database.
 *
 * SQLite WASM (OPFS-backed) mirror of the app domain. Timestamps are stored
 * as ISO-8601 TEXT. Money is REAL in the reporting currency (PKR).
 */

/** SQLite file mounted in OPFS. */
export const DB_FILENAME = 'zainpreneur.sqlite3'

export const SCHEMA_VERSION = 3

export type DbBusinessModel = 'project' | 'consulting' | 'equity'
export type DbBusinessCategory = 'owned' | 'equity' | 'client'
export type DbEngagementType = 'internal' | 'freelancer' | 'agency_partner'
export type DbAssetCategory = 'hardware' | 'machinery' | 'equipment' | 'other'
export type DbAssetStatus = 'available' | 'in-use' | 'maintenance'
export type DbDeploymentEntity = 'owned_branch' | 'equity_branch' | 'client_project'

export type DbPoStatus = 'draft' | 'sent' | 'approved' | 'received' | 'cancelled'
export type DbContractKind = 'salary' | 'hourly' | 'retainer'
export type DbBillingCycle = 'monthly' | 'milestone' | 'hourly'
export type DbAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type DbLedgerSource = 'manual' | 'payroll' | 'procurement' | 'billing' | 'depreciation' | 'equity'
export type DbInvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue'
export type DbOutboxStatus = 'pending' | 'sent' | 'failed'

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
  /** Linked vendor row when an agency partner is also a registered vendor. */
  vendor_id: string | null
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

export interface VendorRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  tax_id: string | null
  payment_terms: string
  rating: number | null
  is_active: number
  created_at: string
  /** Linked roster member when a vendor is also an agency partner. */
  team_member_id: string | null
}

export interface PurchaseOrderRow {
  id: string
  vendor_id: string
  business_id: string | null
  status: DbPoStatus
  order_date: string
  expected_date: string | null
  subtotal: number
  tax: number
  total: number
  notes: string | null
}

export interface PoItemRow {
  id: string
  po_id: string
  name: string
  category: DbAssetCategory
  qty: number
  unit_price: number
  serial_number: string | null
  asset_id: string | null
}

export interface HrContractRow {
  id: string
  member_id: string
  kind: DbContractKind
  base_amount: number
  currency: string
  start_date: string
  end_date: string | null
  billing_cycle: DbBillingCycle
  is_active: number
}

export interface TimesheetRow {
  id: string
  member_id: string
  business_id: string | null
  work_date: string
  hours: number
  billable: number
  milestone_ref: string | null
  note: string | null
  synced: number
}

export interface LedgerAccountRow {
  code: string
  name: string
  type: DbAccountType
  parent_code: string | null
}

export interface LedgerEntryRow {
  id: string
  entry_date: string
  memo: string
  business_id: string | null
  branch_id: string | null
  asset_id: string | null
  member_id: string | null
  source: DbLedgerSource
  created_at: string
}

export interface LedgerLineRow {
  id: string
  entry_id: string
  account_code: string
  debit: number
  credit: number
}

export interface InvoiceRow {
  id: string
  business_id: string
  invoice_no: string
  issue_date: string
  due_date: string
  amount: number
  amount_paid: number
  status: DbInvoiceStatus
  milestone_ref: string | null
}

export interface OutboxRow {
  id: string
  created_at: string
  kind: string
  payload_json: string
  attempts: number
  last_error: string | null
  status: DbOutboxStatus
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
  rate_or_terms TEXT,
  vendor_id TEXT REFERENCES vendors (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_team_engagement ON team_members (engagement_type);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('hardware', 'machinery', 'equipment', 'other')),
  asset_owner TEXT NOT NULL DEFAULT 'Zainpreneur' CHECK (asset_owner = 'Zainpreneur'),
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

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  payment_terms TEXT NOT NULL DEFAULT 'net-30',
  rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  team_member_id TEXT REFERENCES team_members (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors (id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'received', 'cancelled')),
  order_date TEXT NOT NULL,
  expected_date TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders (status);

CREATE TABLE IF NOT EXISTS po_items (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('hardware', 'machinery', 'equipment', 'other')),
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price REAL NOT NULL DEFAULT 0,
  serial_number TEXT,
  asset_id TEXT REFERENCES assets (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_poitem_po ON po_items (po_id);

CREATE TABLE IF NOT EXISTS hr_contracts (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES team_members (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('salary', 'hourly', 'retainer')),
  base_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PKR',
  start_date TEXT NOT NULL,
  end_date TEXT,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'milestone', 'hourly')),
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_contract_member ON hr_contracts (member_id);

CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES team_members (id) ON DELETE CASCADE,
  business_id TEXT REFERENCES businesses (id) ON DELETE SET NULL,
  work_date TEXT NOT NULL,
  hours REAL NOT NULL CHECK (hours >= 0),
  billable INTEGER NOT NULL DEFAULT 1,
  milestone_ref TEXT,
  note TEXT,
  synced INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_ts_member_date ON timesheets (member_id, work_date);
CREATE INDEX IF NOT EXISTS idx_ts_synced ON timesheets (synced);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_code TEXT REFERENCES ledger_accounts (code) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  business_id TEXT REFERENCES businesses (id) ON DELETE SET NULL,
  branch_id TEXT REFERENCES branches (id) ON DELETE SET NULL,
  asset_id TEXT REFERENCES assets (id) ON DELETE SET NULL,
  member_id TEXT REFERENCES team_members (id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'payroll', 'procurement', 'billing', 'depreciation', 'equity')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entry_source ON ledger_entries (source);
CREATE INDEX IF NOT EXISTS idx_entry_business ON ledger_entries (business_id);

CREATE TABLE IF NOT EXISTS ledger_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES ledger_entries (id) ON DELETE CASCADE,
  account_code TEXT NOT NULL REFERENCES ledger_accounts (code) ON DELETE RESTRICT,
  debit REAL NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit REAL NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK (debit > 0 OR credit > 0)
);
CREATE INDEX IF NOT EXISTS idx_line_entry ON ledger_lines (entry_id);
CREATE INDEX IF NOT EXISTS idx_line_account ON ledger_lines (account_code);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL UNIQUE,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'overdue')),
  milestone_ref TEXT
);
CREATE INDEX IF NOT EXISTS idx_inv_business ON invoices (business_id);
CREATE INDEX IF NOT EXISTS idx_inv_status ON invoices (status);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox (status, created_at);
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
  'vendors',
  'purchase_orders',
  'po_items',
  'hr_contracts',
  'timesheets',
  'ledger_accounts',
  'ledger_entries',
  'ledger_lines',
  'invoices',
  'outbox',
] as const

export type TableName = (typeof TABLE_NAMES)[number]
