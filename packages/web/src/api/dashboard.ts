import { api } from './client'

export const dashboardApi = {
  summary: () =>
    api.get<{ data: any }>('/dashboard/summary').then(r => r.data),
}
