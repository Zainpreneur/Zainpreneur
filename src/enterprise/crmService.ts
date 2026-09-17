/**
 * CRM/Invoicing bridge: client receivables, milestone payments, aging.
 */
import { dbService } from '../db/dbService'
import type { InvoiceRow } from '../db/schema'
import { enterpriseId, todayIso } from './ids'

export class BillingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BillingError'
  }
}

export async function listInvoices(status?: string): Promise<Array<InvoiceRow & { business_name: string }>> {
  return dbService.query(
    `SELECT i.*, b.name AS business_name FROM invoices i
     JOIN businesses b ON b.id = i.business_id
     ${status ? 'WHERE i.status = ?' : ''} ORDER BY i.due_date`,
    status ? [status] : undefined,
  )
}

export async function createInvoice(input: {
  businessId: string
  amount: number
  dueDate: string
  milestoneRef?: string
}): Promise<{ id: string; invoiceNo: string }> {
  if (!(input.amount > 0)) throw new BillingError('Invoice amount must be positive')
  const biz = await dbService.query<{ id: string; name: string }>('SELECT id, name FROM businesses WHERE id = ?', [input.businessId])
  if (biz.length === 0) throw new BillingError(`Business ${input.businessId} does not exist`)
  const existing = await dbService.query<{ n: number }>('SELECT COUNT(*) AS n FROM invoices WHERE business_id = ?', [input.businessId])
  const short = biz[0].name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'CL'
  const invoiceNo = `INV-${short}-${String((existing[0]?.n ?? 0) + 1).padStart(4, '0')}`
  const id = enterpriseId('inv')
  const now = todayIso()
  await dbService.batch([
    {
      sql: 'INSERT INTO invoices (id, business_id, invoice_no, issue_date, due_date, amount, amount_paid, status, milestone_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [id, input.businessId, invoiceNo, now, input.dueDate, input.amount, 0, 'sent', input.milestoneRef ?? null],
    },
    {
      sql: 'INSERT INTO ledger_entries (id, entry_date, memo, business_id, branch_id, asset_id, member_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [enterpriseId('le'), now, `Invoice ${invoiceNo} issued`, input.businessId, null, null, null, 'billing', now],
    },
  ])
  const [entry] = await dbService.query<{ id: string }>('SELECT id FROM ledger_entries WHERE memo = ? ORDER BY created_at DESC LIMIT 1', [`Invoice ${invoiceNo} issued`])
  await dbService.batch([
    { sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)', params: [enterpriseId('ll'), entry.id, '1100', input.amount, 0] },
    { sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)', params: [enterpriseId('ll'), entry.id, '4000', 0, input.amount] },
  ])
  return { id, invoiceNo }
}

export async function recordPayment(invoiceId: string, amount: number): Promise<{ status: string; outstanding: number }> {
  if (!(amount > 0)) throw new BillingError('Payment amount must be positive')
  const rows = await dbService.query<InvoiceRow>('SELECT * FROM invoices WHERE id = ?', [invoiceId])
  const invoice = rows[0]
  if (!invoice) throw new BillingError(`Invoice ${invoiceId} does not exist`)
  const outstanding = invoice.amount - invoice.amount_paid
  if (amount - outstanding > 0.01) throw new BillingError(`Overpayment: ${outstanding.toFixed(2)} outstanding`)
  const paid = invoice.amount_paid + amount
  const status = paid >= invoice.amount - 0.01 ? 'paid' : 'partial'
  const now = todayIso()
  const entryId = enterpriseId('le')
  await dbService.batch([
    { sql: 'UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ?', params: [paid, status, invoiceId] },
    {
      sql: 'INSERT INTO ledger_entries (id, entry_date, memo, business_id, branch_id, asset_id, member_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [entryId, now, `Payment on ${invoice.invoice_no}`, invoice.business_id, null, null, null, 'billing', now],
    },
    { sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)', params: [enterpriseId('ll'), entryId, '1000', amount, 0] },
    { sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)', params: [enterpriseId('ll'), entryId, '1100', 0, amount] },
  ])
  return { status, outstanding: Math.max(0, outstanding - amount) }
}

export interface AgingBucket {
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+'
  outstanding: number
  invoices: number
}

export async function receivablesAging(asOf = todayIso()): Promise<{ buckets: AgingBucket[]; total: number }> {
  const rows = await dbService.query<{ due_date: string; outstanding: number; id: string }>(
    `SELECT due_date, amount - amount_paid AS outstanding, id FROM invoices
     WHERE status IN ('sent', 'partial', 'overdue') AND amount - amount_paid > 0.01`,
  )
  const buckets: AgingBucket[] = [
    { bucket: 'current', outstanding: 0, invoices: 0 },
    { bucket: '1-30', outstanding: 0, invoices: 0 },
    { bucket: '31-60', outstanding: 0, invoices: 0 },
    { bucket: '61-90', outstanding: 0, invoices: 0 },
    { bucket: '90+', outstanding: 0, invoices: 0 },
  ]
  const nowMs = new Date(asOf).getTime()
  for (const row of rows) {
    const daysPast = Math.floor((nowMs - new Date(row.due_date).getTime()) / 86_400_000)
    const bucket = daysPast <= 0 ? buckets[0] : daysPast <= 30 ? buckets[1] : daysPast <= 60 ? buckets[2] : daysPast <= 90 ? buckets[3] : buckets[4]
    bucket.outstanding += row.outstanding
    bucket.invoices += 1
  }
  return { buckets, total: buckets.reduce((sum, b) => sum + b.outstanding, 0) }
}
