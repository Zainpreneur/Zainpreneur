// @ts-nocheck
import { useState } from 'react'

import type { Owner } from '../../types'
import type { OwnerDraft } from '../../context/BusinessContext'
import { cn } from '../../utils/cn'
import { Button } from '../common/Button'
import { Field, TextInput, Textarea } from '../common/Input'
import { Modal } from '../common/Modal'

const PALETTE = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#db2777', '#0d9488', '#a16207', '#64748b']

interface OwnerFormModalProps {
  open: boolean
  onClose: () => void
  initial?: Owner
  onSubmit: (draft: OwnerDraft) => void
}

interface FormState {
  name: string
  email: string
  phone: string
  role: string
  location: string
  bio: string
  color: string
}

const EMPTY: FormState = {
  name: '',
  email: '',
  phone: '',
  role: '',
  location: '',
  bio: '',
  color: '#6366f1',
}

function toForm(owner: Owner): FormState {
  return {
    name: owner.name,
    email: owner.email,
    phone: owner.phone ?? '',
    role: owner.role ?? '',
    location: owner.location ?? '',
    bio: owner.bio ?? '',
    color: owner.color,
  }
}

export function OwnerFormModal({ open, onClose, initial, onSubmit }: OwnerFormModalProps) {
  const [form, setForm] = useState<FormState>(() => (initial ? toForm(initial) : EMPTY))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!form.name.trim()) nextErrors.name = 'Owner name is required.'
    if (!form.email.trim()) nextErrors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSubmit({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      role: form.role.trim() || undefined,
      location: form.location.trim() || undefined,
      bio: form.bio.trim() || undefined,
      color: form.color,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={initial ? 'Edit owner' : 'Add an owner'}
      description={initial ? 'Update this owner’s contact details.' : 'Add a person to your owner directory.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{initial ? 'Save changes' : 'Add owner'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="of-name" required error={errors.name}>
            <TextInput id="of-name" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Zain Ali" />
          </Field>
          <Field label="Email" htmlFor="of-email" required error={errors.email}>
            <TextInput
              id="of-email"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="name@example.com"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" htmlFor="of-role" hint="e.g. Founder, Investor">
            <TextInput id="of-role" value={form.role} onChange={(e) => update('role', e.target.value)} placeholder="Founder" />
          </Field>
          <Field label="Phone" htmlFor="of-phone">
            <TextInput id="of-phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+92 ..." />
          </Field>
        </div>

        <Field label="Location" htmlFor="of-location">
          <TextInput id="of-location" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="City, country" />
        </Field>

        <Field label="Bio" htmlFor="of-bio">
          <Textarea id="of-bio" rows={3} value={form.bio} onChange={(e) => update('bio', e.target.value)} placeholder="A short note about this owner." />
        </Field>

        <Field label="Avatar color">
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
      </div>
    </Modal>
  )
}
