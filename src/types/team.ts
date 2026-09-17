export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'

/**
 * A person on the shared roster. Members are global (not owned by a single
 * business) and are allocated to a primary business via `activeBusinessId`.
 * Assets in their possession are derived from {@link Asset}.currentAssignment.
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
  employmentType: EmploymentType
  /** Primary business this person is allocated to. */
  activeBusinessId?: string
  /** Optional home base branch. */
  branchId?: string
  /** Asset ids currently in this member's possession (derived from assignments). */
  assignedAssets: string[]
  location?: string
  startedAt?: string
  monthlyCost?: number
  skills?: string[]
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  intern: 'Intern',
}
