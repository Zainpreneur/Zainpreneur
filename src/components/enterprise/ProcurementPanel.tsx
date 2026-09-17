import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Plus } from 'lucide-react'

import type { DbAssetCategory } from '../../db/schema'
import { ASSET_CATEGORY_LABELS } from '../../types'
import { useBusinesses } from '../../context/BusinessContext'
import { useToast } from '../../context/ToastContext'
import {
  approvePurchaseOrder,
  createPurchaseOrder,
  listPurchaseOrders,
  listVendors,
  receivePurchaseOrder,
  setPurchaseOrderStatus,
  type PoItemInput,
  type PurchaseOrderWithItems,
} from '../../enterprise/procurementService'
import type { VendorRow } from '../../db/schema'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'
import { Field, Select, Textarea, TextInput } from '../common/Input'
import { Modal } from '../common/Modal'

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 ring-1 ring-slate-500/20 dark:bg-white/5 dark:text-slate-300',
  sent: 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300',
  approved: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300',
  received: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  cancelled: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300',
}

export function ProcurementPanel() {
  const { businesses, settings } = useBusinesses()
  const { notify } = useToast()
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [orders, setOrders] = useState<PurchaseOrderWithItems[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [v, o] = await Promise.all([
        listVendors(false),
        listPurchaseOrders(statusFilter === 'all' ? undefined : statusFilter),
      ])
      setVendors(v)
      setOrders(o)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const act = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusyId(id)
    try {
      await fn()
      notify(done)
      await refresh()
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Vendors</CardTitle>
            <CardDescription>{vendors.length} supplier profiles</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {vendors.map((v) => (
            <div key={v.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-sm font-bold">
                {v.name}{' '}
                {v.team_member_id && (
                  <Link to="/team" className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-600/20 hover:underline dark:bg-amber-500/10 dark:text-amber-300">
                    Agency partner
                  </Link>
                )}
              </p>
              <p className="text-xs text-slate-500">{v.email} · {v.payment_terms}{v.rating ? ` · ★${v.rating}` : ''}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Purchase orders</CardTitle>
            <CardDescription>Receiving an approved PO provisions the asset pool</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="PO status filter">
              <option value="all">All statuses</option>
              {['draft', 'sent', 'approved', 'received', 'cancelled'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Button icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>New PO</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading purchase orders…</p>
          ) : error ? (
            <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No purchase orders in this state.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{order.vendor_name}</span>
                    <Badge className={STATUS_CLASS[order.status]}>{order.status}</Badge>
                    <span className="ml-auto font-display text-sm font-extrabold tabular-nums">
                      {formatCurrency(order.total, settings.currency, { compact: true })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {order.items.length} item(s) · ordered {order.order_date.slice(0, 10)}
                    {order.business_id ? ` · ${businesses.find((b) => b.id === order.business_id)?.name ?? ''}` : ''}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    {order.items.map((item) => (
                      <li key={item.id}>· {item.qty}× {item.name} ({ASSET_CATEGORY_LABELS[item.category]}) — {formatCurrency(item.qty * item.unit_price, settings.currency, { compact: true })}{item.asset_id ? ' → pooled' : ''}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.status === 'draft' && (
                      <Button size="sm" variant="secondary" disabled={busyId === order.id} onClick={() => void act(order.id, () => setPurchaseOrderStatus(order.id, 'sent'), 'PO sent to vendor')}>Send</Button>
                    )}
                    {(order.status === 'draft' || order.status === 'sent') && (
                      <Button size="sm" variant="secondary" disabled={busyId === order.id} onClick={() => void act(order.id, () => approvePurchaseOrder(order.id), 'PO approved')}>Approve</Button>
                    )}
                    {order.status === 'approved' && (
                      <Button
                        size="sm"
                        disabled={busyId === order.id}
                        onClick={() => void act(order.id, async () => {
                          const res = await receivePurchaseOrder(order.id)
                          notify(`PO received — ${res.assetIds.length} asset(s) pooled`)
                        }, 'PO received')}
                      >
                        Receive & pool assets
                      </Button>
                    )}
                    {(order.status === 'draft' || order.status === 'sent' || order.status === 'approved') && (
                      <Button size="sm" variant="ghost" disabled={busyId === order.id} onClick={() => void act(order.id, () => setPurchaseOrderStatus(order.id, 'cancelled'), 'PO cancelled')}>Cancel</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <CreatePoModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false)
            void refresh()
          }}
        />
      )}
    </div>
  )
}

const EMPTY_ITEM: PoItemInput = { name: '', category: 'hardware', qty: 1, unitPrice: 0, serialNumber: '' }

function CreatePoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { businesses } = useBusinesses()
  const { notify } = useToast()
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [vendorId, setVendorId] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PoItemInput[]>([{ ...EMPTY_ITEM }])
  const [error, setError] = useState('')

  useEffect(() => {
    void listVendors().then((v) => {
      setVendors(v)
      if (v[0]) setVendorId(v[0].id)
    }).catch(() => {})
  }, [])

  const submit = async () => {
    setError('')
    try {
      await createPurchaseOrder({ vendorId, businessId: businessId || undefined, notes: notes || undefined, items })
      notify('Purchase order drafted')
      onCreated()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      notify(message, 'error')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New purchase order"
      description="Draft a PO with a vendor — receiving provisions the asset pool."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()}>Create draft PO</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vendor" htmlFor="po-vendor">
          <Select id="po-vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        </Field>
        <Field label="For business (optional)" htmlFor="po-biz">
          <Select id="po-biz" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
            <option value="">Unassigned</option>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-800">
            <Field label={`Item ${index + 1}`} htmlFor={`po-item-${index}`}>
              <TextInput id={`po-item-${index}`} value={item.name} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === index ? { ...it, name: e.target.value } : it)))} placeholder="e.g. Paint spray gun" />
            </Field>
            <Field label="Category" htmlFor={`po-cat-${index}`}>
              <Select id={`po-cat-${index}`} value={item.category} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === index ? { ...it, category: e.target.value as DbAssetCategory } : it)))}>
                {(Object.keys(ASSET_CATEGORY_LABELS) as DbAssetCategory[]).map((c) => <option key={c} value={c}>{ASSET_CATEGORY_LABELS[c]}</option>)}
              </Select>
            </Field>
            <Field label="Qty" htmlFor={`po-qty-${index}`}>
              <TextInput id={`po-qty-${index}`} type="number" min={1} value={String(item.qty)} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === index ? { ...it, qty: Number(e.target.value) || 0 } : it)))} />
            </Field>
            <Field label="Unit price (PKR)" htmlFor={`po-price-${index}`}>
              <TextInput id={`po-price-${index}`} type="number" min={0} value={String(item.unitPrice)} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === index ? { ...it, unitPrice: Number(e.target.value) || 0 } : it)))} />
            </Field>
            <div className={cn('sm:col-span-2 flex items-end gap-2')}>
              <div className="flex-1">
                <Field label="Serial (optional)" htmlFor={`po-sn-${index}`}>
                  <TextInput id={`po-sn-${index}`} value={item.serialNumber} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === index ? { ...it, serialNumber: e.target.value } : it)))} />
                </Field>
              </div>
              {items.length > 1 && (
                <Button variant="ghost" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}>Remove</Button>
              )}
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}>Add item</Button>
        <Field label="Notes" htmlFor="po-notes">
          <Textarea id="po-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Modal>
  )
}
