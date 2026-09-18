import { api } from './client'

export const procurementApi = {
  listVendors: () =>
    api.get<{ data: any[] }>('/procurement/vendors').then(r => r.data),

  createVendor: (draft: any) =>
    api.post<{ data: any }>('/procurement/vendors', draft).then(r => r.data),

  listPurchaseOrders: () =>
    api.get<{ data: any[] }>('/procurement/purchase-orders').then(r => r.data),

  createPurchaseOrder: (draft: any) =>
    api.post<{ data: any }>('/procurement/purchase-orders', draft).then(r => r.data),

  updatePoStatus: (id: string, status: string) =>
    api.patch<{ data: any }>(`/procurement/purchase-orders/${id}/status`, { status }).then(r => r.data),
}
