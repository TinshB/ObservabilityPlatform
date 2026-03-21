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
  ReferenceLine,
} from 'recharts'
import type { UiMetricsResponse, CwvStatus } from '@/types'
import type { MetricsParams } from '@/services/metricsService'
import * as metricsService from '@/services/metricsService'
import {
  mergeTimeSeries,
  formatTime,
  formatDateTime,
  formatLatency,
  CHART_COLORS,
} from './chartUtils'

interface Props {
  serviceId: string
  serviceName: string
  params: MetricsParams
}

const STATUS_COLORS: Record<CwvStatus, string> = {
  good: '#2e7d32',
  'needs-improvement': '#ed6c02',
  poor: '#d32f2f',
  unknown: '#9e9e9e',
}

const STATUS_BG: Record<CwvStatus, string> = {
  good: '#e8f5e9',
  'needs-improvement': '#fff3e0',
  poor: '#ffebee',
  unknown: '#f5f5f5',
}

function VitalCard({
  title,
  value,
  status,
  unit,
}: {
  title: string
  value: number | null | undefined
  status: CwvStatus
  unit: string
}) {
  const formatted = value != null
    ? unit === 'score' ? value.toFixed(3) : formatLatency(value)
    : 'N/A'

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        textAlign: 'center',
        backgroundColor: STATUS_BG[status],
        borderColor: STATUS_COLORS[status],
        borderWidth: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <Typography variant="h5" fontWeight={700} color={STATUS_COLORS[status]}>
        {formatted}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: STATUS_COLORS[status], textTransform: 'capitalize', fontWeight: 600 }}
      >
        {status === 'needs-improvement' ? 'Needs Improvement' : status}
      </Typography>
    </Paper>
  )
}

function formatCls(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'N/A'
  return value.toFixed(3)
}

export default function WebVitalsTab({ serviceId, serviceName, params }: Props) {
  const [data, setData] = useState<UiMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await metricsService.getUiMetrics(serviceId, params)
      setData(resp)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to load Web Vitals metrics'
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
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={6} sm={3} key={i}>
              <Skeleton variant="rounded" height={100} />
            </Grid>
          ))}
        </Grid>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" height={280} />
        ))}
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
          No Web Vitals data available. Ensure the OTel Browser SDK is configured and {serviceName} frontend is emitting telemetry.
        </Typography>
      </Paper>
    )
  }

  const current = data.current

  // Chart data: merge P50/P75/P95 for each vital
  const fcpData = mergeTimeSeries([data.fcpP50, data.fcpP75, data.fcpP95], ['P50', 'P75', 'P95'])
  const lcpData = mergeTimeSeries([data.lcpP50, data.lcpP75, data.lcpP95], ['P50', 'P75', 'P95'])
  const clsData = mergeTimeSeries([data.clsP50, data.clsP75, data.clsP95], ['P50', 'P75', 'P95'])
  const ttiData = mergeTimeSeries([data.ttiP50, data.ttiP75, data.ttiP95], ['P50', 'P75', 'P95'])

  const latencyFormatter = (value: unknown, name: unknown) =>
    [formatLatency(value as number), name as string]

  const clsFormatter = (value: unknown, name: unknown) =>
    [formatCls(value as number), name as string]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── P75 summary cards with CWV status ──────────────────────────── */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <VitalCard
            title="FCP (P75)"
            value={current?.fcpP75}
            status={current?.fcpStatus ?? 'unknown'}
            unit="seconds"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <VitalCard
            title="LCP (P75)"
            value={current?.lcpP75}
            status={current?.lcpStatus ?? 'unknown'}
            unit="seconds"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <VitalCard
            title="CLS (P75)"
            value={current?.clsP75}
            status={current?.clsStatus ?? 'unknown'}
            unit="score"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <VitalCard
            title="TTI (P75)"
            value={current?.ttiP75}
            status={current?.ttiStatus ?? 'unknown'}
            unit="seconds"
          />
        </Grid>
      </Grid>

      {/* ── FCP chart ──────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          First Contentful Paint (FCP)
        </Typography>
        {fcpData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={fcpData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tickFormatter={(v) => formatLatency(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip labelFormatter={(l) => formatDateTime(l as number)} formatter={latencyFormatter} />
              <Legend />
              <ReferenceLine y={1.8} stroke="#2e7d32" strokeDasharray="5 5" label="Good" />
              <ReferenceLine y={3.0} stroke="#d32f2f" strokeDasharray="5 5" label="Poor" />
              <Line type="monotone" dataKey="P50" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P75" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P95" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No FCP data available for the selected time range.
          </Typography>
        )}
      </Paper>

      {/* ── LCP chart ──────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Largest Contentful Paint (LCP)
        </Typography>
        {lcpData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lcpData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tickFormatter={(v) => formatLatency(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip labelFormatter={(l) => formatDateTime(l as number)} formatter={latencyFormatter} />
              <Legend />
              <ReferenceLine y={2.5} stroke="#2e7d32" strokeDasharray="5 5" label="Good" />
              <ReferenceLine y={4.0} stroke="#d32f2f" strokeDasharray="5 5" label="Poor" />
              <Line type="monotone" dataKey="P50" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P75" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P95" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No LCP data available for the selected time range.
          </Typography>
        )}
      </Paper>

      {/* ── CLS chart ──────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Cumulative Layout Shift (CLS)
        </Typography>
        {clsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={clsData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tickFormatter={(v) => formatCls(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip labelFormatter={(l) => formatDateTime(l as number)} formatter={clsFormatter} />
              <Legend />
              <ReferenceLine y={0.1} stroke="#2e7d32" strokeDasharray="5 5" label="Good" />
              <ReferenceLine y={0.25} stroke="#d32f2f" strokeDasharray="5 5" label="Poor" />
              <Line type="monotone" dataKey="P50" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P75" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P95" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No CLS data available for the selected time range.
          </Typography>
        )}
      </Paper>

      {/* ── TTI chart ──────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Time to Interactive (TTI)
        </Typography>
        {ttiData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={ttiData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tickFormatter={(v) => formatLatency(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip labelFormatter={(l) => formatDateTime(l as number)} formatter={latencyFormatter} />
              <Legend />
              <ReferenceLine y={3.8} stroke="#2e7d32" strokeDasharray="5 5" label="Good" />
              <ReferenceLine y={7.3} stroke="#d32f2f" strokeDasharray="5 5" label="Poor" />
              <Line type="monotone" dataKey="P50" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P75" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P95" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No TTI data available for the selected time range.
          </Typography>
        )}
      </Paper>
    </Box>
  )
}
