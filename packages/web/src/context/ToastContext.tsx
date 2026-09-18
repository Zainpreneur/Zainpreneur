import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

import { cn } from '../utils/cn'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const KIND_META: Record<ToastKind, { icon: typeof Info; barClass: string; iconClass: string }> = {
  success: { icon: CheckCircle2, barClass: 'bg-emerald-500', iconClass: 'text-emerald-500 dark:text-emerald-400' },
  error: { icon: AlertCircle, barClass: 'bg-rose-500', iconClass: 'text-rose-500 dark:text-rose-400' },
  info: { icon: Info, barClass: 'bg-indigo-500', iconClass: 'text-indigo-500 dark:text-indigo-400' },
}

const TTL_MS = 3600

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = `toast-${Date.now()}-${(seq.current += 1)}`
      setToasts((prev) => [...prev.slice(-3), { id, kind, message }])
      window.setTimeout(() => dismiss(id), TTL_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
          {toasts.map((toast) => {
            const meta = KIND_META[toast.kind]
            return (
              <div
                key={toast.id}
                role="status"
                className="animate-toast-in pointer-events-auto flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
              >
                <span className={cn('w-1 self-stretch', meta.barClass)} />
                <meta.icon className={cn('mt-3 size-5 shrink-0', meta.iconClass)} />
                <p className="flex-1 py-3 pr-1 text-sm font-medium text-slate-700 dark:text-slate-200">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="mr-2 mt-2.5 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  <X className="size-4" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
