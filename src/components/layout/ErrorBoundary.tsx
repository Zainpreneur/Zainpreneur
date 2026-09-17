import React, { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState hasError: boolean
error?: Error
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: undefined }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props
    if (onError) {
      onError(error, errorInfo)
    }
    // Log error to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error caught by ErrorBoundary:', error, errorInfo)
    }
  }

  render() {
    const { hasError, error } = this.state
    const { fallback, children } = this.props

    if (hasError) {
      return (
        <div className="p-6 rounded-lg border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="text-center">
            <svg className="mx-auto mb-4 size-12 text-slate-400 dark:text-slate-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Something went wrong</h3>
            <p className="mt-2 text-slate-500 dark:text-slate-400">An unexpected error occurred. The page will reload.</p>
            {error && (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 break-all">{error.message}</p>
            )}
            {fallback || (
              <button
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-slate-800 bg-sky-600 dark:text-slate-100 dark:bg-sky-500/10 hover:bg-sky-500 dark:hover:bg-sky-600"
              >
                Retry
              </button>
            )}
            {fallback ? null : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">The app will attempt to recover.</p>
            )}
          </div>
        </div>
      )
    }

    return children
  }
}

export { ErrorBoundary }