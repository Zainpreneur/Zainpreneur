import { useMemo, useState } from 'react'

import { Banknote, CircleDollarSign, Plus, Receipt, TrendingDown, Wallet } from 'lucide-react'

import type { BusinessCategory, Transaction, TransactionCategory, TransactionStatus, TransactionType } from '../types'
import { TRANSACTION_CATEGORY_LABELS, TRANSACTION_STATUS_LABELS } from '../types'
import { useBusinesses } from '../context/BusinessContext'
import { formatCurrency, formatPercent } from '../utils/format'
import { businessFinancials, ownerPercentage, portfolioSummary, userDividendShare, userNetShare } from '../utils/calculations'
import { CATEGORY_META, MODEL_META } from '../utils/meta'
import { cn } from '../utils/cn'
import { categoryPerformance } from '../utils/stats'
import { assetUtilization } from '../utils/assets'
import { PageContainer, PageHeader, SectionHeader } from '../components/layout/PageContainer'
import { Button } from '../components/common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/common/Card'
import { Select } from '../components/common/Input'
import { EmptyState } from '../components/common/EmptyState'
import { SearchInput } from '../components/ui/SearchInput'
import { StatCard } from '../components/common/StatCard'
import { TransactionFormModal } from '../components/business/TransactionFormModal'
import { TransactionTable } from '../components/business/TransactionTable'
import { BillingPanel } from '../components/enterprise/BillingPanel'
import { BarChart } from '../components/ui/BarChart'
import { getPortfolioSeries } from '../data'

const CATEGORY_FILTERS: Array<{ value: BusinessCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All categories' },
  { value: 'owned', label: 'Owned' },
  { value: 'equity', label: 'Equity' },
  { value: 'client', label: 'Client' },
]

const PERIODS = [
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
]

