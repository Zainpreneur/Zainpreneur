import { useEffect, useRef, useState } from 'react'

/**
 * Debounced value hook.
 * - Updates the debounced value after `delay` milliseconds of no changes.
 * - Uses a ref to track the latest input so the callback always receives the current value.
 * - On unmount, the timeout is cleared to prevent memory leaks.
 */
export function useDebounced<T>(value: T, delay: number = 250): T {
  const ref = useRef<T>(value)
  ref.current = value

  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(ref.current)
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [delay])

  return debounced
}