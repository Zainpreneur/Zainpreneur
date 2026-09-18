import { api } from './client'

export const tasksApi = {
  list: (filters?: { businessId?: string; status?: string; priority?: string }) => {
    const params = new URLSearchParams()
    if (filters?.businessId) params.set('businessId', filters.businessId)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.priority) params.set('priority', filters.priority)
    const qs = params.toString()
    return api.get<{ data: any[] }>(`/tasks${qs ? `?${qs}` : ''}`).then(r => r.data)
  },

  create: (draft: any) =>
    api.post<{ data: any }>('/tasks', draft).then(r => r.data),

  update: (id: string, patch: any) =>
    api.patch<{ data: any }>(`/tasks/${id}`, patch).then(r => r.data),

  delete: (id: string) =>
    api.delete<{ data: null }>(`/tasks/${id}`).then(r => r.data),
}