export function Financials() {
  const { businesses, transactions, settings, zainOwnerId, addTransaction, updateTransaction, deleteTransaction, logActivity, teamMembers, assets } =
    useBusinesses()

  const [categoryFilter, setCategoryFilter] = useState<BusinessCategory | 'all'>('all')
  const [period, setPeriod] = useState<'6' | '12'>('12')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all')
  const [categoryTxFilter, setCategoryTxFilter] = useState<TransactionCategory | 'all'>('all')
  const [businessFilter, setBusinessFilter] = useState<string>('all')

  const [transactionModal, setTransactionModal] = useState<{ open: boolean; editing?: Transaction }>({ open: false })

  const filteredBusinesses = useMemo(
    () => (categoryFilter === 'all' ? businesses : businesses.filter((b) => b.category === categoryFilter)),
    [businesses, categoryFilter],
  )

  const portfolio = useMemo(() => getPortfolioSeries(filteredBusinesses, Number(period)), [filteredBusinesses, period])

  const summary = useMemo(() => portfolioSummary(filteredBusinesses, zainOwnerId), [filteredBusinesses, zainOwnerId])
  const monthlyRevenue = summary.monthlyRevenue
  const monthlyExpenses = summary.monthlyExpenses
  const monthlyProfit = summary.monthlyProfit
  const monthlyMargin = summary.margin

  const branchRows = useMemo(
    () =>
      [...filteredBusinesses]
        .map((business) => ({
          business,
          financials: businessFinancials(business),
          percentage: ownerPercentage(business, zainOwnerId),
          netShare: userNetShare(business, zainOwnerId),
          dividends: userDividendShare(business, zainOwnerId),
        }))
        .sort((a, b) => b.financials.profit - a.financials.profit),
    [filteredBusinesses, zainOwnerId],
  )

  const categoryRows = useMemo(() => categoryPerformance(filteredBusinesses), [filteredBusinesses])
  const rowTotalRevenue = categoryRows.reduce((sum, row) => sum + row.revenue, 0) || 1

  /** Project-level cost analysis: freelance rates, agency retainers & deployed assets factored per business. */
  const teamCostRows = useMemo(() => {
    const costOf = (id: string, kind: 'internal' | 'freelancer' | 'agency_partner') =>
      teamMembers
        .filter((m) => (m.activeBusinessId ?? m.associatedBusinessId) === id && m.engagementType === kind)
        .reduce((sum, m) => {
          if (kind === 'internal') return sum + (m.internalStaff?.monthlyCost ?? m.monthlyCost ?? 0)
          if (kind === 'freelancer') {
            if (m.monthlyCost) return sum + m.monthlyCost
            return sum + Math.round((m.freelancer?.hourlyRate ?? m.hourlyRate ?? 0) * 160)
          }
          return sum + (m.agencyPartner?.retainerMonthly ?? m.retainerMonthly ?? 0)
        }, 0)
    return filteredBusinesses
      .map((business) => {
        const financials = businessFinancials(business)
        const internal = costOf(business.id, 'internal')
        const freelancer = costOf(business.id, 'freelancer')
        const agency = costOf(business.id, 'agency_partner')
        const deployedAssets = assets.filter((a) => a.currentDeployment?.entityId === business.id)
        const deployedValue = deployedAssets.reduce((s, a) => s + a.value, 0)
        const teamTotal = internal + freelancer + agency
        return {
          business,
          profit: financials.profit,
          internal,
          freelancer,
          agency,
          teamTotal,
          deployedCount: deployedAssets.length,
          deployedValue,
          adjusted: financials.profit - teamTotal,
        }
      })
      .sort((a, b) => b.teamTotal - a.teamTotal)
  }, [filteredBusinesses, teamMembers, assets])

  const teamCostTotals = useMemo(
    () =>
      teamCostRows.reduce(
        (acc, r) => ({
          internal: acc.internal + r.internal,
          freelancer: acc.freelancer + r.freelancer,
          agency: acc.agency + r.agency,
          total: acc.total + r.teamTotal,
          deployedValue: acc.deployedValue + r.deployedValue,
        }),
        { internal: 0, freelancer: 0, agency: 0, total: 0, deployedValue: 0 },
      ),
    [teamCostRows],
  )

  const fleetBookValue = useMemo(() => assetUtilization(assets).bookValue, [assets])

  const filteredTransactions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return transactions
      .filter((tx) => {
        if (businessFilter !== 'all' && tx.businessId !== businessFilter) return false
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false
        if (statusFilter !== 'all' && tx.status !== statusFilter) return false
        if (categoryTxFilter !== 'all' && tx.category !== categoryTxFilter) return false
        if (!normalized) return true
        return [tx.description, tx.reference, tx.paymentMethod, tx.notes ?? ''].join(' ').toLowerCase().includes(normalized)
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, businessFilter, typeFilter, statusFilter, categoryTxFilter, query])

  return (
    <PageContainer>
      <PageHeader
        title="Financials"
        subtitle="Consolidated cash movement across every business in your portfolio."
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => setTransactionModal({ open: true })}
          >
            Record transaction
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Monthly revenue"
          value={formatCurrency(monthlyRevenue, settings.currency, { compact: true })}
          icon={Banknote}
          caption="Current month estimate"
        />
        <StatCard
          label="Monthly expenses"
          value={formatCurrency(monthlyExpenses, settings.currency, { compact: true })}
          icon={Wallet}
          iconClass="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
          caption="Current month estimate"
        />
        <StatCard
          label="Net profit"
          value={formatCurrency(Math.abs(monthlyProfit), settings.currency, { compact: true })}
          icon={CircleDollarSign}
          iconClass={monthlyProfit >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'}
          caption={monthlyProfit >= 0 ? 'Positive cash position' : 'Operating at a loss'}
        />
        <StatCard
          label="Margin"
          value={formatPercent(monthlyMargin)}
          icon={TrendingDown}
          iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
          caption="Blended margin across filtered set"
        />
        <StatCard
          label="Your net share"
          value={formatCurrency(summary.userMonthlyProfit, settings.currency, { compact: true })}
          icon={CircleDollarSign}
          iconClass="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
          caption={`${formatCurrency(summary.userMonthlyRevenue, settings.currency, { compact: true })} of revenue · ${formatCurrency(summary.userDividends, settings.currency, { compact: true })} dividends`}
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setCategoryFilter(filter.value)}
              className={cn(
                'flex-1 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                categoryFilter === filter.value
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="sm:w-44">
          <Select value={period} onChange={(e) => setPeriod(e.target.value as '6' | '12')} aria-label="Chart period">
            {PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Portfolio trend</CardTitle>
              <CardDescription>
                Aggregated {period}-month performance · {filteredBusinesses.length} businesses
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              series={[
                { name: 'Revenue', color: '#6366f1', data: portfolio.revenue },
                { name: 'Expenses', color: '#94a3b8', data: portfolio.expenses },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>By category</CardTitle>
              <CardDescription>Monthly contribution</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="zp-stacked w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th scope="col" className="px-5 py-3">Category</th>
                    <th scope="col" className="px-3 py-3 text-right">Revenue</th>
                    <th scope="col" className="px-3 py-3 text-right">Profit</th>
                    <th scope="col" className="px-5 py-3 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="md:divide-y md:divide-slate-100 md:dark:divide-slate-800">
                  {categoryRows.map((row) => {
                    const meta = CATEGORY_META[row.category as BusinessCategory]
                    return (
                      <tr key={row.category} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td data-nolabel className="md:px-5 md:py-3">
                          <span className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: meta.chartColor }} />
                            {meta.shortLabel}
                            <span className="text-xs font-medium text-slate-400">({row.count})</span>
                          </span>
                        </td>
                        <td data-label="Revenue" className="text-right font-semibold tabular-nums text-slate-900 md:px-3 md:py-3 dark:text-white">
                          {formatCurrency(row.revenue, settings.currency, { compact: true })}
                        </td>
                        <td
                          data-label="Profit"
                          className={cn(
                            'text-right font-semibold tabular-nums md:px-3 md:py-3',
                            row.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                          )}
                        >
                          {formatCurrency(row.profit, settings.currency, { compact: true, signed: true })}
                        </td>
                        <td data-label="Share" className="text-right tabular-nums text-slate-500 md:px-5 md:py-3 dark:text-slate-400">
                          {Math.round((row.revenue / rowTotalRevenue) * 100)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Team, agency & asset cost analysis</CardTitle>
            <CardDescription>
              Freelance rates, agency retainers and deployed Zainpreneur assets factored into project-level cost ·
              {formatCurrency(teamCostTotals.total, settings.currency, { compact: true })}/mo total engagement cost
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 gap-3 px-5 pb-4 pt-1 sm:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Internal staff</p>
              <p className="font-display text-lg font-extrabold tabular-nums">{formatCurrency(teamCostTotals.internal, settings.currency, { compact: true })}</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-600/20 dark:bg-sky-500/10">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Freelancers</p>
              <p className="font-display text-lg font-extrabold tabular-nums">{formatCurrency(teamCostTotals.freelancer, settings.currency, { compact: true })}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-600/20 dark:bg-amber-500/10">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Agencies</p>
              <p className="font-display text-lg font-extrabold tabular-nums">{formatCurrency(teamCostTotals.agency, settings.currency, { compact: true })}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-600/20 dark:bg-indigo-500/10">
              <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Deployed assets</p>
              <p className="font-display text-lg font-extrabold tabular-nums">{formatCurrency(teamCostTotals.deployedValue, settings.currency, { compact: true })}</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 ring-1 ring-slate-500/20 dark:bg-white/5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Fleet book value</p>
              <p className="font-display text-lg font-extrabold tabular-nums">{formatCurrency(fleetBookValue, settings.currency, { compact: true })}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="zp-stacked w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th scope="col" className="px-5 py-3">Business</th>
                  <th scope="col" className="px-3 py-3 text-right">Internal</th>
                  <th scope="col" className="px-3 py-3 text-right">Freelance</th>
                  <th scope="col" className="px-3 py-3 text-right">Agency</th>
                  <th scope="col" className="px-3 py-3 text-right">Assets</th>
                  <th scope="col" className="px-5 py-3 text-right">Profit − team</th>
                </tr>
              </thead>
              <tbody className="md:divide-y md:divide-slate-100 md:dark:divide-slate-800">
                {teamCostRows.map((row) => (
                  <tr key={row.business.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td data-nolabel className="md:px-5 md:py-3">
                      <span className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: row.business.color }} />
                        {row.business.name}
                      </span>
                    </td>
                    <td data-label="Internal" className="text-right tabular-nums text-slate-600 md:px-3 md:py-3 dark:text-slate-300">{row.internal ? formatCurrency(row.internal, settings.currency, { compact: true }) : '—'}</td>
                    <td data-label="Freelance" className="text-right tabular-nums text-slate-600 md:px-3 md:py-3 dark:text-slate-300">{row.freelancer ? formatCurrency(row.freelancer, settings.currency, { compact: true }) : '—'}</td>
                    <td data-label="Agency" className="text-right tabular-nums text-slate-600 md:px-3 md:py-3 dark:text-slate-300">{row.agency ? formatCurrency(row.agency, settings.currency, { compact: true }) : '—'}</td>
                    <td data-label="Assets" className="text-right tabular-nums text-slate-600 md:px-3 md:py-3 dark:text-slate-300" title={formatCurrency(row.deployedValue, settings.currency)}>
                      {row.deployedCount ? `${row.deployedCount} · ${formatCurrency(row.deployedValue, settings.currency, { compact: true })}` : '—'}
                    </td>
                    <td data-label="Profit − team" className={cn('text-right font-semibold tabular-nums md:px-5 md:py-3', row.adjusted >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                      {formatCurrency(row.adjusted, settings.currency, { compact: true, signed: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Consolidated performance & branch distribution</CardTitle>
            <CardDescription>Business totals rolled up from branches, with your net share of profit.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="zp-stacked w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th scope="col" className="px-5 py-3">Business</th>
                  <th scope="col" className="px-3 py-3 text-right">Branches</th>
                  <th scope="col" className="px-3 py-3 text-right">Revenue</th>
                  <th scope="col" className="px-3 py-3 text-right">Profit</th>
                  <th scope="col" className="px-3 py-3 text-right">Your stake</th>
                  <th scope="col" className="px-3 py-3 text-right">Net share</th>
                  <th scope="col" className="px-5 py-3 text-right">Dividends</th>
                </tr>
              </thead>
              <tbody className="md:divide-y md:divide-slate-100 md:dark:divide-slate-800">
                {branchRows.map(({ business, financials, percentage, netShare, dividends }) => {
                  const modelMeta = MODEL_META[business.model]
                  return (
                    <tr key={business.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td data-nolabel className="md:px-5 md:py-3">
                        <span className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: business.color }} />
                          {business.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">{modelMeta.shortLabel}</span>
                      </td>
                      <td data-label="Branches" className="text-right tabular-nums text-slate-600 md:px-3 md:py-3 dark:text-slate-300">
                        {financials.branchCount === 0 ? '—' : `${financials.activeBranchCount}/${financials.branchCount}`}
                      </td>
                      <td data-label="Revenue" className="text-right font-semibold tabular-nums text-slate-900 md:px-3 md:py-3 dark:text-white">
                        {formatCurrency(financials.revenue, settings.currency, { compact: true })}
                      </td>
                      <td
                        data-label="Profit"
                        className={cn(
                          'text-right font-semibold tabular-nums md:px-3 md:py-3',
                          financials.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {formatCurrency(financials.profit, settings.currency, { compact: true, signed: true })}
                      </td>
                      <td data-label="Your stake" className="text-right tabular-nums text-slate-600 md:px-3 md:py-3 dark:text-slate-300">{percentage}%</td>
                      <td data-label="Net share" className="text-right font-semibold tabular-nums text-violet-600 md:px-3 md:py-3 dark:text-violet-400">
                        {formatCurrency(netShare, settings.currency, { compact: true })}
                      </td>
                      <td data-label="Dividends" className="text-right tabular-nums text-slate-500 md:px-5 md:py-3 dark:text-slate-400">
                        {dividends > 0 ? formatCurrency(dividends, settings.currency, { compact: true }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <SectionHeader
          title="Transactions"
          subtitle={`${filteredTransactions.length} of ${transactions.length} records`}
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="size-3.5" />}
              onClick={() => setTransactionModal({ open: true })}
            >
              Record
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <SearchInput value={query} onChange={setQuery} placeholder="Search description, reference…" fullWidth />
              </div>
              <Select value={businessFilter} onChange={(e) => setBusinessFilter(e.target.value)} aria-label="Filter by business">
                <option value="all">All businesses</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </Select>
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'all')} aria-label="Filter by type">
                <option value="all">Income & expenses</option>
                <option value="income">Income only</option>
                <option value="expense">Expenses only</option>
              </Select>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | 'all')} aria-label="Filter by status">
                <option value="all">All statuses</option>
                {(Object.keys(TRANSACTION_STATUS_LABELS) as TransactionStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {TRANSACTION_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
              <Select value={categoryTxFilter} onChange={(e) => setCategoryTxFilter(e.target.value as TransactionCategory | 'all')} aria-label="Filter by category">
                <option value="all">All categories</option>
                {(Object.keys(TRANSACTION_CATEGORY_LABELS) as TransactionCategory[]).map((category) => (
                  <option key={category} value={category}>
                    {TRANSACTION_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredTransactions.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No transactions match your filters"
                description="Adjust the filters or record a new transaction."
              />
            ) : (
              <div className="px-1 py-1">
                <TransactionTable
                  transactions={filteredTransactions}
                  businesses={businesses}
                  currency={settings.currency}
                  onEdit={(tx) => setTransactionModal({ open: true, editing: tx })}
                  onDelete={(tx) => {
                    deleteTransaction(tx.id)
                    logActivity(tx.businessId, 'transaction', `Transaction ${tx.description} deleted`)
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <SectionHeader
          title="Client receivables"
          subtitle="Invoices, milestone payments and aging from the CRM ledger"
        />
        <BillingPanel />
      </div>

      {transactionModal.open && (
        <TransactionFormModal
          open
          onClose={() => setTransactionModal({ open: false })}
          businesses={businesses}
          initial={transactionModal.editing}
          onSubmit={(draft) => {
            if (transactionModal.editing) {
              updateTransaction(transactionModal.editing.id, draft)
            } else {
              addTransaction(draft)
            }
          }}
        />
      )}
    </PageContainer>
  )
}