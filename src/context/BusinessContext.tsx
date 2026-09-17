import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type {
  ActivityEvent,
  AppSettings,
  Asset,
  AssetCategory,
  AssetCondition,
  AssetHistoryAction,
  AssetHistoryEntry,
  AssetStatus,
  Branch,
  BranchStatus,
  Business,
  BusinessCategory,
  BusinessModel,
  BusinessStatus,
  ClientTier,
  ConsultingDetails,
  EmploymentType,
  EquityDetails,
  Milestone,
  Owner,
  OwnerShare,
  ProjectDetails,
  Task,
  TaskPriority,
  TaskStatus,
  TeamMember,
  Transaction,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
  UserProfile,
} from '../types'
import {
  activity as seedActivity,
  assetHistory as seedAssetHistory,
  assets as seedAssets,
  branchesByBusiness,
  businesses as seedBusinesses,
  capTablesByBusiness,
  defaultSettings,
  defaultUser,
  owners as seedOwners,
  tasks as seedTasks,
  teamMembers as seedTeamMembers,
  transactions as seedTransactions,
  ZAIN_OWNER_ID,
} from '../data'
import { ASSET_OWNER } from '../types'
import { initials } from '../utils/format'
import { branchTotals } from '../utils/branches'
import { ownerStats } from '../utils/calculations'

const DATA_KEY = 'zainpreneur:data:v3'
const SETTINGS_KEY = 'zainpreneur:settings:v1'
const PROFILE_KEY = 'zainpreneur:profile:v1'

export { ZAIN_OWNER_ID }

/* ---------------------------------- input types ---------------------------------- */

export interface OwnerShareInput {
  ownerId: string
  percentage: number
  role?: string
  primary?: boolean
}

export interface BusinessDraft {
  name: string
  category: BusinessCategory
  model: BusinessModel
  status: BusinessStatus
  tagline?: string
  description?: string
  industry: string
  foundedYear?: number
  color?: string
  logoGlyph?: string
  website?: string
  location?: string
  phone?: string
  email?: string
  equityShare?: number
  clientTier?: ClientTier
  monthlyRevenue?: number
  monthlyExpenses?: number
  employees?: number
  tags?: string[]
  capTable?: OwnerShareInput[]
  project?: ProjectDetails
  consulting?: ConsultingDetails
  equity?: EquityDetails
}

export interface TransactionDraft {
  businessId: string
  date: string
  description: string
  category: TransactionCategory
  type: TransactionType
  amount: number
  paymentMethod: string
  reference?: string
  status?: TransactionStatus
  notes?: string
}

export interface TaskDraft {
  businessId: string
  title: string
  description?: string
  status?: TaskStatus
  priority: TaskPriority
  dueDate: string
  tags?: string[]
}

export interface OwnerDraft {
  name: string
  email: string
  phone?: string
  location?: string
  role?: string
  bio?: string
  color?: string
}

export interface BranchDraft {
  name: string
  location: string
  address?: string
  city?: string
  country?: string
  phone?: string
  email?: string
  manager?: string
  status?: BranchStatus
  openedYear?: number
  monthlyRevenue?: number
  monthlyExpenses?: number
  employees?: number
  isHeadquarters?: boolean
}

export interface TeamMemberDraft {
  name: string
  role: string
  email: string
  phone?: string
  department?: string
  employmentType?: EmploymentType
  activeBusinessId?: string
  branchId?: string
  location?: string
  startedAt?: string
  monthlyCost?: number
  skills?: string[]
  color?: string
}

export interface AssetDraft {
  name: string
  category: AssetCategory
  serialNumber: string
  purchaseDate: string
  value: number
  status?: AssetStatus
  condition?: AssetCondition
  tag?: string
  assetOwner?: string
  location?: string
  notes?: string
}

export interface DeployAssetInput {
  entityType: BusinessCategory
  entityId: string
  branchId?: string
  memberId?: string
  deployedDate?: string
  notes?: string
}

