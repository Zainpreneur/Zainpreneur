import type { Business } from '../types'
import { getPortfolioSeries } from '../data'
import { businessFinancials } from './calculations'

export interface PortfolioTotals {
  businesses: number
  owned: number
  equity: number
  client: number
  employees: number
  monthlyRevenue: number
  monthlyExpenses: number
  monthlyProfit: number
  avgHealth: number
  tasksOpen: number
  tasksDone: number
}

export function computeTotals(businesses: Business[]): PortfolioTotals {
  const consolidated = businesses.map((business) => businessFinancials(business))
  const monthlyRevenue = consolidated.reduce((sum, financials) => sum + financials.revenue, 0)
  const monthlyExpenses = consolidated.reduce((sum, financials) => sum + financials.expenses, 0)

  return {
    businesses: businesses.length,
    owned: businesses.filter((b) => b.category === 'owned').length,
    equity: businesses.filter((b) => b.category === 'equity').length,
    client: businesses.filter((b) => b.category === 'client').length,
    employees: consolidated.reduce((sum, financials) => sum + financials.employees, 0),
    monthlyRevenue,
    monthlyExpenses,
    monthlyProfit: monthlyRevenue - monthlyExpenses,
    avgHealth: businesses.length
      ? Math.round(businesses.reduce((sum, b) => sum + b.healthScore, 0) / businesses.length)
      : 0,
    tasksOpen: 0,
    tasksDone: 0,
  }
}

export function categoryPerformance(businesses: Business[]) {
  const byCategory = businesses.reduce<Record<string, { revenue: number; expenses: number; count: number }>>((acc, b) => {
    const entry = (acc[b.category] ??= { revenue: 0, expenses: 0, count: 0 })
    const financials = businessFinancials(b)
    entry.revenue += financials.revenue
    entry.expenses += financials.expenses
    entry.count += 1
    return acc
  }, {})

  return Object.entries(byCategory).map(([category, data]) => ({
    category,
    ...data,
    profit: data.revenue - data.expenses,
  }))
}

export function getPortfolioHistory(businesses: Business[]) {
  return getPortfolioSeries(businesses, 12)
}