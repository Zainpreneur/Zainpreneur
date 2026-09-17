import { useMemo, useState } from 'react'

import type { EmploymentType, EngagementType, TeamMember } from '../../types'
import { ENGAGEMENT_TYPE_LABELS } from '../../types'
import type { TeamMemberDraft } from '../../context/BusinessContext'
import { useBusinesses } from '../../context/BusinessContext'
import { Button } from '../common/Button'
import { Field, Select, Textarea, TextInput } from '../common/Input'
import { Modal } from '../common/Modal'

const PALETTE = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#db2777', '#0d9488', '#a16207', '#64748b']

interface MemberFormModalProps {
  open: boolean
  onClose: () => void
  initial?: TeamMember
  onSubmit: (draft: TeamMemberDraft) => void
}

interface FormState {
  name: string
  role: string
  email: string
  phone: string
  department: string
  engagementType: EngagementType
  employmentType: EmploymentType
  monthlyCost: string
  hourlyRate: string
  contractTerms: string
  projectScope: string
  contractEndDate: string
  companyName: string
  contactPerson: string
  projectAllocation: string
  retainerMonthly: string
  activeBusinessId: string
  branchId: string
  location: string
  startedAt: string
  skills: string
  color: string
}

const EMPTY: FormState = {
  name: '',
  role: '',
  email: '',
  phone: '',
  department: 'Operations',
  engagementType: 'internal',
  employmentType: 'full_time',
  monthlyCost: '',
  hourlyRate: '',
  contractTerms: '',
  projectScope: '',
  contractEndDate: '',
  companyName: '',
  contactPerson: '',
  projectAllocation: '',
  retainerMonthly: '',
  activeBusinessId: '',
  branchId: '',
  location: '',
  startedAt: new Date().toISOString().slice(0, 10),
  skills: '',
  color: '#6366f1',
}

function toForm(member: TeamMember): FormState {
  return {
    name: member.name,
    role: member.role,
    email: member.email,
    phone: member.phone ?? '',
    department: member.department,
    engagementType: member.engagementType,
    employmentType: member.internalStaff?.employmentSubType ?? member.employmentType ?? 'full_time',
    monthlyCost: String(member.internalStaff?.monthlyCost ?? member.monthlyCost ?? ''),
    hourlyRate: String(member.freelancer?.hourlyRate ?? member.hourlyRate ?? ''),
    contractTerms: member.freelancer?.contractTerms ?? member.contractTerms ?? '',
    projectScope: member.freelancer?.projectScope ?? member.projectScope ?? '',
    contractEndDate: (member.freelancer?.contractEndDate ?? member.contractEndDate ?? '').slice(0, 10),
    companyName: member.agencyPartner?.companyName ?? member.companyName ?? '',
    contactPerson: member.agencyPartner?.contactPerson ?? member.contactPerson ?? '',
    projectAllocation: member.agencyPartner?.projectAllocation ?? member.projectAllocation ?? '',
    retainerMonthly: String(member.agencyPartner?.retainerMonthly ?? member.retainerMonthly ?? ''),
    activeBusinessId: member.activeBusinessId ?? member.associatedBusinessId ?? '',
    branchId: member.branchId ?? '',
    location: member.location ?? '',
    startedAt: (member.startedAt ?? new Date().toISOString()).slice(0, 10),
    skills: (member.skills ?? []).join(', '),
    color: member.color,
  }
}

const num = (v: string): number | undefined => {
  if (v.trim() === '') return undefined
  const n = Number(v)
  return Number.isNaN(n) ? undefined : n
}

