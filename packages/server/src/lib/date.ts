export function formatCurrency(amount: number, currency = 'PKR'): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', PKR: 'Rs', AED: 'د.إ', INR: '₹',
  }
  const sym = symbols[currency] ?? currency
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function parseDate(dateStr: string): Date {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`)
  return d
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function monthRange(from: string, to: string): { start: Date; end: Date } {
  return { start: new Date(from), end: new Date(to) }
}
