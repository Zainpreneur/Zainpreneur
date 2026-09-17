import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * PWA install + offline helpers.
 * - Captures `beforeinstallprompt` so Settings can trigger the native install sheet.
 * - Tracks online/offline status and whether a service worker controls the page.
 * - Stale-SW protection: detects new SW and claims it with reload prompt.
 */
const SW_VERSION = 'zainpreneur-sw-v1'

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true),
  )
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [swActive, setSwActive] = useState(false)
  const [newSWDetected, setNewSWDetected] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        setSwActive(!!reg?.active)
      })
      navigator.serviceWorker.ready.then(() => setSwActive(true)).catch(() => {})

      // Stale-SW detection: compare registered SW version against current
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg.waiting?.addEventListener('statechange', () => {
          if (reg.waiting?.state === 'installed' && !navigator.serviceWorker.controller) {
            setNewSWDetected(true)
          }
        })
        if (reg.installing) {
          setSwActive(true)
        }
        // Check for new SW on every registration
        reg.onupdatefound = () => {
          const newWorker = reg.installing
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && !navigator.serviceWorker.controller) {
              setNewSWDetected(true)
            }
          })
        }
      })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') setDeferred(null)
    return outcome
  }, [deferred])

  const checkForNewSW = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return false
    return navigator.serviceWorker.controller === null && document.visibilityState === 'visible'
  }, [])

  return {
    canInstall: deferred !== null && !installed,
    installed,
    online,
    swActive,
    newSWDetected,
    promptInstall,
    checkForNewSW,
  }
}