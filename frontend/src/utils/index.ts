// ─────────────────────────────────────────────────────────────────────────────
// Shared utility functions
// ─────────────────────────────────────────────────────────────────────────────

/** Format bytes into a human-readable string (KB, MB, GB, …). */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  const k     = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i     = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

/** Format milliseconds into a human-readable duration string. */
export function formatDuration(ms: number): string {
  if (ms < 1)      return `${ms.toFixed(2)}ms`
  if (ms < 1_000)  return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(2)}s`
  const m = Math.floor(ms / 60_000)
  const s = ((ms % 60_000) / 1_000).toFixed(0)
  return `${m}m ${s}s`
}

/** Truncate a string to maxLength characters with an ellipsis. */
export function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str
}

/** Merge class names, filtering falsy values (minimal alternative to clsx). */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Format a latency percentile label. */
export function percentileLabel(p: number): string {
  return `P${p}`
}

/** Returns true if the value is a non-null object (and not an array). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Shorten a traceId / spanId for display (first 8 chars). */
export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}
