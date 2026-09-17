export type ThemeMode = 'light' | 'dark' | 'system'

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'PKR' | 'AED' | 'INR'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  company: string
  initials: string
  bio: string
  timezone: string
  businessSince: string
  avatarColor: string
}

export interface NotificationSettings {
  taskReminders: boolean
  paymentAlerts: boolean
  weeklyDigest: boolean
  milestoneAlerts: boolean
  marketingEmails: boolean
}

export interface AppSettings {
  theme: ThemeMode
  currency: CurrencyCode
  compactSidebar: boolean
  showFinancialTotals: boolean
  notifications: NotificationSettings
  defaultCategoryFilter: 'owned' | 'equity' | 'client' | 'all'
}

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: 'USD — US Dollar',
  EUR: 'EUR — Euro',
  GBP: 'GBP — British Pound',
  PKR: 'PKR — Pakistani Rupee',
  AED: 'AED — UAE Dirham',
  INR: 'INR — Indian Rupee',
}

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  PKR: '₨',
  AED: 'د.إ',
  INR: '₹',
}