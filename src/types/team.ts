export type EngagementType = 'internal' | 'freelancer' | 'agency_partner'

/**
 * Engagement labels mapped to each model type.
 * internal   → Direct staff (full-time/part-time)
 * freelancer → Contract-based freelancers working on tasks/projects
 * agency_partner → External partner agencies sub-contracted for specialized work
 */
export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  internal: 'Internal Staff',
  freelancer: 'Freelancer',
  agency_partner: 'Agency Partner',
}

/**
 * Internal staff specific details (full-time, part-time, intern)
 * Mapped under the 'internal' engagement type.
 */
export interface InternalStaffDetails {
  employmentSubType: 'full_time' | 'part_time' | 'intern'
  monthlyCost: number
  department: string
}

/**
 * Freelancer specific details (hourly rate, contract terms, project scope)
 * Mapped under the 'freelancer' engagement type.
 */
export interface FreelancerDetails {
  hourlyRate: number
  contractTerms: string
  projectScope?: string
  /** ISO date when the current contract ends. */
  contractEndDate?: string
}

/**
 * Agency partner specific details (partner company, contact point, project allocation)
 * Mapped under the 'agency_partner' engagement type.
 */
export interface AgencyPartnerDetails {
  companyName: string
  contactPerson: string
  projectAllocation: string
  retainerMonthly?: number
}

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  intern: 'Intern',
}

/**
 * A person on the shared roster. Members are global (not owned by a single
 * business) and are allocated to a primary business via `activeBusinessId`.
 * Assets in their possession are derived from {@link Asset}.currentAssignment.
 * Engagement model distinguishes internal staff, freelancers, and agency partners.
 */
export interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  phone?: string
  color: string
  initials: string
  department: string
  engagementType: EngagementType
  /** Legacy employment classifier — prefer engagementType + internalStaff.employmentSubType */
  employmentType?: EmploymentType
  /** Primary business this person is allocated to. */
  activeBusinessId?: string
  /** Alias used by newer specs for activeBusinessId */
  associatedBusinessId?: string
  /** Optional home base branch. */
  branchId?: string
  /** Asset ids currently in this member's possession (derived from assignments). */
  assignedAssets: string[]
  location?: string
  startedAt?: string
  /** Legacy flat monthly cost — prefer internalStaff.monthlyCost */
  monthlyCost?: number
  /** Legacy flat hourly / contract fields — prefer freelancer.* */
  hourlyRate?: number
  contractTerms?: string
  projectScope?: string
  contractEndDate?: string
  /** Legacy flat agency fields — prefer agencyPartner.* */
  companyName?: string
  contactPerson?: string
  projectAllocation?: string
  retainerMonthly?: number
  /** Engagement-type specific details */
  internalStaff?: InternalStaffDetails
  freelancer?: FreelancerDetails
  agencyPartner?: AgencyPartnerDetails
  skills?: string[]
}

/**
 * Derive the human-readable engagement type label from EngagementType.
 */
export function getEngagementLabel(type: EngagementType): string {
  return ENGAGEMENT_TYPE_LABELS[type] ?? type
}

export const ENGAGEMENT_TYPE_COLORS: Record<EngagementType, string> = {
  internal: 'border-indigo-600',
  freelancer: 'border-emerald-600',
  agency_partner: 'border-amber-600',
}
