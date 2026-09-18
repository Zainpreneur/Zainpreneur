import { api } from './client'

export const transactionsApi = {
  list: (filters?: {
    businessId?: string
    type?: string
    category?: string
    status?: string
    from?: string
    to?: string
  }) => {
    const params = new URLSearchParams()
    if (filters?.businessId) params.set('businessId', filters.businessId)
    if (filters?.type) params.set('type', filters.type)
    if (filters?.category) params.set('category', filters.category)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.from) params.set('from', filters.from)
    if (filters?.to) params.set('to', filters.to)
    const qs = params.toString()
    return api.get<{ data: any[] }>(`/transactions${qs ? `?${qs}` : ''}`).then(r => r.data)
  },

  create: (draft: any) =>
    api.post<{ data: any }>('/transactions', draft).then(r => r.data),

  update: (id: string, patch: any) =>
    api.patch<{ data: any }>(`/transactions/${id}`, patch).then(r => r.data),

  delete: (id: string) =>
    api.delete<{ data: null }>(`/transactions/${id}`).then(r => r.data),
}
