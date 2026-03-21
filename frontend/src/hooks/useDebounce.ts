import { useEffect, useRef, useCallback } from 'react'

/**
 * Returns a debounced version of the provided callback.
 * The callback is invoked after `delay` ms of inactivity.
 */
export function useDebounce<T extends (...args: never[]) => void>(
  callback: T,
  delay: number,
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  // Keep the callback reference up to date
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay],
  ) as T
}
