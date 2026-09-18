export type BranchStatus = 'active' | 'opening' | 'paused' | 'closed'

export interface Branch {
  id: string
  businessId: string
  name: string
  location: string
  address?: string
  city?: string
  country?: string
  phone?: string
  email?: string
  manager?: string
  status: BranchStatus
  openedYear: number
  monthlyRevenue: number
  monthlyExpenses: number
  employees: number
  isHeadquarters: boolean
  createdAt: string
}

export const BRANCH_STATUS_LABELS: Record<BranchStatus, string> = {
  active: 'Active',
  opening: 'Opening Soon',
  paused: 'Paused',
  closed: 'Closed',
}
