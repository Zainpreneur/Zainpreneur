export interface Owner {
  id: string
  name: string
  email: string
  avatar?: string
  color: string
  initials: string
  phone?: string
  location?: string
  role?: string
  bio?: string
  createdAt: string
  /** Derived: number of businesses this owner currently holds a stake in. */
  totalOwnedBusinessesCount?: number
}

export interface OwnerShare {
  ownerId: string
  percentage: number
  role?: string
  primary?: boolean
}

/**
 * Venture ownership split — describes the VENTURE's cap table, not
 * Zainpreneur's books. A 100% external table (e.g. a client founder holding
 * everything) is correct: Zainpreneur monetizes such ventures through
 * retainers and project billing rather than equity. Zainpreneur's own
 * economics come from its percentage here via net-share math.
 */
export type CapTable = OwnerShare[]
