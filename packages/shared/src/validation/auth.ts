import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
})

export const settingsUpdateSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'PKR', 'AED', 'INR']).optional(),
  compactSidebar: z.boolean().optional(),
  showFinancialTotals: z.boolean().optional(),
  defaultCategoryFilter: z.enum(['owned', 'equity', 'client', 'all']).optional(),
  notifications: z.object({
    taskReminders: z.boolean().optional(),
    paymentAlerts: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
    milestoneAlerts: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
  }).optional(),
})

export const profileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  bio: z.string().optional(),
  timezone: z.string().optional(),
  avatarColor: z.string().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
