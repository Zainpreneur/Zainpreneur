import { assetHistory, assets } from './assets'
import { allBranches, branchesByBusiness } from './branches'
import { businesses } from './businesses'
import { getBusinessSeries, getPortfolioSeries } from './financialSeries'
import { capTablesByBusiness, owners, ZAIN_OWNER_ID } from './owners'
import { activity, tasks } from './tasks'
import { teamMembers } from './team'
import { transactions } from './transactions'
import { defaultSettings, defaultUser } from './user'

export { businesses, transactions, tasks, activity, defaultUser, defaultSettings }
export { owners, capTablesByBusiness, branchesByBusiness, allBranches, ZAIN_OWNER_ID }
export { assets, assetHistory, teamMembers }
export { getBusinessSeries, getPortfolioSeries }

export function getBusinessById(id: string) {
  return businesses.find((b) => b.id === id)
}

export function getTransactionsForBusiness(businessId: string) {
  return transactions
    .filter((t) => t.businessId === businessId)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function getTasksForBusiness(businessId: string) {
  return tasks
    .filter((t) => t.businessId === businessId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}