import { api } from './client'

export const assetsApi = {
  list: () =>
    api.get<{ data: any[] }>('/assets').then(r => r.data),

  create: (draft: any) =>
    api.post<{ data: any }>('/assets', draft).then(r => r.data),

  update: (id: string, patch: any) =>
    api.patch<{ data: any }>(`/assets/${id}`, patch).then(r => r.data),

  delete: (id: string) =>
    api.delete<{ data: null }>(`/assets/${id}`).then(r => r.data),

  deploy: (assetId: string, input: any) =>
    api.post<{ data: any }>(`/assets/${assetId}/deploy`, input).then(r => r.data),

  return: (assetId: string, notes?: string) =>
    api.post<{ data: any }>(`/assets/${assetId}/return`, { notes }).then(r => r.data),

  setStatus: (assetId: string, status: string) =>
    api.patch<{ data: any }>(`/assets/${assetId}/status`, { status }).then(r => r.data),
}
