import { api } from './client'

export const ownersApi = {
  list: () =>
    api.get<{ data: any[] }>('/owners').then(r => r.data),

  create: (draft: any) =>
    api.post<{ data: any }>('/owners', draft).then(r => r.data),

  update: (id: string, patch: any) =>
    api.patch<{ data: any }>(`/owners/${id}`, patch).then(r => r.data),

  delete: (id: string) =>
    api.delete<{ data: null }>(`/owners/${id}`).then(r => r.data),
}
