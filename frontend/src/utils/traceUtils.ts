import type { TraceSummary } from '@/types'

/** Format microseconds to a human-readable duration string. */
export function formatDuration(micros: number): string {
  if (micros < 1000) return `${micros}µs`
  if (micros < 1_000_000) return `${(micros / 1000).toFixed(1)}ms`
  return `${(micros / 1_000_000).toFixed(2)}s`
}

/** Format ISO timestamp to short locale string. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  } as Intl.DateTimeFormatOptions)
}

/** Build display label for root operation: METHOD route (or url if route is missing). */
export function formatRootOperation(trace: TraceSummary): string {
  const method = trace.httpMethod ?? ''
  const path = trace.httpRoute ?? trace.httpUrl ?? ''

  if (method && path) return `${method} ${path}`
  if (method) return method
  if (path) return path
  return trace.rootOperation
}
