import { useEffect, useState } from 'react'

import { Plus } from 'lucide-react'

import { useBusinesses } from '../../context/BusinessContext'
import { useToast } from '../../context/ToastContext'
import {
  createInvoice,
  listInvoices,
  receivablesAging,
  recordPayment,
  type AgingBucket,
} from '../../enterprise/crmService'
import { formatCurrency } from '../../utils/format'
import { Button } from '../common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'
import { Badge } from '../common/Badge'
import { Field, Select, TextInput } from '../common/Input'
import { Modal } from '../common/Modal'

type Invoice = Awaited<ReturnType<typeof listInvoices>>[number]

export function BillingPanel() {
  const { settings } = useBusinesses()
  const { notify } = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [aging, setAging] = useState<AgingBucket[]>([])
  const [total, setTotal] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [paying, setPaying] = useState<Invoice | null>(null)

  const refresh = async () => {
    const [list, age] = await Promise.all([listInvoices(), receivablesAging()])
    setInvoices(list)
    setAging(age.buckets)
    setTotal(age.total)
  }

  useEffect(() => {
    void refresh().catch((err: unknown) => notify(err instanceof Error ? err.message : String(err), 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Receivables aging</CardTitle>
            <CardDescription>{formatCurrency(total, settings.currency, { compact: true })} outstanding</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {aging.map((bucket) => (
            <div key={bucket.bucket} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
              <span className="font-bold">{bucket.bucket === 'current' ? 'Current' : `${bucket.bucket} days`} <span className="font-medium text-slate-400">({bucket.invoices})</span></span>
              <span className="font-extrabold tabular-nums">{formatCurrency(bucket.outstanding, settings.currency, { compact: true })}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Client invoices</CardTitle>
            <CardDescription>Milestone payments & retainer renewals</CardDescription>
          </div>
          <Button icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>New invoice</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {invoices.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No invoices yet.</p>}
          {invoices.map((invoice) => {
            const outstanding = invoice.amount - invoice.amount_paid
            return (
              <div key={invoice.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{invoice.invoice_no} · {invoice.business_name}</span>
                  <span className="block text-xs text-slate-500">
                    Due {invoice.due_date.slice(0, 10)} · {formatCurrency(invoice.amount_paid, settings.currency, { compact: true })} of {formatCurrency(invoice.amount, settings.currency, { compact: true })} paid
                    {invoice.milestone_ref ? ` · ${invoice.milestone_ref}` : ''}
                  </span>
                </span>
                <Badge>{invoice.status}</Badge>
                {outstanding > 0.01 && (
                  <Button size="sm" variant="secondary" onClick={() => setPaying(invoice)}>Record payment</Button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {createOpen && (
        <CreateInvoiceModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false)
            void refresh()
          }}
        />
      )}
      {paying && (
        <PayModal
          invoice={paying}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setPaying(null)
            void refresh()
          }}
        />
      )}
    </div>
  )
}

function CreateInvoiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { businesses } = useBusinesses()
  const { notify } = useToast()
  const clients = businesses.filter((b) => b.category === 'client')
  const [businessId, setBusinessId] = useState(clients[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [milestone, setMilestone] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    try {
      const res = await createInvoice({ businessId, amount: Number(amount), dueDate: new Date(dueDate).toISOString(), milestoneRef: milestone || undefined })
      notify(`Invoice ${res.invoiceNo} issued with ledger posting`)
      onCreated()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      notify(message, 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="New client invoice" description="Issues the invoice and posts Dr Receivables / Cr Revenue." footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => void submit()}>Issue invoice</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client business" htmlFor="inv-biz">
          <Select id="inv-biz" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
            {clients.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Amount (PKR)" htmlFor="inv-amt">
          <TextInput id="inv-amt" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Due date" htmlFor="inv-due">
          <TextInput id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Milestone ref (optional)" htmlFor="inv-ms">
          <TextInput id="inv-ms" value={milestone} onChange={(e) => setMilestone(e.target.value)} />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
    </Modal>
  )
}

function PayModal({ invoice, onClose, onPaid }: { invoice: Invoice; onClose: () => void; onPaid: () => void }) {
  const { settings } = useBusinesses()
  const { notify } = useToast()
  const outstanding = invoice.amount - invoice.amount_paid
  const [amount, setAmount] = useState(String(Math.round(outstanding)))
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    try {
      const res = await recordPayment(invoice.id, Number(amount))
      notify(`Payment recorded — invoice ${res.status}, ${formatCurrency(res.outstanding, settings.currency)} left`)
      onPaid()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      notify(message, 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={`Pay ${invoice.invoice_no}`} description={`${formatCurrency(outstanding, settings.currency)} outstanding.`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => void submit()}>Record payment</Button></>}>
      <Field label="Amount (PKR)" htmlFor="pay-amt">
        <TextInput id="pay-amt" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
    </Modal>
  )
}
