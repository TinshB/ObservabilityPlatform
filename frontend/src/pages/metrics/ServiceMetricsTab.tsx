import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Skeleton,
  Alert,
} from '@mui/material'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import type { ServiceMetricsResponse } from '@/types'
import type { MetricsParams } from '@/services/metricsService'
import * as metricsService from '@/services/metricsService'
import {
  mergeTimeSeries,
  formatTime,
  formatDateTime,
  formatLatency,
  formatPercent,
  formatNumber,
  CHART_COLORS,
} from './chartUtils'

interface Props {
  serviceId: string
  serviceName: string
  params: MetricsParams
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
      <Typography variant="h5" fontWeight={700}>{value}</Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
      )}
    </Paper>
  )
}

export default function ServiceMetricsTab({ serviceId, serviceName, params }: Props) {
  const [data, setData] = useState<ServiceMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await metricsService.getServiceMetrics(serviceId, params)
      setData(resp)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to load service metrics'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [serviceId, params.range]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={6} sm={4} md={2} key={i}>
              <Skeleton variant="rounded" height={90} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={300} />
        <Skeleton variant="rounded" height={300} />
      </Box>
    )
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
  }

  if (!data) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No data available. Check that the OTel pipeline is active and {serviceName} is emitting telemetry.
        </Typography>
      </Paper>
    )
  }

  const current = data.current
  const latencyData = mergeTimeSeries(
    [data.latencyP50, data.latencyP95, data.latencyP99],
    ['P50', 'P95', 'P99'],
  )
  const errorRateData = mergeTimeSeries([data.errorRate], ['Error Rate'])
  const rpsData = mergeTimeSeries([data.requestRate], ['RPS'])

  // Recharts Tooltip formatter expects (value: ValueType | undefined, name: NameType, ...)
  // We cast to any to avoid the overly strict type signature.
  const latencyTooltipFormatter = (value: unknown, name: unknown) =>
    [formatLatency(value as number), name as string]

  const errorTooltipFormatter = (value: unknown, name: unknown) =>
    [formatPercent(value as number), name as string]

  const rpsTooltipFormatter = (value: unknown, name: unknown) =>
    [`${formatNumber(value as number)} req/s`, name as string]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Instant metric cards ────────────────────────────────────────── */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCard title="Total Requests" value={data.totalRequestCount != null ? formatNumber(data.totalRequestCount) : 'N/A'} subtitle="in selected range" />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCard title="P50 Latency" value={formatLatency(current?.latencyP50)} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCard title="P95 Latency" value={formatLatency(current?.latencyP95)} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCard title="P99 Latency" value={formatLatency(current?.latencyP99)} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCard title="Error Rate" value={formatPercent(current?.errorRate)} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCard title="Request Rate" value={current?.requestRate != null ? `${formatNumber(current.requestRate)} req/s` : 'N/A'} />
        </Grid>
      </Grid>

      {/* ── Latency chart ───────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Latency (P50 / P95 / P99)
        </Typography>
        {latencyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={latencyData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                tick={{ fontSize: 12 }}
                stroke="rgba(0,0,0,0.3)"
              />
              <YAxis
                tickFormatter={(v) => formatLatency(v)}
                tick={{ fontSize: 12 }}
                stroke="rgba(0,0,0,0.3)"
                width={70}
              />
              <Tooltip
                labelFormatter={(label) => formatDateTime(label as number)}
                formatter={latencyTooltipFormatter}
              />
              <Legend />
              <Line type="monotone" dataKey="P50" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P95" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P99" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No latency data available for the selected time range.
          </Typography>
        )}
      </Paper>

      {/* ── Error rate chart ─────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Error Rate
        </Typography>
        {errorRateData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={errorRateData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                tick={{ fontSize: 12 }}
                stroke="rgba(0,0,0,0.3)"
              />
              <YAxis
                tickFormatter={(v) => formatPercent(v)}
                tick={{ fontSize: 12 }}
                stroke="rgba(0,0,0,0.3)"
                width={70}
              />
              <Tooltip
                labelFormatter={(label) => formatDateTime(label as number)}
                formatter={errorTooltipFormatter}
              />
              <Area
                type="monotone"
                dataKey="Error Rate"
                stroke={CHART_COLORS[2]}
                fill={CHART_COLORS[2]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No error rate data available for the selected time range.
          </Typography>
        )}
      </Paper>

      {/* ── Request rate chart ────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Request Rate (RPS)
        </Typography>
        {rpsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={rpsData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                tick={{ fontSize: 12 }}
                stroke="rgba(0,0,0,0.3)"
              />
              <YAxis
                tickFormatter={(v) => `${formatNumber(v)}`}
                tick={{ fontSize: 12 }}
                stroke="rgba(0,0,0,0.3)"
                width={70}
              />
              <Tooltip
                labelFormatter={(label) => formatDateTime(label as number)}
                formatter={rpsTooltipFormatter}
              />
              <Area
                type="monotone"
                dataKey="RPS"
                stroke={CHART_COLORS[0]}
                fill={CHART_COLORS[0]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No request rate data available for the selected time range.
          </Typography>
        )}
      </Paper>
    </Box>
  )
}
