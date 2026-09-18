import { api } from './client'

export const settingsApi = {
  get: () =>
    api.get<{ data: any }>('/settings').then(r => r.data),

  update: (patch: any) =>
    api.patch<{ data: any }>('/settings', patch).then(r => r.data),

  updateProfile: (patch: any) =>
    api.patch<{ data: any }>('/settings/profile', patch).then(r => r.data),

  resetData: () =>
    api.post<{ data: null }>('/settings/reset', {}).then(r => r.data),
}
