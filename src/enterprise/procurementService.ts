/**
 * Purchasing bridge: vendor purchase orders that auto-provision the
 * Zainpreneur asset pool on receipt, plus double-entry postings.
 */
import { dbService } from '../db/dbService'
import type {
  DbAssetCategory,
  PoItemRow,
  PurchaseOrderRow,
  VendorRow,
} from '../db/schema'
import { enterpriseId, todayIso } from './ids'

export class ProcurementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProcurementError'
  }
}

export interface PoItemInput {
  name: string
  category: DbAssetCategory
  qty: number
  unitPrice: number
  serialNumber?: string
}

export interface PurchaseOrderWithItems extends PurchaseOrderRow {
  items: PoItemRow[]
  vendor_name: string
}

const TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['approved', 'cancelled'],
  approved: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

export async function listVendors(activeOnly = true): Promise<VendorRow[]> {
  return dbService.query<VendorRow>(
    `SELECT * FROM vendors ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY name`,
  )
}

export async function listPurchaseOrders(status?: string): Promise<PurchaseOrderWithItems[]> {
  const orders = await dbService.query<PurchaseOrderRow & { vendor_name: string }>(
    `SELECT p.*, v.name AS vendor_name FROM purchase_orders p
     JOIN vendors v ON v.id = p.vendor_id
     ${status ? 'WHERE p.status = ?' : ''} ORDER BY p.order_date DESC`,
    status ? [status] : undefined,
  )
  const items = await dbService.query<PoItemRow>('SELECT * FROM po_items ORDER BY name')
  const byPo = new Map<string, PoItemRow[]>()
  for (const item of items) {
    const list = byPo.get(item.po_id) ?? []
    list.push(item)
    byPo.set(item.po_id, list)
  }
  return orders.map((order) => ({ ...order, items: byPo.get(order.id) ?? [] }))
}

export async function createPurchaseOrder(input: {
  vendorId: string
  businessId?: string
  expectedDate?: string
  notes?: string
  items: PoItemInput[]
}): Promise<{ id: string }> {
  if (input.items.length === 0) throw new ProcurementError('A purchase order needs at least one item')
  const vendors = await dbService.query<VendorRow>('SELECT id FROM vendors WHERE id = ?', [input.vendorId])
  if (vendors.length === 0) throw new ProcurementError(`Vendor ${input.vendorId} does not exist`)
  for (const item of input.items) {
    if (!item.name.trim()) throw new ProcurementError('Every PO item needs a name')
    if (!(item.qty > 0)) throw new ProcurementError(`Invalid quantity for "${item.name}"`)
    if (item.unitPrice < 0) throw new ProcurementError(`Invalid unit price for "${item.name}"`)
  }
  const id = enterpriseId('po')
  const subtotal = input.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  await dbService.batch([
    {
      sql: 'INSERT INTO purchase_orders (id, vendor_id, business_id, status, order_date, expected_date, subtotal, tax, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [id, input.vendorId, input.businessId ?? null, 'draft', todayIso(), input.expectedDate ?? null, subtotal, 0, subtotal, input.notes ?? null],
    },
    ...input.items.map((item, index) => ({
      sql: 'INSERT INTO po_items (id, po_id, name, category, qty, unit_price, serial_number, asset_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      params: [`${id}-i${index + 1}`, id, item.name.trim(), item.category, item.qty, item.unitPrice, item.serialNumber?.trim() || null, null] as Array<string | number | null>,
    })),
  ])
  return { id }
}

export async function setPurchaseOrderStatus(poId: string, status: 'sent' | 'approved' | 'received' | 'cancelled'): Promise<void> {
  const rows = await dbService.query<PurchaseOrderRow>('SELECT id, status FROM purchase_orders WHERE id = ?', [poId])
  const order = rows[0]
  if (!order) throw new ProcurementError(`Purchase order ${poId} does not exist`)
  if (!(TRANSITIONS[order.status] ?? []).includes(status)) {
    throw new ProcurementError(`Cannot move PO from ${order.status} to ${status}`)
  }
  await dbService.run('UPDATE purchase_orders SET status = ? WHERE id = ?', [status, poId])
}

export async function approvePurchaseOrder(poId: string): Promise<void> {
  const rows = await dbService.query<PurchaseOrderRow>('SELECT id, status FROM purchase_orders WHERE id = ?', [poId])
  const order = rows[0]
  if (!order) throw new ProcurementError(`Purchase order ${poId} does not exist`)
  if (order.status === 'draft') {
    await setPurchaseOrderStatus(poId, 'sent')
    await setPurchaseOrderStatus(poId, 'approved')
    return
  }
  await setPurchaseOrderStatus(poId, 'approved')
}

/**
 * Receive an approved PO. Atomically: PO → received, one `available` asset
 * per unit, item→asset links, and a balanced Dr Equipment / Cr Payables entry.
 */
export async function receivePurchaseOrder(poId: string): Promise<{ assetIds: string[] }> {
  const orders = await dbService.query<PurchaseOrderRow>('SELECT * FROM purchase_orders WHERE id = ?', [poId])
  const order = orders[0]
  if (!order) throw new ProcurementError(`Purchase order ${poId} does not exist`)
  if (order.status !== 'approved') throw new ProcurementError(`Only approved POs can be received (currently ${order.status})`)
  const items = await dbService.query<PoItemRow>('SELECT * FROM po_items WHERE po_id = ?', [poId])
  if (items.length === 0) throw new ProcurementError('PO has no items to receive')

  const now = todayIso()
  const entryId = enterpriseId('le')
  const assetIds: string[] = []
  const stmts: Array<{ sql: string; params?: Array<string | number | null> }> = [
    { sql: 'UPDATE purchase_orders SET status = ? WHERE id = ?', params: ['received', poId] },
  ]
  for (const item of items) {
    for (let unit = 0; unit < item.qty; unit += 1) {
      const assetId = enterpriseId('as')
      assetIds.push(assetId)
      const serial = item.serial_number ? (item.qty > 1 ? `${item.serial_number}-U${unit + 1}` : item.serial_number) : null
      stmts.push({
        sql: 'INSERT INTO assets (id, name, category, asset_owner, serial_number, purchase_value, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [assetId, item.qty > 1 ? `${item.name} #${unit + 1}` : item.name, item.category, 'Zainpreneur', serial, item.unit_price, 'available'],
      })
      if (unit === 0) {
        stmts.push({ sql: 'UPDATE po_items SET asset_id = ? WHERE id = ?', params: [assetId, item.id] })
      }
    }
  }
  stmts.push(
    {
      sql: 'INSERT INTO ledger_entries (id, entry_date, memo, business_id, branch_id, asset_id, member_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [entryId, now, `PO receipt ${poId}`, order.business_id, null, null, null, 'procurement', now],
    },
    { sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)', params: [enterpriseId('ll'), entryId, '1500', order.total, 0] },
    { sql: 'INSERT INTO ledger_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)', params: [enterpriseId('ll'), entryId, '2000', 0, order.total] },
  )
  await dbService.batch(stmts)
  return { assetIds }
}
