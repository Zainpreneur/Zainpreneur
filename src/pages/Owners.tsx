import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Gauge, Link2, Mail, MapPin, Pencil, Phone, Plus, Trash2, TrendingUp, Users } from 'lucide-react'

import type { Owner } from '../types'
import { useBusinesses } from '../context/BusinessContext'
import { formatCurrency } from '../utils/format'
import { enterpriseValue, ownerStats } from '../utils/calculations'
import { PageContainer, PageHeader } from '../components/layout/PageContainer'
import { Avatar } from '../components/common/Avatar'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { EmptyState } from '../components/common/EmptyState'
import { ConfirmDialog } from '../components/common/Modal'
import { SearchInput } from '../components/ui/SearchInput'
import { StatCard } from '../components/common/StatCard'
import { OwnerFormModal } from '../components/business/OwnerFormModal'

export function Owners() {
  const { owners, businesses, settings, addOwner, updateOwner, deleteOwner } = useBusinesses()

  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Owner | undefined>(undefined)
  const [deleting, setDeleting] = useState<Owner | undefined>(undefined)

  const stats = useMemo(() => owners.map((owner) => ownerStats(owner, businesses)), [owners, businesses])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return stats
      .filter((stat) => {
        if (!normalized) return true
        const names = stat.holdings.map((holding) => holding.businessName).join(' ')
        return [stat.owner.name, stat.owner.email, stat.owner.role, stat.owner.location, names]
          .join(' ')
          .toLowerCase()
          .includes(normalized)
      })
      .sort((a, b) => a.owner.name.localeCompare(b.owner.name))
  }, [stats, query])

  const linkedCount = businesses.reduce((sum, business) => sum + business.capTable.length, 0)
  const combinedWorth = useMemo(
    () => businesses.reduce((sum, business) => sum + enterpriseValue(business), 0),
    [businesses],
  )

  return (
    <PageContainer>
      <PageHeader
        title="Owners"
        subtitle="The people behind your portfolio and the equity they hold."
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => {
              setEditing(undefined)
              setAddOpen(true)
            }}
          >
            Add owner
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Owners" value={String(owners.length)} icon={Users} />
        <StatCard label="Active stakes" value={String(linkedCount)} icon={Link2} caption="Owner–business links" />
        <StatCard
          label="Combined net worth"
          value={formatCurrency(combinedWorth, settings.currency, { compact: true })}
          icon={TrendingUp}
          iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
        />
      </div>

      <div className="mb-6 max-w-sm">
        <SearchInput value={query} onChange={setQuery} placeholder="Search owners or businesses…" fullWidth />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No owners found"
            description="Add the people who own your businesses to track their stakes and contact details."
            action={
              <Button
                icon={<Plus className="size-4" />}
                onClick={() => {
                  setEditing(undefined)
                  setAddOpen(true)
                }}
              >
                Add owner
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((stat) => {
            const { owner, holdings } = stat
            return (
              <div
                key={owner.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={owner.name} initials={owner.initials} color={owner.color} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base font-bold text-slate-900 dark:text-white">{owner.name}</h3>
                    <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{owner.role || 'Owner'}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={`Edit ${owner.name}`}
                      onClick={() => {
                        setEditing(owner)
                        setAddOpen(true)
                      }}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${owner.name}`}
                      onClick={() => setDeleting(owner)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <ul className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <li className="flex items-center gap-1.5">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{owner.email}</span>
                  </li>
                  {owner.phone && (
                    <li className="flex items-center gap-1.5">
                      <Phone className="size-3.5 shrink-0" />
                      <span className="truncate">{owner.phone}</span>
                    </li>
                  )}
                  {owner.location && (
                    <li className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">{owner.location}</span>
                    </li>
                  )}
                </ul>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Cumulative equity
                    </p>
                    <p className="mt-0.5 font-display text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                      {stat.cumulativeEquity.toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Net worth
                    </p>
                    <p className="mt-0.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                      {formatCurrency(stat.netWorth, settings.currency, { compact: true })}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex-1 space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    <span>{holdings.length === 1 ? '1 holding' : `${holdings.length} holdings`}</span>
                    <span className="inline-flex items-center gap-1">
                      <Gauge className="size-3" />
                      {formatCurrency(stat.monthlyNetShare, settings.currency, { compact: true })}/mo
                    </span>
                  </div>
                  {holdings.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">Not linked to any business yet.</p>
                  ) : (
                    holdings.map((holding) => (
                      <Link
                        key={holding.businessId}
                        to={`/businesses/${holding.businessId}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: holding.businessColor }} />
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-200">
                          {holding.businessName}
                        </span>
                        <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">{holding.percentage}%</span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {addOpen && (
        <OwnerFormModal
          open
          onClose={() => setAddOpen(false)}
          initial={editing}
          onSubmit={(draft) => {
            if (editing) {
              updateOwner(editing.id, draft)
            } else {
              addOwner(draft)
            }
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) deleteOwner(deleting.id)
        }}
        title={`Delete ${deleting?.name ?? 'owner'}?`}
        message="This removes the owner from your directory and unassigns them from every business. This action cannot be undone."
        confirmLabel="Delete owner"
      />
    </PageContainer>
  )
}
