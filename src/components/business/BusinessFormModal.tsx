import { useState } from 'react'

import type { Business, BusinessCategory, BusinessModel, BusinessStatus, ClientTier } from '../../types'
import {
  BUSINESS_MODEL_DESCRIPTIONS,
  BUSINESS_MODEL_LABELS,
  BUSINESS_STATUS_LABELS,
  CLIENT_TIER_LABELS,
} from '../../types'
import { useBusinesses, type BranchDraft, type BusinessDraft, type OwnerShareInput } from '../../context/BusinessContext'
import { cn } from '../../utils/cn'
import { Button } from '../common/Button'
import { Field, Select, Textarea, TextInput } from '../common/Input'
import { Modal } from '../common/Modal'
import { CapTableEditor } from './CapTableEditor'

const PALETTE = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#db2777', '#0d9488', '#a16207', '#64748b']

interface BusinessFormModalProps {
  open: boolean
  onClose: () => void
  initial?: Business
  /** Receives the business draft plus initial branches (only for creation). */
  onSubmit: (draft: BusinessDraft, initialBranches: BranchDraft[]) => void
}

const STEPS = ['Basics & model', 'Cap table', 'Branches'] as const

interface BranchRow {
  name: string
  location: string
  monthlyRevenue: string
  monthlyExpenses: string
}

const EMPTY_BRANCH_ROW: BranchRow = { name: '', location: '', monthlyRevenue: '', monthlyExpenses: '' }

interface FormState {
  name: string
  category: BusinessCategory
  model: BusinessModel
  status: BusinessStatus
  industry: string
  tagline: string
  description: string
  location: string
  website: string
  email: string
  phone: string
  foundedYear: string
  monthlyRevenue: string
  monthlyExpenses: string
  employees: string
  equityShare: string
  clientTier: ClientTier
  color: string
  tags: string
  capTable: OwnerShareInput[]
  projectBudget: string
  projectDeliverables: string
  consultingRate: string
  consultingRetainer: string
  consultingHoursTarget: string
  consultingHoursLogged: string
  consultingContracts: string
  equityValuation: string
  equityDividendYield: string
  equityDividendsReceived: string
}

const EMPTY: FormState = {
  name: '',
  category: 'owned',
  model: 'equity',
  status: 'active',
  industry: '',
  tagline: '',
  description: '',
  location: '',
  website: '',
  email: '',
  phone: '',
  foundedYear: String(new Date().getFullYear()),
  monthlyRevenue: '',
  monthlyExpenses: '',
  employees: '',
  equityShare: '',
  clientTier: 'retainer',
  color: '#6366f1',
  tags: '',
  capTable: [],
  projectBudget: '',
  projectDeliverables: '',
  consultingRate: '',
  consultingRetainer: '',
  consultingHoursTarget: '',
  consultingHoursLogged: '',
  consultingContracts: '',
  equityValuation: '',
  equityDividendYield: '',
  equityDividendsReceived: '',
}

function toForm(business: Business): FormState {
  return {
    name: business.name,
    category: business.category,
    model: business.model,
    status: business.status,
    industry: business.industry,
    tagline: business.tagline,
    description: business.description,
    location: business.location ?? '',
    website: business.website ?? '',
    email: business.email ?? '',
    phone: business.phone ?? '',
    foundedYear: String(business.foundedYear),
    monthlyRevenue: String(business.monthlyRevenue),
    monthlyExpenses: String(business.monthlyExpenses),
    employees: String(business.employees),
    equityShare: business.equityShare !== undefined ? String(business.equityShare) : '',
    clientTier: business.clientTier ?? 'retainer',
    color: business.color,
    tags: business.tags.join(', '),
    capTable: business.capTable.map((share) => ({ ...share })),
    projectBudget: business.project ? String(business.project.budget) : '',
    projectDeliverables: business.project ? String(business.project.deliverables) : '',
    consultingRate: business.consulting ? String(business.consulting.hourlyRate) : '',
    consultingRetainer: business.consulting ? String(business.consulting.retainerMonthly) : '',
    consultingHoursTarget: business.consulting ? String(business.consulting.billableHoursTarget) : '',
    consultingHoursLogged: business.consulting ? String(business.consulting.billableHoursLogged) : '',
    consultingContracts: business.consulting ? String(business.consulting.contracts) : '',
    equityValuation: business.equity ? String(business.equity.valuation) : '',
    equityDividendYield: business.equity ? String(business.equity.dividendYield) : '',
    equityDividendsReceived: business.equity ? String(business.equity.dividendsReceived) : '',
  }
}

