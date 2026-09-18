import { api } from './client'

export const teamApi = {
  list: () =>
    api.get<{ data: any[] }>('/team').then(r => r.data),

  create: (draft: any) =>
    api.post<{ data: any }>('/team', draft).then(r => r.data),

  update: (id: string, patch: any) =>
    api.patch<{ data: any }>(`/team/${id}`, patch).then(r => r.data),

  delete: (id: string) =>
    api.delete<{ data: null }>(`/team/${id}`).then(r => r.data),
}
