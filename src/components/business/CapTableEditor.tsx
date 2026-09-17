import { useMemo, useState } from 'react'

import { Plus, Star, Trash2, UserPlus } from 'lucide-react'

import type { Owner } from '../../types'
import type { OwnerDraft, OwnerShareInput } from '../../context/BusinessContext'
import { cn } from '../../utils/cn'
import { capTableTotal, capTableRemainder } from '../../utils/calculations'
import { Avatar } from '../common/Avatar'
import { Button } from '../common/Button'
import { Select, TextInput } from '../common/Input'

interface CapTableEditorProps {
  owners: Owner[]
  value: OwnerShareInput[]
  onChange: (next: OwnerShareInput[]) => void
  onCreateOwner: (draft: OwnerDraft) => Owner
}

export function CapTableEditor({ owners, value, onChange, onCreateOwner }: CapTableEditorProps) {
  const [adding, setAdding] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickEmail, setQuickEmail] = useState('')

  const total = useMemo(() => capTableTotal(value), [value])
  const balanced = value.length === 0 || Math.abs(total - 100) < 0.01
  const remaining = owners.filter((owner) => !value.some((entry) => entry.ownerId === owner.id))

  const updateRow = (index: number, patch: Partial<OwnerShareInput>) => {
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)))
  }

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const addRow = () => {
    const available = owners.find((owner) => !value.some((entry) => entry.ownerId === owner.id))
    if (!available) return
    const remainder = capTableRemainder(value)
    const percentage = value.length === 0 ? 100 : Math.max(0, remainder)
    onChange([...value, { ownerId: available.id, percentage, primary: value.length === 0 }])
  }

  const handleQuickAdd = () => {
    if (!quickName.trim() || !quickEmail.trim()) return
    const owner = onCreateOwner({ name: quickName.trim(), email: quickEmail.trim() })
    const remainder = capTableRemainder(value)
    onChange([
      ...value,
      { ownerId: owner.id, percentage: value.length === 0 ? 100 : Math.max(0, remainder), primary: value.length === 0 },
    ])
    setQuickName('')
    setQuickEmail('')
    setAdding(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cap table</p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            Assign stakeholders and their equity. Percentages must total 100%.
          </p>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-bold tabular-nums',
            balanced
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
          )}
        >
          {total.toFixed(0)}% allocated
        </span>
      </div>

      {value.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
          No equity allocated yet.
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((entry, index) => {
            const owner = owners.find((item) => item.id === entry.ownerId)
            const used = owners.filter((item) => value.some((row, i) => row.ownerId === item.id && i !== index))
            return (
              <div
                key={`${entry.ownerId}-${index}`}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <Avatar
                  name={owner?.name ?? 'Unassigned'}
                  initials={owner?.initials ?? '?'}
                  color={owner?.color ?? '#94a3b8'}
                  size="sm"
                />
                <Select
                  aria-label="Owner"
                  className="min-w-0 flex-1"
                  value={entry.ownerId}
                  onChange={(e) => updateRow(index, { ownerId: e.target.value })}
                >
                  {owner && !owners.some((item) => item.id === entry.ownerId) && <option value={entry.ownerId}>{owner.name}</option>}
                  {owners.map((item) => (
                    <option key={item.id} value={item.id} disabled={used.some((u) => u.id === item.id)}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <TextInput
                  aria-label="Ownership role"
                  className="hidden w-32 sm:block"
                  value={entry.role ?? ''}
                  onChange={(e) => updateRow(index, { role: e.target.value })}
                  placeholder="Role"
                />
                <div className="relative w-24 shrink-0">
                  <TextInput
                    aria-label="Share percentage"
                    type="number"
                    min={0}
                    max={100}
                    className="pr-7 text-right tabular-nums"
                    value={String(entry.percentage)}
                    onChange={(e) =>
                      updateRow(index, { percentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
                    }
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    %
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={entry.primary ? 'Primary owner' : 'Mark as primary owner'}
                  aria-pressed={entry.primary ?? false}
                  onClick={() => updateRow(index, { primary: !entry.primary })}
                  className={cn(
                    'shrink-0 rounded-lg p-2 transition-colors',
                    entry.primary
                      ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                      : 'text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-700',
                  )}
                >
                  <Star className={cn('size-4', entry.primary && 'fill-current')} />
                </button>
                <button
                  type="button"
                  aria-label="Remove owner"
                  onClick={() => removeRow(index)}
                  className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!balanced && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
          Equity totals {total.toFixed(0)}% — it should add up to 100%.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<Plus className="size-4" />}
          onClick={addRow}
          disabled={remaining.length === 0}
        >
          Add stakeholder
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<UserPlus className="size-4" />}
          onClick={() => setAdding((prev) => !prev)}
        >
          New person
        </Button>
      </div>

      {adding && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <TextInput
            aria-label="New owner name"
            className="min-w-[10rem] flex-1"
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            placeholder="Full name"
          />
          <TextInput
            aria-label="New owner email"
            type="email"
            className="min-w-[10rem] flex-1"
            value={quickEmail}
            onChange={(e) => setQuickEmail(e.target.value)}
            placeholder="Email"
          />
          <Button type="button" size="sm" onClick={handleQuickAdd} disabled={!quickName.trim() || !quickEmail.trim()}>
            Add
          </Button>
        </div>
      )}
    </div>
  )
}
