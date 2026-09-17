import { useMemo, useState } from 'react'
import { Briefcase, Building2, Handshake, Laptop, Mail, MapPin, Pencil, Phone, Plus, Trash2, UserRound, Users } from 'lucide-react'

import type { EngagementType, TeamMember } from '../types'
import { ENGAGEMENT_TYPE_LABELS } from '../types'
import { useBusinesses } from '../context/BusinessContext'
import { formatCurrency } from '../utils/format'
import { cn } from '../utils/cn'
import { PageContainer, PageHeader } from '../components/layout/PageContainer'
import { Card, CardContent } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Avatar } from '../components/common/Avatar'
import { ConfirmDialog, Modal } from '../components/common/Modal'
import { SearchInput } from '../components/ui/SearchInput'
import { EmptyState } from '../components/common/EmptyState'
import { MemberFormModal } from '../components/business/MemberFormModal'
import { PayrollPanel } from '../components/enterprise/PayrollPanel'

type Segment = EngagementType | 'all'

const SEGMENTS: Array<{ value: Segment; label: string; icon: typeof Users }> = [
  { value: 'all', label: 'Everyone', icon: Users },
  { value: 'internal', label: 'Internal Staff', icon: UserRound },
  { value: 'freelancer', label: 'Freelancers', icon: Briefcase },
  { value: 'agency_partner', label: 'Partner Agencies', icon: Handshake },
]

function memberCost(m: TeamMember): number {
  if (m.engagementType === 'internal') return m.internalStaff?.monthlyCost ?? m.monthlyCost ?? 0
  if (m.engagementType === 'freelancer') {
    if (m.monthlyCost) return m.monthlyCost
    const rate = m.freelancer?.hourlyRate ?? m.hourlyRate ?? 0
    return Math.round(rate * 160)
  }
  return m.agencyPartner?.retainerMonthly ?? m.retainerMonthly ?? 0
}

function contractSummary(m: TeamMember): string {
  if (m.engagementType === 'internal') {
    const sub = m.internalStaff?.employmentSubType ?? m.employmentType ?? 'full_time'
    return `${sub.replace('_', ' ')} · ${m.internalStaff?.department ?? m.department}`;
  }
  if (m.engagementType === 'freelancer') {
    const rate = m.freelancer?.hourlyRate ?? m.hourlyRate ?? 0
    return `$${rate}/hr · ${m.freelancer?.contractTerms ?? m.contractTerms ?? 'contract'}`;
  }
  return `${m.agencyPartner?.companyName ?? m.companyName ?? m.name} · ${m.agencyPartner?.projectAllocation ?? m.projectAllocation ?? ''}`.trim()
}

