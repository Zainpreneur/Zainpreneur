import { z } from '@hono/zod-openapi'

// ── Business ──
export const businessSchema = z.object({
  id: z.string().openapi({ description: 'Business ID' }),
  name: z.string().openapi({ description: 'Business name' }),
  model: z.enum(['project', 'consulting', 'equity']).openapi({ description: 'Business model type' }),
  category: z.string().openapi({ description: 'Business category' }),
  status: z.enum(['active', 'inactive', 'archived']).openapi({ description: 'Business status' }),
  tagline: z.string().optional().openapi({ description: 'Short tagline' }),
  description: z.string().optional().openapi({ description: 'Full description' }),
  industry: z.string().optional().openapi({ description: 'Industry sector' }),
  foundedYear: z.number().optional().openapi({ description: 'Year founded' }),
  color: z.string().optional().openapi({ description: 'Brand color hex' }),
  monthlyRevenue: z.number().optional().openapi({ description: 'Monthly revenue' }),
  monthlyExpenses: z.number().optional().openapi({ description: 'Monthly expenses' }),
  employees: z.number().optional().openapi({ description: 'Number of employees' }),
  tags: z.array(z.string()).optional().openapi({ description: 'Tags' }),
  createdAt: z.string().optional().openapi({ description: 'Creation timestamp' }),
  updatedAt: z.string().optional().openapi({ description: 'Last update timestamp' }),
}).openapi({ title: 'Business', description: 'A business entity in the system' })

export const businessCreateSchema = z.object({
  name: z.string().min(1).openapi({ description: 'Business name', example: 'Acme Corp' }),
  model: z.enum(['project', 'consulting', 'equity']).openapi({ description: 'Business model type' }),
  category: z.string().openapi({ description: 'Business category' }),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  foundedYear: z.number().optional(),
  color: z.string().optional(),
  monthlyRevenue: z.number().optional(),
  monthlyExpenses: z.number().optional(),
  employees: z.number().optional(),
  tags: z.array(z.string()).optional(),
  project: z.object({
    budget: z.number(),
    deliverables: z.string(),
  }).optional(),
  consulting: z.object({
    hourlyRate: z.number(),
    retainerMonthly: z.number(),
    billableHoursTarget: z.number(),
    billableHoursLogged: z.number(),
    contracts: z.number(),
  }).optional(),
  equity: z.object({
    valuation: z.number(),
    dividendYield: z.number(),
    dividendsReceived: z.number(),
  }).optional(),
  capTable: z.array(z.object({
    ownerId: z.string(),
    percentage: z.number(),
    role: z.string(),
    primary: z.boolean().optional(),
  })).optional(),
}).openapi({ title: 'BusinessCreate', description: 'Create a new business' })

export const businessUpdateSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  model: z.enum(['project', 'consulting', 'equity']).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  industry: z.string().optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  monthlyRevenue: z.number().optional(),
  monthlyExpenses: z.number().optional(),
  employees: z.number().optional(),
  tags: z.array(z.string()).optional(),
}).openapi({ title: 'BusinessUpdate', description: 'Update a business' })

// ── Owner ──
export const ownerSchema = z.object({
  id: z.string().openapi({ description: 'Owner ID' }),
  name: z.string().openapi({ description: 'Full name' }),
  email: z.string().email().openapi({ description: 'Email address' }),
  phone: z.string().optional().openapi({ description: 'Phone number' }),
  location: z.string().optional().openapi({ description: 'Location' }),
  role: z.string().optional().openapi({ description: 'Role title' }),
  bio: z.string().optional().openapi({ description: 'Biography' }),
  color: z.string().optional().openapi({ description: 'Avatar color hex' }),
  initials: z.string().optional().openapi({ description: 'Name initials' }),
  createdAt: z.string().optional().openapi({ description: 'Creation timestamp' }),
}).openapi({ title: 'Owner', description: 'A business owner' })

export const ownerCreateSchema = z.object({
  name: z.string().min(1).openapi({ description: 'Full name', example: 'John Doe' }),
  email: z.string().email().openapi({ description: 'Email address', example: 'john@example.com' }),
  phone: z.string().optional(),
  location: z.string().optional(),
  role: z.string().optional(),
  bio: z.string().optional(),
  color: z.string().optional(),
}).openapi({ title: 'OwnerCreate', description: 'Create a new owner' })

export const ownerUpdateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  role: z.string().optional(),
  bio: z.string().optional(),
  color: z.string().optional(),
}).openapi({ title: 'OwnerUpdate', description: 'Update an owner' })

