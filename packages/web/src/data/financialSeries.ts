import type { Business, ChartPoint } from '../types'

/** Deterministic PRNG (mulberry32) so charts are stable between reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const MONTH_KEYS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthKey(year: number, month: number): string {
  const offset = (year - 2026) * 12 + month
  return MONTH_KEYS[((offset % 12) + 12) % 12] ?? ''
}

function jitter(rand: () => number, base: number, spread: number, trend: number): number {
  const wave = Math.sin(base * 0.02) * 0.06
  return Math.max(0, Math.round(base * (1 + trend + wave + (rand() - 0.5) * spread)))
}

export interface BusinessSeries {
  revenue: ChartPoint[]
  expenses: ChartPoint[]
  profit: ChartPoint[]
  totalRevenue: number
  totalExpenses: number
  totalProfit: number
}

export function getBusinessSeries(business: Business, months = 12): BusinessSeries {
  const rand = mulberry32(hashString(business.id))
  const trend = (business.healthScore - 65) / 500
  const now = new Date()
  const revenue: ChartPoint[] = []
  const expenses: ChartPoint[] = []
  const profit: ChartPoint[] = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = monthKey(d.getFullYear(), d.getMonth())
    const r = jitter(rand, business.monthlyRevenue, 0.18, trend)
    const e = jitter(rand, business.monthlyExpenses, 0.15, trend * 0.7)
    revenue.push({ label, value: r })
    expenses.push({ label, value: e })
    profit.push({ label, value: r - e })
  }

  return {
    revenue,
    expenses,
    profit,
    totalRevenue: revenue.reduce((sum, p) => sum + p.value, 0),
    totalExpenses: expenses.reduce((sum, p) => sum + p.value, 0),
    totalProfit: profit.reduce((sum, p) => sum + p.value, 0),
  }
}

export function getPortfolioSeries(businesses: Business[], months = 12): BusinessSeries {
  const aggregated = businesses.reduce<{
    revenue: ChartPoint[]
    expenses: ChartPoint[]
    profit: ChartPoint[]
  }>(
    (acc, business, index) => {
      const series = getBusinessSeries(business, months)
      if (index === 0) return { revenue: series.revenue, expenses: series.expenses, profit: series.profit }
      acc.revenue = acc.revenue.map((p, i) => ({ label: p.label, value: p.value + series.revenue[i].value }))
      acc.expenses = acc.expenses.map((p, i) => ({ label: p.label, value: p.value + series.expenses[i].value }))
      acc.profit = acc.profit.map((p, i) => ({ label: p.label, value: p.value + series.profit[i].value }))
      return acc
    },
    { revenue: [], expenses: [], profit: [] },
  )

  return {
    ...aggregated,
    totalRevenue: aggregated.revenue.reduce((sum, p) => sum + p.value, 0),
    totalExpenses: aggregated.expenses.reduce((sum, p) => sum + p.value, 0),
    totalProfit: aggregated.profit.reduce((sum, p) => sum + p.value, 0),
  }
}