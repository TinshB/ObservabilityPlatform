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

/**
 * Transaction-level label: uses http.route template for grouping.
 * e.g. "GET /api/v1/services/{serviceId}/traces"
 */
export function formatTransaction(trace: TraceSummary): string {
  const method = trace.httpMethod ?? ''
  const path = trace.httpRoute ?? trace.httpPath ?? trace.httpUrl ?? ''

  if (method && path) return `${method} ${path}`
  if (method) return method
  if (path) return path
  return trace.rootOperation
}

/**
 * Trace-level label: uses actual url.path for individual trace display.
 * e.g. "GET /api/v1/services/db5c3242-2906-4f0e-b5b1-a7b88a474628/traces"
 */
export function formatTracePath(trace: TraceSummary): string {
  const method = trace.httpMethod ?? ''
  const path = trace.httpPath ?? trace.httpRoute ?? trace.httpUrl ?? ''

  if (method && path) return `${method} ${path}`
  if (method) return method
  if (path) return path
  return trace.rootOperation
}
