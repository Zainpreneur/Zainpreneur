import { z } from 'zod'

export const businessCreateSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  category: z.enum(['owned', 'equity', 'client']),
  model: z.enum(['project', 'consulting', 'equity']),
  status: z.enum(['active', 'scaling', 'paused', 'winding_down']).optional().default('active'),
  tagline: z.string().optional().default(''),
  description: z.string().optional().default(''),
  industry: z.string().min(1, 'Industry is required'),
  foundedYear: z.number().int().min(1900).max(2100).optional(),
  color: z.string().optional().default('#6366f1'),
  logoGlyph: z.string().optional().default(''),
  website: z.string().url().optional().or(z.literal('')),
  location: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  equityShare: z.number().min(0).max(100).optional(),
  clientTier: z.enum(['retainer', 'project', 'consulting']).optional(),
  monthlyRevenue: z.number().min(0).optional().default(0),
  monthlyExpenses: z.number().min(0).optional().default(0),
  employees: z.number().int().min(0).optional().default(0),
  tags: z.array(z.string()).optional().default([]),
  capTable: z.array(z.object({
    ownerId: z.string(),
    percentage: z.number().min(0).max(100),
    role: z.string().optional(),
    primary: z.boolean().optional(),
  })).optional(),
  project: z.object({
    budget: z.number().min(0),
    deliverables: z.number().int().min(0),
  }).optional(),
  consulting: z.object({
    hourlyRate: z.number().min(0),
    retainerMonthly: z.number().min(0),
    billableHoursTarget: z.number().min(0),
    billableHoursLogged: z.number().min(0),
    contracts: z.number().int().min(0),
  }).optional(),
  equity: z.object({
    valuation: z.number().min(0),
    dividendYield: z.number().min(0),
    dividendsReceived: z.number().min(0),
  }).optional(),
})

export const businessUpdateSchema = businessCreateSchema.partial()

export type BusinessCreateInput = z.infer<typeof businessCreateSchema>
export type BusinessUpdateInput = z.infer<typeof businessUpdateSchema>
