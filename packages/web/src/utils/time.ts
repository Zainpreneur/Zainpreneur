// @ts-nocheck
const DAY_MS = 86_400_000

export function nowMs(): number {
  return Date.now()
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < nowMs()
}

export function isOverdue(iso: string): boolean {
  return new Date(iso).getTime() < nowMs() - DAY_MS
}

export function isDueWithinDays(iso: string, days: number): boolean {
  const due = new Date(iso).getTime()
  const start = nowMs()
  return due >= start && due <= start + days * DAY_MS
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - nowMs()) / DAY_MS)
}