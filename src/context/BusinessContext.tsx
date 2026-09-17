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
  EngagementType,
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
import { useToast } from './ToastContext'
import {
  deployAsset as mirrorDeployAsset,
  mirrorDelete,
  mirrorInsert,
  returnAsset as mirrorReturnAsset,
  updateCapTableSplit as mirrorCapTable,
} from '../db/repositories'
import { memberRateTerms } from '../db/seed'
import type { DbDeploymentEntity } from '../db/schema'
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
  engagementType?: EngagementType
  /** Internal staff specific details */
  employmentType?: EmploymentType
  activeBusinessId?: string
  associatedBusinessId?: string
  branchId?: string
  location?: string
  startedAt?: string
  monthlyCost?: number
  /** Freelancer specific details */
  hourlyRate?: number
  contractTerms?: string
  projectScope?: string
  contractEndDate?: string
  /** Agency partner specific details */
  companyName?: string
  contactPerson?: string
  projectAllocation?: string
  retainerMonthly?: number
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

/**
 * Normalize a persisted team member to the current engagement-model schema.
 * Legacy records (stored before engagementType existed) only carry
 * employmentType + flat cost fields, so derive the model from those.
 */
function normalizeTeamMember(member: TeamMember): TeamMember {
  const engagementType: EngagementType =
    member.engagementType ?? (member.employmentType === 'contract' ? 'freelancer' : 'internal')
  const department = member.department ?? 'Operations'
  const normalized: TeamMember = {
    ...member,
    department,
    engagementType,
    activeBusinessId: member.activeBusinessId ?? member.associatedBusinessId,
    associatedBusinessId: member.associatedBusinessId ?? member.activeBusinessId,
    assignedAssets: Array.isArray(member.assignedAssets) ? member.assignedAssets : [],
    initials: member.initials || initials(member.name ?? '?'),
    skills: Array.isArray(member.skills) ? member.skills : [],
  }
  if (engagementType === 'internal' && !normalized.internalStaff) {
    const subType =
      normalized.employmentType === 'part_time' || normalized.employmentType === 'intern'
        ? normalized.employmentType
        : 'full_time'
    normalized.internalStaff = {
      employmentSubType: subType,
      monthlyCost: normalized.monthlyCost ?? 0,
      department,
    }
  }
  if (engagementType === 'freelancer' && !normalized.freelancer) {
    normalized.freelancer = {
      hourlyRate: normalized.hourlyRate ?? 0,
      contractTerms: normalized.contractTerms ?? 'contract',
      projectScope: normalized.projectScope,
      contractEndDate: normalized.contractEndDate,
    }
  }
  if (engagementType === 'agency_partner' && !normalized.agencyPartner) {
    normalized.agencyPartner = {
      companyName: normalized.companyName ?? normalized.name,
      contactPerson: normalized.contactPerson ?? '',
      projectAllocation: normalized.projectAllocation ?? '',
      retainerMonthly: normalized.retainerMonthly,
    }
  }
  return normalized
}

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
        teamMembers: Array.isArray(parsed.teamMembers)
          ? parsed.teamMembers.map(normalizeTeamMember)
          : seedTeamMembers,
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

