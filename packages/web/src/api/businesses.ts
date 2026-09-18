import { api } from './client'

export interface ApiResponse<T> {
  data: T
}

export interface BusinessData {
  id: string
  name: string
  model: string
  category: string
  status: string
  tagline: string
  description: string
  industry: string
  foundedYear: number
  color: string
  logoGlyph: string
  website?: string
  location?: string
  phone?: string
  email?: string
  equityShare?: number
  clientTier?: string
  monthlyRevenue: number
  monthlyExpenses: number
  employees: number
  healthScore: number
  tags: string[]
  capTable: any[]
  branches: any[]
  project?: any
  consulting?: any
  equity?: any
  tasks?: any[]
  transactions?: any[]
  activity?: any[]
  createdAt: string
}

export const businessesApi = {
  list: () =>
    api.get<ApiResponse<BusinessData[]>>('/businesses').then((r) => r.data),

  get: (id: string) =>
    api.get<ApiResponse<BusinessData>>(`/businesses/${id}`).then((r) => r.data),

  create: (draft: Record<string, unknown>) =>
    api.post<ApiResponse<BusinessData>>('/businesses', draft).then((r) => r.data),

  update: (id: string, patch: Record<string, unknown>) =>
    api.patch<ApiResponse<BusinessData>>(`/businesses/${id}`, patch).then((r) => r.data),

  delete: (id: string) =>
    api.delete<ApiResponse<{ success: boolean }>>(`/businesses/${id}`),
}

export const branchesApi = {
  list: (businessId: string) =>
    api.get<ApiResponse<any[]>>(`/businesses/${businessId}/branches`).then((r) => r.data),

  create: (businessId: string, draft: Record<string, unknown>) =>
    api.post<ApiResponse<any>>(`/businesses/${businessId}/branches`, draft).then((r) => r.data),

  update: (businessId: string, branchId: string, patch: Record<string, unknown>) =>
    api.patch<ApiResponse<any>>(`/businesses/${businessId}/branches/${branchId}`, patch).then((r) => r.data),

  delete: (businessId: string, branchId: string) =>
    api.delete(`/businesses/${businessId}/branches/${branchId}`),
}
