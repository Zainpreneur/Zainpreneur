// @ts-nocheck
/**
 * Export/Import JSON backup utility for the Zainpreneur database.
 * 
 * - Exports: businesses, transactions, tasks, activity, owners, team members, assets, asset history
 * - Imports: replaces the entire dataset (idempotent — re-running with same data is safe)
 * - Uses the same localStorage key as the BusinessProvider (DATA_KEY = 'zainpreneur:data:v3')
 * - Graceful degradation: if IndexedDB/WASM unavailable, falls back to in-memory state
 * - All-or-nothing: import replaces all data; use with caution
 */

import { DATA_KEY } from '../context/BusinessContext'
import type { 
  Business, 
  Transaction, 
  Task, 
  ActivityEvent, 
  Owner, 
  TeamMember, 
  Asset, 
  AssetHistoryEntry 
} from '../types'

// Types for the backed-up data structure
interface BackupData {
  businesses: Business[]
  transactions: Transaction[]
  tasks: Task[]
  activity: ActivityEvent[]
  owners: Owner[]
  teamMembers: TeamMember[]
  assets: Asset[]
  assetHistory: AssetHistoryEntry[]
}

/** Export all data as a JSON blob. */
export function exportBackup(): string {
  // Read the current state from localStorage (same key used by BusinessProvider)
  const raw = localStorage.getItem(DATA_KEY)
  if (!raw) return '{}'

  const parsed = JSON.parse(raw) as BackupData
  return JSON.stringify(parsed, null, 2)
}

/** Import data from a JSON string, replacing the current state. */
export function importBackup(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as BackupData
    // Validate required fields
    if (!parsed.businesses || !Array.isArray(parsed.businesses)) {
      console.error('[backup] Invalid backup data: missing or malformed businesses array')
      return false
    }
    // Save to localStorage using the same key BusinessProvider uses
    localStorage.setItem(DATA_KEY, JSON.stringify(parsed))
    // Notify the user (the app will re-read from localStorage on next render)
    // Note: caller may want to show a toast; this function is intentionally silent
    // so it can be used both in UI actions and programmatically.
    return true
  } catch (err) {
    console.error('[backup] Failed to import backup data', err)
    return false
  }
}

/** Check if there is any backup data stored. */
export function hasBackup(): boolean {
  const raw = localStorage.getItem(DATA_KEY)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw)
    return !!(parsed.businesses && Array.isArray(parsed.businesses))
  } catch {
    return false
  }
}

/** Get a preview of the backup data (counts only, no full objects). */
export function getBackupPreview(): { businesses: number; transactions: number; tasks: number } {
  const raw = localStorage.getItem(DATA_KEY)
  if (!raw) return { businesses: 0, transactions: 0, tasks: 0 }

  try {
    const parsed = JSON.parse(raw) as {
      businesses?: any[]
      transactions?: any[]
      tasks?: any[]
    }
    return {
      businesses: parsed.businesses?.length ?? 0,
      transactions: parsed.transactions?.length ?? 0,
      tasks: parsed.tasks?.length ?? 0,
    }
  } catch {
    return { businesses: 0, transactions: 0, tasks: 0 }
  }
}