// @ts-nocheck
import { useState } from 'react'

import type { Branch, BranchStatus } from '../../types'
import { BRANCH_STATUS_LABELS } from '../../types'
import type { BranchDraft } from '../../context/BusinessContext'
import { Button } from '../common/Button'
import { Field, Select, TextInput } from '../common/Input'
import { Modal } from '../common/Modal'
import { Toggle } from '../common/Toggle'

interface BranchFormModalProps {
  open: boolean
  onClose: () => void
  businessName: string
  initial?: Branch
  onSubmit: (draft: BranchDraft) => void
}

interface FormState {
  name: string
  location: string
  address: string
  city: string
  country: string
  phone: string
  email: string
  manager: string
  status: BranchStatus
  openedYear: string
  monthlyRevenue: string
  monthlyExpenses: string
  employees: string
  isHeadquarters: boolean
}

const EMPTY: FormState = {
  name: '',
  location: '',
  address: '',
  city: '',
  country: '',
  phone: '',
  email: '',
  manager: '',
  status: 'active',
  openedYear: String(new Date().getFullYear()),
  monthlyRevenue: '',
  monthlyExpenses: '',
  employees: '',
  isHeadquarters: false,
}

function toForm(branch: Branch): FormState {
  return {
    name: branch.name,
    location: branch.location,
    address: branch.address ?? '',
    city: branch.city ?? '',
    country: branch.country ?? '',
    phone: branch.phone ?? '',
    email: branch.email ?? '',
    manager: branch.manager ?? '',
    status: branch.status,
    openedYear: String(branch.openedYear),
    monthlyRevenue: String(branch.monthlyRevenue),
    monthlyExpenses: String(branch.monthlyExpenses),
    employees: String(branch.employees),
    isHeadquarters: branch.isHeadquarters,
  }
}

export function BranchFormModal({ open, onClose, businessName, initial, onSubmit }: BranchFormModalProps) {
  const [form, setForm] = useState<FormState>(() => (initial ? toForm(initial) : EMPTY))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!form.name.trim()) nextErrors.name = 'Branch name is required.'
    if (!form.location.trim()) nextErrors.location = 'Location is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSubmit({
      name: form.name.trim(),
      location: form.location.trim(),
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      country: form.country.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      manager: form.manager.trim() || undefined,
      status: form.status,
      openedYear: Number(form.openedYear) || new Date().getFullYear(),
      monthlyRevenue: Number(form.monthlyRevenue) || 0,
      monthlyExpenses: Number(form.monthlyExpenses) || 0,
      employees: Number(form.employees) || 0,
      isHeadquarters: form.isHeadquarters,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={initial ? 'Edit branch' : 'Add a branch'}
      description={`${initial ? 'Update this branch' : 'Register a new branch'} for ${businessName}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{initial ? 'Save changes' : 'Add branch'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Branch name" htmlFor="br-name" required error={errors.name}>
            <TextInput id="br-name" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Gulberg Branch" />
          </Field>
          <Field label="Status" htmlFor="br-status">
            <Select id="br-status" value={form.status} onChange={(e) => update('status', e.target.value as BranchStatus)}>
              {(Object.keys(BRANCH_STATUS_LABELS) as BranchStatus[]).map((status) => (
                <option key={status} value={status}>
                  {BRANCH_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Location" htmlFor="br-location" required error={errors.location} hint="Primary area or district">
          <TextInput id="br-location" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="e.g. Gulberg III, Lahore" />
        </Field>

        <Field label="Address" htmlFor="br-address">
          <TextInput id="br-address" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Street address" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" htmlFor="br-city">
            <TextInput id="br-city" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Lahore" />
          </Field>
          <Field label="Country" htmlFor="br-country">
            <TextInput id="br-country" value={form.country} onChange={(e) => update('country', e.target.value)} placeholder="Pakistan" />
          </Field>
          <Field label="Phone" htmlFor="br-phone">
            <TextInput id="br-phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+92 ..." />
          </Field>
          <Field label="Email" htmlFor="br-email">
            <TextInput id="br-email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="branch@example.com" />
          </Field>
          <Field label="Manager" htmlFor="br-manager">
            <TextInput id="br-manager" value={form.manager} onChange={(e) => update('manager', e.target.value)} placeholder="Branch manager" />
          </Field>
          <Field label="Opened year" htmlFor="br-year">
            <TextInput id="br-year" type="number" value={form.openedYear} onChange={(e) => update('openedYear', e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Monthly revenue" htmlFor="br-revenue">
            <TextInput id="br-revenue" type="number" min={0} value={form.monthlyRevenue} onChange={(e) => update('monthlyRevenue', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Monthly expenses" htmlFor="br-expenses">
            <TextInput id="br-expenses" type="number" min={0} value={form.monthlyExpenses} onChange={(e) => update('monthlyExpenses', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Employees" htmlFor="br-employees">
            <TextInput id="br-employees" type="number" min={0} value={form.employees} onChange={(e) => update('employees', e.target.value)} placeholder="0" />
          </Field>
        </div>

        <Toggle id="br-hq" checked={form.isHeadquarters} onChange={(checked) => update('isHeadquarters', checked)} label="This is the headquarters" />
      </div>
    </Modal>
  )
}
