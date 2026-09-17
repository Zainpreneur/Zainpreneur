import type { Branch, Business, BusinessCategory, BusinessModel, Milestone, Owner, OwnerShare } from '../types'

/** Annual-profit multiple applied to non-equity businesses when estimating enterprise value. */
export const PERFORMANCE_MULTIPLE = 3

/* -------------------------------------------------------------------------- */
/*                            Ownership / cap table                           */
/* -------------------------------------------------------------------------- */

export function capTableTotal(capTable: OwnerShare[]): number {
  return capTable.reduce((sum, entry) => sum + entry.percentage, 0)
}

export function capTableRemainder(capTable: OwnerShare[]): number {
  return Math.round((100 - capTableTotal(capTable)) * 100) / 100
}

export function isCapTableValid(capTable: OwnerShare[]): boolean {
  return capTable.length > 0 && Math.abs(capTableTotal(capTable) - 100) < 0.01
}

export function ownerPercentage(business: Business, ownerId: string): number {
  return business.capTable.find((entry) => entry.ownerId === ownerId)?.percentage ?? 0
}

export function primaryOwner(business: Business): OwnerShare | undefined {
  return business.capTable.find((entry) => entry.primary) ?? business.capTable[0]
}

/* -------------------------------------------------------------------------- */
/*                          Consolidated branch totals                        */
/* -------------------------------------------------------------------------- */

export interface ConsolidatedFinancials {
  revenue: number
  expenses: number
  profit: number
  margin: number
  employees: number
  branchCount: number
  activeBranchCount: number
  headquarters?: Branch
}

/** Sum localized branch revenue/expenses/staff into a single consolidated view. */
export function consolidatedFinancials(branches: Branch[]): ConsolidatedFinancials {
  const operating = branches.filter((branch) => branch.status !== 'closed')
  const totals = operating.reduce(
    (acc, branch) => {
      acc.revenue += branch.monthlyRevenue
      acc.expenses += branch.monthlyExpenses
      acc.employees += branch.employees
      return acc
    },
    { revenue: 0, expenses: 0, employees: 0 },
  )

  const profit = totals.revenue - totals.expenses
  return {
    revenue: totals.revenue,
    expenses: totals.expenses,
    profit,
    margin: totals.revenue > 0 ? (profit / totals.revenue) * 100 : 0,
    employees: totals.employees,
    branchCount: branches.length,
    activeBranchCount: operating.length,
    headquarters: branches.find((branch) => branch.isHeadquarters),
  }
}

/**
 * Consolidated financials for a business. When branches exist they are the source
 * of truth; otherwise the business-level stored figures are used.
 */
export function businessFinancials(business: Business): ConsolidatedFinancials {
  if (business.branches.length === 0) {
    const profit = business.monthlyRevenue - business.monthlyExpenses
    return {
      revenue: business.monthlyRevenue,
      expenses: business.monthlyExpenses,
      profit,
      margin: business.monthlyRevenue > 0 ? (profit / business.monthlyRevenue) * 100 : 0,
      employees: business.employees,
      branchCount: 0,
      activeBranchCount: 0,
    }
  }
  return consolidatedFinancials(business.branches)
}

/* -------------------------------------------------------------------------- */
/*                          User net share & valuation                        */
/* -------------------------------------------------------------------------- */

/** The user's slice of a business's headline profit, based on their equity %. */
export function userNetShare(business: Business, userId: string): number {
  const financials = businessFinancials(business)
  return (financials.profit * ownerPercentage(business, userId)) / 100
}

/** The user's slice of a business's consolidated revenue, based on their equity %. */
export function userRevenueShare(business: Business, userId: string): number {
  const financials = businessFinancials(business)
  return (financials.revenue * ownerPercentage(business, userId)) / 100
}

/** Dividend income attributable to the user for equity-model businesses. */
export function userDividendShare(business: Business, userId: string): number {
  if (business.model !== 'equity' || !business.equity) return 0
  return (business.equity.dividendsReceived * ownerPercentage(business, userId)) / 100
}

