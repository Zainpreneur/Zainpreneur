// @ts-nocheck
import { Link } from 'react-router-dom'

import { ArrowUpRight, MapPin, Pause, Pencil, Play, Trash2, Users } from 'lucide-react'

import type { Business } from '../../types'
import { CLIENT_TIER_LABELS } from '../../types'
import { useBusinesses } from '../../context/BusinessContext'
import { businessFinancials } from '../../utils/calculations'
import { formatCurrency } from '../../utils/format'
import { CATEGORY_META, MODEL_META, STATUS_META } from '../../utils/meta'
import { cn } from '../../utils/cn'
import { Avatar } from '../common/Avatar'
import { Badge } from '../common/Badge'
import { BusinessLogo } from '../common/BusinessLogo'
import { Dropdown } from '../ui/Dropdown'
import { ScoreRing } from '../ui/ScoreRing'

interface BusinessCardProps {
  business: Business
  currency: Parameters<typeof formatCurrency>[1]
  onEdit: (business: Business) => void
  onDelete: (business: Business) => void
}

export function BusinessCard({ business, currency, onEdit, onDelete }: BusinessCardProps) {
  const { owners, updateBusiness } = useBusinesses()
  const paused = business.status === 'paused'
  const meta = CATEGORY_META[business.category]
  const model = MODEL_META[business.model]
  const status = STATUS_META[business.status]
  const financials = businessFinancials(business)
  const profit = financials.profit
  const margin = financials.margin
  const businessOwners = business.capTable
    .map((share) => owners.find((owner) => owner.id === share.ownerId))
    .filter((owner): owner is NonNullable<typeof owner> => Boolean(owner))

  return (
    <div className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="flex items-start gap-3">
        <BusinessLogo glyph={business.logoGlyph} color={business.color} size="md" />
        <div className="min-w-0 flex-1">
          <Link to={`/businesses/${business.id}`} className="block">
            <h3
              title={business.name}
              className="truncate font-display text-[15px] font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400"
            >
              {business.name}
            </h3>
          </Link>
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{business.tagline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge className={meta.badgeClass}>{meta.shortLabel}</Badge>
            <Badge className={model.badgeClass}>
              <model.icon className="mr-1 size-3" />
              {model.shortLabel}
            </Badge>
            <Badge className={status.badgeClass}>
              <span className={cn('mr-1 size-1.5 rounded-full', status.dotClass)} />
              {status.label}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Dropdown
            label={`Actions for ${business.name}`}
            trigger={<span className="text-lg leading-none text-slate-400">···</span>}
            items={[
              { label: 'Edit business', icon: Pencil, onClick: () => onEdit(business) },
              {
                label: paused ? 'Resume business' : 'Pause business',
                icon: paused ? Play : Pause,
                onClick: () => updateBusiness(business.id, { status: paused ? 'active' : 'paused' }),
              },
              { label: '', separator: true },
              { label: 'Delete business', icon: Trash2, danger: true, onClick: () => onDelete(business) },
            ]}
          />
          <ScoreRing value={business.healthScore} size={44} strokeWidth={4} />
        </div>
      </div>

      <div className="mt-4 grid auto-rows-fr grid-cols-3 gap-2 rounded-[10px] bg-slate-100/70 p-3 dark:bg-white/5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Revenue</p>
          <p className="mt-0.5 truncate font-display text-sm font-bold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(financials.revenue, currency, { compact: true })}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Profit</p>
          <p
            className={cn(
              'mt-0.5 truncate font-display text-sm font-bold tabular-nums',
              profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
            )}
          >
            {formatCurrency(profit, currency, { compact: true, signed: true })}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Margin</p>
          <p className="mt-0.5 truncate font-display text-sm font-bold tabular-nums text-slate-900 dark:text-white">{margin.toFixed(0)}%</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" />
          {financials.employees} staff
        </span>
        {business.location && (
          <span className="inline-flex items-center gap-1.5 truncate">
            <MapPin className="size-3.5" />
            {business.location}
          </span>
        )}
        {business.category === 'equity' && business.equityShare !== undefined && (
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{business.equityShare}% equity</span>
        )}
        {business.category === 'client' && business.clientTier && (
          <span className="font-semibold text-amber-600 dark:text-amber-400">{CLIENT_TIER_LABELS[business.clientTier]}</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {businessOwners.length > 0 ? (
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {businessOwners.slice(0, 4).map((owner) => (
                <Avatar
                  key={owner.id}
                  name={owner.name}
                  initials={owner.initials}
                  color={owner.color}
                  size="xs"
                  className="ring-2 ring-white dark:ring-slate-900"
                />
              ))}
            </div>
            {businessOwners.length > 4 && (
              <span className="ml-1.5 text-xs font-semibold text-slate-400">+{businessOwners.length - 4}</span>
            )}
          </div>
        ) : (
          <span />
        )}
        <Link
          to={`/businesses/${business.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400"
        >
          View details
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}