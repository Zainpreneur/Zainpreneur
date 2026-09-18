export type EngagementType = 'internal' | 'freelancer' | 'agency_partner'

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  internal: 'Internal Staff',
  freelancer: 'Freelancer',
  agency_partner: 'Agency Partner',
}

export interface InternalStaffDetails {
  employmentSubType: 'full_time' | 'part_time' | 'intern'
  monthlyCost: number
  department: string
}

export interface FreelancerDetails {
  hourlyRate: number
  contractTerms: string
  projectScope?: string
  contractEndDate?: string
}

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
  employmentType?: EmploymentType
  activeBusinessId?: string
  associatedBusinessId?: string
  branchId?: string
  assignedAssets: string[]
  location?: string
  startedAt?: string
  monthlyCost?: number
  hourlyRate?: number
  contractTerms?: string
  projectScope?: string
  contractEndDate?: string
  companyName?: string
  contactPerson?: string
  projectAllocation?: string
  retainerMonthly?: number
  internalStaff?: InternalStaffDetails
  freelancer?: FreelancerDetails
  agencyPartner?: AgencyPartnerDetails
  skills?: string[]
}

export function getEngagementLabel(type: EngagementType): string {
  return ENGAGEMENT_TYPE_LABELS[type] ?? type
}

export const ENGAGEMENT_TYPE_COLORS: Record<EngagementType, string> = {
  internal: 'border-indigo-600',
  freelancer: 'border-emerald-600',
  agency_partner: 'border-amber-600',
}
