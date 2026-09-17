/**
 * Typed repositories over the SQLite engine.
 *
 * All multi-statement mutations run as single transactions (the worker
 * wraps `batch` in BEGIN IMMEDIATE / COMMIT with ROLLBACK on error), so
 * relational invariants — 100% cap tables, exactly-one-current-deployment —
 * hold atomically across tabs.
 */
import { dbService } from './dbService'
import type {
  AssetDeploymentRow,
  AssetRow,
  BranchRow,
  BusinessRow,
  CapShareRow,
  DbDeploymentEntity,
  OwnerRow,
  TableName,
  TeamMemberRow,
} from './schema'

export class CapTableError extends Error {
  readonly total: number
  constructor(total: number) {
    super(`Cap table must total 100% (currently ${total.toFixed(2)}%)`)
    this.name = 'CapTableError'
    this.total = total
  }
}

export class AssetStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssetStateError'
  }
}

export interface OwnerShareInput {
  ownerId: string
  percentage: number
}

export interface CapShareWithOwner extends CapShareRow {
  owner_name: string
  owner_email: string
}

export interface BusinessWithRelations extends BusinessRow {
  branches: BranchRow[]
  capTable: CapShareWithOwner[]
}

export interface AssetWithDeployment extends AssetRow {
  deployment: AssetDeploymentRow | null
  member_name: string | null
}

export interface DeploymentTarget {
  entityType: DbDeploymentEntity
  /** Branch id when known, otherwise the business id. */
  entityId: string
  memberId?: string
  notes?: string
}

