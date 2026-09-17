import { useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  Building2,
  Laptop,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Wrench,
} from 'lucide-react'

import type { Asset, AssetCategory, AssetStatus, BusinessCategory } from '../types'
import { ASSET_CATEGORY_LABELS, ASSET_STATUS_LABELS, ENGAGEMENT_TYPE_LABELS } from '../types'
import { useBusinesses, type DeployAssetInput } from '../context/BusinessContext'
import { assetAgeYears, assetBookValue, assetUtilization } from '../utils/assets'
import { formatCurrency, formatDate } from '../utils/format'
import { ASSET_CATEGORY_META, ASSET_STATUS_META, CATEGORY_META } from '../utils/meta'
import { cn } from '../utils/cn'
import { PageContainer, PageHeader } from '../components/layout/PageContainer'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { ConfirmDialog, Modal } from '../components/common/Modal'
import { SearchInput } from '../components/ui/SearchInput'
import { EmptyState } from '../components/common/EmptyState'
import { AssetFormModal } from '../components/business/AssetFormModal'

type CategoryFilter = AssetCategory | 'all'
type StatusFilter = AssetStatus | 'all'

const CATEGORY_FILTERS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All categories' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
]

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'available', label: 'Available' },
  { value: 'in-use', label: 'Deployed' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
]

function deploymentLabel(
  asset: Asset,
  businesses: ReturnType<typeof useBusinesses>['businesses'],
  teamMembers: ReturnType<typeof useBusinesses>['teamMembers'],
): string {
  const d = asset.currentDeployment
  if (!d) {
    if (asset.status === 'maintenance') return asset.location ?? 'In maintenance'
    if (asset.status === 'retired') return asset.location ?? 'Retired'
    return asset.location ?? 'Central pool · Available'
  }
  const biz = businesses.find((b) => b.id === d.entityId)
  const branch = d.branchId ? biz?.branches.find((br) => br.id === d.branchId) : undefined
  const member = d.assignedToMemberId ? teamMembers.find((m) => m.id === d.assignedToMemberId) : undefined
  const place = branch ? `${branch.name} · ${biz?.name ?? ''}` : (biz?.name ?? 'Unknown business')
  if (member) {
    const eng = ENGAGEMENT_TYPE_LABELS[member.engagementType] ?? member.engagementType
    return `${asset.name} → ${member.name} (${eng}) · ${place}`
  }
  return `${asset.name} deployed to ${place}`
}

