// @ts-nocheck
import { useState } from 'react'
import { Cloud, ArrowUpDown, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'
import { Button } from '../common/Button'

export function SyncPanel() {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [lastSync, setLastSync] = useState<string | null>(null)

  const runSync = async () => {
    setStatus('syncing')
    try {
      // Server-managed sync: just verify connectivity
      const res = await fetch('/health')
      if (!res.ok) throw new Error('Server unreachable')
      setStatus('done')
      setLastSync(new Date().toLocaleTimeString())
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
            <Cloud className="size-5" />
          </span>
          <div>
            <CardTitle>Cloud Sync</CardTitle>
            <CardDescription>Server-managed data synchronization</CardDescription>
          </div>
          <span className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1',
            status === 'done'
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300'
              : status === 'error'
                ? 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300'
                : 'bg-slate-100 text-slate-500 ring-slate-500/20 dark:bg-white/5 dark:text-slate-300',
          )}>
            {status === 'done' ? <CheckCircle className="size-3" /> : status === 'error' ? <AlertCircle className="size-3" /> : null}
            {status === 'done' ? 'Synced' : status === 'error' ? 'Failed' : status === 'syncing' ? 'Syncing…' : 'Ready'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/40">
          <p className="text-slate-600 dark:text-slate-300">
            Data is stored server-side in PostgreSQL. All clients share the same data through the REST API. No manual sync required — changes appear in real-time across sessions.
          </p>
        </div>

        {lastSync && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Last connectivity check: {lastSync}
          </p>
        )}

        <Button
          variant="secondary"
          icon={<ArrowUpDown className={cn('size-4', status === 'syncing' && 'animate-spin')} />}
          onClick={runSync}
          disabled={status === 'syncing'}
        >
          {status === 'syncing' ? 'Syncing…' : 'Check Connectivity'}
        </Button>

        <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          With the server backend, data synchronization is handled automatically. Each client authenticates via JWT and communicates with the PostgreSQL database through the Hono API.
        </p>
      </CardContent>
    </Card>
  )
}