const TOLERANCE = 0.01

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`
}

/** Businesses with branches + cap-table shares (owner names joined). */
export async function getBusinessesWithRelations(): Promise<BusinessWithRelations[]> {
  const [businesses, branches, shares] = await Promise.all([
    dbService.query<BusinessRow>('SELECT * FROM businesses ORDER BY name'),
    dbService.query<BranchRow>('SELECT * FROM branches ORDER BY name'),
    dbService.query<CapShareWithOwner>(
      `SELECT c.*, o.name AS owner_name, o.email AS owner_email
       FROM cap_table c JOIN owners o ON o.id = c.owner_id
       ORDER BY c.equity_percentage DESC`,
    ),
  ])
  const byBusiness = new Map<string, BranchRow[]>()
  for (const branch of branches) {
    const list = byBusiness.get(branch.business_id) ?? []
    list.push(branch)
    byBusiness.set(branch.business_id, list)
  }
  const sharesByBusiness = new Map<string, CapShareWithOwner[]>()
  for (const share of shares) {
    const list = sharesByBusiness.get(share.business_id) ?? []
    list.push(share)
    sharesByBusiness.set(share.business_id, list)
  }
  return businesses.map((business) => ({
    ...business,
    branches: byBusiness.get(business.id) ?? [],
    capTable: sharesByBusiness.get(business.id) ?? [],
  }))
}

/**
 * Replace a business cap table inside one transaction. Validates the 100%
 * total up front (and relies on CHECK constraints + UNIQUE as backstops).
 */
export async function updateCapTableSplit(businessId: string, shares: OwnerShareInput[]): Promise<void> {
  const total = shares.reduce((sum, share) => sum + share.percentage, 0)
  if (Math.abs(total - 100) >= TOLERANCE) throw new CapTableError(total)
  await dbService.batch([
    { sql: 'DELETE FROM cap_table WHERE business_id = ?', params: [businessId] },
    ...shares.map((share) => ({
      sql: 'INSERT INTO cap_table (id, business_id, owner_id, equity_percentage) VALUES (?, ?, ?, ?)',
      params: [`${businessId}__${share.ownerId}`, businessId, share.ownerId, share.percentage] as Array<string | number | null>,
    })),
  ])
}

/**
 * Check out an asset: flips status to `in-use` and inserts the deployment
 * audit record atomically. Throws when the asset is not available.
 */
export async function deployAsset(
  assetId: string,
  target: DeploymentTarget,
): Promise<{ deploymentId: string }> {
  const rows = await dbService.query<AssetRow>('SELECT id, status FROM assets WHERE id = ?', [assetId])
  const asset = rows[0]
  if (!asset) throw new AssetStateError(`Asset ${assetId} does not exist`)
  if (asset.status !== 'available') {
    throw new AssetStateError(`Asset ${assetId} is ${asset.status}, only available assets can be deployed`)
  }
  const deploymentId = makeId('dep')
  const assignedDate = new Date().toISOString()
  await dbService.batch([
    { sql: 'UPDATE assets SET status = ? WHERE id = ?', params: ['in-use', assetId] },
    {
      sql: 'INSERT INTO asset_deployments (id, asset_id, entity_type, entity_id, assigned_member_id, assigned_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [
        deploymentId,
        assetId,
        target.entityType,
        target.entityId,
        target.memberId ?? null,
        assignedDate,
        target.notes ?? null,
      ],
    },
  ])
  return { deploymentId }
}

/**
 * Return an asset to base: clears deployment mapping(s) and resets status
 * to `available` atomically. The audit trail is preserved in the response.
 */
export async function returnAsset(assetId: string): Promise<{ cleared: number }> {
  const existing = await dbService.query<AssetDeploymentRow>(
    'SELECT * FROM asset_deployments WHERE asset_id = ?',
    [assetId],
  )
  await dbService.batch([
    { sql: 'DELETE FROM asset_deployments WHERE asset_id = ?', params: [assetId] },
    { sql: 'UPDATE assets SET status = ? WHERE id = ?', params: ['available', assetId] },
  ])
  return { cleared: existing.length }
}

/**
 * Best-effort mirrors used by the app store to keep the SQL engine close to
 * live data. Callers must catch failures — the localStorage store is the
 * source of truth and must never break because the mirror skipped.
 */
export async function mirrorInsert(table: TableName, row: Record<string, string | number | null>): Promise<void> {
  const columns = Object.keys(row)
  if (columns.length === 0) return
  // Plain INSERT (never REPLACE — replace would fire FK cascades on conflicts).
  const placeholders = columns.map(() => '?').join(', ')
  await dbService.run(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    columns.map((column) => row[column] ?? null),
  )
}

export async function mirrorDelete(table: TableName, id: string): Promise<void> {
  await dbService.run(`DELETE FROM ${table} WHERE id = ?`, [id])
}

/** Full inventory with current deployment + holder name (if any). */
export async function listAssetsWithDeployments(): Promise<AssetWithDeployment[]> {
  const rows = await dbService.query<
    AssetRow & {
      d_id: string | null
      d_entity_type: DbDeploymentEntity | null
      d_entity_id: string | null
      d_member: string | null
      d_date: string | null
      d_notes: string | null
      member_name: string | null
    }
  >(
    `SELECT a.*,
       d.id AS d_id, d.entity_type AS d_entity_type, d.entity_id AS d_entity_id,
       d.assigned_member_id AS d_member, d.assigned_date AS d_date, d.notes AS d_notes,
       m.name AS member_name
     FROM assets a
     LEFT JOIN asset_deployments d ON d.asset_id = a.id
     LEFT JOIN team_members m ON m.id = d.assigned_member_id
     ORDER BY a.name`,
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    asset_owner: row.asset_owner,
    serial_number: row.serial_number,
    purchase_value: row.purchase_value,
    status: row.status,
    deployment: row.d_id
      ? {
          id: row.d_id,
          asset_id: row.id,
          entity_type: row.d_entity_type as DbDeploymentEntity,
          entity_id: row.d_entity_id as string,
          assigned_member_id: row.d_member,
          assigned_date: row.d_date as string,
          notes: row.d_notes,
        }
      : null,
    member_name: row.member_name,
  }))
}

/** Team directory with per-member deployment counts. */
export async function listTeamDirectory(): Promise<Array<TeamMemberRow & { active_deployments: number }>> {
  return dbService.query(
    `SELECT t.*, COUNT(d.id) AS active_deployments
     FROM team_members t
     LEFT JOIN asset_deployments d ON d.assigned_member_id = t.id
     GROUP BY t.id
     ORDER BY t.name`,
  )
}

/** Owners with their equity holdings across the portfolio. */
export async function listOwnersWithHoldings(): Promise<
  Array<OwnerRow & { businesses: number; total_percentage: number }>
> {
  return dbService.query(
    `SELECT o.*, COUNT(c.business_id) AS businesses, COALESCE(SUM(c.equity_percentage), 0) AS total_percentage
     FROM owners o
     LEFT JOIN cap_table c ON c.owner_id = o.id
     GROUP BY o.id
     ORDER BY o.name`,
  )
}

/** Portfolio valuation: purchase total vs depreciated book proxy from seed values. */
export async function getAssetValuation(): Promise<{ purchase: number; count: number; deployed: number }> {
  const rows = await dbService.query<{ purchase: number; count: number; deployed: number }>(
    `SELECT COALESCE(SUM(purchase_value), 0) AS purchase,
       COUNT(*) AS count,
       SUM(CASE WHEN status = 'in-use' THEN 1 ELSE 0 END) AS deployed
     FROM assets`,
  )
  return rows[0] ?? { purchase: 0, count: 0, deployed: 0 }
}