export function Team() {
  const { teamMembers, businesses, assets, settings, addTeamMember, updateTeamMember, deleteTeamMember, logActivity } = useBusinesses()
  const [segment, setSegment] = useState<Segment>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<TeamMember | null>(null)
  const [memberModal, setMemberModal] = useState<{ open: boolean; editing?: TeamMember }>({ open: false })
  const [deleting, setDeleting] = useState<TeamMember | null>(null)
  const [view, setView] = useState<'directory' | 'payroll'>('directory')
  // Re-resolve against live context so detail modal reflects assignment changes.
  const liveSelected = selected ? (teamMembers.find((m) => m.id === selected.id) ?? selected) : null

  const counts = useMemo(() => ({
    all: teamMembers.length,
    internal: teamMembers.filter((m) => m.engagementType === 'internal').length,
    freelancer: teamMembers.filter((m) => m.engagementType === 'freelancer').length,
    agency_partner: teamMembers.filter((m) => m.engagementType === 'agency_partner').length,
  }), [teamMembers])

  const monthlyBurn = useMemo(() => teamMembers.reduce((s, m) => s + memberCost(m), 0), [teamMembers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return teamMembers.filter((m) => {
      if (segment !== 'all' && m.engagementType !== segment) return false
      if (!q) return true
      return [m.name, m.role, m.email, m.department, m.agencyPartner?.companyName ?? '', m.freelancer?.projectScope ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [teamMembers, segment, query])

  return (
    <PageContainer>
      <PageHeader
        title={view === 'payroll' ? 'Payroll' : 'Team & Partner Management Hub'}
        subtitle={
          view === 'payroll'
            ? 'Contracts, timesheets and payroll runs posting to the master ledger.'
            : `Internal staff, freelancers & sub-contracted agencies · ${formatCurrency(monthlyBurn, settings.currency, { compact: true })}/mo engagement cost`
        }
        actions={
          view === 'directory' ? (
            <>
              <SearchInput value={query} onChange={setQuery} placeholder="Search people, agencies, skills…" />
              <Button icon={<Plus className="size-4" />} onClick={() => setMemberModal({ open: true })}>
                Add member
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['directory', 'payroll'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors',
                view === v
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
              )}
            >
              {v === 'directory' ? 'Directory' : 'Payroll'}
            </button>
          ))}
        </div>
      </div>

      {view === 'payroll' ? (
        <PayrollPanel />
      ) : (
      <>
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSegment(s.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition',
              segment === s.value
                ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10',
            )}
          >
            <s.icon className="size-4" />
            {s.label}
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-bold dark:bg-white/10">
              {counts[s.value]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={Users}
            title={teamMembers.length === 0 ? 'No team members yet' : 'No members found'}
            description={teamMembers.length === 0 ? 'Add your first internal member, freelancer or agency partner.' : 'Try a different segment or search.'}
            action={
              teamMembers.length === 0 ? (
                <Button icon={<Plus className="size-4" />} onClick={() => setMemberModal({ open: true })}>
                  Add first member
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => {
            const biz = businesses.find((b) => b.id === (m.activeBusinessId ?? m.associatedBusinessId))
            const held = assets.filter((a) => a.currentDeployment?.assignedToMemberId === m.id)
            return (
              <Card key={m.id} className="transition hover:shadow-md">
                <CardContent>
                  <div className="flex items-start gap-3">
                    <Avatar name={m.name} initials={m.initials} color={m.color} size="md" />
                    <div className="min-w-0 flex-1">
                      <button onClick={() => setSelected(m)} className="block truncate text-left text-sm font-bold text-slate-900 hover:underline dark:text-white">{m.name}</button>
                      <p className="truncate text-xs text-slate-500">{m.role}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge className={segmentBadge(m.engagementType)}>{ENGAGEMENT_TYPE_LABELS[m.engagementType]}</Badge>
                        {biz && <Badge className="bg-slate-100 text-slate-600 ring-1 ring-slate-500/20 dark:bg-white/5 dark:text-slate-300">{biz.name}</Badge>}
                      </div>
                    </div>
                    <span className="text-right text-xs font-bold text-slate-900 dark:text-white">
                      {formatCurrency(memberCost(m), settings.currency, { compact: true })}
                      <span className="block text-[10px] font-medium text-slate-400">/mo</span>
                    </span>
                  </div>
                  <p className="mt-3 truncate text-xs text-slate-500">{contractSummary(m)}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                    <span className="inline-flex items-center gap-1.5"><Laptop className="size-3.5" />{held.length} asset{held.length === 1 ? '' : 's'}</span>
                    <Button variant="ghost" onClick={() => setSelected(m)}>Details</Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      </>
      )}

      {liveSelected && (
        <MemberDetailModal
          member={liveSelected}
          onClose={() => setSelected(null)}
          onEdit={() => setMemberModal({ open: true, editing: liveSelected })}
          onDelete={() => setDeleting(liveSelected)}
        />
      )}

      {memberModal.open && (
        <MemberFormModal
          open
          initial={memberModal.editing}
          onClose={() => setMemberModal({ open: false })}
          onSubmit={(draft) => {
            if (memberModal.editing) {
              updateTeamMember(memberModal.editing.id, draft)
              logActivity(draft.activeBusinessId ?? '', 'team', `${draft.name} updated`)
            } else {
              const created = addTeamMember(draft)
              logActivity(created.activeBusinessId ?? '', 'team', `${created.name} joined as ${ENGAGEMENT_TYPE_LABELS[created.engagementType]}`)
            }
            setMemberModal({ open: false })
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            logActivity(deleting.activeBusinessId ?? '', 'team', `${deleting.name} removed from roster`)
            deleteTeamMember(deleting.id)
            if (selected?.id === deleting.id) setSelected(null)
          }
          setDeleting(null)
        }}
        title={`Remove ${deleting?.name}?`}
        message="Their asset assignments will be released back to the pool. This cannot be undone."
        confirmLabel="Remove"
      />
    </PageContainer>
  )
}

function segmentBadge(t: EngagementType): string {
  if (t === 'internal') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300'
  if (t === 'freelancer') return 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300'
  return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300'
}

/** Urgency color for a freelancer contract end date. */
function contractUrgency(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(diff) || diff < 0) return 'text-rose-600 dark:text-rose-400'
  if (diff < 30 * 86_400_000) return 'text-amber-600 dark:text-amber-400'
  return 'text-sky-700 dark:text-sky-300'
}

function MemberDetailModal({ member, onClose, onEdit, onDelete }: { member: TeamMember; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const { businesses, assets, settings, updateTeamMember, deployAsset, logActivity } = useBusinesses()
  const biz = businesses.find((b) => b.id === (member.activeBusinessId ?? member.associatedBusinessId))
  const branch = member.branchId ? biz?.branches.find((br) => br.id === member.branchId) : undefined
  const held = assets.filter((a) => a.currentDeployment?.assignedToMemberId === member.id)
  const availableAssets = assets.filter((a) => a.status === 'available')
  const [handoverId, setHandoverId] = useState('')
  const currentBizId = member.activeBusinessId ?? member.associatedBusinessId ?? ''
  const [assignId, setAssignId] = useState(currentBizId)
  const [assignSaved, setAssignSaved] = useState(false)
  const assignDirty = assignId !== currentBizId

  return (
    <Modal
      open
      onClose={onClose}
      title={member.name}
      description={`${member.role} · ${ENGAGEMENT_TYPE_LABELS[member.engagementType]}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => { onDelete(); onClose() }}>
            Remove
          </Button>
          <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => { onEdit(); onClose() }}>
            Edit
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Avatar name={member.name} initials={member.initials} color={member.color} size="md" />
            <div>
              <p className="font-bold">{contractSummary(member)}</p>
              <p className="text-xs text-slate-500">{member.department} · {member.location ?? 'Remote'}</p>
            </div>
          </div>
          <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/5">
            <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300"><Mail className="size-3.5" />{member.email}</span>
            {member.phone && <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300"><Phone className="size-3.5" />{member.phone}</span>}
            {biz && <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300"><Building2 className="size-3.5" />{biz.name}{branch ? ` · ${branch.name}` : ''}</span>}
            {member.location && <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300"><MapPin className="size-3.5" />{member.location}</span>}
          </div>

          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <label className="grid gap-1.5 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {member.engagementType === 'agency_partner' ? 'Assign agency to project' : 'Assign to business'}
              </span>
              <select
                value={assignId}
                onChange={(e) => { setAssignId(e.target.value); setAssignSaved(false) }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Unassigned (bench pool)</option>
                {(['owned', 'equity', 'client'] as const).map((cat) => (
                  <optgroup key={cat} label={`${cat[0].toUpperCase()}${cat.slice(1)} businesses`}>
                    {businesses.filter((b) => b.category === cat).map((b) => (
                      <option key={b.id} value={b.id}>{b.name} · {b.model}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                disabled={!assignDirty}
                onClick={() => {
                  const target = businesses.find((b) => b.id === assignId)
                  updateTeamMember(member.id, { activeBusinessId: assignId || undefined, associatedBusinessId: assignId || undefined })
                  logActivity(assignId, 'team', `${member.name} assigned to ${target ? target.name : 'bench pool'}`)
                  setAssignSaved(true)
                }}
              >
                Save assignment
              </Button>
              {assignSaved && !assignDirty && <span className="text-[11px] font-semibold text-emerald-600">Saved</span>}
            </div>
          </div>

          {member.engagementType === 'freelancer' && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs dark:border-sky-500/20 dark:bg-sky-500/10">
              <p className="font-bold text-sky-800 dark:text-sky-200">Freelance contract</p>
              <p className="mt-1 text-sky-700 dark:text-sky-300">Rate: ${(member.freelancer?.hourlyRate ?? member.hourlyRate ?? 0)}/hr · Terms: {member.freelancer?.contractTerms ?? member.contractTerms}</p>
              {(member.freelancer?.projectScope ?? member.projectScope) && <p className="mt-1">Scope: {member.freelancer?.projectScope ?? member.projectScope}</p>}
              {(member.freelancer?.contractEndDate ?? member.contractEndDate) && (
                <p className={cn('mt-1 font-semibold', contractUrgency(member.freelancer?.contractEndDate ?? member.contractEndDate ?? ''))}>
                  Ends: {(member.freelancer?.contractEndDate ?? member.contractEndDate ?? '').slice(0, 10)}
                </p>
              )}
            </div>
          )}
          {member.engagementType === 'agency_partner' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-500/20 dark:bg-amber-500/10">
              <p className="font-bold text-amber-800 dark:text-amber-200">{member.agencyPartner?.companyName ?? member.companyName}</p>
              <p className="mt-1">Contact: {member.agencyPartner?.contactPerson ?? member.contactPerson}</p>
              <p className="mt-1">Allocation: {member.agencyPartner?.projectAllocation ?? member.projectAllocation}</p>
              {(member.agencyPartner?.retainerMonthly ?? member.retainerMonthly) ? <p className="mt-1 font-bold">Retainer: {formatCurrency(member.agencyPartner?.retainerMonthly ?? member.retainerMonthly ?? 0, settings.currency)}</p> : null}
              <p className="mt-1 opacity-80">Single enterprise: partner agencies double as registered vendors — see Enterprise → Purchasing.</p>
            </div>
          )}
          {member.engagementType === 'internal' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <p className="font-bold text-emerald-800 dark:text-emerald-200">Direct employment</p>
              <p className="mt-1">Cost: {formatCurrency(member.internalStaff?.monthlyCost ?? member.monthlyCost ?? 0, settings.currency)}/mo · {member.internalStaff?.employmentSubType ?? member.employmentType}</p>
              {member.startedAt && <p className="mt-1">Since: {member.startedAt.slice(0, 10)}</p>}
            </div>
          )}
          {(member.skills?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">{member.skills!.map((s) => <Badge key={s}>{s}</Badge>)}</div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-bold">Zainpreneur hardware in possession ({held.length})</h4>
          <p className="text-xs text-slate-500">All assets remain Zainpreneur-owned — checked out only.</p>
          <div className="mt-3 space-y-2">
            {held.length === 0 && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-white/5">No assets currently assigned.</p>}
            {held.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800">
                <Laptop className="size-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{a.name}</span><span className="block text-[11px] text-slate-500">{a.tag} · {formatCurrency(a.value, settings.currency, { compact: true })}</span></span>
                <Badge>{a.category}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Direct asset handover</p>
            {!biz ? (
              <p className="mt-1 text-[11px] text-slate-500">Assign {member.name} to a business first — handovers deploy into their business context.</p>
            ) : availableAssets.length === 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">No available assets in the central pool right now.</p>
            ) : (
              <div className="mt-2 flex gap-2">
                <select
                  value={handoverId}
                  onChange={(e) => setHandoverId(e.target.value)}
                  aria-label="Available asset to hand over"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Select pool asset…</option>
                  {availableAssets.map((a) => (
                    <option key={a.id} value={a.id}>{a.tag} · {a.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!handoverId}
                  onClick={() => {
                    const asset = availableAssets.find((a) => a.id === handoverId)
                    if (!asset || !biz) return
                    deployAsset(asset.id, {
                      entityType: biz.category,
                      entityId: biz.id,
                      branchId: member.branchId,
                      memberId: member.id,
                      notes: `Direct handover to ${member.name}`,
                    })
                    setHandoverId('')
                  }}
                >
                  Hand over
                </Button>
              </div>
            )}
          </div>
          {biz && (
            <div className="mt-4 rounded-xl bg-slate-900 p-3 text-xs text-white dark:bg-white/5 dark:text-slate-200">
              <p className="font-bold">Active assignment</p>
              <p className="mt-1 opacity-80">{biz.name} · {biz.category} · {biz.model} model</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
