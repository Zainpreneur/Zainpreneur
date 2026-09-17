import { useEffect } from 'react'

import type { AppSettings } from '../types'

export function useApplyTheme(settings: Pick<AppSettings, 'theme'>) {
  useEffect(() => {
    const root = document.documentElement
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
    root.classList.toggle('dark', shouldBeDark)
  }, [settings.theme])
}

export function useSystemPrefersDark(): boolean {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')
  return prefersDark.matches
}