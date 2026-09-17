import { useState } from 'react'

import { Database, Download, RefreshCw, RotateCcw } from 'lucide-react'

import { useDatabase } from '../../db/useDatabase'
import { TABLE_NAMES } from '../../db/schema'
import { cn } from '../../utils/cn'
import { Button } from '../common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'
import { ConfirmDialog } from '../common/Modal'

const TABLE_LABELS: Record<string, string> = {
  businesses: 'Businesses',
  branches: 'Branches',
  owners: 'Owners',
  cap_table: 'Cap shares',
  team_members: 'Team',
  assets: 'Assets',
  asset_deployments: 'Deployments',
}

export function DatabasePanel() {
  const { status, backend, isSecure, crossOriginIsolated, counts, error, refresh, reset, exportFile } =
    useDatabase()
  const [busy, setBusy] = useState<'refresh' | 'reset' | 'export' | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState('')

  const run = async (kind: 'refresh' | 'reset' | 'export', action: () => Promise<unknown>, done: string) => {
    setBusy(kind)
    setNotice('')
    try {
      await action()
      setNotice(done)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const ready = status === 'ready'
  const total = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Database className="size-5" />
          </span>
          <div>
            <CardTitle>Local SQLite database</CardTitle>
            <CardDescription>Offline-first engine · SQLite WASM in a worker · OPFS file</CardDescription>
          </div>
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1',
              status === 'ready'
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                : status === 'error'
                  ? 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300'
                  : 'bg-slate-100 text-slate-500 ring-slate-500/20 dark:bg-white/5 dark:text-slate-300',
            )}
          >
            <span className={cn('size-1.5 rounded-full', status === 'ready' ? 'bg-emerald-500' : status === 'error' ? 'bg-rose-500' : 'bg-slate-400')} />
            {status === 'ready' ? (backend === 'opfs' ? 'OPFS persistent' : 'Memory + journal') : status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TABLE_NAMES.map((table) => (
            <div key={table} className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/40">
              <p className="font-display text-base font-extrabold tabular-nums">{counts?.[table] ?? '—'}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{TABLE_LABELS[table]}</p>
            </div>
          ))}
          <div className="rounded-xl bg-slate-900 p-2.5 text-center text-white dark:bg-white/5">
            <p className="font-display text-base font-extrabold tabular-nums">{total}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Total rows</p>
          </div>
        </div>

        {!crossOriginIsolated && ready && backend !== 'opfs' && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-200">
            Cross-origin isolation is off (secure: {isSecure ? 'yes' : 'no'}), so the engine runs in-memory with a
            localStorage mutation journal instead of the OPFS file. Serve with COOP/COEP headers for full persistence.
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
        {notice && <p className="text-xs text-slate-500 dark:text-slate-400">{notice}</p>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            icon={<RefreshCw className="size-4" />}
            className="flex-1"
            disabled={busy !== null}
            onClick={() => void run('refresh', refresh, 'Counts refreshed.')}
          >
            {busy === 'refresh' ? 'Loading…' : 'Refresh'}
          </Button>
          <Button
            variant="secondary"
            icon={<Download className="size-4" />}
            className="flex-1"
            disabled={!ready || busy !== null}
            onClick={() => void run('export', exportFile, 'zainpreneur.sqlite3 downloaded.')}
          >
            {busy === 'export' ? 'Exporting…' : 'Export .sqlite3'}
          </Button>
          <Button
            variant="secondary"
            icon={<RotateCcw className="size-4" />}
            className="flex-1 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            disabled={!ready || busy !== null}
            onClick={() => setConfirmReset(true)}
          >
            Reseed
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Same relational data as the app store, queryable offline. Cap-table writes validate 100% in a transaction;
          deployments flip status and audit atomically.
        </p>
      </CardContent>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false)
          void run('reset', reset, 'Database reset and reseeded.')
        }}
        title="Reseed local database?"
        message="Drops all SQLite tables and restores the seed snapshot. Journaled offline writes will be discarded."
        confirmLabel="Reseed"
      />
    </Card>
  )
}