export function Assets() {
  const {
    assets,
    assetHistory,
    teamMembers,
    businesses,
    settings,
    deployAsset,
    returnAsset,
    setAssetStatus,
    addAsset,
    updateAsset,
    deleteAsset,
  } = useBusinesses()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [deployFor, setDeployFor] = useState<Asset | null>(null)
  const [detail, setDetail] = useState<Asset | null>(null)
  const [assetModal, setAssetModal] = useState<{ open: boolean; editing?: Asset }>({ open: false })
  const [deleting, setDeleting] = useState<Asset | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assets.filter((a) => {
      if (category !== 'all' && a.category !== category) return false
      if (status !== 'all' && a.status !== status) return false
      if (!q) return true
      return [a.name, a.tag, a.serialNumber, a.location ?? '', a.notes ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [assets, query, category, status])

  const stats = useMemo(() => {
    const total = assets.length
    const inUse = assets.filter((a) => a.status === 'in-use').length
    const available = assets.filter((a) => a.status === 'available').length
    const maintenance = assets.filter((a) => a.status === 'maintenance').length
    const totalValue = assets.reduce((s, a) => s + a.value, 0)
    const deployedValue = assets.filter((a) => a.status === 'in-use').reduce((s, a) => s + a.value, 0)
    return { total, inUse, available, maintenance, totalValue, deployedValue }
  }, [assets])

  const valuation = useMemo(() => assetUtilization(assets), [assets])

  return (
    <PageContainer>
      <PageHeader
        title="Asset & Equipment Hub"
        subtitle="Centralized Zainpreneur-owned pool — deploy hardware & machinery to staff, freelancers, agencies and branches."
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              {stats.inUse} in-use
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-500/20 dark:bg-white/5 dark:text-slate-300">
              {stats.available} available
            </span>
            <Button icon={<Plus className="size-4" />} onClick={() => setAssetModal({ open: true })}>
              Register asset
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><Package className="size-5" /></span><span><span className="block text-xs font-medium text-slate-500">Total assets</span><span className="font-display text-xl font-extrabold">{stats.total}</span></span></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><ArrowLeftRight className="size-5" /></span><span><span className="block text-xs font-medium text-slate-500">Deployed value</span><span className="font-display text-xl font-extrabold">{formatCurrency(stats.deployedValue, settings.currency, { compact: true })}</span></span></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"><Laptop className="size-5" /></span><span><span className="block text-xs font-medium text-slate-500">Pool value</span><span className="font-display text-xl font-extrabold">{formatCurrency(stats.totalValue, settings.currency, { compact: true })}</span></span></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"><Wrench className="size-5" /></span><span><span className="block text-xs font-medium text-slate-500">In maintenance</span><span className="font-display text-xl font-extrabold">{stats.maintenance}</span></span></CardContent></Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Portfolio valuation</CardTitle>
            <CardDescription>Straight-line depreciation with 10% salvage floor · purchase vs current book value</CardDescription>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-extrabold tabular-nums">{formatCurrency(valuation.bookValue, settings.currency, { compact: true })}</p>
            <p className="text-[11px] text-slate-400">
              book · {formatCurrency(valuation.totalValue, settings.currency, { compact: true })} purchase ·
              −{formatCurrency(valuation.totalValue - valuation.bookValue, settings.currency, { compact: true })} depreciated
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3">Category</th>
                  <th className="px-3 py-3 text-right">Assets</th>
                  <th className="px-3 py-3 text-right">Purchase</th>
                  <th className="px-5 py-3 text-right">Book value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(Object.keys(valuation.byCategory) as AssetCategory[]).map((cat) => {
                  const row = valuation.byCategory[cat]
                  if (row.count === 0) return null
                  return (
                    <tr key={cat} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-200">{ASSET_CATEGORY_LABELS[cat]}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{row.count}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatCurrency(row.value, settings.currency, { compact: true })}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(row.bookValue, settings.currency, { compact: true })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Inventory grid</CardTitle>
            <CardDescription>Filter by category & status. Ownership is always Zainpreneur — only deployment moves.</CardDescription>
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Search tag, serial, location…" />
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            {CATEGORY_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setCategory(f.value)} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition', category === f.value ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10')}>{f.label}</button>
            ))}
            <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-white/10" />
            {STATUS_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setStatus(f.value)} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition', status === f.value ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10')}>{f.label}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title={assets.length === 0 ? 'No assets registered' : 'No assets match'}
              description={assets.length === 0 ? 'Register your first Zainpreneur-owned laptop, machine or equipment.' : 'Try clearing filters or search.'}
              action={
                assets.length === 0 ? (
                  <Button icon={<Plus className="size-4" />} onClick={() => setAssetModal({ open: true })}>
                    Add first asset
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('')
                      setCategory('all')
                      setStatus('all')
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((asset) => {
                const cat = ASSET_CATEGORY_META[asset.category]
                const st = ASSET_STATUS_META[asset.status]
                return (
                  <div key={asset.id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:hover:border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <span className={cn('flex size-10 items-center justify-center rounded-xl', cat.iconClass)}><cat.icon className="size-5" /></span>
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold', st.badgeClass)}><span className={cn('size-1.5 rounded-full', st.dotClass)} />{ASSET_STATUS_LABELS[asset.status]}</span>
                    </div>
                    <button onClick={() => setDetail(asset)} className="mt-3 block text-left">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{asset.name}</span>
                      <span className="mt-0.5 block text-xs font-medium text-slate-500">{asset.tag} · {ASSET_CATEGORY_LABELS[asset.category]} · {formatCurrency(asset.value, settings.currency, { compact: true })}</span>
                    </button>
                    <p className="mt-2 line-clamp-2 min-h-8 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {deploymentLabel(asset, businesses, teamMembers)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge className={cat.badgeClass}>{cat.label}</Badge>
                      {asset.currentDeployment && (
                        <Badge className={CATEGORY_META[asset.currentDeployment.entityType].badgeClass}>
                          {CATEGORY_META[asset.currentDeployment.entityType].shortLabel}
                        </Badge>
                      )}
                      <span className="text-[11px] text-slate-400">Owner: Zainpreneur</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {asset.status === 'in-use' ? (
                        <Button variant="secondary" className="flex-1" icon={<RotateCcw className="size-4" />} onClick={() => returnAsset(asset.id)}>Return</Button>
                      ) : asset.status === 'available' ? (
                        <Button className="flex-1" icon={<ArrowLeftRight className="size-4" />} onClick={() => setDeployFor(asset)}>Deploy</Button>
                      ) : (
                        <Button variant="secondary" className="flex-1" onClick={() => setAssetStatus(asset.id, 'available')}>Restore</Button>
                      )}
                      <Button variant="ghost" icon={<Search className="size-4" />} onClick={() => setDetail(asset)} aria-label="View asset" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><div><CardTitle>Deployment history</CardTitle><CardDescription>Latest checkouts, returns & maintenance events</CardDescription></div></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assetHistory.slice(0, 8).map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"><Building2 className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{h.assetName}</span><span className="block truncate text-xs text-slate-500">{h.action} → {h.targetLabel} · {formatDate(h.date.slice(0, 10))}</span></span>
                <Badge>{h.action}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {deployFor && (
        <DeployModal
          asset={deployFor}
          onClose={() => setDeployFor(null)}
          onDeploy={(input) => {
            deployAsset(deployFor.id, input)
            setDeployFor(null)
          }}
        />
      )}

      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={detail.name}
          description={`${detail.tag} · ${detail.serialNumber} · Purchased ${detail.purchaseDate}`}
          footer={
            <>
              <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => { setDeleting(detail); setDetail(null) }}>
                Delete
              </Button>
              <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => { setAssetModal({ open: true, editing: detail }); setDetail(null) }}>
                Edit
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <p className="text-slate-600 dark:text-slate-300">{deploymentLabel(detail, businesses, teamMembers)}</p>
            <p className="text-xs text-slate-500">Condition: {detail.condition} · Value: {formatCurrency(detail.value, settings.currency)} · Owner: Zainpreneur (never transfers)</p>
            <p className="text-xs text-slate-500">
              Book value: <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(assetBookValue(detail), settings.currency)}</span>
              {' '}· Age: {assetAgeYears(detail).toFixed(1)} yrs (straight-line, 10% salvage)
            </p>
            {detail.notes && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-200">{detail.notes}</p>}
            <div className="flex gap-2 pt-2">
              {detail.status === 'in-use' ? (
                <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => { returnAsset(detail.id); setDetail(null) }}>Return to pool</Button>
              ) : (
                <Button icon={<Plus className="size-4" />} onClick={() => { setDeployFor(detail); setDetail(null) }}>Deploy asset</Button>
              )}
              {detail.status !== 'maintenance' && detail.status !== 'retired' && (
                <Button variant="ghost" onClick={() => { setAssetStatus(detail.id, 'maintenance', 'Sent from detail view'); setDetail(null) }}>Send to maintenance</Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {assetModal.open && (
        <AssetFormModal
          open
          initial={assetModal.editing}
          onClose={() => setAssetModal({ open: false })}
          onSubmit={(draft) => {
            if (assetModal.editing) updateAsset(assetModal.editing.id, draft)
            else addAsset(draft)
            setAssetModal({ open: false })
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteAsset(deleting.id)
          setDeleting(null)
        }}
        title={`Delete ${deleting?.tag}?`}
        message="This removes the asset and its deployment history from the central pool. This cannot be undone."
        confirmLabel="Delete"
      />
    </PageContainer>
  )
}

function DeployModal({ asset, onClose, onDeploy }: { asset: Asset; onClose: () => void; onDeploy: (input: DeployAssetInput) => void }) {
  const { businesses, teamMembers } = useBusinesses()
  const [entityType, setEntityType] = useState<BusinessCategory>(asset.currentDeployment?.entityType ?? 'owned')
  const [entityId, setEntityId] = useState(asset.currentDeployment?.entityId ?? businesses[0]?.id ?? '')
  const [branchId, setBranchId] = useState(asset.currentDeployment?.branchId ?? '')
  const [memberId, setMemberId] = useState(asset.currentDeployment?.assignedToMemberId ?? '')
  const [notes, setNotes] = useState(asset.currentDeployment?.notes ?? '')

  const biz = businesses.find((b) => b.id === entityId)
  const eligibleBusinesses = businesses.filter((b) => b.category === entityType)
  const eligibleMembers = teamMembers.filter((m) => !m.activeBusinessId || m.activeBusinessId === entityId || m.associatedBusinessId === entityId)

  return (
    <Modal
      open
      onClose={onClose}
      title={`Deploy ${asset.tag}`}
      description="Checkout Zainpreneur-owned asset to a business, branch or team member. Ownership stays with Zainpreneur."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            icon={<ArrowLeftRight className="size-4" />}
            onClick={() => {
              if (!entityId) return
              onDeploy({
                entityType,
                entityId,
                branchId: branchId || undefined,
                memberId: memberId || undefined,
                notes: notes || undefined,
              })
            }}
          >
            Confirm deployment
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Target portfolio</span>
          <div className="flex gap-2">
            {(['owned', 'equity', 'client'] as BusinessCategory[]).map((t) => (
              <button key={t} type="button" onClick={() => { setEntityType(t); const first = businesses.find((b) => b.category === t); setEntityId(first?.id ?? ''); setBranchId('') }} className={cn('flex-1 rounded-lg px-3 py-2 text-xs font-bold ring-1', entityType === t ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-600 ring-slate-200 dark:bg-white/5 dark:text-slate-300')}>{t}</button>
            ))}
          </div>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Business</span>
          <select value={entityId} onChange={(e) => { setEntityId(e.target.value); setBranchId('') }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            {eligibleBusinesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Branch (optional)</span>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <option value="">No specific branch</option>
            {biz?.branches.map((br) => <option key={br.id} value={br.id}>{br.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Assign to member (optional)</span>
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <option value="">No member — branch / business pool</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name} · {ENGAGEMENT_TYPE_LABELS[m.engagementType]} · {m.role}</option>)}
          </select>
          {eligibleMembers.length === 0 && <span className="text-xs text-amber-600">No members currently allocated to this business — you can still deploy to the branch.</span>}
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Deployment notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="e.g. Laptop assigned to Freelancer Ali working on Client Project X" className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800" />
        </label>
      </div>
    </Modal>
  )
}
