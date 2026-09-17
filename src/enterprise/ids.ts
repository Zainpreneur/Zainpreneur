/** Client-generated ids double as offline idempotency keys. */
export function enterpriseId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`
}

export function todayIso(): string {
  return new Date().toISOString()
}
