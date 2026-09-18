// @ts-nocheck
import { useState } from 'react'

import type { Asset, AssetCategory, AssetCondition, AssetStatus } from '../../types'
import { ASSET_CATEGORY_LABELS, ASSET_CONDITION_LABELS, ASSET_STATUS_LABELS } from '../../types'
import type { AssetDraft } from '../../context/BusinessContext'
import { Button } from '../common/Button'
import { Field, Select, Textarea, TextInput } from '../common/Input'
import { Modal } from '../common/Modal'

interface AssetFormModalProps {
  open: boolean
  onClose: () => void
  initial?: Asset
  onSubmit: (draft: AssetDraft) => void
}

interface FormState {
  name: string
  category: AssetCategory
  tag: string
  serialNumber: string
  purchaseDate: string
  value: string
  status: AssetStatus
  condition: AssetCondition
  location: string
  notes: string
}

const EMPTY: FormState = {
  name: '',
  category: 'hardware',
  tag: '',
  serialNumber: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  value: '',
  status: 'available',
  condition: 'good',
  location: '',
  notes: '',
}

function toForm(asset: Asset): FormState {
  return {
    name: asset.name,
    category: asset.category,
    tag: asset.tag,
    serialNumber: asset.serialNumber,
    purchaseDate: asset.purchaseDate,
    value: String(asset.value),
    status: asset.status,
    condition: asset.condition,
    location: asset.location ?? '',
    notes: asset.notes ?? '',
  }
}

export function AssetFormModal({ open, onClose, initial, onSubmit }: AssetFormModalProps) {
  const [form, setForm] = useState<FormState>(() => (initial ? toForm(initial) : EMPTY))
  const [error, setError] = useState('')

  const set = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setError('')
  }

  const submit = () => {
    if (!form.name.trim() || !form.serialNumber.trim()) {
      setError('Name and serial number are required.')
      return
    }
    const value = Number(form.value)
    if (form.value.trim() === '' || Number.isNaN(value) || value < 0) {
      setError('Enter a valid purchase value.')
      return
    }
    onSubmit({
      name: form.name.trim(),
      category: form.category,
      serialNumber: form.serialNumber.trim(),
      purchaseDate: form.purchaseDate,
      value,
      status: form.status,
      condition: form.condition,
      tag: form.tag.trim() || undefined,
      location: form.location.trim() || undefined,
      notes: form.notes.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Edit ${initial.tag}` : 'Register asset'}
      description="All assets are owned by Zainpreneur — registration adds to the central pool as available."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{initial ? 'Save changes' : 'Register asset'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Asset name" htmlFor="am-name">
            <TextInput id="am-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder='e.g. MacBook Pro 14" M3' />
          </Field>
        </div>
        <Field label="Category" htmlFor="am-cat">
          <Select id="am-cat" value={form.category} onChange={(e) => set({ category: e.target.value as AssetCategory })}>
            {(Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[]).map((c) => (
              <option key={c} value={c}>{ASSET_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Asset tag (auto if empty)" htmlFor="am-tag">
          <TextInput id="am-tag" value={form.tag} onChange={(e) => set({ tag: e.target.value })} placeholder="e.g. ZP-LT-007" />
        </Field>
        <Field label="Serial number" htmlFor="am-sn">
          <TextInput id="am-sn" value={form.serialNumber} onChange={(e) => set({ serialNumber: e.target.value })} />
        </Field>
        <Field label="Purchase date" htmlFor="am-date">
          <TextInput id="am-date" type="date" value={form.purchaseDate} onChange={(e) => set({ purchaseDate: e.target.value })} />
        </Field>
        <Field label="Purchase value (PKR)" htmlFor="am-value">
          <TextInput id="am-value" type="number" min={0} value={form.value} onChange={(e) => set({ value: e.target.value })} />
        </Field>
        <Field label="Condition" htmlFor="am-cond">
          <Select id="am-cond" value={form.condition} onChange={(e) => set({ condition: e.target.value as AssetCondition })}>
            {(Object.keys(ASSET_CONDITION_LABELS) as AssetCondition[]).map((c) => (
              <option key={c} value={c}>{ASSET_CONDITION_LABELS[c]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="am-status">
          <Select
            id="am-status"
            value={form.status}
            onChange={(e) => set({ status: e.target.value as AssetStatus })}
            disabled={initial?.status === 'in-use'}
          >
            {(Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map((s) => (
              <option key={s} value={s}>{ASSET_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Location" htmlFor="am-loc">
          <TextInput id="am-loc" value={form.location} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. HQ Storage" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes" htmlFor="am-notes">
            <Textarea id="am-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </div>
      {initial?.status === 'in-use' && (
        <p className="mt-3 text-xs text-amber-600">Status is locked while deployed — return the asset to change it.</p>
      )}
      {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
    </Modal>
  )
}
