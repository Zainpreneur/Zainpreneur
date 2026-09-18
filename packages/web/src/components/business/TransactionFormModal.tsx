// @ts-nocheck
import { useState } from 'react'

import type { Business, Transaction, TransactionCategory, TransactionStatus, TransactionType } from '../../types'
import { TRANSACTION_CATEGORY_LABELS, TRANSACTION_STATUS_LABELS } from '../../types'
import type { TransactionDraft } from '../../context/BusinessContext'
import { cn } from '../../utils/cn'
import { Button } from '../common/Button'
import { Field, Select, Textarea, TextInput } from '../common/Input'
import { Modal } from '../common/Modal'

interface TransactionFormModalProps {
  open: boolean
  onClose: () => void
  businesses: Business[]
  initial?: Transaction
  lockedBusinessId?: string
  onSubmit: (draft: TransactionDraft) => void
}

interface FormState {
  businessId: string
  type: TransactionType
  amount: string
  date: string
  category: TransactionCategory
  description: string
  paymentMethod: string
  reference: string
  status: TransactionStatus
  notes: string
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TransactionFormModal({
  open,
  onClose,
  businesses,
  initial,
  lockedBusinessId,
  onSubmit,
}: TransactionFormModalProps) {
  const [form, setForm] = useState<FormState>(() => ({
    businessId: initial?.businessId ?? lockedBusinessId ?? businesses[0]?.id ?? '',
    type: initial?.type ?? 'income',
    amount: initial ? String(initial.amount) : '',
    date: initial?.date ?? today(),
    category: initial?.category ?? 'revenue',
    description: initial?.description ?? '',
    paymentMethod: initial?.paymentMethod ?? 'Bank transfer',
    reference: initial?.reference ?? '',
    status: initial?.status ?? 'cleared',
    notes: initial?.notes ?? '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!form.businessId) nextErrors.businessId = 'Choose a business.'
    if (!form.description.trim()) nextErrors.description = 'Add a short description.'
    if (!form.amount || Number(form.amount) <= 0) nextErrors.amount = 'Enter an amount greater than zero.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSubmit({
      businessId: form.businessId,
      type: form.type,
      amount: Number(form.amount),
      date: form.date,
      category: form.category,
      description: form.description.trim(),
      paymentMethod: form.paymentMethod.trim() || 'Other',
      reference: form.reference.trim() || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit transaction' : 'Record transaction'}
      description="Track income and expenses across your portfolio."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{initial ? 'Save changes' : 'Add transaction'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['income', 'expense'] as TransactionType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => update('type', type)}
              className={cn(
                'cursor-pointer rounded-lg py-2 text-sm font-semibold capitalize transition-colors',
                form.type === type
                  ? type === 'income'
                    ? 'bg-white text-emerald-600 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                    : 'bg-white text-rose-600 shadow-sm dark:bg-slate-900 dark:text-rose-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
              )}
            >
              {type}
            </button>
          ))}
        </div>

        <Field label="Business" htmlFor="tf-business" required error={errors.businessId}>
          <Select
            id="tf-business"
            value={form.businessId}
            disabled={Boolean(lockedBusinessId)}
            onChange={(e) => update('businessId', e.target.value)}
          >
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" htmlFor="tf-amount" required error={errors.amount}>
            <TextInput
              id="tf-amount"
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => update('amount', e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Date" htmlFor="tf-date">
            <TextInput id="tf-date" type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
          </Field>
        </div>

        <Field label="Description" htmlFor="tf-description" required error={errors.description}>
          <TextInput
            id="tf-description"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="e.g. Membership revenue batch"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="tf-category">
            <Select
              id="tf-category"
              value={form.category}
              onChange={(e) => update('category', e.target.value as TransactionCategory)}
            >
              {(Object.keys(TRANSACTION_CATEGORY_LABELS) as TransactionCategory[]).map((category) => (
                <option key={category} value={category}>
                  {TRANSACTION_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="tf-status">
            <Select id="tf-status" value={form.status} onChange={(e) => update('status', e.target.value as TransactionStatus)}>
              {(Object.keys(TRANSACTION_STATUS_LABELS) as TransactionStatus[]).map((status) => (
                <option key={status} value={status}>
                  {TRANSACTION_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment method" htmlFor="tf-method">
            <TextInput
              id="tf-method"
              value={form.paymentMethod}
              onChange={(e) => update('paymentMethod', e.target.value)}
              placeholder="Bank transfer"
            />
          </Field>
          <Field label="Reference" htmlFor="tf-reference" hint="Optional">
            <TextInput
              id="tf-reference"
              value={form.reference}
              onChange={(e) => update('reference', e.target.value)}
              placeholder="INV-0001"
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor="tf-notes">
          <Textarea id="tf-notes" rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Optional context" />
        </Field>
      </div>
    </Modal>
  )
}