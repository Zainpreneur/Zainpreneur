import type { Branch } from '../types'
import { consolidatedFinancials } from './calculations'

export { consolidatedFinancials as branchTotals }

export function isBranchOperating(branch: Branch): boolean {
  return branch.status !== 'closed'
}
