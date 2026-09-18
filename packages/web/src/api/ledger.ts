import { api } from './client'

export const ledgerApi = {
  trialBalance: () =>
    api.get<{ data: any }>('/ledger/trial-balance').then(r => r.data),

  statements: () =>
    api.get<{ data: any }>('/ledger/statements').then(r => r.data),

  profitAndLoss: (businessId?: string) => {
    const qs = businessId ? `?businessId=${encodeURIComponent(businessId)}` : ''
    return api.get<{ data: any }>(`/ledger/pnl${qs}`).then(r => r.data)
  },

  postDepreciation: (periodMonth: string) =>
    api.post<{ data: any }>('/ledger/depreciation', { periodMonth }).then(r => r.data),
}
