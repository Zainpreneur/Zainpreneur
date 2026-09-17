export type TransactionType = 'income' | 'expense'

export type TransactionStatus = 'cleared' | 'pending' | 'flagged'

export type TransactionCategory =
  | 'revenue'
  | 'operations'
  | 'payroll'
  | 'marketing'
  | 'software'
  | 'inventory'
  | 'consulting'
  | 'utilities'
  | 'rent'
  | 'equipment'
  | 'other'

export interface Transaction {
  id: string
  businessId: string
  date: string
  description: string
  category: TransactionCategory
  type: TransactionType
  amount: number
  paymentMethod: string
  reference: string
  status: TransactionStatus
  notes?: string
}

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  revenue: 'Revenue',
  operations: 'Operations',
  payroll: 'Payroll',
  marketing: 'Marketing',
  software: 'Software',
  inventory: 'Inventory',
  consulting: 'Consulting',
  utilities: 'Utilities',
  rent: 'Rent',
  equipment: 'Equipment',
  other: 'Other',
}

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  cleared: 'Cleared',
  pending: 'Pending',
  flagged: 'Flagged',
}