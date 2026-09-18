// @ts-nocheck
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Building2, Plus } from 'lucide-react'

import type { Business, BusinessCategory, BusinessStatus } from '../types'
import { BUSINESS_STATUS_LABELS } from '../types'
import { useBusinesses } from '../context/BusinessContext'
import { cn } from '../utils/cn'
import { PageContainer, PageHeader } from '../components/layout/PageContainer'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { EmptyState } from '../components/common/EmptyState'
import { Select } from '../components/common/Input'
import { SearchInput } from '../components/ui/SearchInput'
import { BusinessCard } from '../components/business/BusinessCard'
import { BusinessFormModal } from '../components/business/BusinessFormModal'
import { ConfirmDialog } from '../components/common/Modal'

type SortKey = 'name' | 'revenue' | 'profit' | 'health' | 'employees'

const FILTERS: Array<{ value: BusinessCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'owned', label: 'Owned' },
  { value: 'equity', label: 'Equity' },
  { value: 'client', label: 'Client' },
]

export function BusinessesList() {
  const { businesses, settings, addBusiness, updateBusiness, deleteBusiness, addBranch } = useBusinesses()
  const [searchParams, setSearchParams] = useSearchParams()

  const [statusFilter, setStatusFilter] = useState<BusinessStatus | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('revenue')

  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Business | undefined>(undefined)
  const [deleting, setDeleting] = useState<Business | undefined>(undefined)

  const query = searchParams.get('q') ?? ''
  const category = (searchParams.get('category') as BusinessCategory | null) ?? 'all'

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    let list = businesses.filter((b) => {
      if (category !== 'all' && b.category !== category) return false
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (!normalized) return true
      return [b.name, b.tagline, b.industry, b.description, ...b.tags]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    })

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'revenue':
          return b.monthlyRevenue - a.monthlyRevenue
        case 'profit':
          return b.monthlyRevenue - b.monthlyExpenses - (a.monthlyRevenue - a.monthlyExpenses)
        case 'health':
          return b.healthScore - a.healthScore
        case 'employees':
          return b.employees - a.employees
      }
    })
    return list
  }, [businesses, category, statusFilter, query, sortKey])

  const setCategory = (value: BusinessCategory | 'all') => {
    const next = new URLSearchParams(searchParams)
    if (value === 'all') {
      next.delete('category')
    } else {
      next.set('category', value)
    }
    setSearchParams(next)
  }

  const setQuery = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set('q', value)
    } else {
      next.delete('q')
    }
    setSearchParams(next)
  }

  return (
    <PageContainer>
      <PageHeader
        title="Businesses"
        subtitle={`${businesses.length} entities across owned, equity and client engagements.`}
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => {
              setEditing(undefined)
              setAddOpen(true)
            }}
          >
            Add business
          </Button>
        }
      />

      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex w-full flex-1 gap-1.5 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setCategory(filter.value)}
                className={cn(
                  'flex-1 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                  category === filter.value
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                {filter.label}
                <span className="ml-1.5 text-xs font-medium text-slate-400">
                  {filter.value === 'all' ? businesses.length : businesses.filter((b) => b.category === filter.value).length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-none">
            <div className="w-full sm:w-64">
              <SearchInput value={query} onChange={setQuery} placeholder="Search name, industry, tag…" fullWidth />
            </div>
            <div className="flex gap-3">
              <div className="w-full sm:w-40">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BusinessStatus | 'all')} aria-label="Filter by status">
                  <option value="all">All statuses</option>
                  {(Object.keys(BUSINESS_STATUS_LABELS) as BusinessStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {BUSINESS_STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-full sm:w-44">
                <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort businesses">
                  <option value="revenue">Sort: Revenue</option>
                  <option value="profit">Sort: Profit</option>
                  <option value="health">Sort: Health</option>
                  <option value="employees">Sort: Team size</option>
                  <option value="name">Sort: Name</option>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No businesses match your filters"
            description="Try clearing the search or switching categories, or add a new business to your portfolio."
            action={
              <Button
                icon={<Plus className="size-4" />}
                onClick={() => {
                  setEditing(undefined)
                  setAddOpen(true)
                }}
              >
                Add business
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              currency={settings.currency}
              onEdit={(b) => {
                setEditing(b)
                setAddOpen(true)
              }}
              onDelete={(b) => setDeleting(b)}
            />
          ))}
        </div>
      )}

      {addOpen && (
        <BusinessFormModal
          open
          onClose={() => setAddOpen(false)}
          initial={editing}
          onSubmit={(draft, initialBranches) => {
            if (editing) {
              updateBusiness(editing.id, draft)
            } else {
              const created = addBusiness(draft)
              initialBranches.forEach((branch) => addBranch(created.id, branch))
            }
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) {
            deleteBusiness(deleting.id)
          }
        }}
        title={`Delete ${deleting?.name ?? 'business'}?`}
        message="This permanently removes the business, its transactions, tasks and activity history. This action cannot be undone."
        confirmLabel="Delete permanently"
      />
    </PageContainer>
  )
}