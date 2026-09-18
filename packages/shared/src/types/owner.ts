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
  totalOwnedBusinessesCount?: number
}

export interface OwnerShare {
  ownerId: string
  percentage: number
  role?: string
  primary?: boolean
}

export type CapTable = OwnerShare[]
