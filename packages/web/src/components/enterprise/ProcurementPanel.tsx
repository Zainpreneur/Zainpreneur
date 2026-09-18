// @ts-nocheck
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, Plus, Star } from 'lucide-react'

import { procurementApi } from '../../api/procurement'
import { Button } from '../common/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card'
import { Badge } from '../common/Badge'
import { EmptyState } from '../common/EmptyState'
import { Modal } from '../common/Modal'
import { Tabs } from '../common/Tabs'
import { Skeleton } from '../common/Skeleton'
import { Field, TextInput } from '../common/Input'

type Tab = 'vendors' | 'orders'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

const statusBadge = (status: string) => {
  const map: Record<string, { tone: string; dot: string }> = {
    draft: { tone: 'info', dot: 'sky' },
    pending: { tone: 'warning', dot: 'amber' },
    approved: { tone: 'success', dot: 'emerald' },
    delivered: { tone: 'success', dot: 'emerald' },
    cancelled: { tone: 'danger', dot: 'rose' },
  }
  const s = map[status] ?? { tone: 'info', dot: 'sky' }
  return <Badge tone={s.tone} dot={s.dot}>{status}</Badge>
}

const renderStars = (rating: number) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`size-3.5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
      />
    ))}
  </div>
)

export function ProcurementPanel() {
  const [tab, setTab] = useState<Tab>('vendors')
  const [showNewVendor, setShowNewVendor] = useState(false)
  const [showNewPO, setShowNewPO] = useState(false)
  const queryClient = useQueryClient()

  const vendors = useQuery({
    queryKey: ['procurement', 'vendors'],
    queryFn: () => procurementApi.listVendors(),
  })

  const purchaseOrders = useQuery({
    queryKey: ['procurement', 'purchase-orders'],
    queryFn: () => procurementApi.listPurchaseOrders(),
  })

  const vendorList = vendors.data?.data ?? vendors.data ?? []
  const poList = purchaseOrders.data?.data ?? purchaseOrders.data ?? []

  const createVendor = useMutation({
    mutationFn: (draft: any) => procurementApi.createVendor(draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'vendors'] })
      setShowNewVendor(false)
    },
  })

  const createPO = useMutation({
    mutationFn: (draft: any) => procurementApi.createPurchaseOrder(draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] })
      setShowNewPO(false)
    },
  })

  const updatePOStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => procurementApi.updatePoStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-bold text-slate-800 dark:text-slate-100">Procurement</h2>
        <div className="flex gap-2">
          {tab === 'vendors' && (
            <Button icon={<Plus className="size-4" />} onClick={() => setShowNewVendor(true)}>
              Add Vendor
            </Button>
          )}
          {tab === 'orders' && (
            <Button icon={<Plus className="size-4" />} onClick={() => setShowNewPO(true)}>
              Create PO
            </Button>
          )}
        </div>
      </div>

      <Tabs
        options={[
          { value: 'vendors', label: 'Vendors', count: vendorList.length },
          { value: 'orders', label: 'Purchase Orders', count: poList.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Vendors Tab */}
      {tab === 'vendors' && (
        <div>
          {vendors.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-36 rounded-[22px]" />
              ))}
            </div>
          ) : vendorList.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No vendors yet"
              description="Add a vendor to start procuring goods and services."
              action={<Button onClick={() => setShowNewVendor(true)}>Add Vendor</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vendorList.map((v: any) => (
                <Card key={v.id}>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-sm font-bold text-slate-800 dark:text-slate-100">{v.name}</p>
                      {v.rating != null && renderStars(v.rating)}
                    </div>
                    <Badge tone="info">{v.category ?? 'General'}</Badge>
                    {v.contactEmail && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{v.contactEmail}</p>
                    )}
                    {v.phone && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{v.phone}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Purchase Orders Tab */}
      {tab === 'orders' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <ShoppingCart className="size-5" />
              </span>
              <CardTitle>Purchase Orders</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {purchaseOrders.isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : poList.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="No purchase orders"
                description="Create a purchase order to procure goods."
                action={<Button onClick={() => setShowNewPO(true)}>Create PO</Button>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">PO #</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Vendor</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Date</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Total</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Status</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {poList.map((po: any) => (
                      <tr key={po.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{po.poNumber ?? po.id}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{po.vendorName ?? po.vendorId ?? '—'}</td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                          {po.date ? new Date(po.date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-800 dark:text-slate-100">{fmt(po.total ?? 0)}</td>
                        <td className="px-5 py-3">{statusBadge(po.status ?? 'draft')}</td>
                        <td className="px-5 py-3 text-right">
                          <select
                            value={po.status ?? 'draft'}
                            onChange={(e) => updatePOStatus.mutate({ id: po.id, status: e.target.value })}
                            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <option value="draft">Draft</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* New Vendor Modal */}
      <Modal
        open={showNewVendor}
        onClose={() => setShowNewVendor(false)}
        title="Add Vendor"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewVendor(false)}>Cancel</Button>
            <Button
              disabled={createVendor.isPending}
              onClick={() => {
                const form = document.getElementById('new-vendor-form') as HTMLFormElement
                if (!form) return
                const fd = new FormData(form)
                createVendor.mutate({
                  name: fd.get('name'),
                  category: fd.get('category'),
                  contactEmail: fd.get('contactEmail'),
                  phone: fd.get('phone'),
                })
              }}
            >
              {createVendor.isPending ? 'Adding…' : 'Add Vendor'}
            </Button>
          </>
        }
      >
        <form id="new-vendor-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Field label="Vendor Name" required>
            <TextInput name="name" placeholder="Acme Supplies" />
          </Field>
          <Field label="Category">
            <TextInput name="category" placeholder="Office / IT / Materials" />
          </Field>
          <Field label="Contact Email">
            <TextInput name="contactEmail" type="email" placeholder="vendor@example.com" />
          </Field>
          <Field label="Phone">
            <TextInput name="phone" placeholder="+1 (555) 000-0000" />
          </Field>
        </form>
      </Modal>

      {/* New Purchase Order Modal */}
      <Modal
        open={showNewPO}
        onClose={() => setShowNewPO(false)}
        title="Create Purchase Order"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewPO(false)}>Cancel</Button>
            <Button
              disabled={createPO.isPending}
              onClick={() => {
                const form = document.getElementById('new-po-form') as HTMLFormElement
                if (!form) return
                const fd = new FormData(form)
                createPO.mutate({
                  vendorId: fd.get('vendorId'),
                  items: fd.get('items'),
                  expectedDate: fd.get('expectedDate'),
                })
              }}
            >
              {createPO.isPending ? 'Creating…' : 'Create PO'}
            </Button>
          </>
        }
      >
        <form id="new-po-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Field label="Vendor ID" required>
            <TextInput name="vendorId" placeholder="Vendor ID" />
          </Field>
          <Field label="Items (description)" required>
            <TextInput name="items" placeholder="Item description and quantity" />
          </Field>
          <Field label="Expected Date">
            <TextInput name="expectedDate" type="date" />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