/** Swallow mirror failures — the localStorage store is source of truth. */
function mirrorSkip(label: string): (err: unknown) => void {
  return (err: unknown) => console.warn(`[db] ${label} mirror skipped`, err)
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
  const engagementType: EngagementType = draft.engagementType ?? 'internal'
  const activeId = draft.activeBusinessId ?? draft.associatedBusinessId
  const department = draft.department ?? 'Operations'
  const subType = draft.employmentType === 'part_time' || draft.employmentType === 'intern' ? draft.employmentType : 'full_time'
  return {
    id,
    name: draft.name,
    role: draft.role,
    email: draft.email,
    phone: draft.phone,
    color: draft.color ?? '#6366f1',
    initials: initials(draft.name),
    department,
    engagementType,
    employmentType: draft.employmentType,
    activeBusinessId: activeId,
    associatedBusinessId: draft.associatedBusinessId ?? activeId,
    branchId: draft.branchId,
    assignedAssets: [],
    location: draft.location,
    startedAt: draft.startedAt,
    monthlyCost: draft.monthlyCost,
    hourlyRate: draft.hourlyRate,
    contractTerms: draft.contractTerms,
    projectScope: draft.projectScope,
    contractEndDate: draft.contractEndDate,
    companyName: draft.companyName,
    contactPerson: draft.contactPerson,
    projectAllocation: draft.projectAllocation,
    retainerMonthly: draft.retainerMonthly,
    skills: draft.skills ?? [],
    internalStaff:
      engagementType === 'internal'
        ? { employmentSubType: subType, monthlyCost: draft.monthlyCost ?? 0, department }
        : undefined,
    freelancer:
      engagementType === 'freelancer'
        ? {
            hourlyRate: draft.hourlyRate ?? 0,
            contractTerms: draft.contractTerms ?? 'project-based',
            projectScope: draft.projectScope,
            contractEndDate: draft.contractEndDate,
          }
        : undefined,
    agencyPartner:
      engagementType === 'agency_partner'
        ? {
            companyName: draft.companyName ?? draft.name,
            contactPerson: draft.contactPerson ?? '',
            projectAllocation: draft.projectAllocation ?? '',
            retainerMonthly: draft.retainerMonthly,
          }
        : undefined,
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
  const { notify } = useToast()

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
    notify(`Business "${nextBusiness.name}" created`)
    void mirrorInsert('businesses', {
      id: nextBusiness.id,
      name: nextBusiness.name,
      model: nextBusiness.model,
      category: nextBusiness.category,
      status: nextBusiness.status,
      created_at: nextBusiness.createdAt,
    }).catch(mirrorSkip('business create'))
    return nextBusiness
  }, [notify])

  const updateBusiness = useCallback((id: string, patch: Partial<BusinessDraft>) => {
    setBusinesses((prev) =>
      prev.map((business) => {
        if (business.id !== id) return business
        const merged: Business = { ...business, ...patch }
        if (patch.capTable !== undefined) merged.capTable = patch.capTable
        return withRollup(merged)
      }),
    )
    notify('Business updated')
  }, [notify])

  const deleteBusiness = useCallback((id: string) => {
    notify('Business deleted', 'info')
    void mirrorDelete('businesses', id).catch(mirrorSkip('business delete'))
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
    notify('Cap table updated')
    // Best-effort mirror into the offline SQLite engine; never blocks the UI.
    void mirrorCapTable(
      businessId,
      capTable.map((entry) => ({ ownerId: entry.ownerId, percentage: entry.percentage })),
    ).catch((err: unknown) => console.warn('[db] cap-table mirror skipped', err))
  }, [notify])

  /* ------------------------------ owner actions ------------------------------ */

  const addOwner = useCallback((draft: OwnerDraft) => {
    const nextOwner = ownerSeed(draft, makeId('own'))
    setRawOwners((prev) => [...prev, nextOwner])
    notify(`Owner "${nextOwner.name}" added`)
    void mirrorInsert('owners', {
      id: nextOwner.id,
      name: nextOwner.name,
      email: nextOwner.email,
      avatar: null,
    }).catch(mirrorSkip('owner create'))
    return nextOwner
  }, [notify])

  const updateOwner = useCallback((id: string, patch: Partial<OwnerDraft>) => {
    setRawOwners((prev) =>
      prev.map((owner) => {
        if (owner.id !== id) return owner
        const merged = { ...owner, ...patch }
        if (patch.name) merged.initials = initials(patch.name)
        return merged
      }),
    )
    notify('Owner updated')
  }, [notify])

  const deleteOwner = useCallback((id: string) => {
    notify('Owner removed', 'info')
    void mirrorDelete('owners', id).catch(mirrorSkip('owner delete'))
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
    notify(`Branch "${branch.name}" added — totals rolled up`)
    void mirrorInsert('branches', {
      id: branch.id,
      business_id: businessId,
      name: branch.name,
      location: branch.location,
      monthly_revenue: branch.monthlyRevenue,
      monthly_expenses: branch.monthlyExpenses,
    }).catch(mirrorSkip('branch create'))
    return branch
  }, [notify])

  const updateBranch = useCallback((businessId: string, branchId: string, patch: Partial<BranchDraft>) => {
    setBusinesses((prev) =>
      prev.map((business) => {
        if (business.id !== businessId) return business
        let branches = business.branches.map((branch) => (branch.id === branchId ? { ...branch, ...patch } : branch))
        if (patch.isHeadquarters) branches = branches.map((branch) => ({ ...branch, isHeadquarters: branch.id === branchId }))
        return withRollup({ ...business, branches })
      }),
    )
    notify('Branch updated — totals rolled up')
  }, [notify])

  const deleteBranch = useCallback((businessId: string, branchId: string) => {
    notify('Branch deleted — totals rolled up', 'info')
    void mirrorDelete('branches', branchId).catch(mirrorSkip('branch delete'))
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
  }, [notify])

  /* ------------------------------ milestone actions ------------------------------ */

  const addMilestone = useCallback((businessId: string, milestone: Omit<Milestone, 'id'>) => {
    setBusinesses((prev) =>
      prev.map((business) => {
        if (business.id !== businessId) return business
        const project: ProjectDetails = business.project ?? { budget: 0, deliverables: 0, milestones: [] }
        return { ...business, project: { ...project, milestones: [...project.milestones, { ...milestone, id: makeId('ms') }] } }
      }),
    )
    notify(`Milestone "${milestone.name}" added`)
  }, [notify])

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
    notify('Milestone updated')
  }, [notify])

  const deleteMilestone = useCallback((businessId: string, milestoneId: string) => {
    notify('Milestone deleted', 'info')
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
  }, [notify])

  /* ------------------------------ team member actions ------------------------------ */

  const addTeamMember = useCallback((draft: TeamMemberDraft) => {
    const member = teamMemberSeed(draft, makeId('tm'))
    setRawTeamMembers((prev) => [...prev, member])
    notify(`"${member.name}" added to roster`)
    void mirrorInsert('team_members', {
      id: member.id,
      name: member.name,
      email: member.email,
      engagement_type: member.engagementType,
      role: member.role,
      rate_or_terms: memberRateTerms(member),
    }).catch(mirrorSkip('member create'))
    return member
  }, [notify])

  const updateTeamMember = useCallback((id: string, patch: Partial<TeamMemberDraft>) => {
    setRawTeamMembers((prev) =>
      prev.map((member) => {
        if (member.id !== id) return member
        const merged: TeamMember = { ...member, ...patch }
        if (merged.name) merged.initials = initials(merged.name)
        if (patch.activeBusinessId !== undefined || patch.associatedBusinessId !== undefined) {
          const synced = patch.activeBusinessId ?? patch.associatedBusinessId ?? member.activeBusinessId
          merged.activeBusinessId = synced
          merged.associatedBusinessId = patch.associatedBusinessId ?? synced
        }
        if (merged.engagementType === 'internal') {
          const sub = merged.employmentType === 'part_time' || merged.employmentType === 'intern' ? merged.employmentType : 'full_time'
          merged.internalStaff = {
            employmentSubType: sub,
            monthlyCost: patch.monthlyCost ?? merged.internalStaff?.monthlyCost ?? merged.monthlyCost ?? 0,
            department: patch.department ?? merged.department ?? 'Operations',
          }
          if (patch.monthlyCost !== undefined) merged.monthlyCost = patch.monthlyCost
          if (patch.department !== undefined) merged.department = patch.department
        }
        if (merged.engagementType === 'freelancer') {
          merged.freelancer = {
            hourlyRate: patch.hourlyRate ?? merged.freelancer?.hourlyRate ?? merged.hourlyRate ?? 0,
            contractTerms: patch.contractTerms ?? merged.freelancer?.contractTerms ?? 'project-based',
            projectScope: patch.projectScope ?? merged.freelancer?.projectScope,
            contractEndDate: patch.contractEndDate ?? merged.freelancer?.contractEndDate ?? merged.contractEndDate,
          }
          if (patch.hourlyRate !== undefined) merged.hourlyRate = patch.hourlyRate
          if (patch.contractTerms !== undefined) merged.contractTerms = patch.contractTerms
          if (patch.contractEndDate !== undefined) merged.contractEndDate = patch.contractEndDate
          if (patch.projectScope !== undefined) merged.projectScope = patch.projectScope
        }
        if (merged.engagementType === 'agency_partner') {
          merged.agencyPartner = {
            companyName: patch.companyName ?? merged.agencyPartner?.companyName ?? merged.name,
            contactPerson: patch.contactPerson ?? merged.agencyPartner?.contactPerson ?? '',
            projectAllocation: patch.projectAllocation ?? merged.agencyPartner?.projectAllocation ?? '',
            retainerMonthly: patch.retainerMonthly ?? merged.agencyPartner?.retainerMonthly,
          }
        }
        return merged
      }),
    )
    if (patch.activeBusinessId !== undefined || patch.associatedBusinessId !== undefined) {
      notify('Team member reassigned')
    } else {
      notify('Team member updated')
    }
  }, [notify])

  const deleteTeamMember = useCallback((id: string) => {
    notify('Team member removed', 'info')
    void mirrorDelete('team_members', id).catch(mirrorSkip('member delete'))
    setRawTeamMembers((prev) => prev.filter((member) => member.id !== id))
    setAssets((prev) =>
      prev.map((asset) =>
        asset.currentDeployment?.assignedToMemberId === id
          ? { ...asset, currentDeployment: { ...asset.currentDeployment, assignedToMemberId: undefined } }
          : asset,
      ),
    )
  }, [notify])

  /* ------------------------------ asset actions ------------------------------ */

  const addAsset = useCallback((draft: AssetDraft) => {
    const asset = assetSeed(draft, makeId('as'))
    notify(`Asset "${asset.name}" registered to central pool`)
    void mirrorInsert('assets', {
      id: asset.id,
      name: asset.name,
      category: asset.category,
      asset_owner: 'Zainpreneur',
      serial_number: asset.serialNumber,
      purchase_value: asset.value,
      status: asset.status === 'retired' ? 'maintenance' : asset.status,
    }).catch(mirrorSkip('asset create'))
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
  }, [notify])

  const updateAsset = useCallback((id: string, patch: Partial<AssetDraft>) => {
    setAssets((prev) => prev.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)))
    notify('Asset updated')
  }, [notify])

  const deleteAsset = useCallback((id: string) => {
    notify('Asset deleted from pool', 'info')
    void mirrorDelete('assets', id).catch(mirrorSkip('asset delete'))
    setAssets((prev) => prev.filter((asset) => asset.id !== id))
    setAssetHistory((prev) => prev.filter((entry) => entry.assetId !== id))
  }, [notify])

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
      notify(`Asset "${asset?.name ?? 'asset'}" successfully deployed`)
      // Best-effort mirror into the offline SQLite engine; never blocks the UI.
      const mirrorEntity: DbDeploymentEntity =
        input.entityType === 'equity' ? 'equity_branch' : input.entityType === 'client' ? 'client_project' : 'owned_branch'
      void mirrorDeployAsset(assetId, {
        entityType: mirrorEntity,
        entityId: input.branchId ?? input.entityId,
        memberId: input.memberId,
        notes: input.notes,
      }).catch((err: unknown) => console.warn('[db] deploy mirror skipped', err))
    },
    [assets, describeDeployment, pushHistory, logActivity, notify],
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
      notify(`Asset "${asset?.name ?? 'asset'}" returned to base`)
      // Best-effort mirror into the offline SQLite engine; never blocks the UI.
      void mirrorReturnAsset(assetId).catch((err: unknown) => console.warn('[db] return mirror skipped', err))
    },
    [assets, describeDeployment, pushHistory, logActivity, notify],
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
      notify(`Asset "${asset?.name ?? 'asset'}" marked ${status}`)
    },
    [assets, pushHistory, logActivity, notify],
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
    notify('Transaction recorded')
    return nextTransaction
  }, [notify])

  const updateTransaction = useCallback((id: string, patch: Partial<TransactionDraft>) => {
    setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)))
    notify('Transaction updated')
  }, [notify])

  const deleteTransaction = useCallback((id: string) => {
    notify('Transaction deleted', 'info')
    setTransactions((prev) => prev.filter((tx) => tx.id !== id))
  }, [notify])

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
    notify(`Task "${nextTask.title}" created`)
    return nextTask
  }, [notify])

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
    notify(patch.status === 'done' ? 'Task completed' : 'Task updated')
  }, [notify])

  const deleteTask = useCallback((id: string) => {
    notify('Task deleted', 'info')
    setTasks((prev) => prev.filter((task) => task.id !== id))
  }, [notify])

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
    notify('Demo data reset', 'info')
  }, [notify])

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