// ── Task ──
export const taskSchema = z.object({
  id: z.string().openapi({ description: 'Task ID' }),
  businessId: z.string().openapi({ description: 'Parent business ID' }),
  title: z.string().openapi({ description: 'Task title' }),
  description: z.string().optional().openapi({ description: 'Task description' }),
  status: z.enum(['todo', 'in-progress', 'review', 'done']).openapi({ description: 'Task status' }),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).openapi({ description: 'Task priority' }),
  dueDate: z.string().optional().openapi({ description: 'Due date (ISO 8601)' }),
  tags: z.array(z.string()).optional().openapi({ description: 'Tags' }),
  completedAt: z.string().optional().openapi({ description: 'Completion timestamp' }),
  createdAt: z.string().optional().openapi({ description: 'Creation timestamp' }),
}).openapi({ title: 'Task', description: 'A task within a business' })

export const taskCreateSchema = z.object({
  businessId: z.string().min(1).openapi({ description: 'Parent business ID' }),
  title: z.string().min(1).openapi({ description: 'Task title', example: 'Update landing page' }),
  description: z.string().optional(),
  status: z.enum(['todo', 'in-progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).openapi({ title: 'TaskCreate', description: 'Create a new task' })

export const taskUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in-progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).openapi({ title: 'TaskUpdate', description: 'Update a task' })

// ── Transaction ──
export const transactionSchema = z.object({
  id: z.string().openapi({ description: 'Transaction ID' }),
  businessId: z.string().openapi({ description: 'Parent business ID' }),
  date: z.string().openapi({ description: 'Transaction date (ISO 8601)' }),
  description: z.string().openapi({ description: 'Transaction description' }),
  category: z.string().openapi({ description: 'Category' }),
  type: z.enum(['income', 'expense']).openapi({ description: 'Transaction type' }),
  amount: z.number().openapi({ description: 'Amount' }),
  paymentMethod: z.string().optional().openapi({ description: 'Payment method' }),
  reference: z.string().optional().openapi({ description: 'Reference number' }),
  status: z.enum(['pending', 'cleared', 'reconciled']).optional().openapi({ description: 'Status' }),
  notes: z.string().optional().openapi({ description: 'Notes' }),
  createdAt: z.string().optional().openapi({ description: 'Creation timestamp' }),
}).openapi({ title: 'Transaction', description: 'A financial transaction' })

export const transactionCreateSchema = z.object({
  businessId: z.string().min(1).openapi({ description: 'Parent business ID' }),
  date: z.string().openapi({ description: 'Transaction date (ISO 8601)', example: '2026-01-15' }),
  description: z.string().min(1).openapi({ description: 'Transaction description', example: 'Client payment' }),
  category: z.string().openapi({ description: 'Category', example: 'revenue' }),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive().openapi({ description: 'Amount', example: 5000 }),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
  status: z.enum(['pending', 'cleared', 'reconciled']).optional(),
  notes: z.string().optional(),
}).openapi({ title: 'TransactionCreate', description: 'Create a new transaction' })

export const transactionUpdateSchema = z.object({
  date: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(['income', 'expense']).optional(),
  amount: z.number().optional(),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
  status: z.enum(['pending', 'cleared', 'reconciled']).optional(),
  notes: z.string().optional(),
}).openapi({ title: 'TransactionUpdate', description: 'Update a transaction' })

// ── Team Member ──
export const teamMemberSchema = z.object({
  id: z.string().openapi({ description: 'Member ID' }),
  name: z.string().openapi({ description: 'Full name' }),
  email: z.string().email().openapi({ description: 'Email address' }),
  role: z.string().optional().openapi({ description: 'Role title' }),
  phone: z.string().optional().openapi({ description: 'Phone number' }),
  color: z.string().optional().openapi({ description: 'Avatar color hex' }),
  initials: z.string().optional().openapi({ description: 'Name initials' }),
  department: z.string().optional().openapi({ description: 'Department' }),
  engagementType: z.enum(['internal', 'external', 'contractor']).optional().openapi({ description: 'Engagement type' }),
  employmentType: z.string().optional().openapi({ description: 'Employment type' }),
  location: z.string().optional().openapi({ description: 'Work location' }),
  startedAt: z.string().optional().openapi({ description: 'Start date' }),
  monthlyCost: z.number().optional().openapi({ description: 'Monthly cost' }),
  hourlyRate: z.number().optional().openapi({ description: 'Hourly rate' }),
  skills: z.array(z.string()).optional().openapi({ description: 'Skills' }),
  createdAt: z.string().optional().openapi({ description: 'Creation timestamp' }),
}).openapi({ title: 'TeamMember', description: 'A team member' })

export const teamMemberCreateSchema = z.object({
  name: z.string().min(1).openapi({ description: 'Full name', example: 'Jane Smith' }),
  email: z.string().email().openapi({ description: 'Email address' }),
  role: z.string().optional(),
  phone: z.string().optional(),
  color: z.string().optional(),
  department: z.string().optional(),
  engagementType: z.enum(['internal', 'external', 'contractor']).optional(),
  employmentType: z.string().optional(),
  activeBusinessId: z.string().optional(),
  associatedBusinessId: z.string().optional(),
  branchId: z.string().optional(),
  location: z.string().optional(),
  startedAt: z.string().optional(),
  monthlyCost: z.number().optional(),
  hourlyRate: z.number().optional(),
  contractTerms: z.string().optional(),
  projectScope: z.string().optional(),
  contractEndDate: z.string().optional(),
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  projectAllocation: z.number().optional(),
  retainerMonthly: z.number().optional(),
  skills: z.array(z.string()).optional(),
}).openapi({ title: 'TeamMemberCreate', description: 'Create a new team member' })

export const teamMemberUpdateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  color: z.string().optional(),
  department: z.string().optional(),
  engagementType: z.enum(['internal', 'external', 'contractor']).optional(),
  employmentType: z.string().optional(),
  activeBusinessId: z.string().optional(),
  associatedBusinessId: z.string().optional(),
  branchId: z.string().optional(),
  location: z.string().optional(),
  startedAt: z.string().optional(),
  monthlyCost: z.number().optional(),
  hourlyRate: z.number().optional(),
  contractTerms: z.string().optional(),
  projectScope: z.string().optional(),
  contractEndDate: z.string().optional(),
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  projectAllocation: z.number().optional(),
  retainerMonthly: z.number().optional(),
  skills: z.array(z.string()).optional(),
}).openapi({ title: 'TeamMemberUpdate', description: 'Update a team member' })

// ── Asset ──
export const assetSchema = z.object({
  id: z.string().openapi({ description: 'Asset ID' }),
  name: z.string().openapi({ description: 'Asset name' }),
  category: z.string().openapi({ description: 'Asset category' }),
  serialNumber: z.string().optional().openapi({ description: 'Serial number' }),
  purchaseDate: z.string().optional().openapi({ description: 'Purchase date' }),
  value: z.number().openapi({ description: 'Asset value' }),
  status: z.enum(['available', 'in-use', 'maintenance', 'retired']).openapi({ description: 'Asset status' }),
  condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional().openapi({ description: 'Condition' }),
  tag: z.string().optional().openapi({ description: 'Asset tag' }),
  location: z.string().optional().openapi({ description: 'Location' }),
  notes: z.string().optional().openapi({ description: 'Notes' }),
  createdAt: z.string().optional().openapi({ description: 'Creation timestamp' }),
}).openapi({ title: 'Asset', description: 'A physical asset' })

export const assetCreateSchema = z.object({
  name: z.string().min(1).openapi({ description: 'Asset name', example: 'Dell XPS 15' }),
  category: z.string().openapi({ description: 'Asset category', example: 'laptop' }),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  value: z.number().positive().openapi({ description: 'Asset value', example: 1500 }),
  status: z.enum(['available', 'in-use', 'maintenance', 'retired']).optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  tag: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
}).openapi({ title: 'AssetCreate', description: 'Create a new asset' })

export const assetUpdateSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  value: z.number().optional(),
  status: z.enum(['available', 'in-use', 'maintenance', 'retired']).optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  tag: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
}).openapi({ title: 'AssetUpdate', description: 'Update an asset' })

