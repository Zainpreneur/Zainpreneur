import { Building2, MapPin, Pencil, Phone, Plus, Trash2, UserRound } from 'lucide-react'

import type { Branch, Business } from '../../types'
import { formatCurrency, formatNumber } from '../../utils/format'
import { branchTotals } from '../../utils/branches'
import { BRANCH_STATUS_META } from '../../utils/meta'
import { cn } from '../../utils/cn'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { EmptyState } from '../common/EmptyState'

interface BranchListProps {
  business: Business
  currency: Parameters<typeof formatCurrency>[1]
  onAdd: () => void
  onEdit: (branch: Branch) => void
  onDelete: (branch: Branch) => void
}

export function BranchList({ business, currency, onAdd, onEdit, onDelete }: BranchListProps) {
  const branches = business.branches
  const totals = branchTotals(branches)

  if (branches.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No branches yet"
        description="Add the first branch for this business to track its locations and roll up their numbers."
        action={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={onAdd}>
            Add branch
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-white">{branches.length}</span> branches
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Revenue <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(totals.revenue, currency, { compact: true })}</span>
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Profit{' '}
            <span className={cn('font-semibold tabular-nums', totals.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {formatCurrency(totals.profit, currency, { compact: true, signed: true })}
            </span>
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Staff <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{totals.employees}</span>
          </span>
        </div>
        <Button size="sm" icon={<Plus className="size-4" />} onClick={onAdd}>
          Add branch
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {branches.map((branch) => {
          const meta = BRANCH_STATUS_META[branch.status]
          const profit = branch.monthlyRevenue - branch.monthlyExpenses
          return (
            <div
              key={branch.id}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 truncate font-display text-sm font-bold text-slate-900 dark:text-white">
                    {branch.name}
                    {branch.isHeadquarters && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        HQ
                      </span>
                    )}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Opened {branch.openedYear}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge className={meta.badgeClass}>
                    <span className={cn('mr-1 size-1.5 rounded-full', meta.dotClass)} />
                    {meta.label}
                  </Badge>
                </div>
              </div>

              <ul className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  <span className="truncate">{[branch.address, branch.city, branch.country].filter(Boolean).join(', ')}</span>
                </li>
                {branch.manager && (
                  <li className="flex items-center gap-1.5">
                    <UserRound className="size-3.5 shrink-0" />
                    <span className="truncate">{branch.manager}</span>
                  </li>
                )}
                {branch.phone && (
                  <li className="flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0" />
                    <span className="truncate">{branch.phone}</span>
                  </li>
                )}
              </ul>

              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/50">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Revenue</p>
                  <p className="font-display text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(branch.monthlyRevenue, currency, { compact: true })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Profit</p>
                  <p className={cn('font-display text-xs font-bold tabular-nums', profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                    {formatCurrency(profit, currency, { compact: true, signed: true })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Staff</p>
                  <p className="font-display text-xs font-bold tabular-nums text-slate-900 dark:text-white">{formatNumber(branch.employees)}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-1">
                <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => onEdit(branch)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                  icon={<Trash2 className="size-3.5" />}
                  onClick={() => onDelete(branch)}
                >
                  Delete
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
