import { Pencil, PieChart } from 'lucide-react'

import type { Business, Owner } from '../../types'
import { formatCurrency } from '../../utils/format'
import { businessFinancials, capTableTotal } from '../../utils/calculations'
import { Avatar } from '../common/Avatar'
import { Button } from '../common/Button'

interface CapTableCardProps {
  business: Business
  owners: Owner[]
  currency: Parameters<typeof formatCurrency>[1]
  onManage: () => void
}

export function CapTableCard({ business, owners, currency, onManage }: CapTableCardProps) {
  const rows = business.capTable
    .map((share) => ({ share, owner: owners.find((owner) => owner.id === share.ownerId) }))
    .filter((row) => row.owner)

  const total = capTableTotal(business.capTable)
  const profit = businessFinancials(business).profit

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PieChart className="size-4 text-slate-400" />
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">Cap Table</h2>
        </div>
        <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" />} onClick={onManage}>
          Manage
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No equity allocated for this business yet.</p>
      ) : (
        <>
          <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {rows.map(({ share, owner }) => (
              <span
                key={owner!.id}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${share.percentage}%`, backgroundColor: owner!.color }}
                title={`${owner!.name} — ${share.percentage}%`}
              />
            ))}
          </div>

          <ul className="mt-4 space-y-3">
            {rows.map(({ share, owner }) => (
              <li key={owner!.id} className="flex items-center gap-3">
                <Avatar name={owner!.name} initials={owner!.initials} color={owner!.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {owner!.name}
                    {share.primary && (
                      <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                        Primary
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400 dark:text-slate-500">{share.role || owner!.role || 'Shareholder'}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {share.percentage}%
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {formatCurrency((profit * share.percentage) / 100, currency, { compact: true })}/mo
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {Math.abs(total - 100) >= 0.01 && (
            <p className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-400">
              Equity totals {total.toFixed(0)}% — it should add up to 100%.
            </p>
          )}
        </>
      )}
    </div>
  )
}