export const assetDeploySchema = z.object({
  entityType: z.string().min(1).openapi({ description: 'Entity type (business, branch, team)', example: 'business' }),
  entityId: z.string().min(1).openapi({ description: 'Entity ID' }),
  branchId: z.string().optional(),
  memberId: z.string().optional(),
  deployedDate: z.string().optional(),
  notes: z.string().optional(),
}).openapi({ title: 'AssetDeploy', description: 'Deploy an asset' })

// ── Auth ──
export const loginSchema = z.object({
  email: z.string().email().openapi({ description: 'Email address', example: 'user@example.com' }),
  password: z.string().min(6).openapi({ description: 'Password', example: 'password123' }),
}).openapi({ title: 'Login', description: 'Login request' })

export const registerSchema = z.object({
  name: z.string().min(1).openapi({ description: 'Full name', example: 'John Doe' }),
  email: z.string().email().openapi({ description: 'Email address', example: 'john@example.com' }),
  password: z.string().min(6).openapi({ description: 'Password (min 6 chars)' }),
}).openapi({ title: 'Register', description: 'Register new account' })

// ── Common Response Schemas ──
export const errorSchema = z.object({
  error: z.string().openapi({ description: 'Error message' }),
}).openapi({ title: 'Error', description: 'Error response' })

export const successSchema = z.object({
  success: z.boolean().openapi({ description: 'Success flag' }),
}).openapi({ title: 'Success', description: 'Success response' })

export const healthCheckSchema = z.object({
  status: z.enum(['ok', 'degraded']).openapi({ description: 'Health status' }),
  timestamp: z.string().openapi({ description: 'Check timestamp' }),
  env: z.string().openapi({ description: 'Environment' }),
  checks: z.record(z.string()).openapi({ description: 'Health checks' }),
  uptime: z.number().openapi({ description: 'Uptime in seconds' }),
}).openapi({ title: 'HealthCheck', description: 'Health check response' })
