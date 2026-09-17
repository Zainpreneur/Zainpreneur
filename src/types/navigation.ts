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