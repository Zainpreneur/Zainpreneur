import { api } from './client'

export const invoicesApi = {
  list: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    return api.get<{ data: any[] }>(`/invoices${qs}`).then(r => r.data)
  },

  create: (input: any) =>
    api.post<{ data: any }>('/invoices', input).then(r => r.data),

  recordPayment: (invoiceId: string, amount: number) =>
    api.post<{ data: any }>(`/invoices/${invoiceId}/pay`, { amount }).then(r => r.data),

  aging: () =>
    api.get<{ data: any }>('/invoices/aging').then(r => r.data),
}
