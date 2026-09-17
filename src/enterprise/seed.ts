import type { SqlStatement } from '../db/schema'

const NOW = '2026-09-17T00:00:00Z'

/**
 * Enterprise seed: vendors, purchase orders, HR contracts, timesheets, chart
 * of accounts with balanced opening entries, and client invoices. Runs once
 * (when `vendors` is empty) inside a single transaction.
 */
export function buildEnterpriseSeedStatements(): SqlStatement[] {
  const stmts: SqlStatement[] = []
  const ins = (sql: string, params: Array<string | number | null>): void => {
    stmts.push({ sql, params })
  }

  // Vendors
  const vendors: Array<[string, string, string, string, number]> = [
    ['ven-techsource', 'TechSource Lahore', 'sales@techsource.pk', '+92 300 111 4400', 5],
    ['ven-punjab-machinery', 'Punjab Machinery House', 'info@pmh.pk', '+92 300 222 5500', 4],
    ['ven-odoo-partner', 'Odoo Solutions Pakistan', 'contact@odoo.com.pk', '+92 300 333 6600', 5],
    ['ven-growthbridge', 'GrowthBridge Digital', 'hello@growthbridge.pk', '+92 300 444 7700', 4],
  ]
  for (const [id, name, email, phone, rating] of vendors) {
    ins('INSERT INTO vendors (id, name, email, phone, address, tax_id, payment_terms, rating, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      id, name, email, phone, 'Lahore, Pakistan', null, 'net-30', rating, 1, NOW,
    ])
  }

  // Chart of accounts
  const accounts: Array<[string, string, string]> = [
    ['1000', 'Cash & Bank', 'asset'],
    ['1100', 'Accounts Receivable', 'asset'],
    ['1500', 'Equipment & Hardware', 'asset'],
    ['2000', 'Accounts Payable', 'liability'],
    ['2100', 'Payroll Liability', 'liability'],
    ['2200', 'Shareholder Payable', 'liability'],
    ['3000', 'Owner Equity', 'equity'],
    ['4000', 'Service Revenue', 'revenue'],
    ['5000', 'Operating Expenses', 'expense'],
    ['5100', 'Salary Expense', 'expense'],
    ['5200', 'Contractor Expense', 'expense'],
  ]
  for (const [code, name, type] of accounts) {
    ins('INSERT INTO ledger_accounts (code, name, type, parent_code) VALUES (?, ?, ?, ?)', [code, name, type, null])
  }

  // HR contracts: salary, hourly, retainer across all three engagement models
  const contracts: Array<[string, string, string, number, string, string]> = [
    ['hc-hassan', 'tm-hassan', 'salary', 145000, 'monthly', '2021-07-01'],
    ['hc-mariam', 'tm-mariam', 'salary', 175000, 'monthly', '2020-06-01'],
    ['hc-kashif', 'tm-kashif', 'hourly', 80, 'hourly', '2023-06-01'],
    ['hc-ali', 'tm-ali', 'hourly', 65, 'hourly', '2024-04-01'],
    ['hc-odoo', 'ag-odoo-partner', 'retainer', 250000, 'monthly', '2024-01-15'],
    ['hc-growthbridge', 'ag-marketing-partner', 'retainer', 150000, 'monthly', '2024-03-01'],
  ]
  for (const [id, memberId, kind, amount, cycle, start] of contracts) {
    ins('INSERT INTO hr_contracts (id, member_id, kind, base_amount, currency, start_date, end_date, billing_cycle, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      id, memberId, kind, amount, kind === 'hourly' ? 'USD' : 'PKR', `${start}T00:00:00Z`, null, cycle, 1,
    ])
  }

  // Timesheets (one unsynced row demonstrates the offline outbox path)
  const timesheets: Array<[string, string, string | null, string, number, number]> = [
    ['ts-001', 'tm-kashif', 'biz-stride-sportswear', '2026-09-12', 6, 1],
    ['ts-002', 'tm-kashif', 'biz-stride-sportswear', '2026-09-13', 5.5, 1],
    ['ts-003', 'tm-ali', 'biz-nova-fitness', '2026-09-12', 7, 1],
    ['ts-004', 'tm-ali', 'biz-nova-fitness', '2026-09-15', 4, 0],
  ]
  for (const [id, memberId, businessId, date, hours, synced] of timesheets) {
    ins('INSERT INTO timesheets (id, member_id, business_id, work_date, hours, billable, milestone_ref, note, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      id, memberId, businessId, `${date}T00:00:00Z`, hours, 1, null, null, synced,
    ])
  }

  // Purchase orders
  ins("INSERT INTO purchase_orders (id, vendor_id, business_id, status, order_date, expected_date, subtotal, tax, total, notes) VALUES ('po-001', 'ven-techsource', 'biz-apex-autospa', 'draft', '2026-09-16T00:00:00Z', '2026-10-01T00:00:00Z', 900000, 0, 900000, 'Two workstations for detailing studio')", [])
  ins("INSERT INTO po_items (id, po_id, name, category, qty, unit_price, serial_number, asset_id) VALUES ('poi-001', 'po-001', 'Lenovo ThinkPad E14 Gen 6', 'hardware', 2, 450000, NULL, NULL)", [])
  ins("INSERT INTO purchase_orders (id, vendor_id, business_id, status, order_date, expected_date, subtotal, tax, total, notes) VALUES ('po-002', 'ven-punjab-machinery', 'biz-luxe-laundry', 'approved', '2026-09-10T00:00:00Z', '2026-09-30T00:00:00Z', 410000, 0, 410000, 'Garment conveyor spare')", [])
  ins("INSERT INTO po_items (id, po_id, name, category, qty, unit_price, serial_number, asset_id) VALUES ('poi-002', 'po-002', 'Garment Conveyor Belt Unit', 'machinery', 1, 410000, 'LX-CNV-005', NULL)", [])
  ins("INSERT INTO purchase_orders (id, vendor_id, business_id, status, order_date, expected_date, subtotal, tax, total, notes) VALUES ('po-003', 'ven-techsource', 'biz-mobicom', 'received', '2025-02-05T00:00:00Z', '2025-02-08T00:00:00Z', 620000, 0, 620000, 'Onboarding pool laptop')", [])
  ins("INSERT INTO po_items (id, po_id, name, category, qty, unit_price, serial_number, asset_id) VALUES ('poi-003', 'po-003', 'MacBook Pro 14 M3', 'hardware', 1, 620000, 'C02X2F7KLVDL', 'as-lt-005')", [])

  // Balanced opening ledger entries (every entry nets to zero)
  const entry = (id: string, date: string, memo: string, business: string | null, source: string): void => {
    ins('INSERT INTO ledger_entries (id, entry_date, memo, business_id, branch_id, asset_id, member_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      id, `${date}T00:00:00Z`, memo, business, null, null, null, source, NOW,
    ])
  }
  const line = (id: string, entryId: string, account: string, debit: number, credit: number): void => {
    ins('INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)', [id, entryId, account, debit, credit])
  }
  entry('le-001', '2025-02-08', 'PO-003 receipt: MacBook Pro 14 M3', 'biz-mobicom', 'procurement')
  line('ll-001a', 'le-001', '1500', 620000, 0)
  line('ll-001b', 'le-001', '2000', 0, 620000)
  entry('le-002', '2026-08-28', 'August payroll accrual', null, 'payroll')
  line('ll-002a', 'le-002', '5100', 500000, 0)
  line('ll-002b', 'le-002', '2100', 0, 500000)
  entry('le-003', '2026-09-15', 'Apex membership batch payout', 'biz-apex-autospa', 'billing')
  line('ll-003a', 'le-003', '1000', 320000, 0)
  line('ll-003b', 'le-003', '4000', 0, 320000)
  entry('le-004', '2026-09-06', 'Meta ads spend September', 'biz-stride-sportswear', 'manual')
  line('ll-004a', 'le-004', '5000', 210000, 0)
  line('ll-004b', 'le-004', '1000', 0, 210000)

  // Client invoices
  ins("INSERT INTO invoices (id, business_id, invoice_no, issue_date, due_date, amount, amount_paid, status, milestone_ref) VALUES ('inv-sql-01', 'biz-stride-sportswear', 'INV-ST-1521', '2026-09-15T00:00:00Z', '2026-10-15T00:00:00Z', 185000, 185000, 'paid', NULL)", [])
  ins("INSERT INTO invoices (id, business_id, invoice_no, issue_date, due_date, amount, amount_paid, status, milestone_ref) VALUES ('inv-sql-02', 'biz-nova-fitness', 'INV-NF-0711', '2026-09-14T00:00:00Z', '2026-09-21T00:00:00Z', 330000, 100000, 'partial', 'Studio 2 launch plan')", [])

  return stmts
}
