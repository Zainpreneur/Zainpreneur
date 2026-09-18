// @ts-nocheck
import { useState, useEffect } from 'react'
import { Database, RefreshCw, CheckCircle, XCircle, Server } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'
import { Button } from '../common/Button'

interface HealthStatus {
  status: string
  checks: Record<string, string>
  uptime: number
  timestamp: string
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function DatabasePanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchHealth = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/health')
      const data = await res.json()
      setHealth(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHealth() }, [])

  const dbOk = health?.checks?.database === 'ok'
  const healthy = health?.status === 'ok'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className={cn(
            'flex size-9 items-center justify-center rounded-xl',
            healthy ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
          )}>
            <Server className="size-5" />
          </span>
          <div>
            <CardTitle>Server Connection</CardTitle>
            <CardDescription>PostgreSQL + Hono API</CardDescription>
          </div>
          <span className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1',
            healthy
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300',
          )}>
            <span className={cn('size-1.5 rounded-full', healthy ? 'bg-emerald-500' : 'bg-rose-500')} />
            {healthy ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/40">
            <p className="font-display text-base font-extrabold tabular-nums">
              {health ? formatUptime(health.uptime) : '—'}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Uptime</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/40">
            <p className="font-display text-base font-extrabold tabular-nums">
              {health?.env ?? '—'}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Environment</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/40">
            <div className="flex items-center justify-center gap-1.5">
              {dbOk ? <CheckCircle className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-rose-500" />}
              <p className="font-display text-base font-extrabold">{dbOk ? 'OK' : 'Error'}</p>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Database</p>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}

        <Button
          variant="secondary"
          icon={<RefreshCw className={cn('size-4', loading && 'animate-spin')} />}
          onClick={fetchHealth}
          disabled={loading}
        >
          {loading ? 'Checking…' : 'Refresh Status'}
        </Button>

        <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Server-side PostgreSQL database. Data persists across sessions. All mutations are logged via activity events.
        </p>
      </CardContent>
    </Card>
  )
}