export function MemberFormModal({ open, onClose, initial, onSubmit }: MemberFormModalProps) {
  const { businesses } = useBusinesses()
  const [form, setForm] = useState<FormState>(() => (initial ? toForm(initial) : EMPTY))
  const [error, setError] = useState('')

  const set = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setError('')
  }

  const branches = useMemo(
    () => businesses.find((b) => b.id === form.activeBusinessId)?.branches ?? [],
    [businesses, form.activeBusinessId],
  )

  const submit = () => {
    if (!form.name.trim() || !form.role.trim() || !form.email.trim()) {
      setError('Name, role and email are required.')
      return
    }
    const draft: TeamMemberDraft = {
      name: form.name.trim(),
      role: form.role.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      department: form.department.trim() || 'Operations',
      engagementType: form.engagementType,
      employmentType: form.employmentType,
      activeBusinessId: form.activeBusinessId || undefined,
      branchId: form.branchId || undefined,
      location: form.location.trim() || undefined,
      startedAt: form.startedAt ? new Date(form.startedAt).toISOString() : undefined,
      monthlyCost: num(form.monthlyCost),
      hourlyRate: num(form.hourlyRate),
      contractTerms: form.contractTerms.trim() || undefined,
      projectScope: form.projectScope.trim() || undefined,
      contractEndDate: form.contractEndDate || undefined,
      companyName: form.companyName.trim() || undefined,
      contactPerson: form.contactPerson.trim() || undefined,
      projectAllocation: form.projectAllocation.trim() || undefined,
      retainerMonthly: num(form.retainerMonthly),
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      color: form.color,
    }
    onSubmit(draft)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Edit ${initial.name}` : 'Add team member / partner'}
      description="Internal staff, freelancers and agency partners share one roster."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{initial ? 'Save changes' : 'Add member'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="mm-name">
          <TextInput id="mm-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ali Raza" />
        </Field>
        <Field label="Role" htmlFor="mm-role">
          <TextInput id="mm-role" value={form.role} onChange={(e) => set({ role: e.target.value })} placeholder="e.g. ERP Engineer" />
        </Field>
        <Field label="Email" htmlFor="mm-email">
          <TextInput id="mm-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Phone" htmlFor="mm-phone">
          <TextInput id="mm-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Engagement model" htmlFor="mm-eng">
          <Select id="mm-eng" value={form.engagementType} onChange={(e) => set({ engagementType: e.target.value as EngagementType })}>
            {(Object.keys(ENGAGEMENT_TYPE_LABELS) as EngagementType[]).map((t) => (
              <option key={t} value={t}>{ENGAGEMENT_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Department" htmlFor="mm-dept">
          <TextInput id="mm-dept" value={form.department} onChange={(e) => set({ department: e.target.value })} />
        </Field>

        {form.engagementType === 'internal' && (
          <>
            <Field label="Employment type" htmlFor="mm-emp">
              <Select id="mm-emp" value={form.employmentType} onChange={(e) => set({ employmentType: e.target.value as EmploymentType })}>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="intern">Intern</option>
              </Select>
            </Field>
            <Field label="Monthly cost (PKR)" htmlFor="mm-cost">
              <TextInput id="mm-cost" type="number" min={0} value={form.monthlyCost} onChange={(e) => set({ monthlyCost: e.target.value })} />
            </Field>
          </>
        )}
        {form.engagementType === 'freelancer' && (
          <>
            <Field label="Hourly rate (USD)" htmlFor="mm-rate">
              <TextInput id="mm-rate" type="number" min={0} value={form.hourlyRate} onChange={(e) => set({ hourlyRate: e.target.value })} />
            </Field>
            <Field label="Contract terms" htmlFor="mm-terms">
              <TextInput id="mm-terms" value={form.contractTerms} onChange={(e) => set({ contractTerms: e.target.value })} placeholder="e.g. 3-month retainer" />
            </Field>
            <Field label="Contract end date" htmlFor="mm-end">
              <TextInput id="mm-end" type="date" value={form.contractEndDate} onChange={(e) => set({ contractEndDate: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Project scope" htmlFor="mm-scope">
                <Textarea id="mm-scope" rows={2} value={form.projectScope} onChange={(e) => set({ projectScope: e.target.value })} />
              </Field>
            </div>
          </>
        )}
        {form.engagementType === 'agency_partner' && (
          <>
            <Field label="Partner company" htmlFor="mm-co">
              <TextInput id="mm-co" value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} placeholder="e.g. Odoo Solutions Pakistan" />
            </Field>
            <Field label="Contact person" htmlFor="mm-contact">
              <TextInput id="mm-contact" value={form.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} />
            </Field>
            <Field label="Monthly retainer (PKR)" htmlFor="mm-ret">
              <TextInput id="mm-ret" type="number" min={0} value={form.retainerMonthly} onChange={(e) => set({ retainerMonthly: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Project allocation" htmlFor="mm-alloc">
                <Textarea id="mm-alloc" rows={2} value={form.projectAllocation} onChange={(e) => set({ projectAllocation: e.target.value })} placeholder="e.g. MobiCom ERP deployment for client X" />
              </Field>
            </div>
          </>
        )}

        <Field label="Assigned business" htmlFor="mm-biz">
          <Select
            id="mm-biz"
            value={form.activeBusinessId}
            onChange={(e) => set({ activeBusinessId: e.target.value, branchId: '' })}
          >
            <option value="">Bench pool (unassigned)</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name} · {b.category}</option>
            ))}
          </Select>
        </Field>
        <Field label="Branch" htmlFor="mm-branch">
          <Select id="mm-branch" value={form.branchId} onChange={(e) => set({ branchId: e.target.value })} disabled={branches.length === 0}>
            <option value="">{branches.length === 0 ? 'Select a business first' : 'No specific branch'}</option>
            {branches.map((br) => (
              <option key={br.id} value={br.id}>{br.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Location" htmlFor="mm-loc">
          <TextInput id="mm-loc" value={form.location} onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label="Start date" htmlFor="mm-start">
          <TextInput id="mm-start" type="date" value={form.startedAt} onChange={(e) => set({ startedAt: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Skills (comma separated)" htmlFor="mm-skills">
            <TextInput id="mm-skills" value={form.skills} onChange={(e) => set({ skills: e.target.value })} placeholder="React, ERP, SEO" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Avatar color">
            <div className="flex gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set({ color: c })}
                  aria-label={`Color ${c}`}
                  className={`size-7 rounded-full ring-2 ring-offset-2 ${form.color === c ? 'ring-slate-900 dark:ring-white' : 'ring-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
    </Modal>
  )
}
