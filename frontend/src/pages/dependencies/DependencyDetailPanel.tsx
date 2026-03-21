import { useEffect, useState } from 'react'
import {
  Box, Typography, Chip, Divider, IconButton, Skeleton, Card, CardContent,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts'
import type { DependencyEdge, DependencyMetrics, TimeSeries } from '@/types'
import { getDependencyMetrics } from '@/services/dependencyService'

// ── Constants ───────────────────────────────────────────────────────────────

const EDGE_COLORS: Record<string, string> = {
  HTTP:     '#42a5f5',
  GRPC:     '#66bb6a',
  DATABASE: '#ab47bc',
  CLOUD:    '#ffa726',
  CACHE:    '#d32f2f',
}

const LATENCY_COLORS = {
  p50: '#42a5f5',
  p95: '#ff9800',
  p99: '#f44336',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatLatencySeconds(s: number | null): string {
  if (s == null) return '—'
  if (s < 0.001) return `${(s * 1_000_000).toFixed(0)}µs`
  if (s < 1) return `${(s * 1000).toFixed(1)}ms`
  return `${s.toFixed(2)}s`
}

function formatLatencyMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatPercent(v: number | null): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(2)}%`
}

function formatRate(v: number | null): string {
  if (v == null) return '—'
  return `${v.toFixed(2)}/s`
}

function errorRatePercent(edge: DependencyEdge): string {
  if (edge.callCount1h === 0) return '0%'
  return `${((edge.errorCount1h / edge.callCount1h) * 100).toFixed(1)}%`
}

/** Convert TimeSeries to recharts data array. */
function toChartData(series: TimeSeries | null): { time: string; value: number }[] {
  if (!series || !series.dataPoints) return []
  return series.dataPoints.map(dp => ({
    time: new Date(dp.timestamp * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    value: dp.value,
  }))
}

/** Merge multiple latency series into a single chart dataset. */
function mergeLatencyData(
  p50: TimeSeries | null, p95: TimeSeries | null, p99: TimeSeries | null,
): { time: string; p50: number | null; p95: number | null; p99: number | null }[] {
  const map = new Map<string, { p50: number | null; p95: number | null; p99: number | null }>()

  const addSeries = (series: TimeSeries | null, key: 'p50' | 'p95' | 'p99') => {
    if (!series?.dataPoints) return
    for (const dp of series.dataPoints) {
      const time = new Date(dp.timestamp * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      const entry = map.get(time) ?? { p50: null, p95: null, p99: null }
      entry[key] = dp.value
      map.set(time, entry)
    }
  }

  addSeries(p50, 'p50')
  addSeries(p95, 'p95')
  addSeries(p99, 'p99')

  return Array.from(map.entries()).map(([time, vals]) => ({ time, ...vals }))
}

// ── Props ───────────────────────────────────────────────────────────────────

interface DependencyDetailPanelProps {
  edge: DependencyEdge
  onClose: () => void
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DependencyDetailPanel({ edge, onClose }: DependencyDetailPanelProps) {
  const [metrics, setMetrics]     = useState<DependencyMetrics | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    getDependencyMetrics(edge.id)
      .then(data => { if (!cancelled) setMetrics(data) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [edge.id])

  const current = metrics?.current
  const latencyData  = mergeLatencyData(metrics?.latencyP50 ?? null, metrics?.latencyP95 ?? null, metrics?.latencyP99 ?? null)
  const errorData    = toChartData(metrics?.errorRate ?? null)
  const throughputData = toChartData(metrics?.throughput ?? null)

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Dependency Detail</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* ── Connection info ─────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
        <DetailRow label="Source" value={edge.source} />
        <DetailRow label="Target" value={edge.target} />
        <DetailRow label="Type">
          <Chip size="small" label={edge.dependencyType}
            sx={{ backgroundColor: EDGE_COLORS[edge.dependencyType], color: '#fff' }} />
        </DetailRow>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* ── Instant metrics cards ───────────────────────────────── */}
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Current Metrics</Typography>

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rectangular" height={48} />)}
        </Box>
      ) : error ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Unable to load Prometheus metrics. Showing stored 1h data.
        </Typography>
      ) : null}

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
        <MetricCard label="P50 Latency"  value={current ? formatLatencySeconds(current.latencyP50) : formatLatencyMs(edge.avgLatencyMs1h)} />
        <MetricCard label="P95 Latency"  value={current ? formatLatencySeconds(current.latencyP95) : '—'} />
        <MetricCard label="P99 Latency"  value={current ? formatLatencySeconds(current.latencyP99) : '—'} />
        <MetricCard label="Error Rate"   value={current ? formatPercent(current.errorRate) : errorRatePercent(edge)}
          highlight={current?.errorRate != null && current.errorRate > 0.05} />
        <MetricCard label="Throughput"   value={current ? formatRate(current.throughput) : '—'} />
        <MetricCard label="Calls (1h)"   value={(current?.callCount1h ?? edge.callCount1h).toLocaleString()} />
        <MetricCard label="Errors (1h)"  value={(current?.errorCount1h ?? edge.errorCount1h).toLocaleString()}
          highlight={(current?.errorCount1h ?? edge.errorCount1h) > 0} />
        <MetricCard label="Avg Lat (1h)" value={formatLatencyMs(current?.avgLatencyMs1h ?? edge.avgLatencyMs1h)} />
      </Box>

      {/* ── Charts ──────────────────────────────────────────────── */}
      {!loading && !error && metrics && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Latency (P50 / P95 / P99)</Typography>
          {latencyData.length > 0 ? (
            <Box sx={{ width: '100%', height: 160, mb: 2 }}>
              <ResponsiveContainer>
                <LineChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" fontSize={10} interval="preserveStartEnd" />
                  <YAxis fontSize={10} tickFormatter={v => `${(v * 1000).toFixed(0)}ms`} />
                  <RechartsTooltip formatter={(v) => formatLatencySeconds(Number(v))} />
                  <Line type="monotone" dataKey="p50" stroke={LATENCY_COLORS.p50} dot={false} strokeWidth={1.5} name="P50" />
                  <Line type="monotone" dataKey="p95" stroke={LATENCY_COLORS.p95} dot={false} strokeWidth={1.5} name="P95" />
                  <Line type="monotone" dataKey="p99" stroke={LATENCY_COLORS.p99} dot={false} strokeWidth={1.5} name="P99" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              No latency data available
            </Typography>
          )}

          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Error Rate</Typography>
          {errorData.length > 0 ? (
            <Box sx={{ width: '100%', height: 120, mb: 2 }}>
              <ResponsiveContainer>
                <LineChart data={errorData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" fontSize={10} interval="preserveStartEnd" />
                  <YAxis fontSize={10} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                  <RechartsTooltip formatter={(v) => formatPercent(Number(v))} />
                  <Line type="monotone" dataKey="value" stroke="#f44336" dot={false} strokeWidth={1.5} name="Error Rate" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              No error rate data available
            </Typography>
          )}

          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Throughput</Typography>
          {throughputData.length > 0 ? (
            <Box sx={{ width: '100%', height: 120, mb: 2 }}>
              <ResponsiveContainer>
                <LineChart data={throughputData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" fontSize={10} interval="preserveStartEnd" />
                  <YAxis fontSize={10} tickFormatter={v => `${v.toFixed(1)}/s`} />
                  <RechartsTooltip formatter={(v) => formatRate(Number(v))} />
                  <Line type="monotone" dataKey="value" stroke="#42a5f5" dot={false} strokeWidth={1.5} name="Throughput" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              No throughput data available
            </Typography>
          )}
        </>
      )}
    </Box>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      {children ?? (
        <Typography variant="body2" fontWeight={600} fontFamily="monospace">{value}</Typography>
      )}
    </Box>
  )
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card variant="outlined" sx={{ backgroundColor: highlight ? 'error.50' : undefined }}>
      <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
        <Typography variant="caption" color="text.secondary" fontSize="0.65rem">{label}</Typography>
        <Typography variant="body2" fontWeight={700} fontFamily="monospace"
          color={highlight ? 'error.main' : 'text.primary'}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}
