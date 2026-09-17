import { useEffect, useState } from 'react'

import { useBusinesses } from '../../context/BusinessContext'
import { useToast } from '../../context/ToastContext'
import {
  assertBalanced,
  getMasterStatements,
  postCapTableDistribution,
  postDepreciation,
  profitAndLoss,
  type TrialBalanceRow,
} from '../../enterprise/ledgerService'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'
import { Button } from '../common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'
import { Field, Select, TextInput } from '../common/Input'

export function LedgerPanel() {
  const { businesses, settings } = useBusinesses()
  const { notify } = useToast()
  const [trial, setTrial] = useState<TrialBalanceRow[]>([])
  const [balanced, setBalanced] = useState(true)
  const [pnl, setPnl] = useState({ revenue: 0, expenses: 0, profit: 0 })
  const [bizPnl, setBizPnl] = useState({ revenue: 0, expenses: 0, profit: 0 })
  const [bizId, setBizId] = useState('')
  const [depMonth, setDepMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [distBiz, setDistBiz] = useState('')
  const [distProfit, setDistProfit] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = async () => {
    const master = await getMasterStatements()
    setTrial(master.trial)
    setBalanced(master.balanced)
    setPnl(master.pnl)
    if (bizId) setBizPnl(await profitAndLoss(bizId))
  }

  useEffect(() => {
    void refresh().catch((err: unknown) => notify(err instanceof Error ? err.message : String(err), 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!bizId) return
    void profitAndLoss(bizId).then(setBizPnl).catch(() => {})
  }, [bizId])

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key)
    try {
      notify(await fn())
      await refresh()
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
            <CardTitle>Zainpreneur Master P&L</CardTitle>
            <CardDescription>Consolidated corporate statement, all ventures</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Stat label="Revenue" value={formatCurrency(pnl.revenue, settings.currency, { compact: true })} tone="text-slate-900 dark:text-white" />
          <Stat label="Expenses" value={formatCurrency(pnl.expenses, settings.currency, { compact: true })} tone="text-rose-600 dark:text-rose-400" />
          <Stat label="Net profit" value={formatCurrency(pnl.profit, settings.currency, { compact: true, signed: true })} tone={pnl.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} />
          <Field label="Per business" htmlFor="lg-biz">
            <Select id="lg-biz" value={bizId} onChange={(e) => setBizId(e.target.value)}>
              <option value="">Portfolio</option>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          {bizId && (
            <p className="text-xs text-slate-500">
              {businesses.find((b) => b.id === bizId)?.name}: {formatCurrency(bizPnl.profit, settings.currency, { compact: true, signed: true })} profit
            </p>
          )}
          <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
            <Field label="Depreciation month (YYYY-MM)" htmlFor="lg-dep">
              <TextInput id="lg-dep" value={depMonth} onChange={(e) => setDepMonth(e.target.value)} placeholder="2026-09" />
            </Field>
            <Button
              variant="secondary" className="w-full" disabled={busy === 'dep'}
              onClick={() => void run('dep', async () => {
                const res = await postDepreciation(depMonth)
                return res.skipped ? 'Depreciation already posted for this month' : `Depreciation posted for ${res.assets} assets`
              })}
            >
              {busy === 'dep' ? 'Posting…' : 'Post depreciation'}
            </Button>
          </div>
          <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
            <Field label="Equity distribution — business" htmlFor="lg-dist-biz">
              <Select id="lg-dist-biz" value={distBiz} onChange={(e) => setDistBiz(e.target.value)}>
                <option value="">Select…</option>
                {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Profit to distribute (PKR)" htmlFor="lg-dist-profit">
              <TextInput id="lg-dist-profit" type="number" min={0} value={distProfit} onChange={(e) => setDistProfit(e.target.value)} />
            </Field>
            <Button
              variant="secondary" className="w-full" disabled={!distBiz || busy === 'dist'}
              onClick={() => void run('dist', async () => {
                const res = await postCapTableDistribution(distBiz, Number(distProfit), new Date().toISOString().slice(0, 7))
                return res.skipped ? 'Distribution already posted for this period' : 'Distribution posted per cap table'
              })}
            >
              {busy === 'dist' ? 'Posting…' : 'Distribute by cap table'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Master trial balance</CardTitle>
            <CardDescription>Zainpreneur books · debits must equal credits</CardDescription>
          </div>
          <span className={cn('rounded-full px-3 py-1 text-xs font-bold ring-1', balanced ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300')}>
            {balanced ? 'Balanced' : 'Out of balance'}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                  <th className="px-5 py-3">Code</th>
                  <th className="px-3 py-3">Account</th>
                  <th className="px-3 py-3 text-right">Debit</th>
                  <th className="px-3 py-3 text-right">Credit</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trial.map((row) => (
                  <tr key={row.code}>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{row.code}</td>
                    <td className="px-3 py-2.5 font-semibold">{row.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.debit ? formatCurrency(row.debit, settings.currency, { compact: true }) : '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.credit ? formatCurrency(row.credit, settings.currency, { compact: true }) : '—'}</td>
                    <td className="px-5 py-2.5 text-right font-bold tabular-nums">{formatCurrency(row.balance, settings.currency, { compact: true, signed: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-5">
            <Button
              variant="ghost" disabled={busy === 'check'}
              onClick={() => void run('check', async () => {
                await assertBalanced()
                return 'Ledger verified — debits equal credits'
              })}
            >
              {busy === 'check' ? 'Checking…' : 'Verify balance'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className={cn('font-display text-lg font-extrabold tabular-nums', tone)}>{value}</span>
    </div>
  )
}