export function BusinessFormModal({ open, onClose, initial, onSubmit }: BusinessFormModalProps) {
  const { owners, addOwner } = useBusinesses()
  const [form, setForm] = useState<FormState>(() => (initial ? toForm(initial) : EMPTY))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [step, setStep] = useState(0)
  const [branchRows, setBranchRows] = useState<BranchRow[]>([EMPTY_BRANCH_ROW])

  const hasBranches = (initial?.branches.length ?? 0) > 0
  const isCreate = !initial

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateBranchRow = (index: number, patch: Partial<BranchRow>) => {
    setBranchRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  /** Validate the current step; returns true when navigation may continue. */
  const validateStep = (target: number): boolean => {
    const nextErrors: Record<string, string> = {}
    if (target === 0) {
      if (!form.name.trim()) nextErrors.name = 'Business name is required.'
      if (!form.industry.trim()) nextErrors.industry = 'Industry is required.'
      if (form.category === 'equity' && form.equityShare) {
        const share = Number(form.equityShare)
        if (Number.isNaN(share) || share < 0 || share > 100) nextErrors.equityShare = 'Enter a value between 0 and 100.'
      }
    }
    if (target === 1) {
      const allocated = form.capTable.reduce((sum, entry) => sum + entry.percentage, 0)
      if (form.capTable.length > 0 && Math.abs(allocated - 100) >= 0.01) {
        nextErrors.capTable = `Equity must total 100% (currently ${allocated.toFixed(0)}%).`
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const goNext = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const handleSubmit = () => {
    if (!validateStep(0) || !validateStep(1)) {
      setStep(!form.name.trim() || !form.industry.trim() ? 0 : 1)
      return
    }
    const nextErrors: Record<string, string> = {}
    setErrors(nextErrors)

    const draft: BusinessDraft = {
      name: form.name.trim(),
      category: form.category,
      model: form.model,
      status: form.status,
      industry: form.industry.trim(),
      tagline: form.tagline.trim(),
      description: form.description.trim(),
      location: form.location.trim() || undefined,
      website: form.website.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      foundedYear: Number(form.foundedYear) || new Date().getFullYear(),
      monthlyRevenue: Number(form.monthlyRevenue) || 0,
      monthlyExpenses: Number(form.monthlyExpenses) || 0,
      employees: Number(form.employees) || 0,
      equityShare: form.category === 'equity' && form.equityShare ? Number(form.equityShare) : undefined,
      clientTier: form.category === 'client' ? form.clientTier : undefined,
      color: form.color,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      capTable: form.capTable,
      project:
        form.model === 'project'
          ? {
              budget: Number(form.projectBudget) || 0,
              deliverables: Number(form.projectDeliverables) || 0,
              milestones: initial?.project?.milestones ?? [],
            }
          : undefined,
      consulting:
        form.model === 'consulting'
          ? {
              hourlyRate: Number(form.consultingRate) || 0,
              retainerMonthly: Number(form.consultingRetainer) || 0,
              billableHoursTarget: Number(form.consultingHoursTarget) || 0,
              billableHoursLogged: Number(form.consultingHoursLogged) || 0,
              contracts: Number(form.consultingContracts) || 0,
            }
          : undefined,
      equity:
        form.model === 'equity'
          ? {
              valuation: Number(form.equityValuation) || 0,
              dividendYield: Number(form.equityDividendYield) || 0,
              dividendsReceived: Number(form.equityDividendsReceived) || 0,
            }
          : undefined,
    }

    const initialBranches: BranchDraft[] = isCreate
      ? branchRows
          .filter((row) => row.name.trim())
          .map((row, index) => ({
            name: row.name.trim(),
            location: row.location.trim(),
            monthlyRevenue: Number(row.monthlyRevenue) || 0,
            monthlyExpenses: Number(row.monthlyExpenses) || 0,
            isHeadquarters: index === 0,
          }))
      : []

    onSubmit(draft, initialBranches)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={initial ? 'Edit business' : 'Add a business'}
      description={initial ? 'Update the details for this venture.' : 'Register a business under owned, equity or client.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext}>Continue</Button>
          ) : (
            <Button onClick={handleSubmit}>{initial ? 'Save changes' : 'Create business'}</Button>
          )}
        </>
      }
    >
      <ol className="mb-5 flex items-center gap-2" aria-label="Form progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (index < step || validateStep(step)) setStep(index)
              }}
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                index === step
                  ? 'bg-brand-600 text-white'
                  : index < step
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800',
              )}
              aria-current={index === step ? 'step' : undefined}
            >
              {index + 1}
            </button>
            <span className={cn('text-xs font-semibold', index === step ? 'text-slate-900 dark:text-white' : 'text-slate-400')}>
              {label}
            </span>
            {index < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-slate-200 dark:bg-slate-700" />}
          </li>
        ))}
      </ol>
      <div className="space-y-5">
        {step === 0 && (
          <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="bf-name" required error={errors.name}>
            <TextInput
              id="bf-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Apex AutoSpa"
            />
          </Field>
          <Field label="Industry" htmlFor="bf-industry" required error={errors.industry}>
            <TextInput
              id="bf-industry"
              value={form.industry}
              onChange={(e) => update('industry', e.target.value)}
              placeholder="e.g. Automotive Services"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" htmlFor="bf-category">
            <Select id="bf-category" value={form.category} onChange={(e) => update('category', e.target.value as BusinessCategory)}>
              <option value="owned">Owned Business</option>
              <option value="equity">Equity Stake</option>
              <option value="client">Client Business</option>
            </Select>
          </Field>
          <Field label="Status" htmlFor="bf-status">
            <Select id="bf-status" value={form.status} onChange={(e) => update('status', e.target.value as BusinessStatus)}>
              {(Object.keys(BUSINESS_STATUS_LABELS) as BusinessStatus[]).map((status) => (
                <option key={status} value={status}>
                  {BUSINESS_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Founded year" htmlFor="bf-year">
            <TextInput
              id="bf-year"
              type="number"
              value={form.foundedYear}
              onChange={(e) => update('foundedYear', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Business model" htmlFor="bf-model" hint={BUSINESS_MODEL_DESCRIPTIONS[form.model]}>
          <Select id="bf-model" value={form.model} onChange={(e) => update('model', e.target.value as BusinessModel)}>
            {(Object.keys(BUSINESS_MODEL_LABELS) as BusinessModel[]).map((model) => (
              <option key={model} value={model}>
                {BUSINESS_MODEL_LABELS[model]}
              </option>
            ))}
          </Select>
        </Field>

        {form.category === 'equity' && (
          <Field label="Equity share (%)" htmlFor="bf-equity" error={errors.equityShare} hint="Percentage of the company you own.">
            <TextInput
              id="bf-equity"
              type="number"
              min={0}
              max={100}
              value={form.equityShare}
              onChange={(e) => update('equityShare', e.target.value)}
              placeholder="e.g. 22"
            />
          </Field>
        )}

        {form.category === 'client' && (
          <Field label="Engagement type" htmlFor="bf-tier">
            <Select id="bf-tier" value={form.clientTier} onChange={(e) => update('clientTier', e.target.value as ClientTier)}>
              {(Object.keys(CLIENT_TIER_LABELS) as ClientTier[]).map((tier) => (
                <option key={tier} value={tier}>
                  {CLIENT_TIER_LABELS[tier]}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Tagline" htmlFor="bf-tagline">
          <TextInput
            id="bf-tagline"
            value={form.tagline}
            onChange={(e) => update('tagline', e.target.value)}
            placeholder="A short one-line description"
          />
        </Field>

        <Field label="Description" htmlFor="bf-description">
          <Textarea
            id="bf-description"
            rows={3}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What does this business do?"
          />
        </Field>

        {hasBranches && (
          <p className="rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
            Revenue, expenses and staff are rolled up from this business’s {initial?.branches.length} branches.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Monthly revenue" htmlFor="bf-revenue" hint={hasBranches ? 'From branches' : 'Approximate'}>
            <TextInput
              id="bf-revenue"
              type="number"
              min={0}
              disabled={hasBranches}
              value={form.monthlyRevenue}
              onChange={(e) => update('monthlyRevenue', e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Monthly expenses" htmlFor="bf-expenses" hint={hasBranches ? 'From branches' : 'Approximate'}>
            <TextInput
              id="bf-expenses"
              type="number"
              min={0}
              disabled={hasBranches}
              value={form.monthlyExpenses}
              onChange={(e) => update('monthlyExpenses', e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Employees" htmlFor="bf-employees" hint={hasBranches ? 'From branches' : undefined}>
            <TextInput
              id="bf-employees"
              type="number"
              min={0}
              disabled={hasBranches}
              value={form.employees}
              onChange={(e) => update('employees', e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>

        {form.model === 'project' && (
          <div className="grid gap-4 rounded-xl border border-sky-200 bg-sky-50/40 p-4 sm:grid-cols-2 dark:border-sky-500/20 dark:bg-sky-500/5">
            <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Project details
            </p>
            <Field label="Project budget" htmlFor="bf-project-budget">
              <TextInput
                id="bf-project-budget"
                type="number"
                min={0}
                value={form.projectBudget}
                onChange={(e) => update('projectBudget', e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Deliverables" htmlFor="bf-project-deliverables">
              <TextInput
                id="bf-project-deliverables"
                type="number"
                min={0}
                value={form.projectDeliverables}
                onChange={(e) => update('projectDeliverables', e.target.value)}
                placeholder="0"
              />
            </Field>
            <p className="sm:col-span-2 text-xs text-sky-700/80 dark:text-sky-300/80">
              Milestones are managed from the business detail page.
            </p>
          </div>
        )}

        {form.model === 'consulting' && (
          <div className="grid gap-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 sm:grid-cols-3 dark:border-indigo-500/20 dark:bg-indigo-500/5">
            <p className="sm:col-span-3 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              Consulting details
            </p>
            <Field label="Hourly rate" htmlFor="bf-consulting-rate">
              <TextInput
                id="bf-consulting-rate"
                type="number"
                min={0}
                value={form.consultingRate}
                onChange={(e) => update('consultingRate', e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Monthly retainer" htmlFor="bf-consulting-retainer">
              <TextInput
                id="bf-consulting-retainer"
                type="number"
                min={0}
                value={form.consultingRetainer}
                onChange={(e) => update('consultingRetainer', e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Active contracts" htmlFor="bf-consulting-contracts">
              <TextInput
                id="bf-consulting-contracts"
                type="number"
                min={0}
                value={form.consultingContracts}
                onChange={(e) => update('consultingContracts', e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Billable hours target" htmlFor="bf-consulting-target">
              <TextInput
                id="bf-consulting-target"
                type="number"
                min={0}
                value={form.consultingHoursTarget}
                onChange={(e) => update('consultingHoursTarget', e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Billable hours logged" htmlFor="bf-consulting-logged">
              <TextInput
                id="bf-consulting-logged"
                type="number"
                min={0}
                value={form.consultingHoursLogged}
                onChange={(e) => update('consultingHoursLogged', e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>
        )}

        {form.model === 'equity' && (
          <div className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:grid-cols-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <p className="sm:col-span-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Equity details
            </p>
            <Field label="Valuation" htmlFor="bf-equity-valuation">
              <TextInput
                id="bf-equity-valuation"
                type="number"
                min={0}
                value={form.equityValuation}
                onChange={(e) => update('equityValuation', e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Dividend yield (%)" htmlFor="bf-equity-yield">
              <TextInput
                id="bf-equity-yield"
                type="number"
                min={0}
                value={form.equityDividendYield}
                onChange={(e) => update('equityDividendYield', e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Dividends received" htmlFor="bf-equity-dividends">
              <TextInput
                id="bf-equity-dividends"
                type="number"
                min={0}
                value={form.equityDividendsReceived}
                onChange={(e) => update('equityDividendsReceived', e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" htmlFor="bf-location">
            <TextInput id="bf-location" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="City, area" />
          </Field>
          <Field label="Website" htmlFor="bf-website">
            <TextInput id="bf-website" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="example.com" />
          </Field>
          <Field label="Email" htmlFor="bf-email">
            <TextInput id="bf-email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="hello@example.com" />
          </Field>
          <Field label="Phone" htmlFor="bf-phone">
            <TextInput id="bf-phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+92 ..." />
          </Field>
        </div>

        <Field label="Tags" htmlFor="bf-tags" hint="Comma separated">
          <TextInput id="bf-tags" value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="retail, growth, B2B" />
        </Field>

        <Field label="Brand color">
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Select color ${color}`}
                onClick={() => update('color', color)}
                className={cn(
                  'size-8 cursor-pointer rounded-lg transition-transform hover:scale-110',
                  form.color === color && 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-slate-900',
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </Field>
          </>
        )}
        {step === 1 && (
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Allocate ownership across stakeholders. Percentages must total exactly 100% before you can continue.
            </p>
            <CapTableEditor owners={owners} value={form.capTable} onChange={(next) => update('capTable', next)} onCreateOwner={addOwner} />
            {errors.capTable && <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{errors.capTable}</p>}
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            {isCreate ? (
              <>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Optionally register the first branches now — revenue, expenses and staff roll up from branches
                  automatically. The first branch becomes headquarters. You can add more later from the detail view.
                </p>
                {branchRows.map((row, index) => (
                  <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-800">
                    <Field label={`Branch ${index + 1} name`} htmlFor={`bf-br-name-${index}`}>
                      <TextInput
                        id={`bf-br-name-${index}`}
                        value={row.name}
                        onChange={(e) => updateBranchRow(index, { name: e.target.value })}
                        placeholder="e.g. DHA Flagship"
                      />
                    </Field>
                    <Field label="Location" htmlFor={`bf-br-loc-${index}`}>
                      <TextInput
                        id={`bf-br-loc-${index}`}
                        value={row.location}
                        onChange={(e) => updateBranchRow(index, { location: e.target.value })}
                        placeholder="City, area"
                      />
                    </Field>
                    <Field label="Monthly revenue" htmlFor={`bf-br-rev-${index}`}>
                      <TextInput
                        id={`bf-br-rev-${index}`}
                        type="number"
                        min={0}
                        value={row.monthlyRevenue}
                        onChange={(e) => updateBranchRow(index, { monthlyRevenue: e.target.value })}
                        placeholder="0"
                      />
                    </Field>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Field label="Monthly expenses" htmlFor={`bf-br-exp-${index}`}>
                          <TextInput
                            id={`bf-br-exp-${index}`}
                            type="number"
                            min={0}
                            value={row.monthlyExpenses}
                            onChange={(e) => updateBranchRow(index, { monthlyExpenses: e.target.value })}
                            placeholder="0"
                          />
                        </Field>
                      </div>
                      {branchRows.length > 1 && (
                        <Button
                          variant="ghost"
                          onClick={() => setBranchRows((prev) => prev.filter((_, i) => i !== index))}
                          aria-label={`Remove branch ${index + 1}`}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="secondary" onClick={() => setBranchRows((prev) => [...prev, { ...EMPTY_BRANCH_ROW }])}>
                  Add another branch
                </Button>
                <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                  <p className="font-bold text-slate-800 dark:text-slate-100">Review — {form.name || 'New business'}</p>
                  <p className="mt-1">
                    {form.category} · {form.model} model · {form.capTable.reduce((s, e) => s + e.percentage, 0).toFixed(0)}% equity allocated ·
                    {' '}{branchRows.filter((r) => r.name.trim()).length} branch(es)
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {initial?.branches.length ?? 0} existing branch(es)
                </p>
                <p className="mt-1">
                  Branches are managed from the business detail view, where revenue, expenses and staff roll up
                  automatically. Saving here keeps the current branch structure.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}