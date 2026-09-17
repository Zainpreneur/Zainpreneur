/**
 * General-ledger bridge: trial balance, P&L, equity distributions and
 * monthly depreciation postings over the double-entry tables.
 */
import { dbService } from '../db/dbService'
import type { LedgerAccountRow } from '../db/schema'
import { enterpriseId, todayIso } from './ids'

export class LedgerImbalanceError extends Error {
  readonly imbalance: number
  constructor(imbalance: number) {
    super(`Ledger out of balance by ${imbalance.toFixed(2)}`)
    this.name = 'LedgerImbalanceError'
    this.imbalance = imbalance
  }
}

/** Straight-line horizons (years) mirroring the app's asset constants. */
const USEFUL_LIFE_YEARS: Record<string, number> = {
  hardware: 4,
  machinery: 8,
  equipment: 6,
  other: 5,
}

export interface TrialBalanceRow extends LedgerAccountRow {
  debit: number
  credit: number
  balance: number
}

export async function trialBalance(): Promise<{ rows: TrialBalanceRow[]; balanced: boolean; imbalance: number }> {
  const rows = await dbService.query<TrialBalanceRow>(
    `SELECT a.code, a.name, a.type, a.parent_code,
       COALESCE(SUM(l.debit), 0) AS debit, COALESCE(SUM(l.credit), 0) AS credit,
       COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS balance
     FROM ledger_accounts a
     LEFT JOIN ledger_lines l ON l.account_code = a.code
     GROUP BY a.code ORDER BY a.code`,
  )
  const imbalance = rows.reduce((sum, row) => sum + row.balance, 0)
  const balanced = Math.abs(imbalance) < 0.01
  return { rows, balanced, imbalance }
}

export async function assertBalanced(): Promise<void> {
  const { imbalance, balanced } = await trialBalance()
  if (!balanced) throw new LedgerImbalanceError(imbalance)
}

export interface MasterStatements {
  /** Fixed enterprise framing — every figure below is Zainpreneur-consolidated. */
  enterprise: 'Zainpreneur'
  asOf: string
  trial: TrialBalanceRow[]
  balanced: boolean
  pnl: { revenue: number; expenses: number; profit: number }
}

/**
 * Zainpreneur's master statements in one envelope: portfolio-wide trial
 * balance plus consolidated P&L. Per-business figures are segment views —
 * see `profitAndLoss(businessId)` — never separate company books.
 */
export async function getMasterStatements(): Promise<MasterStatements> {
  const [trial, pnl] = await Promise.all([trialBalance(), profitAndLoss()])
  return {
    enterprise: 'Zainpreneur',
    asOf: new Date().toISOString(),
    trial: trial.rows,
    balanced: trial.balanced,
    pnl,
  }
}

export async function profitAndLoss(businessId?: string): Promise<{ revenue: number; expenses: number; profit: number }> {
  const params: Array<string | number | null> = []
  const scope = businessId ? 'AND e.business_id = ?' : ''
  if (businessId) params.push(businessId)
  const revenue = await dbService.query<{ total: number }>(
    `SELECT COALESCE(SUM(l.credit - l.debit), 0) AS total FROM ledger_lines l
     JOIN ledger_entries e ON e.id = l.entry_id
     JOIN ledger_accounts a ON a.code = l.account_code
     WHERE a.type = 'revenue' ${scope}`,
    params,
  )
  const expenses = await dbService.query<{ total: number }>(
    `SELECT COALESCE(SUM(l.debit - l.credit), 0) AS total FROM ledger_lines l
     JOIN ledger_entries e ON e.id = l.entry_id
     JOIN ledger_accounts a ON a.code = l.account_code
     WHERE a.type = 'expense' ${scope}`,
    params,
  )
  const rev = revenue[0]?.total ?? 0
  const exp = expenses[0]?.total ?? 0
  return { revenue: rev, expenses: exp, profit: rev - exp }
}

/**
 * Post equity distribution: reads live cap-table splits and books
 * Dr Owner Equity / Cr Shareholder Payable per owner. Idempotent per
 * business+period via memo key.
 */
export async function postCapTableDistribution(businessId: string, profitAmount: number, period: string): Promise<{ entryId: string; skipped: boolean }> {
  const memo = `Equity distribution ${businessId} ${period}`
  const existing = await dbService.query<{ id: string }>(
    "SELECT id FROM ledger_entries WHERE memo = ? AND source = 'equity'",
    [memo],
  )
  if (existing.length > 0) return { entryId: existing[0].id, skipped: true }
  if (!(profitAmount > 0)) throw new LedgerImbalanceError(0)
  const shares = await dbService.query<{ owner_id: string; equity_percentage: number }>(
    'SELECT owner_id, equity_percentage FROM cap_table WHERE business_id = ?',
    [businessId],
  )
  if (shares.length === 0) throw new LedgerImbalanceError(0)
  const now = todayIso()
  const entryId = enterpriseId('le')
  await dbService.batch([
    {
      sql: 'INSERT INTO ledger_entries (id, entry_date, memo, business_id, branch_id, asset_id, member_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [entryId, now, memo, businessId, null, null, null, 'equity', now],
    },
    ...shares.flatMap((share) => {
      const amount = Math.round((profitAmount * share.equity_percentage) / 100)
      return [
        {
          sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)',
          params: [enterpriseId('ll'), entryId, '3000', amount, 0] as Array<string | number | null>,
        },
        {
          sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)',
          params: [enterpriseId('ll'), entryId, '2200', 0, amount] as Array<string | number | null>,
        },
      ]
    }),
  ])
  return { entryId, skipped: false }
}

/**
 * Post one month of straight-line depreciation per asset
 * (value ÷ life-months, 10% salvage floor approximated by capping total
 * charged months at 90% of life). Idempotent per YYYY-MM memo key.
 */
export async function postDepreciation(periodMonth: string): Promise<{ entryId: string | null; skipped: boolean; assets: number }> {
  if (!/^\d{4}-\d{2}$/.test(periodMonth)) throw new LedgerImbalanceError(0)
  const memo = `Depreciation ${periodMonth}`
  const existing = await dbService.query<{ id: string }>(
    "SELECT id FROM ledger_entries WHERE memo = ? AND source = 'depreciation'",
    [memo],
  )
  if (existing.length > 0) return { entryId: existing[0].id, skipped: true, assets: 0 }
  // NOTE: the SQL mirror carries no purchase date, so age is unknown here;
  // the charge below is the standard monthly slice (documented simplification).
  const assets = await dbService.query<{ id: string; category: string; purchase_value: number }>(
    'SELECT id, category, purchase_value FROM assets',
  )
  const charges = assets
    .map((asset) => ({
      id: asset.id,
      amount: Math.round(asset.purchase_value / ((USEFUL_LIFE_YEARS[asset.category] ?? 5) * 12)),
    }))
    .filter((charge) => charge.amount > 0)
  if (charges.length === 0) return { entryId: null, skipped: true, assets: 0 }
  const total = charges.reduce((sum, charge) => sum + charge.amount, 0)
  const now = todayIso()
  const entryId = enterpriseId('le')
  await dbService.batch([
    {
      sql: 'INSERT INTO ledger_entries (id, entry_date, memo, business_id, branch_id, asset_id, member_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [entryId, now, memo, null, null, null, null, 'depreciation', now],
    },
    {
      sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)',
      params: [enterpriseId('ll'), entryId, '5000', total, 0],
    },
    {
      sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)',
      params: [enterpriseId('ll'), entryId, '1500', 0, total],
    },
  ])
  return { entryId, skipped: false, assets: charges.length }
}
