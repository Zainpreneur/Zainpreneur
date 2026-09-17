import { useEffect, useState } from 'react'

import { RefreshCw, Wifi, WifiOff } from 'lucide-react'

import { useToast } from '../../context/ToastContext'
import { failedEntries, pendingCount } from '../../enterprise/sync/outbox'
import { InMemoryRemotePort, isOnline, onSync, syncNow, type SyncResult } from '../../enterprise/sync/syncEngine'
import type { OutboxRow } from '../../db/schema'
import { cn } from '../../utils/cn'
import { Button } from '../common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'

export function SyncPanel() {
  const { notify } = useToast()
  const [online, setOnline] = useState(isOnline())
  const [pending, setPending] = useState(0)
  const [failed, setFailed] = useState<OutboxRow[]>([])
  const [last, setLast] = useState<SyncResult | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    setPending(await pendingCount().catch(() => 0))
    setFailed(await failedEntries().catch(() => []))
  }

  useEffect(() => {
    const offSync = onSync((result) => {
      setLast(result)
      setPending(result.pending)
      void failedEntries().then(setFailed).catch(() => {})
    })
    const on = (): void => {
      setOnline(true)
      void refresh()
    }
    const off = (): void => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    void refresh()
    return () => {
      offSync()
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const run = async () => {
    setBusy(true)
    try {
      const result = await syncNow(new InMemoryRemotePort())
      notify(`Sync complete — ${result.sent} sent, ${result.failed} failed, ${result.pending} pending`)
      await refresh()
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Offline sync</CardTitle>
          <CardDescription>Outbox replay with idempotency keys · cross-tab broadcast</CardDescription>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1', online ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300')}>
          {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {online ? 'Online' : 'Offline — queueing'}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">
          <span className="font-semibold">{pending} pending · {failed.length} failed</span>
          <Button size="sm" icon={<RefreshCw className="size-4" />} disabled={busy} onClick={() => void run()}>
            {busy ? 'Syncing…' : 'Sync now'}
          </Button>
        </div>
        {last && (
          <p className="text-xs text-slate-500">
            Last run: {last.attempted} attempted · {last.sent} sent · {last.failed} failed · {last.pending} still pending
          </p>
        )}
        {failed.length > 0 && (
          <div className="space-y-1.5">
            {failed.map((row) => (
              <p key={row.id} className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {row.kind} · {row.attempts} attempts · {row.last_error ?? 'unknown error'}
              </p>
            ))}
          </div>
        )}
        <p className="text-xs leading-relaxed text-slate-400">
          Timesheets logged offline land here first, then replay exactly once when connectivity returns.
        </p>
      </CardContent>
    </Card>
  )
}
