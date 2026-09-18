import { z } from 'zod'

export const transactionCreateSchema = z.object({
  businessId: z.string().min(1, 'Business is required'),
  date: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum([
    'revenue', 'operations', 'payroll', 'marketing', 'software',
    'inventory', 'consulting', 'utilities', 'rent', 'equipment', 'other',
  ]),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.string().optional().default(''),
  reference: z.string().optional().default(''),
  status: z.enum(['cleared', 'pending', 'flagged']).optional().default('cleared'),
  notes: z.string().optional(),
})

export const transactionUpdateSchema = transactionCreateSchema.omit({ businessId: true }).partial()

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>
