import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import type { UserProfile } from '../types'
import { defaultUser } from '../data'

const AUTH_KEY = 'zainpreneur:auth:v1'

interface AuthUser {
  email: string
  name: string
  loggedInAt: string
}

interface AuthContextValue {
  isAuthenticated: boolean
  authUser: AuthUser | null
  profile: UserProfile
  login: (email: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredAuth(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    return parsed.email ? (parsed as AuthUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => readStoredAuth())

  const login = useCallback((email: string, password: string) => {
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { ok: false, error: 'Enter a valid email address.' }
    }
    if (password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters.' }
    }

    const name =
      trimmed === defaultUser.email.toLowerCase()
        ? defaultUser.name
        : trimmed
            .split('@')[0]
            ?.split(/[._-]/)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || 'User'

    const user: AuthUser = { email: trimmed, name, loggedInAt: new Date().toISOString() }
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    setAuthUser(user)
    return { ok: true }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY)
    setAuthUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated: authUser !== null, authUser, profile: defaultUser, login, logout }),
    [authUser, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}