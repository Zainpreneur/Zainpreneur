import { z } from 'zod'

export const ownerCreateSchema = z.object({
  name: z.string().min(1, 'Owner name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  location: z.string().optional(),
  role: z.string().optional(),
  bio: z.string().optional(),
  color: z.string().optional().default('#6366f1'),
})

export const ownerUpdateSchema = ownerCreateSchema.partial()

export type OwnerCreateInput = z.infer<typeof ownerCreateSchema>
export type OwnerUpdateInput = z.infer<typeof ownerUpdateSchema>
