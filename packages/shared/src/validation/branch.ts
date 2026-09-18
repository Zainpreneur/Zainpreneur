import { z } from 'zod'

export const branchCreateSchema = z.object({
  name: z.string().min(1, 'Branch name is required'),
  location: z.string().optional().default(''),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  manager: z.string().optional(),
  status: z.enum(['active', 'opening', 'paused', 'closed']).optional().default('active'),
  openedYear: z.number().int().min(1900).max(2100).optional(),
  monthlyRevenue: z.number().min(0).optional().default(0),
  monthlyExpenses: z.number().min(0).optional().default(0),
  employees: z.number().int().min(0).optional().default(0),
  isHeadquarters: z.boolean().optional().default(false),
})

export const branchUpdateSchema = branchCreateSchema.partial()

export type BranchCreateInput = z.infer<typeof branchCreateSchema>
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>
