// @ts-nocheck
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Plus, Search } from 'lucide-react'

import { invoicesApi } from '../../api/invoices'
import { Button } from '../common/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card'
import { Badge } from '../common/Badge'
import { EmptyState } from '../common/EmptyState'
import { Modal } from '../common/Modal'
import { Tabs } from '../common/Tabs'
import { Skeleton } from '../common/Skeleton'
import { Field, TextInput } from '../common/Input'

type Tab = 'invoices' | 'aging'

const statusBadge = (status: string) => {
  const map: Record<string, { tone: string; dot: string }> = {
    paid: { tone: 'success', dot: 'emerald' },
    pending: { tone: 'warning', dot: 'amber' },
    overdue: { tone: 'danger', dot: 'rose' },
  }
  const s = map[status] ?? { tone: 'info', dot: 'sky' }
  return <Badge tone={s.tone} dot={s.dot}>{status}</Badge>
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export function BillingPanel() {
  const [tab, setTab] = useState<Tab>('invoices')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [payInvoice, setPayInvoice] = useState<{ id: string; outstanding: number } | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const queryClient = useQueryClient()

  const invoices = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  })

  const aging = useQuery({
    queryKey: ['invoices', 'aging'],
    queryFn: () => invoicesApi.aging(),
  })

  const createMutation = useMutation({
    mutationFn: (input: any) => invoicesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowNew(false)
    },
  })

  const payMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => invoicesApi.recordPayment(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoices', 'aging'] })
      setPayInvoice(null)
      setPayAmount('')
    },
  })

  const invoiceList = invoices.data?.data ?? invoices.data ?? []
  const filtered = invoiceList.filter((inv: any) =>
    search ? inv.invoiceNo?.toLowerCase().includes(search.toLowerCase()) || inv.business?.name?.toLowerCase().includes(search.toLowerCase()) : true,
  )

  const agingData = aging.data?.data ?? aging.data ?? {}
  const agingBuckets = [
    { label: 'Current', value: agingData.current ?? 0 },
    { label: '1-30 days', value: agingData['1-30'] ?? 0 },
    { label: '31-60 days', value: agingData['31-60'] ?? 0 },
    { label: '61-90 days', value: agingData['61-90'] ?? 0 },
    { label: '90+ days', value: agingData['90+'] ?? 0 },
  ]
  const agingTotal = agingBuckets.reduce((s, b) => s + b.value, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-bold text-slate-800 dark:text-slate-100">Billing</h2>
        <Button icon={<Plus className="size-4" />} onClick={() => setShowNew(true)}>
          New Invoice
        </Button>
      </div>

      <Tabs
        options={[
          { value: 'invoices', label: 'Invoices', count: invoiceList.length },
          { value: 'aging', label: 'Aging Report' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'invoices' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                <DollarSign className="size-5" />
              </span>
              <CardTitle>Invoices</CardTitle>
            </div>
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoices…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-56 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {invoices.isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="No invoices yet"
                description="Create your first invoice to get started."
                action={<Button onClick={() => setShowNew(true)}>New Invoice</Button>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Invoice #</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Business</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Amount</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Paid</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Outstanding</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Due Date</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Status</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{inv.invoiceNo}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{inv.business?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-800 dark:text-slate-100">{fmt(inv.amount)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(inv.paid ?? 0)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">{fmt(inv.outstanding ?? inv.amount)}</td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                        <td className="px-5 py-3">{statusBadge(inv.status ?? 'pending')}</td>
                        <td className="px-5 py-3 text-right">
                          {inv.status !== 'paid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPayInvoice({ id: inv.id, outstanding: inv.outstanding ?? inv.amount })}
                            >
                              Record Payment
                            </Button>
                          )}
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

      {tab === 'aging' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                <DollarSign className="size-5" />
              </span>
              <CardTitle>Aging Report</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {aging.isLoading ? (
              <div className="grid grid-cols-5 gap-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {agingBuckets.map((bucket) => (
                    <div
                      key={bucket.label}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {bucket.label}
                      </p>
                      <p className="mt-1 font-display text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                        {fmt(bucket.value)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total Outstanding</span>
                  <span className="font-display text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    {fmt(agingTotal)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* New Invoice Modal */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New Invoice"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button
              disabled={createMutation.isPending}
              onClick={() => {
                const form = document.getElementById('new-invoice-form') as HTMLFormElement
                if (!form) return
                const fd = new FormData(form)
                createMutation.mutate({
                  businessId: fd.get('businessId'),
                  invoiceNo: fd.get('invoiceNo'),
                  amount: Number(fd.get('amount')),
                  issueDate: fd.get('issueDate'),
                  dueDate: fd.get('dueDate'),
                })
              }}
            >
              {createMutation.isPending ? 'Creating…' : 'Create Invoice'}
            </Button>
          </>
        }
      >
        <form id="new-invoice-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Field label="Business ID" required>
            <TextInput name="businessId" placeholder="Business ID" />
          </Field>
          <Field label="Invoice Number" required>
            <TextInput name="invoiceNo" placeholder="INV-001" />
          </Field>
          <Field label="Amount" required>
            <TextInput name="amount" type="number" placeholder="0.00" step="0.01" min="0" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Issue Date" required>
              <TextInput name="issueDate" type="date" />
            </Field>
            <Field label="Due Date" required>
              <TextInput name="dueDate" type="date" />
            </Field>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={!!payInvoice}
        onClose={() => { setPayInvoice(null); setPayAmount('') }}
        title="Record Payment"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setPayInvoice(null); setPayAmount('') }}>Cancel</Button>
            <Button
              disabled={!payAmount || payMutation.isPending}
              onClick={() => {
                if (payInvoice && payAmount) {
                  payMutation.mutate({ id: payInvoice.id, amount: Number(payAmount) })
                }
              }}
            >
              {payMutation.isPending ? 'Processing…' : 'Record Payment'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Outstanding balance: <span className="font-bold">{payInvoice ? fmt(payInvoice.outstanding) : '—'}</span>
          </p>
          <Field label="Payment Amount" required>
            <TextInput
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              max={payInvoice?.outstanding}
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
