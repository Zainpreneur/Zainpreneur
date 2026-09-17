import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { ChevronRight } from 'lucide-react'

import { cn } from '../../utils/cn'

interface PageContainerProps {
  children: ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-[1500px] px-4 py-6 md:px-6 md:py-8', className)}>{children}</div>
  )
}

interface Crumb {
  label: string
  to?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumb?: Crumb[]
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, breadcrumb, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'sticky top-0 z-20 -mx-4 mb-6 border-b border-transparent bg-slate-50/85 px-4 py-3 backdrop-blur-lg sm:mb-8 md:-mx-6 md:px-6 dark:bg-slate-950/80',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {breadcrumb && breadcrumb.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {breadcrumb.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                  {index > 0 && <ChevronRight className="size-3" />}
                  {crumb.to ? (
                    <Link to={crumb.to} className="transition-colors hover:text-brand-600 dark:hover:text-brand-400">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-slate-600 dark:text-slate-300">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1
            title={title}
            className="truncate font-display text-2xl font-bold tracking-[-0.02em] text-slate-900 sm:text-[28px] dark:text-white"
          >
            {title}
          </h1>
          {subtitle && <p className="mt-1 max-w-2xl truncate text-[13px] text-slate-500 sm:whitespace-normal dark:text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}