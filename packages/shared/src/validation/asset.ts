import { z } from 'zod'

export const assetCreateSchema = z.object({
  name: z.string().min(1, 'Asset name is required'),
  category: z.enum(['hardware', 'machinery', 'equipment', 'other']),
  serialNumber: z.string().optional().default(''),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  value: z.number().min(0, 'Value must be non-negative'),
  status: z.enum(['available', 'in-use', 'maintenance', 'retired']).optional().default('available'),
  condition: z.enum(['new', 'good', 'fair', 'poor']).optional().default('good'),
  tag: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
})

export const assetUpdateSchema = assetCreateSchema.partial()

export const assetDeploySchema = z.object({
  entityType: z.enum(['owned', 'equity', 'client']),
  entityId: z.string().min(1, 'Target business is required'),
  branchId: z.string().optional(),
  memberId: z.string().optional(),
  deployedDate: z.string().optional(),
  notes: z.string().optional(),
})

export type AssetCreateInput = z.infer<typeof assetCreateSchema>
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>
export type AssetDeployInput = z.infer<typeof assetDeploySchema>