/* ---------------------------------- persisted shape ---------------------------------- */

interface PersistedState {
  businesses: Business[]
  transactions: Transaction[]
  tasks: Task[]
  activity: ActivityEvent[]
  owners: Owner[]
  teamMembers: TeamMember[]
  assets: Asset[]
  assetHistory: AssetHistoryEntry[]
}

/* ---------------------------------- storage helpers ---------------------------------- */

function readPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    if (
      Array.isArray(parsed.businesses) &&
      Array.isArray(parsed.transactions) &&
      Array.isArray(parsed.tasks) &&
      Array.isArray(parsed.activity) &&
      Array.isArray(parsed.owners)
    ) {
      return {
        businesses: parsed.businesses,
        transactions: parsed.transactions,
        tasks: parsed.tasks,
        activity: parsed.activity,
        owners: parsed.owners,
        teamMembers: Array.isArray(parsed.teamMembers) ? parsed.teamMembers : seedTeamMembers,
        assets: Array.isArray(parsed.assets) ? parsed.assets : seedAssets,
        assetHistory: Array.isArray(parsed.assetHistory) ? parsed.assetHistory : seedAssetHistory,
      }
    }
    return null
  } catch {
    return null
  }
}

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    return defaultSettings
  }
}

function readProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return defaultUser
    return { ...defaultUser, ...(JSON.parse(raw) as Partial<UserProfile>) }
  } catch {
    return defaultUser
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function computeHealth(revenue: number, expenses: number): number {
  if (revenue <= 0 && expenses <= 0) return 50
  if (revenue <= 0) return 25
  const margin = (revenue - expenses) / revenue
  return Math.min(98, Math.max(8, Math.round(50 + margin * 120)))
}

/** Recompute headline figures from branches so consolidated totals stay authoritative. */
function withRollup(business: Business): Business {
  if (business.branches.length === 0) return business
  const totals = branchTotals(business.branches)
  return {
    ...business,
    monthlyRevenue: totals.revenue,
    monthlyExpenses: totals.expenses,
    employees: totals.employees,
    healthScore: computeHealth(totals.revenue, totals.expenses),
  }
}

function businessSeed(input: BusinessDraft, id: string): Business {
  const glyph =
    input.logoGlyph ||
    input.name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()

  const capTable: OwnerShare[] = (input.capTable ?? []).map((entry) => ({ ...entry }))

  return withRollup({
    id,
    name: input.name,
    category: input.category,
    model: input.model,
    status: input.status,
    tagline: input.tagline ?? '',
    description: input.description ?? '',
    industry: input.industry,
    foundedYear: input.foundedYear ?? new Date().getFullYear(),
    color: input.color ?? '#6366f1',
    logoGlyph: glyph,
    website: input.website,
    location: input.location,
    phone: input.phone,
    email: input.email,
    equityShare: input.equityShare,
    clientTier: input.clientTier,
    monthlyRevenue: input.monthlyRevenue ?? 0,
    monthlyExpenses: input.monthlyExpenses ?? 0,
    employees: input.employees ?? 0,
    healthScore: computeHealth(input.monthlyRevenue ?? 0, input.monthlyExpenses ?? 0),
    tags: input.tags ?? [],
    capTable,
    branches: [],
    project: input.project,
    consulting: input.consulting,
    equity: input.equity,
    createdAt: new Date().toISOString(),
  })
}

function ownerSeed(draft: OwnerDraft, id: string): Owner {
  return {
    id,
    name: draft.name,
    email: draft.email,
    phone: draft.phone,
    location: draft.location,
    role: draft.role,
    bio: draft.bio,
    color: draft.color ?? '#6366f1',
    initials: initials(draft.name),
    createdAt: new Date().toISOString(),
    totalOwnedBusinessesCount: 0,
  }
}

function branchSeed(businessId: string, draft: BranchDraft, id: string): Branch {
  return {
    id,
    businessId,
    name: draft.name,
    location: draft.location,
    address: draft.address,
    city: draft.city,
    country: draft.country,
    phone: draft.phone,
    email: draft.email,
    manager: draft.manager,
    status: draft.status ?? 'active',
    openedYear: draft.openedYear ?? new Date().getFullYear(),
    monthlyRevenue: draft.monthlyRevenue ?? 0,
    monthlyExpenses: draft.monthlyExpenses ?? 0,
    employees: draft.employees ?? 0,
    isHeadquarters: draft.isHeadquarters ?? false,
    createdAt: new Date().toISOString(),
  }
}

const ASSET_TAG_PREFIX: Record<AssetCategory, string> = {
  hardware: 'HW',
  machinery: 'MC',
  equipment: 'EQ',
  other: 'OT',
}

function teamMemberSeed(draft: TeamMemberDraft, id: string): TeamMember {
  return {
    id,
    name: draft.name,
    role: draft.role,
    email: draft.email,
    phone: draft.phone,
    color: draft.color ?? '#6366f1',
    initials: initials(draft.name),
    department: draft.department ?? 'Operations',
    employmentType: draft.employmentType ?? 'full_time',
    activeBusinessId: draft.activeBusinessId,
    branchId: draft.branchId,
    assignedAssets: [],
    location: draft.location,
    startedAt: draft.startedAt,
    monthlyCost: draft.monthlyCost,
    skills: draft.skills ?? [],
  }
}

function assetSeed(draft: AssetDraft, id: string): Asset {
  const status = draft.status ?? 'available'
  return {
    id,
    tag: draft.tag?.trim() || `ZP-${ASSET_TAG_PREFIX[draft.category]}-${id.slice(-4).toUpperCase()}`,
    name: draft.name,
    category: draft.category,
    serialNumber: draft.serialNumber,
    purchaseDate: draft.purchaseDate,
    value: draft.value,
    status,
    condition: draft.condition ?? 'good',
    assetOwner: draft.assetOwner ?? ASSET_OWNER,
    location: draft.location,
    notes: draft.notes,
    currentDeployment: undefined,
    createdAt: new Date().toISOString(),
  }
}

function seadRelations(): Business[] {
  return seedBusinesses.map((business) => ({
    ...business,
    capTable: business.capTable.length > 0 ? business.capTable : capTablesByBusiness[business.id] ?? [],
    branches: business.branches.length > 0 ? business.branches : branchesByBusiness[business.id] ?? [],
  }))
}

/* ---------------------------------- context ---------------------------------- */

interface BusinessContextValue {
  businesses: Business[]
  transactions: Transaction[]
  tasks: Task[]
  activity: ActivityEvent[]
  owners: Owner[]
  teamMembers: TeamMember[]
  assets: Asset[]
  assetHistory: AssetHistoryEntry[]
  settings: AppSettings
  profile: UserProfile
  zainOwnerId: string

  addBusiness: (draft: BusinessDraft) => Business
  updateBusiness: (id: string, patch: Partial<BusinessDraft>) => void
  deleteBusiness: (id: string) => void

  addTransaction: (draft: TransactionDraft) => Transaction
  updateTransaction: (id: string, patch: Partial<TransactionDraft>) => void
  deleteTransaction: (id: string) => void

  addTask: (draft: TaskDraft) => Task
  updateTask: (id: string, patch: Partial<Omit<TaskDraft, 'businessId'>>) => void
  deleteTask: (id: string) => void

  addOwner: (draft: OwnerDraft) => Owner
  updateOwner: (id: string, patch: Partial<OwnerDraft>) => void
  deleteOwner: (id: string) => void

  addBranch: (businessId: string, draft: BranchDraft) => Branch
  updateBranch: (businessId: string, branchId: string, patch: Partial<BranchDraft>) => void
  deleteBranch: (businessId: string, branchId: string) => void

  addTeamMember: (draft: TeamMemberDraft) => TeamMember
  updateTeamMember: (id: string, patch: Partial<TeamMemberDraft>) => void
  deleteTeamMember: (id: string) => void

  addAsset: (draft: AssetDraft) => Asset
  updateAsset: (id: string, patch: Partial<AssetDraft>) => void
  deleteAsset: (id: string) => void
  deployAsset: (assetId: string, input: DeployAssetInput) => void
  returnAsset: (assetId: string, notes?: string) => void
  setAssetStatus: (assetId: string, status: AssetStatus, notes?: string) => void

  setCapTable: (businessId: string, capTable: OwnerShareInput[]) => void
  addMilestone: (businessId: string, milestone: Omit<Milestone, 'id'>) => void
  updateMilestone: (businessId: string, milestoneId: string, patch: Partial<Milestone>) => void
  deleteMilestone: (businessId: string, milestoneId: string) => void

  logActivity: (businessId: string, type: ActivityEvent['type'], message: string) => void
  updateSettings: (patch: Partial<AppSettings>) => void
  updateProfile: (patch: Partial<UserProfile>) => void
  resetData: () => void
}

const BusinessContext = createContext<BusinessContextValue | null>(null)

export function BusinessProvider({ children }: { children: ReactNode }) {
  const seeded = useMemo<PersistedState>(
    () =>
      readPersisted() ?? {
        businesses: seadRelations(),
        transactions: seedTransactions,
        tasks: seedTasks,
        activity: seedActivity,
        owners: seedOwners,
        teamMembers: seedTeamMembers,
        assets: seedAssets,
        assetHistory: seedAssetHistory,
      },
    [],
  )

  const [businesses, setBusinesses] = useState<Business[]>(seeded.businesses)
  const [transactions, setTransactions] = useState<Transaction[]>(seeded.transactions)
  const [tasks, setTasks] = useState<Task[]>(seeded.tasks)
  const [activity, setActivity] = useState<ActivityEvent[]>(seeded.activity)
  const [rawOwners, setRawOwners] = useState<Owner[]>(seeded.owners)
  const [rawTeamMembers, setRawTeamMembers] = useState<TeamMember[]>(seeded.teamMembers)
  const [assets, setAssets] = useState<Asset[]>(seeded.assets)
  const [assetHistory, setAssetHistory] = useState<AssetHistoryEntry[]>(seeded.assetHistory)
  const [settings, setSettings] = useState<AppSettings>(() => readSettings())
  const [profile, setProfile] = useState<UserProfile>(() => readProfile())

  /* ------------------------------ derived owners ------------------------------ */

  const owners = useMemo<Owner[]>(
    () => rawOwners.map((owner) => ownerStats(owner, businesses).owner),
    [rawOwners, businesses],
  )

  /* ------------------------------ derived team ------------------------------ */

  const teamMembers = useMemo<TeamMember[]>(
    () =>
      rawTeamMembers.map((member) => ({
        ...member,
        assignedAssets: assets
          .filter((asset) => asset.currentDeployment?.assignedToMemberId === member.id)
          .map((asset) => asset.id),
      })),
    [rawTeamMembers, assets],
  )

  /* ------------------------------ persistence ------------------------------ */

  useEffect(() => {
    localStorage.setItem(
      DATA_KEY,
      JSON.stringify({
        businesses,
        transactions,
        tasks,
        activity,
        owners: rawOwners,
        teamMembers: rawTeamMembers,
        assets,
        assetHistory,
      }),
    )
  }, [businesses, transactions, tasks, activity, rawOwners, rawTeamMembers, assets, assetHistory])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  }, [profile])

  /* ------------------------------ business actions ------------------------------ */

  const addBusiness = useCallback((draft: BusinessDraft) => {
    const nextBusiness = businessSeed(draft, makeId('biz'))
    setBusinesses((prev) => [...prev, nextBusiness])
    return nextBusiness
  }, [])

  const updateBusiness = useCallback((id: string, patch: Partial<BusinessDraft>) => {
    setBusinesses((prev) =>
      prev.map((business) => {
        if (business.id !== id) return business
        const merged: Business = { ...business, ...patch }
        if (patch.capTable !== undefined) merged.capTable = patch.capTable
        return withRollup(merged)
      }),
    )
  }, [])

  const deleteBusiness = useCallback((id: string) => {
    setBusinesses((prev) => prev.filter((business) => business.id !== id))
    setTransactions((prev) => prev.filter((tx) => tx.businessId !== id))
    setTasks((prev) => prev.filter((task) => task.businessId !== id))
    setActivity((prev) => prev.filter((event) => event.businessId !== id))
    setRawTeamMembers((prev) =>
      prev.map((member) => (member.activeBusinessId === id ? { ...member, activeBusinessId: undefined } : member)),
    )
    setAssets((prev) =>
      prev.map((asset) =>
        asset.currentDeployment?.entityId === id
          ? { ...asset, status: 'available', currentDeployment: undefined }
          : asset,
      ),
    )
  }, [])

  const setCapTable = useCallback((businessId: string, capTable: OwnerShareInput[]) => {
    setBusinesses((prev) =>
      prev.map((business) =>
        business.id === businessId ? { ...business, capTable: capTable.map((entry) => ({ ...entry })) } : business,
      ),
    )
  }, [])

  /* ------------------------------ owner actions ------------------------------ */

  const addOwner = useCallback((draft: OwnerDraft) => {
    const nextOwner = ownerSeed(draft, makeId('own'))
    setRawOwners((prev) => [...prev, nextOwner])
    return nextOwner
  }, [])

  const updateOwner = useCallback((id: string, patch: Partial<OwnerDraft>) => {
    setRawOwners((prev) =>
      prev.map((owner) => {
        if (owner.id !== id) return owner
        const merged = { ...owner, ...patch }
        if (patch.name) merged.initials = initials(patch.name)
        return merged
      }),
    )
  }, [])

  const deleteOwner = useCallback((id: string) => {
    setRawOwners((prev) => prev.filter((owner) => owner.id !== id))
    setBusinesses((prev) =>
      prev.map((business) =>
        business.capTable.some((entry) => entry.ownerId === id)
          ? { ...business, capTable: business.capTable.filter((entry) => entry.ownerId !== id) }
          : business,
      ),
    )
  }, [])

  /* ------------------------------ branch actions ------------------------------ */

  const addBranch = useCallback((businessId: string, draft: BranchDraft) => {
    const branch = branchSeed(businessId, draft, makeId('br'))
    setBusinesses((prev) =>
      prev.map((business) => {
        if (business.id !== businessId) return business
        let branches = [...business.branches, branch]
        if (branch.isHeadquarters) branches = branches.map((item) => ({ ...item, isHeadquarters: item.id === branch.id }))
        return withRollup({ ...business, branches })
      }),
    )
    return branch
  }, [])

  const updateBranch = useCallback((businessId: string, branchId: string, patch: Partial<BranchDraft>) => {
    setBusinesses((prev) =>
      prev.map((business) => {
        if (business.id !== businessId) return business
        let branches = business.branches.map((branch) => (branch.id === branchId ? { ...branch, ...patch } : branch))
        if (patch.isHeadquarters) branches = branches.map((branch) => ({ ...branch, isHeadquarters: branch.id === branchId }))
        return withRollup({ ...business, branches })
      }),
    )
  }, [])

  const deleteBranch = useCallback((businessId: string, branchId: string) => {
    setBusinesses((prev) =>
      prev.map((business) =>
        business.id === businessId
          ? withRollup({ ...business, branches: business.branches.filter((branch) => branch.id !== branchId) })
          : business,
      ),
    )
    setAssets((prev) =>
      prev.map((asset) =>
        asset.currentDeployment?.branchId === branchId
          ? { ...asset, currentDeployment: { ...asset.currentDeployment, branchId: undefined } }
          : asset,
      ),
    )
  }, [])

  /* ------------------------------ milestone actions ------------------------------ */

  const addMilestone = useCallback((businessId: string, milestone: Omit<Milestone, 'id'>) => {
    setBusinesses((prev) =>
      prev.map((business) => {
        if (business.id !== businessId) return business
        const project: ProjectDetails = business.project ?? { budget: 0, deliverables: 0, milestones: [] }
        return { ...business, project: { ...project, milestones: [...project.milestones, { ...milestone, id: makeId('ms') }] } }
      }),
    )
  }, [])

  const updateMilestone = useCallback((businessId: string, milestoneId: string, patch: Partial<Milestone>) => {
    setBusinesses((prev) =>
      prev.map((business) => {
        if (business.id !== businessId || !business.project) return business
        return {
          ...business,
          project: {
            ...business.project,
            milestones: business.project.milestones.map((milestone) =>
              milestone.id === milestoneId ? { ...milestone, ...patch } : milestone,
            ),
          },
        }
      }),
    )
  }, [])

  const deleteMilestone = useCallback((businessId: string, milestoneId: string) => {
    setBusinesses((prev) =>
      prev.map((business) => {
        if (business.id !== businessId || !business.project) return business
        return {
          ...business,
          project: {
            ...business.project,
            milestones: business.project.milestones.filter((milestone) => milestone.id !== milestoneId),
          },
        }
      }),
    )
  }, [])

  /* ------------------------------ team member actions ------------------------------ */

  const addTeamMember = useCallback((draft: TeamMemberDraft) => {
    const member = teamMemberSeed(draft, makeId('tm'))
    setRawTeamMembers((prev) => [...prev, member])
    return member
  }, [])

  const updateTeamMember = useCallback((id: string, patch: Partial<TeamMemberDraft>) => {
    setRawTeamMembers((prev) =>
      prev.map((member) => {
        if (member.id !== id) return member
        const merged: TeamMember = { ...member, ...patch }
        if (patch.name) merged.initials = initials(patch.name)
        return merged
      }),
    )
  }, [])

  const deleteTeamMember = useCallback((id: string) => {
    setRawTeamMembers((prev) => prev.filter((member) => member.id !== id))
    setAssets((prev) =>
      prev.map((asset) =>
        asset.currentDeployment?.assignedToMemberId === id
          ? { ...asset, currentDeployment: { ...asset.currentDeployment, assignedToMemberId: undefined } }
          : asset,
      ),
    )
  }, [])

  /* ------------------------------ asset actions ------------------------------ */

  const addAsset = useCallback((draft: AssetDraft) => {
    const asset = assetSeed(draft, makeId('as'))
    setAssets((prev) => [asset, ...prev])
    setAssetHistory((prev) => [
      {
        id: makeId('ah'),
        assetId: asset.id,
        assetName: asset.name,
        action: 'created',
        targetLabel: 'Asset registered',
        date: new Date().toISOString(),
      },
      ...prev,
    ])
    return asset
  }, [])

  const updateAsset = useCallback((id: string, patch: Partial<AssetDraft>) => {
    setAssets((prev) => prev.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)))
  }, [])

  const deleteAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== id))
    setAssetHistory((prev) => prev.filter((entry) => entry.assetId !== id))
  }, [])

  const describeDeployment = useCallback(
    (input: { entityId: string; branchId?: string; memberId?: string }): { label: string; businessId: string } => {
      const business = businesses.find((item) => item.id === input.entityId)
      const branch = input.branchId ? business?.branches.find((item) => item.id === input.branchId) : undefined
      const member = input.memberId ? teamMembers.find((item) => item.id === input.memberId) : undefined
      const place = branch?.name ?? business?.name ?? 'Pool'
      const label = member ? `${member.name} · ${place}` : place
      return { label, businessId: business?.id ?? '' }
    },
    [businesses, teamMembers],
  )

  const pushHistory = useCallback(
    (asset: Asset | undefined, entry: Omit<AssetHistoryEntry, 'id' | 'assetId' | 'assetName' | 'date'>) => {
      if (!asset) return
      const full: AssetHistoryEntry = {
        id: makeId('ah'),
        assetId: asset.id,
        assetName: asset.name,
        date: new Date().toISOString(),
        ...entry,
      }
      setAssetHistory((prev) => [full, ...prev])
    },
    [],
  )

  const logActivity = useCallback((businessId: string, type: ActivityEvent['type'], message: string) => {
    const event: ActivityEvent = {
      id: makeId('act'),
      businessId,
      type,
      message,
      timestamp: new Date().toISOString(),
    }
    setActivity((prev) => [event, ...prev].slice(0, 60))
  }, [])

  const deployAsset = useCallback(
    (assetId: string, input: DeployAssetInput) => {
      const asset = assets.find((item) => item.id === assetId)
      const target = describeDeployment(input)
      const deployedDate = input.deployedDate || new Date().toISOString().slice(0, 10)
      setAssets((prev) =>
        prev.map((item) =>
          item.id === assetId
            ? {
                ...item,
                status: 'in-use',
                currentDeployment: {
                  entityType: input.entityType,
                  entityId: input.entityId,
                  branchId: input.branchId,
                  assignedToMemberId: input.memberId,
                  deployedDate,
                  notes: input.notes,
                },
              }
            : item,
        ),
      )
      pushHistory(asset, {
        action: 'assigned',
        entityType: input.entityType,
        entityId: input.entityId,
        branchId: input.branchId,
        memberId: input.memberId,
        targetLabel: target.label,
        notes: input.notes,
      })
      if (asset) logActivity(target.businessId, 'asset', `${asset.name} deployed to ${target.label}`)
    },
    [assets, describeDeployment, pushHistory, logActivity],
  )

  const returnAsset = useCallback(
    (assetId: string, notes?: string) => {
      const asset = assets.find((item) => item.id === assetId)
      const deployment = asset?.currentDeployment
      const target = deployment
        ? describeDeployment({
            entityId: deployment.entityId,
            branchId: deployment.branchId,
            memberId: deployment.assignedToMemberId,
          })
        : { label: 'the pool', businessId: '' }
      setAssets((prev) =>
        prev.map((item) => (item.id === assetId ? { ...item, status: 'available', currentDeployment: undefined } : item)),
      )
      pushHistory(asset, { action: 'returned', targetLabel: 'Returned to pool', notes })
      if (asset) logActivity(target.businessId, 'asset', `${asset.name} returned from ${target.label}`)
    },
    [assets, describeDeployment, pushHistory, logActivity],
  )

  const setAssetStatus = useCallback(
    (assetId: string, status: AssetStatus, notes?: string) => {
      const asset = assets.find((item) => item.id === assetId)
      setAssets((prev) =>
        prev.map((item) =>
          item.id === assetId
            ? { ...item, status, currentDeployment: status === 'in-use' ? item.currentDeployment : undefined }
            : item,
        ),
      )
      const action: AssetHistoryAction = status === 'maintenance' ? 'maintenance' : status === 'retired' ? 'retired' : 'restored'
      const label = status === 'maintenance' ? 'Sent for maintenance' : status === 'retired' ? 'Retired from service' : 'Back in service'
      pushHistory(asset, { action, targetLabel: label, notes })
      if (asset) logActivity('', 'asset', `${asset.name} marked ${status}`)
    },
    [assets, pushHistory, logActivity],
  )

  /* ------------------------------ transaction actions ------------------------------ */

  const addTransaction = useCallback((draft: TransactionDraft) => {
    const nextTransaction: Transaction = {
      id: makeId('tx'),
      businessId: draft.businessId,
      date: draft.date,
      description: draft.description,
      category: draft.category,
      type: draft.type,
      amount: Math.abs(draft.amount),
      paymentMethod: draft.paymentMethod,
      reference: draft.reference ?? `REF-${Math.floor(1000 + Math.random() * 9000)}`,
      status: draft.status ?? 'cleared',
      notes: draft.notes,
    }
    setTransactions((prev) => [...prev, nextTransaction])
    return nextTransaction
  }, [])

  const updateTransaction = useCallback((id: string, patch: Partial<TransactionDraft>) => {
    setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)))
  }, [])

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id))
  }, [])

  /* ------------------------------ task actions ------------------------------ */

  const addTask = useCallback((draft: TaskDraft) => {
    const nowIso = new Date().toISOString()
    const nextTask: Task = {
      id: makeId('task'),
      businessId: draft.businessId,
      title: draft.title,
      description: draft.description ?? '',
      status: draft.status ?? 'todo',
      priority: draft.priority,
      dueDate: draft.dueDate,
      tags: draft.tags ?? [],
      createdAt: nowIso,
      completedAt: draft.status === 'done' ? nowIso : undefined,
    }
    setTasks((prev) => [...prev, nextTask])
    return nextTask
  }, [])

  const updateTask = useCallback((id: string, patch: Partial<Omit<TaskDraft, 'businessId'>>) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task
        const merged: Task = { ...task, ...patch }
        if (patch.status === 'done' && !task.completedAt) merged.completedAt = new Date().toISOString()
        if (patch.status !== undefined && patch.status !== 'done' && task.status === 'done') merged.completedAt = undefined
        return merged
      }),
    )
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id))
  }, [])

  /* ------------------------------ settings ------------------------------ */

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }))
  }, [])

  const resetData = useCallback(() => {
    setBusinesses(seadRelations())
    setTransactions(seedTransactions)
    setTasks(seedTasks)
    setActivity(seedActivity)
    setRawOwners(seedOwners)
    setRawTeamMembers(seedTeamMembers)
    setAssets(seedAssets)
    setAssetHistory(seedAssetHistory)
    setSettings(defaultSettings)
    setProfile(defaultUser)
  }, [])

  const value = useMemo<BusinessContextValue>(
    () => ({
      businesses,
      transactions,
      tasks,
      activity,
      owners,
      teamMembers,
      assets,
      assetHistory,
      settings,
      profile,
      zainOwnerId: ZAIN_OWNER_ID,
      addBusiness,
      updateBusiness,
      deleteBusiness,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addTask,
      updateTask,
      deleteTask,
      addOwner,
      updateOwner,
      deleteOwner,
      addBranch,
      updateBranch,
      deleteBranch,
      addTeamMember,
      updateTeamMember,
      deleteTeamMember,
      addAsset,
      updateAsset,
      deleteAsset,
      deployAsset,
      returnAsset,
      setAssetStatus,
      setCapTable,
      addMilestone,
      updateMilestone,
      deleteMilestone,
      logActivity,
      updateSettings,
      updateProfile,
      resetData,
    }),
    [
      businesses,
      transactions,
      tasks,
      activity,
      owners,
      teamMembers,
      assets,
      assetHistory,
      settings,
      profile,
      addBusiness,
      updateBusiness,
      deleteBusiness,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addTask,
      updateTask,
      deleteTask,
      addOwner,
      updateOwner,
      deleteOwner,
      addBranch,
      updateBranch,
      deleteBranch,
      addTeamMember,
      updateTeamMember,
      deleteTeamMember,
      addAsset,
      updateAsset,
      deleteAsset,
      deployAsset,
      returnAsset,
      setAssetStatus,
      setCapTable,
      addMilestone,
      updateMilestone,
      deleteMilestone,
      logActivity,
      updateSettings,
      updateProfile,
      resetData,
    ],
  )

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}

export function useBusinesses(): BusinessContextValue {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusinesses must be used within a BusinessProvider')
  return ctx
}
