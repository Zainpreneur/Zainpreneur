import type { AppSettings, UserProfile } from '../types'

export const defaultUser: UserProfile = {
  id: 'usr-zain',
  name: 'Zain Pirzada',
  email: 'zain@zainpreneur.io',
  role: 'Founder & Managing Partner',
  company: 'Zainpreneur Holdings',
  initials: 'ZP',
  bio: 'Serial operator managing owned ventures, equity stakes and client engagements from one command center.',
  timezone: 'Asia/Karachi',
  businessSince: '2019',
  avatarColor: '#6366f1',
}

export const defaultSettings: AppSettings = {
  theme: 'system',
  currency: 'PKR',
  compactSidebar: false,
  showFinancialTotals: true,
  notifications: {
    taskReminders: true,
    paymentAlerts: true,
    weeklyDigest: true,
    milestoneAlerts: true,
    marketingEmails: false,
  },
  defaultCategoryFilter: 'all',
}