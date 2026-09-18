export type {
  Business,
  BusinessCategory,
  BusinessModel,
  BusinessStatus,
  BusinessWithPerformance,
  ClientTier,
  ConsultingDetails,
  EquityDetails,
  FinancialPerformance,
  Milestone,
  MilestoneStatus,
  ProjectDetails,
} from '@zainpreneur/shared'
export {
  BUSINESS_CATEGORY_LABELS,
  BUSINESS_MODEL_DESCRIPTIONS,
  BUSINESS_MODEL_LABELS,
  BUSINESS_STATUS_LABELS,
  CLIENT_TIER_LABELS,
  MILESTONE_STATUS_LABELS,
} from '@zainpreneur/shared'

export type { Branch, BranchStatus } from '@zainpreneur/shared'
export { BRANCH_STATUS_LABELS } from '@zainpreneur/shared'

export type { CapTable, Owner, OwnerShare } from '@zainpreneur/shared'

export type {
  ActivityEvent,
  ActivityType,
  Task,
  TaskPriority,
  TaskStatus,
} from '@zainpreneur/shared'
export { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@zainpreneur/shared'

export type {
  Transaction,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from '@zainpreneur/shared'
export {
  TRANSACTION_CATEGORY_LABELS,
  TRANSACTION_STATUS_LABELS,
} from '@zainpreneur/shared'

export type {
  AppSettings,
  CurrencyCode,
  NotificationSettings,
  ThemeMode,
  UserProfile,
} from '@zainpreneur/shared'
export {
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  ENTERPRISE_NAME,
} from '@zainpreneur/shared'

export type {
  AgencyPartnerDetails,
  EmploymentType,
  EngagementType,
  FreelancerDetails,
  InternalStaffDetails,
  TeamMember,
} from '@zainpreneur/shared'
export { EMPLOYMENT_TYPE_LABELS, ENGAGEMENT_TYPE_LABELS, ENGAGEMENT_TYPE_COLORS, getEngagementLabel } from '@zainpreneur/shared'

export type {
  Asset,
  AssetCategory,
  AssetCondition,
  AssetDeployment,
  AssetHistoryAction,
  AssetHistoryEntry,
  AssetStatus,
} from '@zainpreneur/shared'
export {
  ASSET_CATEGORY_LABELS,
  ASSET_CONDITION_LABELS,
  ASSET_OWNER,
  ASSET_STATUS_LABELS,
  ASSET_USEFUL_LIFE_YEARS,
} from '@zainpreneur/shared'

export type { ChartPoint, DonutSlice } from '@zainpreneur/shared'

import type { LucideIcon } from 'lucide-react'

export interface NavSection {
  label: string
  items: NavItem[]
}

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  badge?: number
}
