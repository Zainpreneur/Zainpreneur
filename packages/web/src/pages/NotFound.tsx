// @ts-nocheck
import { Link } from 'react-router-dom'

import { Compass } from 'lucide-react'

import { Button } from '../components/common/Button'
import { PageContainer } from '../components/layout/PageContainer'

export function NotFound() {
  return (
    <PageContainer className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <p className="font-display text-7xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">404</p>
        <h1 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">Page not found</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/" className="mt-6 inline-block">
          <Button icon={<Compass className="size-4" />}>Back to dashboard</Button>
        </Link>
      </div>
    </PageContainer>
  )
}