// @ts-nocheck
/**
 * ID generator with `crypto.randomUUID` fallback.
 * - Preferred: globalThis.crypto.randomUUID() (when available)
 * - Fallback: a deterministic-random string for environments without Crypto API
 * - Used by repos and context to ensure unique IDs across sessions
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback: generate a short unique ID using Math.random
  // 24-char alphanumeric string (low collision probability for client-side use)
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 12)
  return `${timestamp}-${random}`
}

/** Generate a batch of IDs. Used for assigning IDs to new items. */
export function generateIds(count: number): string[] {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    ids.push(generateId())
  }
  return ids
}