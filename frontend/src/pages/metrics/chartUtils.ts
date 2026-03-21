import type { TimeSeries } from '@/types'

/**
 * Convert a TimeSeries into a flat array of { time, [seriesName]: value } objects
 * suitable for Recharts. Merges multiple series by timestamp.
 */
export function mergeTimeSeries(
  seriesList: (TimeSeries | null | undefined)[],
  nameOverrides?: string[],
): Record<string, number>[] {
  const map = new Map<number, Record<string, number>>()

  seriesList.forEach((series, idx) => {
    if (!series?.dataPoints) return
    const key = nameOverrides?.[idx] ?? series.name
    for (const dp of series.dataPoints) {
      let row = map.get(dp.timestamp)
      if (!row) {
        row = { time: dp.timestamp }
        map.set(dp.timestamp, row)
      }
      row[key] = dp.value
    }
  })

  return Array.from(map.values()).sort((a, b) => a.time - b.time)
}

/**
 * Merge multiple TimeSeries[] (e.g. per-route) into chart data,
 * using a label extracted from each series' labels map.
 */
export function mergeTimeSeriesByLabel(
  seriesList: TimeSeries[],
  labelKey: string,
): { data: Record<string, number>[]; keys: string[] } {
  const map = new Map<number, Record<string, number>>()
  const keys = new Set<string>()

  for (const series of seriesList) {
    const label = series.labels?.[labelKey] ?? series.name
    keys.add(label)
    for (const dp of series.dataPoints) {
      let row = map.get(dp.timestamp)
      if (!row) {
        row = { time: dp.timestamp }
        map.set(dp.timestamp, row)
      }
      row[label] = dp.value
    }
  }

  return {
    data: Array.from(map.values()).sort((a, b) => a.time - b.time),
    keys: Array.from(keys),
  }
}

/** Format epoch seconds to locale time string for chart X axis. */
export function formatTime(epoch: number): string {
  const d = new Date(epoch * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Format epoch seconds to full date+time for tooltips. */
export function formatDateTime(epoch: number): string {
  const d = new Date(epoch * 1000)
  return d.toLocaleString([], {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

/** Format a latency value in seconds to a human-readable string. */
export function formatLatency(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds)) return 'N/A'
  if (seconds < 0.001) return `${(seconds * 1_000_000).toFixed(0)}us`
  if (seconds < 1) return `${(seconds * 1000).toFixed(1)}ms`
  return `${seconds.toFixed(2)}s`
}

/** Format a rate (0.0-1.0) as a percentage. */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null || isNaN(ratio)) return 'N/A'
  return `${(ratio * 100).toFixed(2)}%`
}

/** Format a number with appropriate suffix (K, M). */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'N/A'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(1)
}

/** Format bytes to human-readable. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || isNaN(bytes)) return 'N/A'
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${bytes.toFixed(0)} B`
}

/** Format bytes/sec to human-readable rate. */
export function formatBytesRate(bps: number | null | undefined): string {
  if (bps == null || isNaN(bps)) return 'N/A'
  return `${formatBytes(bps)}/s`
}

/** Format CPU usage in cores to human-readable (cores or millicores). */
export function formatCores(cores: number | null | undefined): string {
  if (cores == null || isNaN(cores)) return 'N/A'
  if (cores < 0.01) return `${(cores * 1000).toFixed(0)}m`
  return `${cores.toFixed(3)} cores`
}

/** A consistent color palette for chart series. */
export const CHART_COLORS = [
  '#1976d2', // blue (primary)
  '#ed6c02', // orange (warning)
  '#d32f2f', // red (error)
  '#2e7d32', // green (success)
  '#9c27b0', // purple
  '#00838f', // teal
  '#f57c00', // deep orange
  '#5c6bc0', // indigo
  '#26a69a', // teal accent
  '#ab47bc', // purple accent
]

/** Status code color mapping. */
export function statusCodeColor(code: string): string {
  if (code.startsWith('2')) return '#2e7d32'
  if (code.startsWith('3')) return '#1976d2'
  if (code.startsWith('4')) return '#ed6c02'
  if (code.startsWith('5')) return '#d32f2f'
  return '#9e9e9e'
}
