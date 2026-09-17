import type { Asset, AssetCategory } from '../types'
import { ASSET_USEFUL_LIFE_YEARS } from '../types'

const SALVAGE_RATIO = 0.1
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000

/** Straight-line book value with a 10% salvage floor. */
export function assetBookValue(asset: Asset, asOf: Date = new Date()): number {
  const lifeMs = ASSET_USEFUL_LIFE_YEARS[asset.category] * YEAR_MS
  const ageMs = Math.max(0, asOf.getTime() - new Date(asset.purchaseDate).getTime())
  const remaining = Math.max(SALVAGE_RATIO, 1 - ageMs / lifeMs)
  return Math.round(asset.value * remaining)
}

export function assetAgeYears(asset: Asset, asOf: Date = new Date()): number {
  const ageMs = Math.max(0, asOf.getTime() - new Date(asset.purchaseDate).getTime())
  return ageMs / YEAR_MS
}

export interface CategoryAssetStats {
  count: number
  value: number
  bookValue: number
}

export interface AssetUtilization {
  total: number
  deployed: number
  available: number
  maintenance: number
  retired: number
  totalValue: number
  bookValue: number
  deployedValue: number
  utilizationRate: number
  byCategory: Record<AssetCategory, CategoryAssetStats>
}

const EMPTY_CATEGORY_STATS: CategoryAssetStats = { count: 0, value: 0, bookValue: 0 }

export function assetUtilization(assets: Asset[]): AssetUtilization {
  const byCategory: Record<AssetCategory, CategoryAssetStats> = {
    hardware: { ...EMPTY_CATEGORY_STATS },
    machinery: { ...EMPTY_CATEGORY_STATS },
    equipment: { ...EMPTY_CATEGORY_STATS },
    other: { ...EMPTY_CATEGORY_STATS },
  }

  let deployed = 0
  let available = 0
  let maintenance = 0
  let retired = 0
  let totalValue = 0
  let bookValue = 0
  let deployedValue = 0

  for (const asset of assets) {
    const book = assetBookValue(asset)
    totalValue += asset.value
    bookValue += book
    byCategory[asset.category].count += 1
    byCategory[asset.category].value += asset.value
    byCategory[asset.category].bookValue += book

    if (asset.status === 'in-use') {
      deployed += 1
      deployedValue += asset.value
    } else if (asset.status === 'available') available += 1
    else if (asset.status === 'maintenance') maintenance += 1
    else retired += 1
  }

  const active = assets.length - retired
  return {
    total: assets.length,
    deployed,
    available,
    maintenance,
    retired,
    totalValue,
    bookValue,
    deployedValue,
    utilizationRate: active > 0 ? (deployed / active) * 100 : 0,
    byCategory,
  }
}

export function assetsForBranch(assets: Asset[], branchId: string): Asset[] {
  return assets.filter((asset) => asset.currentDeployment?.branchId === branchId)
}

export function assetsForBusiness(assets: Asset[], businessId: string): Asset[] {
  return assets.filter((asset) => asset.currentDeployment?.entityId === businessId)
}

export function assetsForTeamMember(assets: Asset[], memberId: string): Asset[] {
  return assets.filter((asset) => asset.currentDeployment?.assignedToMemberId === memberId)
}

export function unassignedAssetValue(assets: Asset[]): number {
  return assets
    .filter((asset) => !asset.currentDeployment && asset.status !== 'retired')
    .reduce((total, asset) => total + asset.value, 0)
}
