import { Crown, Handshake, Briefcase, FolderKanban, LineChart, Wallet, type LucideIcon } from 'lucide-react'

import type {
  BranchStatus,
  BusinessCategory,
  BusinessModel,
  BusinessStatus,
  MilestoneStatus,
  TaskPriority,
  TransactionStatus,
  TransactionType,
} from '../types'
import {
  BRANCH_STATUS_LABELS,
  BUSINESS_CATEGORY_LABELS,
  BUSINESS_MODEL_LABELS,
  BUSINESS_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TRANSACTION_STATUS_LABELS,
} from '../types'

/* ------------------------------ business categories ------------------------------ */

export interface CategoryMeta {
  label: string
  shortLabel: string
  color: string
  icon: LucideIcon
  badgeClass: string
  iconClass: string
  dotClass: string
  solidClass: string
  chartColor: string
}

export const CATEGORY_META: Record<BusinessCategory, CategoryMeta> = {
  owned: {
    label: BUSINESS_CATEGORY_LABELS.owned,
    shortLabel: 'Owned',
    color: '#8b5cf6',
    icon: Crown,
    badgeClass:
      'bg-violet-50 text-violet-700 ring-1 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20',
    iconClass: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    dotClass: 'bg-violet-500',
    solidClass: 'bg-violet-500',
    chartColor: '#8b5cf6',
  },
  equity: {
    label: BUSINESS_CATEGORY_LABELS.equity,
    shortLabel: 'Equity',
    color: '#10b981',
    icon: Handshake,
    badgeClass:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    iconClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    dotClass: 'bg-emerald-500',
    solidClass: 'bg-emerald-500',
    chartColor: '#10b981',
  },
  client: {
    label: BUSINESS_CATEGORY_LABELS.client,
    shortLabel: 'Client',
    color: '#f59e0b',
    icon: Briefcase,
    badgeClass:
      'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
    iconClass: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    dotClass: 'bg-amber-500',
    solidClass: 'bg-amber-500',
    chartColor: '#f59e0b',
  },
}

/* ------------------------------ business models ------------------------------ */

export interface ModelMeta {
  label: string
  shortLabel: string
  icon: LucideIcon
  badgeClass: string
  iconClass: string
  chartColor: string
}

export const MODEL_META: Record<BusinessModel, ModelMeta> = {
  project: {
    label: BUSINESS_MODEL_LABELS.project,
    shortLabel: 'Project',
    icon: FolderKanban,
    badgeClass:
      'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
    iconClass: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
    chartColor: '#0ea5e9',
  },
  consulting: {
    label: BUSINESS_MODEL_LABELS.consulting,
    shortLabel: 'Consulting',
    icon: LineChart,
    badgeClass:
      'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20',
    iconClass: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
    chartColor: '#6366f1',
  },
  equity: {
    label: BUSINESS_MODEL_LABELS.equity,
    shortLabel: 'Equity',
    icon: Wallet,
    badgeClass:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    iconClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    chartColor: '#10b981',
  },
}

/* ------------------------------ milestone statuses ------------------------------ */

export const MILESTONE_STATUS_META: Record<MilestoneStatus, StatusMeta> = {
  planned: {
    label: MILESTONE_STATUS_LABELS.planned,
    badgeClass:
      'bg-slate-100 text-slate-600 ring-1 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20',
    dotClass: 'bg-slate-400',
  },
  in_progress: {
    label: MILESTONE_STATUS_LABELS.in_progress,
    badgeClass:
      'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
    dotClass: 'bg-sky-500',
  },
  done: {
    label: MILESTONE_STATUS_LABELS.done,
    badgeClass:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    dotClass: 'bg-emerald-500',
  },
}

/* ------------------------------ business statuses ------------------------------ */

export interface StatusMeta {
  label: string
  badgeClass: string
  dotClass: string
}

export const STATUS_META: Record<BusinessStatus, StatusMeta> = {
  active: {
    label: BUSINESS_STATUS_LABELS.active,
    badgeClass:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    dotClass: 'bg-emerald-500',
  },
  scaling: {
    label: BUSINESS_STATUS_LABELS.scaling,
    badgeClass:
      'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
    dotClass: 'bg-sky-500',
  },
  paused: {
    label: BUSINESS_STATUS_LABELS.paused,
    badgeClass:
      'bg-slate-100 text-slate-700 ring-1 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20',
    dotClass: 'bg-slate-400',
  },
  winding_down: {
    label: BUSINESS_STATUS_LABELS.winding_down,
    badgeClass:
      'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
    dotClass: 'bg-rose-500',
  },
}

/* ------------------------------ branch statuses ------------------------------ */

export const BRANCH_STATUS_META: Record<BranchStatus, StatusMeta> = {
  active: {
    label: BRANCH_STATUS_LABELS.active,
    badgeClass:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    dotClass: 'bg-emerald-500',
  },
  opening: {
    label: BRANCH_STATUS_LABELS.opening,
    badgeClass:
      'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
    dotClass: 'bg-sky-500',
  },
  paused: {
    label: BRANCH_STATUS_LABELS.paused,
    badgeClass:
      'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
    dotClass: 'bg-amber-500',
  },
  closed: {
    label: BRANCH_STATUS_LABELS.closed,
    badgeClass:
      'bg-slate-100 text-slate-600 ring-1 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20',
    dotClass: 'bg-slate-400',
  },
}

/* ------------------------------ task priorities ------------------------------ */

export const PRIORITY_META: Record<TaskPriority, StatusMeta> = {
  low: {
    label: TASK_PRIORITY_LABELS.low,
    badgeClass:
      'bg-slate-100 text-slate-600 ring-1 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20',
    dotClass: 'bg-slate-400',
  },
  medium: {
    label: TASK_PRIORITY_LABELS.medium,
    badgeClass:
      'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
    dotClass: 'bg-sky-500',
  },
  high: {
    label: TASK_PRIORITY_LABELS.high,
    badgeClass:
      'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/20',
    dotClass: 'bg-orange-500',
  },
  urgent: {
    label: TASK_PRIORITY_LABELS.urgent,
    badgeClass:
      'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
    dotClass: 'bg-rose-500',
  },
}

/* ------------------------------ transactions ------------------------------ */

export const TXN_TYPE_META: Record<TransactionType, StatusMeta> = {
  income: {
    label: 'Income',
    badgeClass:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    dotClass: 'bg-emerald-500',
  },
  expense: {
    label: 'Expense',
    badgeClass:
      'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
    dotClass: 'bg-rose-500',
  },
}

export const TXN_STATUS_META: Record<TransactionStatus, StatusMeta> = {
  cleared: STATUS_META.active,
  pending: {
    label: TRANSACTION_STATUS_LABELS.pending,
    badgeClass:
      'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
    dotClass: 'bg-amber-500',
  },
  flagged: {
    label: TRANSACTION_STATUS_LABELS.flagged,
    badgeClass:
      'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
    dotClass: 'bg-rose-500',
  },
}