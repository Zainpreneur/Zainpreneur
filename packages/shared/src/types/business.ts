export type BusinessCategory = 'owned' | 'equity' | 'client'
export type BusinessModel = 'project' | 'consulting' | 'equity'
export type BusinessStatus = 'active' | 'scaling' | 'paused' | 'winding_down'
export type ClientTier = 'retainer' | 'project' | 'consulting'
export type MilestoneStatus = 'planned' | 'in_progress' | 'done'

export interface Milestone {
  id: string
  name: string
  status: MilestoneStatus
  dueDate: string
  budget: number
}

export interface ProjectDetails {
  budget: number
  milestones: Milestone[]
  deliverables: number
}

export interface ConsultingDetails {
  hourlyRate: number
  retainerMonthly: number
  billableHoursTarget: number
  billableHoursLogged: number
  contracts: number
}

export interface EquityDetails {
  valuation: number
  dividendYield: number
  dividendsReceived: number
}

export interface FinancialPerformance {
  revenue: number
  expenses: number
  profit: number
  margin: number
}

export interface Business {
  id: string
  name: string
  category: BusinessCategory
  model: BusinessModel
  status: BusinessStatus
  tagline: string
  description: string
  industry: string
  foundedYear: number
  color: string
  logoGlyph: string
  website?: string
  location?: string
  phone?: string
  email?: string
  equityShare?: number
  clientTier?: ClientTier
  monthlyRevenue: number
  monthlyExpenses: number
  employees: number
  healthScore: number
  tags: string[]
  capTable: OwnerShare[]
  branches: Branch[]
  project?: ProjectDetails
  consulting?: ConsultingDetails
  equity?: EquityDetails
  createdAt: string
}

export interface BusinessWithPerformance extends Business {
  performance: FinancialPerformance
}

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  owned: 'Owned Business',
  equity: 'Equity Stake',
  client: 'Client Business',
}

export const BUSINESS_MODEL_LABELS: Record<BusinessModel, string> = {
  project: 'Project-Based',
  consulting: 'Consulting-Based',
  equity: 'Equity Ownership',
}

export const BUSINESS_MODEL_DESCRIPTIONS: Record<BusinessModel, string> = {
  project: 'Milestones, deliverables and project budgets',
  consulting: 'Billable hours, retainers and client contracts',
  equity: 'Cap table, valuation and dividends',
}

export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  active: 'Active',
  scaling: 'Scaling',
  paused: 'Paused',
  winding_down: 'Winding Down',
}

export const CLIENT_TIER_LABELS: Record<ClientTier, string> = {
  retainer: 'Retainer',
  project: 'Project-based',
  consulting: 'Consulting',
}

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  done: 'Done',
}

import type { Branch } from './branch'
import type { OwnerShare } from './owner'
