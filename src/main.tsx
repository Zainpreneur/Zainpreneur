import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { BusinessProvider } from './context/BusinessContext.tsx'
import { ToastProvider } from './context/ToastContext.tsx'
import { dbService } from './db/dbService.ts'

// Pre-warm the offline-first SQLite engine (OPFS file + seed + journal
// replay) so the local database is ready before Settings is ever opened.
// Best-effort: the app store works independently if this fails.
if (typeof window !== 'undefined') {
  const idle = (cb: () => void): void => {
    const ric = (window as Window & { requestIdleCallback?: (fn: () => void) => void }).requestIdleCallback
    if (ric) ric(cb)
    else window.setTimeout(cb, 1500)
  }
  idle(() => {
    void dbService.ready().catch((err: unknown) => {
      console.warn('[db] pre-warm failed', err)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <BusinessProvider>
            <App />
          </BusinessProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is best-effort — app works without SW too.
    })
  })
}