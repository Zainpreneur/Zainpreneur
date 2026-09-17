import type { DbDeploymentEntity, SqlStatement } from './schema'
import { allBranches, assets as appAssets, businesses, capTablesByBusiness, owners, teamMembers } from '../data'
import type { BusinessCategory } from '../types'

const toDateTime = (d: string): string => (d.length === 10 ? `${d}T00:00:00Z` : d)

/** App portfolio category → deployment entity type used by the SQL mirror. */
export function toDeploymentEntity(category: BusinessCategory): DbDeploymentEntity {
  if (category === 'equity') return 'equity_branch'
  if (category === 'client') return 'client_project'
  return 'owned_branch'
}

/** Human-readable rate/terms line for a roster member, shared by seed + mirrors. */
export function memberRateTerms(member: (typeof teamMembers)[number]): string | null {
  if (member.engagementType === 'internal') {
    const cost = member.internalStaff?.monthlyCost ?? member.monthlyCost ?? 0
    return `${cost}/mo · ${member.internalStaff?.department ?? member.department}`
  }
  if (member.engagementType === 'freelancer') {
    const rate = member.freelancer?.hourlyRate ?? member.hourlyRate ?? 0
    return `$${rate}/hr · ${member.freelancer?.contractTerms ?? member.contractTerms ?? 'contract'}`
  }
  const company = member.agencyPartner?.companyName ?? member.companyName ?? member.name
  const retainer = member.agencyPartner?.retainerMonthly ?? member.retainerMonthly
  return retainer ? `${company} · ${retainer}/mo retainer` : company
}

/**
 * Build a fully parameterized INSERT script mirroring the app's mock data,
 * plus a paint spray gun deployed to the detailing studio. Executed inside a
 * single transaction by the worker; safe to run only when tables are empty.
 */
export function buildSeedStatements(): SqlStatement[] {
  const stmts: SqlStatement[] = []

  for (const b of businesses) {
    stmts.push({
      sql: 'INSERT INTO businesses (id, name, model, category, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      params: [b.id, b.name, b.model, b.category, b.status, b.createdAt],
    })
  }

  for (const br of allBranches) {
    stmts.push({
      sql: 'INSERT INTO branches (id, business_id, name, location, monthly_revenue, monthly_expenses) VALUES (?, ?, ?, ?, ?, ?)',
      params: [br.id, br.businessId, br.name, br.location, br.monthlyRevenue, br.monthlyExpenses],
    })
  }

  for (const o of owners) {
    stmts.push({
      sql: 'INSERT INTO owners (id, name, email, avatar) VALUES (?, ?, ?, ?)',
      params: [o.id, o.name, o.email, o.avatar ?? null],
    })
  }

  for (const [businessId, shares] of Object.entries(capTablesByBusiness)) {
    for (const share of shares) {
      stmts.push({
        sql: 'INSERT INTO cap_table (id, business_id, owner_id, equity_percentage) VALUES (?, ?, ?, ?)',
        params: [`${businessId}__${share.ownerId}`, businessId, share.ownerId, share.percentage],
      })
    }
  }

  for (const m of teamMembers) {
    stmts.push({
      sql: 'INSERT INTO team_members (id, name, email, engagement_type, role, rate_or_terms) VALUES (?, ?, ?, ?, ?, ?)',
      params: [m.id, m.name, m.email, m.engagementType, m.role, memberRateTerms(m)],
    })
  }

  const deploy = (
    assetId: string,
    entity: DbDeploymentEntity,
    entityId: string,
    memberId: string | null,
    date: string,
    notes: string | null,
  ): void => {
    stmts.push({
      sql: 'INSERT INTO asset_deployments (id, asset_id, entity_type, entity_id, assigned_member_id, assigned_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [`dep-${assetId}`, assetId, entity, entityId, memberId, toDateTime(date), notes],
    })
  }

  for (const a of appAssets) {
    // SQL mirror tracks the three live statuses; retired units re-enter as maintenance.
    const status = a.status === 'retired' ? 'maintenance' : a.status
    stmts.push({
      sql: 'INSERT INTO assets (id, name, category, asset_owner, serial_number, purchase_value, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [a.id, a.name, a.category, 'Zainpreneur', a.serialNumber, a.value, status],
    })
    const d = a.currentDeployment
    if (d) {
      const biz = businesses.find((b) => b.id === d.entityId)
      deploy(
        a.id,
        toDeploymentEntity(d.entityType),
        d.branchId ?? d.entityId,
        d.assignedToMemberId ?? null,
        d.deployedDate,
        d.notes ?? (biz ? `Deployed within ${biz.name}` : null),
      )
    }
  }

  // Spec example: paint spray gun checked out to the detailing studio.
  stmts.push({
    sql: 'INSERT INTO assets (id, name, category, asset_owner, serial_number, purchase_value, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    params: ['as-eqp-900', 'Pro Paint Spray Gun Set', 'equipment', 'Zainpreneur', 'PSG-PRO-2201', 95000, 'in-use'],
  })
  deploy('as-eqp-900', 'owned_branch', 'br-aa-2', 'tm-faizan', '2026-09-02', 'Ceramic coating bay · Gulberg Detailing Studio')

  return stmts
}
