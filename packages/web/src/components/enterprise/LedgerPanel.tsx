// @ts-nocheck
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, BookOpen } from 'lucide-react'

import { ledgerApi } from '../../api/ledger'
import { Button } from '../common/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card'
import { Badge } from '../common/Badge'
import { EmptyState } from '../common/EmptyState'
import { Modal } from '../common/Modal'
import { Tabs } from '../common/Tabs'
import { Skeleton } from '../common/Skeleton'
import { Field, TextInput } from '../common/Input'

type Tab = 'trial-balance' | 'pnl'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export function LedgerPanel() {
  const [tab, setTab] = useState<Tab>('trial-balance')
  const [businessFilter, setBusinessFilter] = useState('')
  const [showDepreciation, setShowDepreciation] = useState(false)
  const queryClient = useQueryClient()

  const trialBalance = useQuery({
    queryKey: ['ledger', 'trial-balance'],
    queryFn: () => ledgerApi.trialBalance(),
  })

  const pnl = useQuery({
    queryKey: ['ledger', 'pnl', businessFilter],
    queryFn: () => ledgerApi.profitAndLoss(businessFilter || undefined),
  })

  const postDepreciation = useMutation({
    mutationFn: (periodMonth: string) => ledgerApi.postDepreciation(periodMonth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      setShowDepreciation(false)
    },
  })

  const tbData = trialBalance.data?.data ?? trialBalance.data ?? {}
  const accounts = tbData.accounts ?? tbData ?? []
  const totalDebits = accounts.reduce((s: number, a: any) => s + (a.debit ?? 0), 0)
  const totalCredits = accounts.reduce((s: number, a: any) => s + (a.credit ?? 0), 0)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

  const pnlData = pnl.data?.data ?? pnl.data ?? {}
  const revenue = pnlData.revenue ?? []
  const expenses = pnlData.expenses ?? []
  const totalRevenue = revenue.reduce((s: number, r: any) => s + (r.amount ?? 0), 0)
  const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
  const netIncome = totalRevenue - totalExpenses

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-bold text-slate-800 dark:text-slate-100">Ledger</h2>
        <Button variant="secondary" onClick={() => setShowDepreciation(true)}>
          Post Depreciation
        </Button>
      </div>

      <Tabs
        options={[
          { value: 'trial-balance', label: 'Trial Balance' },
          { value: 'pnl', label: 'Profit & Loss' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Trial Balance Tab */}
      {tab === 'trial-balance' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <BookOpen className="size-5" />
              </span>
              <CardTitle>Trial Balance</CardTitle>
            </div>
            <div className="ml-auto">
              <Badge tone={isBalanced ? 'success' : 'danger'}>
                {isBalanced ? 'Balanced' : 'Out of Balance'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {trialBalance.isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-10 rounded-xl" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No accounts"
                description="Trial balance data will appear here once accounts are set up."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Account</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Debit</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc: any, i: number) => (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{acc.name ?? acc.account ?? '—'}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-800 dark:text-slate-100">
                          {acc.debit ? fmt(acc.debit) : '—'}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-800 dark:text-slate-100">
                          {acc.credit ? fmt(acc.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                      <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-100">Total</td>
                      <td className="px-5 py-3 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{fmt(totalDebits)}</td>
                      <td className="px-5 py-3 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{fmt(totalCredits)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* P&L Tab */}
      {tab === 'pnl' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative ml-auto">
              <TextInput
                value={businessFilter}
                onChange={(e) => setBusinessFilter(e.target.value)}
                placeholder="Filter by business ID"
                className="!h-9 !w-56"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Revenue */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <TrendingUp className="size-5" />
                  </span>
                  <CardTitle>Revenue</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {pnl.isLoading ? (
                  <div className="space-y-3 p-6">
                    {Array.from({ length: 3 }, (_, i) => (
                      <Skeleton key={i} className="h-10 rounded-xl" />
                    ))}
                  </div>
                ) : revenue.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-slate-400">No revenue data</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <tbody>
                        {revenue.map((r: any, i: number) => (
                          <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                            <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{r.name ?? r.category ?? 'Revenue'}</td>
                            <td className="px-5 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(r.amount ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                          <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-100">Total Revenue</td>
                          <td className="px-5 py-3 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(totalRevenue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                    <TrendingDown className="size-5" />
                  </span>
                  <CardTitle>Expenses</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {pnl.isLoading ? (
                  <div className="space-y-3 p-6">
                    {Array.from({ length: 3 }, (_, i) => (
                      <Skeleton key={i} className="h-10 rounded-xl" />
                    ))}
                  </div>
                ) : expenses.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-slate-400">No expense data</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <tbody>
                        {expenses.map((e: any, i: number) => (
                          <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                            <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{e.name ?? e.category ?? 'Expense'}</td>
                            <td className="px-5 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">{fmt(e.amount ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                          <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-100">Total Expenses</td>
                          <td className="px-5 py-3 text-right font-bold tabular-nums text-rose-600 dark:text-rose-400">{fmt(totalExpenses)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Net Income */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className={`flex size-9 items-center justify-center rounded-xl ${netIncome >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'}`}>
                    <TrendingUp className="size-5" />
                  </span>
                  <CardTitle>Net Income</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {pnl.isLoading ? (
                  <Skeleton className="h-16 rounded-xl" />
                ) : (
                  <div className="space-y-3">
                    <p className={`font-display text-3xl font-bold tabular-nums ${netIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {fmt(netIncome)}
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Revenue</span>
                        <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Expenses</span>
                        <span className="tabular-nums text-rose-600 dark:text-rose-400">({fmt(totalExpenses)})</span>
                      </div>
                    </div>
                    <Badge tone={netIncome >= 0 ? 'success' : 'danger'}>
                      {netIncome >= 0 ? 'Profitable' : 'Net Loss'}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Post Depreciation Modal */}
      <Modal
        open={showDepreciation}
        onClose={() => setShowDepreciation(false)}
        title="Post Depreciation"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDepreciation(false)}>Cancel</Button>
            <Button
              disabled={postDepreciation.isPending}
              onClick={() => {
                const form = document.getElementById('depreciation-form') as HTMLFormElement
                if (!form) return
                const fd = new FormData(form)
                postDepreciation.mutate(fd.get('periodMonth') as string)
              }}
            >
              {postDepreciation.isPending ? 'Posting…' : 'Post'}
            </Button>
          </>
        }
      >
        <form id="depreciation-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Field label="Period Month" required>
            <TextInput name="periodMonth" type="month" defaultValue={(() => {
              const now = new Date()
              return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
            })()} />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
