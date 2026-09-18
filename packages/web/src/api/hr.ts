import { api } from './client'

export const hrApi = {
  listContracts: () =>
    api.get<{ data: any[] }>('/hr/contracts').then(r => r.data),

  createContract: (draft: any) =>
    api.post<{ data: any }>('/hr/contracts', draft).then(r => r.data),

  listTimesheets: (filter?: any) => {
    const params = new URLSearchParams()
    if (filter?.businessId) params.set('businessId', filter.businessId)
    if (filter?.employeeId) params.set('employeeId', filter.employeeId)
    if (filter?.periodMonth) params.set('periodMonth', filter.periodMonth)
    const qs = params.toString()
    return api.get<{ data: any[] }>(`/hr/timesheets${qs ? `?${qs}` : ''}`).then(r => r.data)
  },

  logTimesheet: (input: any) =>
    api.post<{ data: any }>('/hr/timesheets', input).then(r => r.data),

  calculatePayroll: (input: any) =>
    api.post<{ data: any }>('/hr/payroll/calculate', input).then(r => r.data),

  postPayrollRun: (run: any) =>
    api.post<{ data: any }>('/hr/payroll/post', run).then(r => r.data),
}
