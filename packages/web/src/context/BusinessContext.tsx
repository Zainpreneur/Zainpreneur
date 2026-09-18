// @ts-nocheck
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export const ZAIN_OWNER_ID = 'owner-zain'
export const DATA_KEY = 'zainpreneur-data'

// ═══════════════════════════════════════════════════════════
// API helper
// ═══════════════════════════════════════════════════════════

async function fetchApi<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('zp:auth:token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`/api${path}`, { ...init, headers: { ...headers, ...init?.headers } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as any).error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

// ═══════════════════════════════════════════════════════════
// Context value type
// ═══════════════════════════════════════════════════════════

interface BusinessContextValue {
  businesses: any[]
  transactions: any[]
  tasks: any[]
  activity: any[]
  owners: any[]
  teamMembers: any[]
  assets: any[]
  assetHistory: any[]
  settings: any
  profile: any
  zainOwnerId: string

  addBusiness: (draft: any) => Promise<any>
  updateBusiness: (id: string, patch: any) => Promise<void>
  deleteBusiness: (id: string) => Promise<void>

  addTransaction: (draft: any) => Promise<any>
  updateTransaction: (id: string, patch: any) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>

  addTask: (draft: any) => Promise<any>
  updateTask: (id: string, patch: any) => Promise<void>
  deleteTask: (id: string) => Promise<void>

  addOwner: (draft: any) => Promise<any>
  updateOwner: (id: string, patch: any) => Promise<void>
  deleteOwner: (id: string) => Promise<void>

  addBranch: (businessId: string, draft: any) => Promise<any>
  updateBranch: (businessId: string, branchId: string, patch: any) => Promise<void>
  deleteBranch: (businessId: string, branchId: string) => Promise<void>

  addTeamMember: (draft: any) => Promise<any>
  updateTeamMember: (id: string, patch: any) => Promise<void>
  deleteTeamMember: (id: string) => Promise<void>

  addAsset: (draft: any) => Promise<any>
  updateAsset: (id: string, patch: any) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  deployAsset: (assetId: string, input: any) => Promise<void>
  returnAsset: (assetId: string, notes?: string) => Promise<void>
  setAssetStatus: (assetId: string, status: string, notes?: string) => Promise<void>

  setCapTable: (businessId: string, capTable: any[]) => Promise<void>
  addMilestone: (businessId: string, milestone: any) => Promise<void>
  updateMilestone: (businessId: string, milestoneId: string, patch: any) => Promise<void>
  deleteMilestone: (businessId: string, milestoneId: string) => Promise<void>

  logActivity: (businessId: string, type: string, message: string) => Promise<void>
  updateSettings: (patch: any) => Promise<void>
  updateProfile: (patch: any) => Promise<void>
  resetData: () => Promise<void>
}

const BusinessContext = createContext<BusinessContextValue | null>(null)

// ═══════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════

export function BusinessProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const invalidate = (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))

  const { data: businesses = [] } = useQuery({
    queryKey: ['businesses'],
    queryFn: () => fetchApi('/businesses').then((r: any) => r.data),
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => fetchApi('/transactions').then((r: any) => r.data),
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetchApi('/tasks').then((r: any) => r.data),
  })

  const { data: activity = [] } = useQuery({
    queryKey: ['activity'],
    queryFn: () => fetchApi('/dashboard/summary').then((r: any) => r.data?.activity ?? []),
  })

  const { data: owners = [] } = useQuery({
    queryKey: ['owners'],
    queryFn: () => fetchApi('/owners').then((r: any) => r.data),
  })

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team'],
    queryFn: () => fetchApi('/team').then((r: any) => r.data),
  })

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => fetchApi('/assets').then((r: any) => r.data),
  })

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetchApi('/settings').then((r: any) => r.data),
  })

  // ── Mutations ──
  const addBusiness = async (draft: any) => {
    const res = await fetchApi('/businesses', { method: 'POST', body: JSON.stringify(draft) })
    invalidate('businesses')
    return (res as any).data
  }
  const updateBusiness = async (id: string, patch: any) => {
    await fetchApi(`/businesses/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    invalidate('businesses')
  }
  const deleteBusiness = async (id: string) => {
    await fetchApi(`/businesses/${id}`, { method: 'DELETE' })
    invalidate('businesses')
  }

  const addTransaction = async (draft: any) => {
    const res = await fetchApi('/transactions', { method: 'POST', body: JSON.stringify(draft) })
    invalidate('transactions', 'businesses')
    return (res as any).data
  }
  const updateTransaction = async (id: string, patch: any) => {
    await fetchApi(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    invalidate('transactions')
  }
  const deleteTransaction = async (id: string) => {
    await fetchApi(`/transactions/${id}`, { method: 'DELETE' })
    invalidate('transactions')
  }

  const addTask = async (draft: any) => {
    const res = await fetchApi('/tasks', { method: 'POST', body: JSON.stringify(draft) })
    invalidate('tasks')
    return (res as any).data
  }
  const updateTask = async (id: string, patch: any) => {
    await fetchApi(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    invalidate('tasks')
  }
  const deleteTask = async (id: string) => {
    await fetchApi(`/tasks/${id}`, { method: 'DELETE' })
    invalidate('tasks')
  }

  const addOwner = async (draft: any) => {
    const res = await fetchApi('/owners', { method: 'POST', body: JSON.stringify(draft) })
    invalidate('owners')
    return (res as any).data
  }
  const updateOwner = async (id: string, patch: any) => {
    await fetchApi(`/owners/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    invalidate('owners')
  }
  const deleteOwner = async (id: string) => {
    await fetchApi(`/owners/${id}`, { method: 'DELETE' })
    invalidate('owners')
  }

  const addBranch = async (businessId: string, draft: any) => {
    const res = await fetchApi(`/businesses/${businessId}/branches`, { method: 'POST', body: JSON.stringify(draft) })
    invalidate('businesses')
    return (res as any).data
  }
  const updateBranch = async (businessId: string, branchId: string, patch: any) => {
    await fetchApi(`/businesses/${businessId}/branches/${branchId}`, { method: 'PATCH', body: JSON.stringify(patch) })
    invalidate('businesses')
  }
  const deleteBranch = async (businessId: string, branchId: string) => {
    await fetchApi(`/businesses/${businessId}/branches/${branchId}`, { method: 'DELETE' })
    invalidate('businesses')
  }

  const addTeamMember = async (draft: any) => {
    const res = await fetchApi('/team', { method: 'POST', body: JSON.stringify(draft) })
    invalidate('team')
    return (res as any).data
  }
  const updateTeamMember = async (id: string, patch: any) => {
    await fetchApi(`/team/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    invalidate('team')
  }
  const deleteTeamMember = async (id: string) => {
    await fetchApi(`/team/${id}`, { method: 'DELETE' })
    invalidate('team')
  }

  const addAsset = async (draft: any) => {
    const res = await fetchApi('/assets', { method: 'POST', body: JSON.stringify(draft) })
    invalidate('assets')
    return (res as any).data
  }
  const updateAsset = async (id: string, patch: any) => {
    await fetchApi(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    invalidate('assets')
  }
  const deleteAsset = async (id: string) => {
    await fetchApi(`/assets/${id}`, { method: 'DELETE' })
    invalidate('assets')
  }
  const deployAsset = async (assetId: string, input: any) => {
    await fetchApi(`/assets/${assetId}/deploy`, { method: 'POST', body: JSON.stringify(input) })
    invalidate('assets')
  }
  const returnAsset = async (assetId: string, notes?: string) => {
    await fetchApi(`/assets/${assetId}/return`, { method: 'POST', body: JSON.stringify({ notes }) })
    invalidate('assets')
  }
  const setAssetStatus = async (assetId: string, status: string, notes?: string) => {
    await fetchApi(`/assets/${assetId}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) })
    invalidate('assets')
  }

  const setCapTable = async (businessId: string, capTable: any[]) => {
    await fetchApi(`/businesses/${businessId}`, { method: 'PATCH', body: JSON.stringify({ capTable }) })
    invalidate('businesses')
  }
  const addMilestone = async () => {}
  const updateMilestone = async () => {}
  const deleteMilestone = async () => {}

  const logActivity = async () => {}
  const updateSettings = async (patch: any) => {
    await fetchApi('/settings', { method: 'PATCH', body: JSON.stringify(patch) })
    invalidate('settings')
  }
  const updateProfile = async (patch: any) => {
    await fetchApi('/settings/profile', { method: 'PATCH', body: JSON.stringify(patch) })
    invalidate('settings')
  }
  const resetData = async () => {
    await fetchApi('/settings/reset', { method: 'POST' })
    qc.clear()
  }

  const value = useMemo<BusinessContextValue>(() => ({
    businesses,
    transactions,
    tasks,
    activity,
    owners,
    teamMembers,
    assets,
    assetHistory: [],
    settings: settingsData ?? { theme: 'system', currency: 'PKR', compactSidebar: false, showFinancialTotals: true, notifications: { taskReminders: true, paymentAlerts: true, weeklyDigest: true, milestoneAlerts: true, marketingEmails: false }, defaultCategoryFilter: 'all' },
    profile: settingsData?.profile ?? { enterprise: 'Zainpreneur', initials: 'ZA', bio: '', timezone: 'Asia/Karachi', businessSince: '', avatarColor: '#6366f1' },
    zainOwnerId: ZAIN_OWNER_ID,
    addBusiness, updateBusiness, deleteBusiness,
    addTransaction, updateTransaction, deleteTransaction,
    addTask, updateTask, deleteTask,
    addOwner, updateOwner, deleteOwner,
    addBranch, updateBranch, deleteBranch,
    addTeamMember, updateTeamMember, deleteTeamMember,
    addAsset, updateAsset, deleteAsset, deployAsset, returnAsset, setAssetStatus,
    setCapTable, addMilestone, updateMilestone, deleteMilestone,
    logActivity, updateSettings, updateProfile, resetData,
  }), [businesses, transactions, tasks, activity, owners, teamMembers, assets, settingsData])

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}

export function useBusinesses(): BusinessContextValue {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusinesses must be used within a BusinessProvider')
  return ctx
}
