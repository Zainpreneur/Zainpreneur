import { z } from 'zod'

export const teamMemberCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  role: z.string().optional().default(''),
  phone: z.string().optional(),
  color: z.string().optional().default('#6366f1'),
  department: z.string().optional().default(''),
  engagementType: z.enum(['internal', 'freelancer', 'agency_partner']).optional().default('internal'),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  activeBusinessId: z.string().optional(),
  associatedBusinessId: z.string().optional(),
  branchId: z.string().optional(),
  location: z.string().optional(),
  startedAt: z.string().optional(),
  monthlyCost: z.number().min(0).optional(),
  hourlyRate: z.number().min(0).optional(),
  contractTerms: z.string().optional(),
  projectScope: z.string().optional(),
  contractEndDate: z.string().optional(),
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  projectAllocation: z.string().optional(),
  retainerMonthly: z.number().min(0).optional(),
  skills: z.array(z.string()).optional().default([]),
})

export const teamMemberUpdateSchema = teamMemberCreateSchema.partial()

export type TeamMemberCreateInput = z.infer<typeof teamMemberCreateSchema>
export type TeamMemberUpdateInput = z.infer<typeof teamMemberUpdateSchema>
