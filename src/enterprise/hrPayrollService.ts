/**
 * HR bridge: contracts per engagement model, timesheet logging, payroll
 * calculation and posting to the general ledger.
 */
import { dbService } from '../db/dbService'
import type { HrContractRow, TeamMemberRow, TimesheetRow } from '../db/schema'
import { enterpriseId, todayIso } from './ids'
import { enqueueOutbox } from './sync/outbox'

export class PayrollError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayrollError'
  }
}

export interface PayrollLine {
  memberId: string
  memberName: string
  engagement: string
  kind: string
  currency: string
  amount: number
  detail: string
}

export interface PayrollRun {
  period: string
  lines: PayrollLine[]
  totals: Record<string, number>
  grandTotal: number
  warnings: string[]
}

export async function listContracts(activeOnly = true): Promise<Array<HrContractRow & { member_name: string; engagement_type: string }>> {
  return dbService.query(
    `SELECT c.*, t.name AS member_name, t.engagement_type FROM hr_contracts c
     JOIN team_members t ON t.id = c.member_id
     ${activeOnly ? 'WHERE c.is_active = 1' : ''} ORDER BY t.name`,
  )
}

export async function logTimesheet(input: {
  memberId: string
  businessId?: string
  date: string
  hours: number
  billable?: boolean
  milestoneRef?: string
  note?: string
}): Promise<{ id: string; queued: boolean }> {
  if (!(input.hours >= 0)) throw new PayrollError('Hours must be zero or more')
  const members = await dbService.query<TeamMemberRow>('SELECT id FROM team_members WHERE id = ?', [input.memberId])
  if (members.length === 0) throw new PayrollError(`Member ${input.memberId} does not exist`)
  const id = enterpriseId('ts')
  const online = typeof navigator === 'undefined' || navigator.onLine
  await dbService.run(
    'INSERT INTO timesheets (id, member_id, business_id, work_date, hours, billable, milestone_ref, note, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, input.memberId, input.businessId ?? null, input.date, input.hours, input.billable === false ? 0 : 1, input.milestoneRef ?? null, input.note ?? null, online ? 1 : 0],
  )
  if (!online) {
    await enqueueOutbox('timesheet', { id, memberId: input.memberId, hours: input.hours, date: input.date })
  }
  return { id, queued: !online }
}

/**
 * Calculate payouts for a period. Salary/retainer contracts pay base;
 * hourly contracts sum billable timesheet hours in range.
 */
export async function calculatePayroll(input: { memberIds?: string[]; from: string; to: string }): Promise<PayrollRun> {
  const contracts = await dbService.query<HrContractRow & { member_name: string; engagement_type: string }>(
    `SELECT c.*, t.name AS member_name, t.engagement_type FROM hr_contracts c
     JOIN team_members t ON t.id = c.member_id WHERE c.is_active = 1 ORDER BY t.name`,
  )
  const lines: PayrollLine[] = []
  const warnings: string[] = []
  const totals: Record<string, number> = {}
  for (const contract of contracts) {
    if (input.memberIds && !input.memberIds.includes(contract.member_id)) continue
    if (contract.kind === 'salary' || contract.kind === 'retainer') {
      const amount = contract.base_amount
      lines.push({
        memberId: contract.member_id,
        memberName: contract.member_name,
        engagement: contract.engagement_type,
        kind: contract.kind,
        currency: contract.currency,
        amount,
        detail: `${contract.billing_cycle} ${contract.kind} @ ${contract.base_amount}`,
      })
      totals[contract.engagement_type] = (totals[contract.engagement_type] ?? 0) + amount
    } else {
      const rows = await dbService.query<{ hours: number }>(
        'SELECT COALESCE(SUM(hours), 0) AS hours FROM timesheets WHERE member_id = ? AND billable = 1 AND work_date >= ? AND work_date <= ?',
        [contract.member_id, input.from, input.to],
      )
      const hours = rows[0]?.hours ?? 0
      if (hours === 0) {
        warnings.push(`${contract.member_name} logged no billable hours in range — skipped`)
        continue
      }
      const amount = Math.round(hours * contract.base_amount * 100) / 100
      lines.push({
        memberId: contract.member_id,
        memberName: contract.member_name,
        engagement: contract.engagement_type,
        kind: contract.kind,
        currency: contract.currency,
        amount,
        detail: `${hours}h × ${contract.base_amount}/${contract.currency === 'USD' ? 'hr' : 'unit'}`,
      })
      totals[contract.engagement_type] = (totals[contract.engagement_type] ?? 0) + amount
    }
  }
  return {
    period: `${input.from.slice(0, 10)} → ${input.to.slice(0, 10)}`,
    lines,
    totals,
    grandTotal: lines.reduce((sum, line) => sum + line.amount, 0),
    warnings,
  }
}

/** Post a payroll run as one balanced entry: Dr salary/contractor expense, Cr payroll liability. */
export async function postPayrollRun(run: PayrollRun): Promise<{ entryId: string }> {
  if (run.lines.length === 0) throw new PayrollError('Nothing to post — payroll run is empty')
  const now = todayIso()
  const entryId = enterpriseId('le')
  const salary = run.lines.filter((l) => l.kind === 'salary').reduce((s, l) => s + l.amount, 0)
  const contractor = run.grandTotal - salary
  await dbService.batch([
    {
      sql: 'INSERT INTO ledger_entries (id, entry_date, memo, business_id, branch_id, asset_id, member_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [entryId, now, `Payroll run ${run.period} (${run.lines.length} payouts)`, null, null, null, null, 'payroll', now],
    },
    ...(salary > 0
      ? [{ sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)', params: [enterpriseId('ll'), entryId, '5100', salary, 0] as Array<string | number | null> }]
      : []),
    ...(contractor > 0
      ? [{ sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)', params: [enterpriseId('ll'), entryId, '5200', contractor, 0] as Array<string | number | null> }]
      : []),
    {
      sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)',
      params: [enterpriseId('ll'), entryId, '2100', 0, run.grandTotal],
    },
  ])
  return { entryId }
}

export async function listTimesheets(filter?: { memberId?: string; unsyncedOnly?: boolean }): Promise<TimesheetRow[]> {
  const clauses: string[] = []
  const params: Array<string | number | null> = []
  if (filter?.memberId) {
    clauses.push('member_id = ?')
    params.push(filter.memberId)
  }
  if (filter?.unsyncedOnly) clauses.push('synced = 0')
  return dbService.query<TimesheetRow>(
    `SELECT * FROM timesheets ${clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY work_date DESC LIMIT 200`,
    params,
  )
}
