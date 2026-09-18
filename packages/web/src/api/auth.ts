import { api, setToken, clearToken } from './client'

export interface LoginResponse {
  token: string
  user: { id: string; email: string; name: string; role: string }
  profile: any
  settings: any
}

export interface MeResponse {
  user: { id: string; email: string; name: string; role: string }
  profile: any
  settings: any
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),

  register: (email: string, password: string, name: string) =>
    api.post<LoginResponse>('/auth/register', { email, password, name }),

  me: () => api.get<MeResponse>('/auth/me'),

  setAuthToken: setToken,
  clearAuthToken: clearToken,
}
