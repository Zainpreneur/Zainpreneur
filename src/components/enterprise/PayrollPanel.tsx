import { useEffect, useState } from 'react'

import { useToast } from '../../context/ToastContext'
import { useBusinesses } from '../../context/BusinessContext'
import {
  calculatePayroll,
  listContracts,
  logTimesheet,
  postPayrollRun,
  type PayrollRun,
} from '../../enterprise/hrPayrollService'
import { formatCurrency } from '../../utils/format'
import { Button } from '../common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'
import { Field, Select, TextInput } from '../common/Input'
import { Modal } from '../common/Modal'

const monthRange = (): { from: string; to: string } => {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

export function PayrollPanel() {
  const { settings } = useBusinesses()
  const { notify } = useToast()
  const [range, setRange] = useState(monthRange)
  const [run, setRun] = useState<PayrollRun | null>(null)
  const [busy, setBusy] = useState<'calc' | 'post' | 'log' | null>(null)
  const [contracts, setContracts] = useState<Awaited<ReturnType<typeof listContracts>>>([])
  const [logOpen, setLogOpen] = useState(false)

  useEffect(() => {
    void listContracts().then(setContracts).catch(() => {})
  }, [])

  const calculate = async () => {
    setBusy('calc')
    try {
      setRun(await calculatePayroll({ from: range.from, to: range.to }))
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const post = async () => {
    if (!run) return
    setBusy('post')
    try {
      const res = await postPayrollRun(run)
      notify(`Payroll posted as ledger entry ${res.entryId.slice(0, 12)}…`)
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Contracts</CardTitle>
            <CardDescription>{contracts.length} active across models</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {contracts.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5 text-xs dark:border-slate-800">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.member_name}</span>
                <span className="block text-slate-500">{c.engagement_type} · {c.kind} · {c.billing_cycle}</span>
              </span>
              <span className="font-bold tabular-nums">{c.base_amount.toLocaleString()}{c.currency === 'USD' ? '/hr' : ''}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Payroll run</CardTitle>
            <CardDescription>Salary + hourly timesheets + retainers → ledger</CardDescription>
          </div>
          <Button variant="secondary" onClick={() => setLogOpen(true)}>Log hours</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="From" htmlFor="pr-from">
              <TextInput id="pr-from" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </Field>
            <Field label="To" htmlFor="pr-to">
              <TextInput id="pr-to" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </Field>
            <Button disabled={busy === 'calc'} onClick={() => void calculate()}>
              {busy === 'calc' ? 'Calculating…' : 'Calculate'}
            </Button>
            {run && run.lines.length > 0 && (
              <Button variant="secondary" disabled={busy === 'post'} onClick={() => void post()}>
                {busy === 'post' ? 'Posting…' : 'Post to ledger'}
              </Button>
            )}
          </div>

          {run && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(run.totals).map(([eng, total]) => (
                  <span key={eng} className="rounded-full bg-slate-100 px-3 py-1 font-bold dark:bg-white/5">
                    {eng}: {formatCurrency(total, settings.currency, { compact: true })}
                  </span>
                ))}
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  Total: {formatCurrency(run.grandTotal, settings.currency, { compact: true })}
                </span>
              </div>
              {run.warnings.length > 0 && (
                <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  {run.warnings.join(' · ')}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                      <th className="py-2 pr-3">Member</th>
                      <th className="py-2 pr-3">Kind</th>
                      <th className="py-2 pr-3">Detail</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {run.lines.map((line) => (
                      <tr key={line.memberId}>
                        <td className="py-2 pr-3 font-semibold">{line.memberName}</td>
                        <td className="py-2 pr-3 text-slate-500">{line.kind}</td>
                        <td className="py-2 pr-3 text-xs text-slate-500">{line.detail}</td>
                        <td className="py-2 text-right font-bold tabular-nums">{formatCurrency(line.amount, settings.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {logOpen && (
        <LogHoursModal
          onClose={() => setLogOpen(false)}
          onLogged={() => {
            setLogOpen(false)
            setRun(null)
          }}
        />
      )}
    </div>
  )
}

function LogHoursModal({ onClose, onLogged }: { onClose: () => void; onLogged: () => void }) {
  const { teamMembers, businesses } = useBusinesses()
  const { notify } = useToast()
  const freelancers = teamMembers.filter((m) => m.engagementType === 'freelancer')
  const [memberId, setMemberId] = useState(freelancers[0]?.id ?? '')
  const [businessId, setBusinessId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState('8')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    try {
      const res = await logTimesheet({
        memberId,
        businessId: businessId || undefined,
        date: new Date(date).toISOString(),
        hours: Number(hours),
        note: note || undefined,
      })
      notify(res.queued ? 'Offline — hours queued for sync' : 'Timesheet logged')
      onLogged()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      notify(message, 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="Log freelancer hours" description="Billable by default; offline entries queue automatically." footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => void submit()}>Log hours</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Freelancer" htmlFor="lh-member">
          <Select id="lh-member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {freelancers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Business" htmlFor="lh-biz">
          <Select id="lh-biz" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
            <option value="">Unassigned</option>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Date" htmlFor="lh-date">
          <TextInput id="lh-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Hours" htmlFor="lh-hours">
          <TextInput id="lh-hours" type="number" min={0} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Note" htmlFor="lh-note">
            <TextInput id="lh-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
    </Modal>
  )
}
