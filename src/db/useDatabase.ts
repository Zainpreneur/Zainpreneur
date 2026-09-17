import { useCallback, useEffect, useState } from 'react'

import { dbService, type DbStatus } from './dbService'
import type { WorkerBackend } from './sqlite.worker'
import type { TableName } from './schema'

export interface DatabaseState {
  status: DbStatus
  backend: WorkerBackend | null
  /** Secure-context + isolation flags that gate the OPFS backend. */
  isSecure: boolean
  crossOriginIsolated: boolean
  counts: Record<TableName, number> | null
  error: string | null
  refresh: () => Promise<void>
  reset: () => Promise<void>
  exportFile: () => Promise<void>
}

const emptyCounts = (): Record<TableName, number> => ({
  businesses: 0,
  branches: 0,
  owners: 0,
  cap_table: 0,
  team_members: 0,
  assets: 0,
  asset_deployments: 0,
})

export function useDatabase(): DatabaseState {
  const [status, setStatus] = useState<DbStatus>('idle')
  const [backend, setBackend] = useState<WorkerBackend | null>(null)
  const [counts, setCounts] = useState<Record<TableName, number> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const info = await dbService.ready()
      setBackend(info.backend)
      const raw = await dbService.counts()
      const next = emptyCounts()
      for (const [table, n] of Object.entries(raw)) {
        if (table in next) next[table as TableName] = n
      }
      setCounts(next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    const unsubscribe = dbService.onStatus(setStatus)
    void refresh()
    return unsubscribe
  }, [refresh])

  const reset = useCallback(async () => {
    await dbService.reset()
    await refresh()
  }, [refresh])

  const exportFile = useCallback(async () => {
    const buffer = await dbService.exportDatabase()
    const blob = new Blob([buffer], { type: 'application/x-sqlite3' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'zainpreneur.sqlite3'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [])

  return {
    status,
    backend,
    isSecure: typeof window !== 'undefined' && window.isSecureContext,
    crossOriginIsolated: typeof window !== 'undefined' && window.crossOriginIsolated,
    counts,
    error,
    refresh,
    reset,
    exportFile,
  }
}
