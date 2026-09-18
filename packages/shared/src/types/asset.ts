import type { BusinessCategory } from './business'

export type AssetCategory = 'hardware' | 'machinery' | 'equipment' | 'other'
export type AssetStatus = 'available' | 'in-use' | 'maintenance' | 'retired'
export type AssetCondition = 'new' | 'good' | 'fair' | 'poor'

export interface AssetDeployment {
  entityType: BusinessCategory
  entityId: string
  branchId?: string
  assignedToMemberId?: string
  deployedDate: string
  notes?: string
}

export const ASSET_OWNER = 'Zainpreneur'

export interface Asset {
  id: string
  tag: string
  name: string
  category: AssetCategory
  serialNumber: string
  purchaseDate: string
  value: number
  status: AssetStatus
  condition: AssetCondition
  assetOwner: typeof ASSET_OWNER
  location?: string
  notes?: string
  currentDeployment?: AssetDeployment
  createdAt: string
}

export type AssetHistoryAction = 'assigned' | 'returned' | 'maintenance' | 'restored' | 'retired' | 'created'

export interface AssetHistoryEntry {
  id: string
  assetId: string
  assetName: string
  action: AssetHistoryAction
  entityType?: BusinessCategory
  entityId?: string
  branchId?: string
  memberId?: string
  targetLabel: string
  date: string
  notes?: string
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  hardware: 'Hardware',
  machinery: 'Machinery',
  equipment: 'Equipment',
  other: 'Other',
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  available: 'Available',
  'in-use': 'Deployed',
  maintenance: 'Maintenance',
  retired: 'Retired',
}

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  new: 'New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
}

export const ASSET_USEFUL_LIFE_YEARS: Record<AssetCategory, number> = {
  hardware: 4,
  machinery: 8,
  equipment: 6,
  other: 5,
}
