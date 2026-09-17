export type EngagementType = 'internal' | 'freelancer' | 'agency_partner'

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'

/**
 * Engagement detail that varies by type.
 * - internal:   monthlyCost, department, direct management
 * - freelancer: hourlyRate, contractTerms, project focus
 * - agency_partner: partnerName, contractValue, project allocations
 */
export interface EngagementDetail {
  type: EngagementType
  /** Monthly cost for internal / hourly rate for freelancer / contract value for agency */
  cost: number
  /** Additional type-specific fields */
  details?: Record<string, unknown>
}

/**
 * A person on the shared roster. Members are global (not owned by a single
 * business) and are allocated to a primary business via `activeBusinessId`.
 * Engagement type determines how they are hired/managed and their cost structure.
 * Assets in their possession are derived from {@link Asset}.currentDeployment.
 */
export interface TeamMember {
  id: string
  name: string
  role: string
  email: string
  phone?: string
  color: string
  initials: string
  department: string
  engagementType: EngagementType
  /** Primary business this person is allocated to. */
  activeBusinessId?: string
  /** Optional home base branch. */
  branchId?: string
  /** Engagement cost details (monthlyCost / hourlyRate / contractValue). */
  engagement: EngagementDetail
  /** Asset ids currently in this member's possession (derived from assignments). */
  assignedAssets: string[]
  location?: string
  startedAt?: string
  skills?: string[]
}

/**
 * Partner agency detail for agency_partner engagement type.
 * Tracks the external partner company, their contact and project allocations.
 */
export interface PartnerAgency {
  id: string
  name: string
  contactName: string
  email: string
  phone?: string
  website?: string
  category: BusinessCategory
  /** Active projects / business allocations */
  activeAllocations: string[] // business IDs
  contractValue: number
  status: 'active' | 'inactive' | 'expired'
  notes?: string
  createdAt: string
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  intern: 'Intern',
}

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  internal: 'Internal Staff',
  freelancer: 'Freelancer',
  agency_partner: 'Agency Partner',
}

export const ENGAGEMENT_TYPE_COLORS: Record<EngagementType, string> = {
  internal: 'border-indigo-600',
  freelancer: 'border-emerald-600',
  agency_partner: 'border-amber-600',
}
