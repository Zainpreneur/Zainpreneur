// @ts-nocheck
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

import { AlertCircle } from 'lucide-react'

import { cn } from '../../utils/cn'

const FIELD_BASE =
  'w-full rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-1)] shadow-[var(--sh-inset)] placeholder-color-[var(--text-3)] transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus-ring-[var(--accent-tint)] disabled:cursor-not-allowed disabled:bg-[var(--surface-3)] dark:border-[var(--hairline-strong)] dark:bg-[var(--surface-3)] dark:text-[var(--text-1)] dark:placeholder-color-[var(--text-3)]'

const _INPUT_LEFT_ICON = 'left-3 top-1/2 -translate-y-1/2 left-3 select-none pointer-events-none text-[var(--text-2)]'

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-2)] dark:text-[var(--text-3)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--danger)] dark:text-[var(--danger-tint)]">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-[var(--text-2)] dark:text-[var(--text-3)]">{hint}</p>
      ) : null}
    </div>
  )
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function TextInput({ className, ...props }: TextInputProps) {
  return <input className={cn(FIELD_BASE, 'pl-12', className)} {...props} />
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn(FIELD_BASE, 'resize-y', 'pl-12', className)} {...props} />
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(FIELD_BASE, 'cursor-pointer pr-12 rounded-[14px]', className)}
      {...props}
    >
      {children}
    </select>
  )
}