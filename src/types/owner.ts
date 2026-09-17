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

export type CapTable = OwnerShare[]