/**
 * Enterprise value: explicit valuation for equity-model businesses, otherwise an
 * annualized-profit multiple on the consolidated performance.
 */
export function enterpriseValue(business: Business): number {
  if (business.equity) return business.equity.valuation
  const financials = businessFinancials(business)
  return Math.max(0, financials.profit * 12 * PERFORMANCE_MULTIPLE)
}

/** The user's proportional net asset value in a single business. */
export function userNetAssetValue(business: Business, userId: string): number {
  return (enterpriseValue(business) * ownerPercentage(business, userId)) / 100
}

/* -------------------------------------------------------------------------- */
/*                              Model-specific metrics                        */
/* -------------------------------------------------------------------------- */

export type ModelMetrics =
  | {
      model: 'project'
      completionRate: number
      milestonesDone: number
      milestonesTotal: number
      budget: number
      deliverables: number
      budgetPerDeliverable: number
    }
  | {
      model: 'consulting'
      utilization: number
      hoursLogged: number
      hoursTarget: number
      effectiveHourlyRate: number
      billedRate: number
      retainerMonthly: number
      contracts: number
    }
  | {
      model: 'equity'
      valuation: number
      dividendYield: number
      dividendsReceived: number
      netAssetValue: number
      userPercentage: number
    }

export function milestoneCompletionRate(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0
  const done = milestones.filter((milestone) => milestone.status === 'done').length
  return Math.round((done / milestones.length) * 100)
}

export function modelMetrics(business: Business, userId?: string): ModelMetrics {
  if (business.model === 'project') {
    const milestones = business.project?.milestones ?? []
    const done = milestones.filter((milestone) => milestone.status === 'done')
    const deliverables = business.project?.deliverables ?? 0
    const budget = business.project?.budget ?? 0
    return {
      model: 'project',
      completionRate: milestoneCompletionRate(milestones),
      milestonesDone: done.length,
      milestonesTotal: milestones.length,
      budget,
      deliverables,
      budgetPerDeliverable: deliverables > 0 ? budget / deliverables : 0,
    }
  }

  if (business.model === 'consulting') {
    const consulting = business.consulting ?? {
      hourlyRate: 0,
      retainerMonthly: 0,
      billableHoursTarget: 0,
      billableHoursLogged: 0,
      contracts: 0,
    }
    const utilization =
      consulting.billableHoursTarget > 0 ? (consulting.billableHoursLogged / consulting.billableHoursTarget) * 100 : 0
    const effective = consulting.billableHoursLogged > 0 ? consulting.retainerMonthly / consulting.billableHoursLogged : consulting.hourlyRate
    return {
      model: 'consulting',
      utilization: Math.round(utilization),
      hoursLogged: consulting.billableHoursLogged,
      hoursTarget: consulting.billableHoursTarget,
      effectiveHourlyRate: effective,
      billedRate: consulting.hourlyRate,
      retainerMonthly: consulting.retainerMonthly,
      contracts: consulting.contracts,
    }
  }

  const equity = business.equity ?? { valuation: enterpriseValue(business), dividendYield: 0, dividendsReceived: 0 }
  const percentage = userId ? ownerPercentage(business, userId) : 0
  return {
    model: 'equity',
    valuation: equity.valuation,
    dividendYield: equity.dividendYield,
    dividendsReceived: equity.dividendsReceived,
    netAssetValue: (equity.valuation * percentage) / 100,
    userPercentage: percentage,
  }
}

/* -------------------------------------------------------------------------- */
/*                              Portfolio roll-ups                            */
/* -------------------------------------------------------------------------- */

export interface PortfolioSummary {
  businesses: number
  branches: number
  employees: number
  enterpriseValue: number
  userNetWorth: number
  monthlyRevenue: number
  monthlyExpenses: number
  monthlyProfit: number
  margin: number
  userMonthlyRevenue: number
  userMonthlyProfit: number
  userDividends: number
  avgHealth: number
  byModel: Record<BusinessModel, number>
  byCategory: Record<BusinessCategory, number>
}

