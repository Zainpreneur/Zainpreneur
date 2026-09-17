import type { BusinessCategory } from './business'

export type AssetCategory = 'hardware' | 'machinery' | 'equipment' | 'other'

export type AssetStatus = 'available' | 'in-use' | 'maintenance' | 'retired'

export type AssetCondition = 'new' | 'good' | 'fair' | 'poor'

/**
 * Where an asset is currently deployed. Ownership never moves — assets are
 * owned by Zainpreneur / the owned businesses and only checked out temporarily.
 * `entityType` mirrors the owning category of the target business so equity and
 * client deployments can be reported separately from internal use.
 */
export interface AssetDeployment {
  entityType: BusinessCategory
  /** Target business id. */
  entityId: string
  /** Optional branch within the target business. */
  branchId?: string
  /** Optional team member operating or holding the asset. */
  assignedToMemberId?: string
  deployedDate: string
  notes?: string
}

/** Sole owner label for the central asset pool. */
export const ASSET_OWNER = 'Zainpreneur'

export interface Asset {
  id: string
  /** Human-readable asset tag, e.g. ZP-LT-004. */
  tag: string
  name: string
  category: AssetCategory
  serialNumber: string
  purchaseDate: string
  /** Purchase value in the reporting currency. */
  value: number
  status: AssetStatus
  condition: AssetCondition
  /**
   * Sole owning entity — always Zainpreneur. Typed as a literal so ownership
   * can never drift to a venture, vendor, or member. Deployments move only
   * `currentDeployment`; this field never changes after registration.
   */
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
  /** Human-friendly snapshot of the target at the time of the event. */
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

/** Straight-line depreciation horizon (years) used for book-value estimates. */
export const ASSET_USEFUL_LIFE_YEARS: Record<AssetCategory, number> = {
  hardware: 4,
  machinery: 8,
  equipment: 6,
  other: 5,
}