export function portfolioSummary(businesses: Business[], userId: string): PortfolioSummary {
  const byModel: Record<BusinessModel, number> = { project: 0, consulting: 0, equity: 0 }
  const byCategory: Record<BusinessCategory, number> = { owned: 0, equity: 0, client: 0 }

  let monthlyRevenue = 0
  let monthlyExpenses = 0
  let enterprise = 0
  let netWorth = 0
  let userMonthlyRevenue = 0
  let userMonthlyProfit = 0
  let userDividends = 0
  let employees = 0
  let branches = 0
  let health = 0

  for (const business of businesses) {
    const financials = businessFinancials(business)
    byModel[business.model] += 1
    byCategory[business.category] += 1
    monthlyRevenue += financials.revenue
    monthlyExpenses += financials.expenses
    employees += financials.employees
    branches += financials.branchCount
    enterprise += enterpriseValue(business)
    netWorth += userNetAssetValue(business, userId)
    userMonthlyRevenue += userRevenueShare(business, userId)
    userMonthlyProfit += userNetShare(business, userId)
    userDividends += userDividendShare(business, userId)
    health += business.healthScore
  }

  const monthlyProfit = monthlyRevenue - monthlyExpenses

  return {
    businesses: businesses.length,
    branches,
    employees,
    enterpriseValue: enterprise,
    userNetWorth: netWorth,
    monthlyRevenue,
    monthlyExpenses,
    monthlyProfit,
    margin: monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0,
    userMonthlyRevenue,
    userMonthlyProfit,
    userDividends,
    avgHealth: businesses.length > 0 ? Math.round(health / businesses.length) : 0,
    byModel,
    byCategory,
  }
}

/* -------------------------------------------------------------------------- */
/*                           Stakeholder aggregation                          */
/* -------------------------------------------------------------------------- */

export interface OwnerHolding {
  businessId: string
  businessName: string
  businessColor: string
  model: BusinessModel
  category: BusinessCategory
  percentage: number
  role?: string
  primary: boolean
  netShare: number
  netAssetValue: number
}

export function ownerHoldings(ownerId: string, businesses: Business[]): OwnerHolding[] {
  const holdings: OwnerHolding[] = []
  for (const business of businesses) {
    const entry = business.capTable.find((share) => share.ownerId === ownerId)
    if (!entry) continue
    holdings.push({
      businessId: business.id,
      businessName: business.name,
      businessColor: business.color,
      model: business.model,
      category: business.category,
      percentage: entry.percentage,
      role: entry.role,
      primary: entry.primary ?? false,
      netShare: (businessFinancials(business).profit * entry.percentage) / 100,
      netAssetValue: (enterpriseValue(business) * entry.percentage) / 100,
    })
  }
  return holdings.sort((a, b) => b.percentage - a.percentage)
}

export interface OwnerStats {
  owner: Owner
  holdings: OwnerHolding[]
  cumulativeEquity: number
  businessCount: number
  netWorth: number
  monthlyNetShare: number
}

export function ownerStats(owner: Owner, businesses: Business[]): OwnerStats {
  const holdings = ownerHoldings(owner.id, businesses)
  return {
    owner: { ...owner, totalOwnedBusinessesCount: holdings.length },
    holdings,
    cumulativeEquity: holdings.reduce((sum, holding) => sum + holding.percentage, 0),
    businessCount: holdings.length,
    netWorth: holdings.reduce((sum, holding) => sum + holding.netAssetValue, 0),
    monthlyNetShare: holdings.reduce((sum, holding) => sum + holding.netShare, 0),
  }
}

/** Resolve owner records for a cap table, preserving cap-table order. */
export function resolveCapTable(capTable: OwnerShare[], owners: Owner[]): Array<{ share: OwnerShare; owner: Owner | undefined }> {
  return capTable.map((share) => ({ share, owner: owners.find((owner) => owner.id === share.ownerId) }))
}
