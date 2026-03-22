import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Skeleton,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Collapse,
  LinearProgress,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { LogMetricsResponse, LogPattern, MetricDataPoint } from '@/types'
import type { MetricsParams } from '@/services/metricsService'
import * as metricsService from '@/services/metricsService'
import {
  mergeTimeSeriesByLabel,
  mergeTimeSeries,
  formatTime,
  formatDateTime,
  formatNumber,
  formatPercent,
  CHART_COLORS,
} from './chartUtils'

interface Props {
  serviceId: string
  serviceName: string
  params: MetricsParams
}

const SEVERITY_COLORS: Record<string, string> = {
  FATAL: '#b71c1c',
  ERROR: '#d32f2f',
  WARN: '#ed6c02',
  INFO: '#1976d2',
  DEBUG: '#9e9e9e',
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

function ErrorRatioGauge({ ratio }: { ratio: number | null | undefined }) {
  const pct = ratio != null ? ratio * 100 : 0
  const color = pct > 5 ? '#d32f2f' : pct > 2 ? '#ed6c02' : '#2e7d32'

  return (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Error Ratio
      </Typography>
      <Typography variant="h4" fontWeight={700} color={color}>
        {ratio != null ? formatPercent(ratio) : 'N/A'}
      </Typography>
      <Box sx={{ mt: 1, mx: 2 }}>
        <LinearProgress
          variant="determinate"
          value={Math.min(pct, 100)}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'rgba(0,0,0,0.08)',
            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 },
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        Threshold: 5%
      </Typography>
    </Paper>
  )
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUpIcon fontSize="small" color="error" />
  if (trend === 'down') return <TrendingDownIcon fontSize="small" color="success" />
  return <TrendingFlatIcon fontSize="small" color="disabled" />
}

export default function LogMetricsTab({ serviceId, serviceName, params }: Props) {
  const [data, setData] = useState<LogMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPatternIdx, setSelectedPatternIdx] = useState<number | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await metricsService.getLogMetrics(serviceId, params)
      setData(resp)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to load log metrics'
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
          No log metrics available. Ensure the OTel Collector is processing logs for {serviceName}.
        </Typography>
      </Paper>
    )
  }

  const current = data.current

  // Build stacked area chart data from volumeByLevel
  const volumeChart = data.volumeByLevel?.length
    ? mergeTimeSeriesByLabel(data.volumeByLevel, 'severity')
    : null

  // If volumeByLevel doesn't have the severity label, use the series name as key
  const volumeChartFallback = data.volumeByLevel?.length && !volumeChart?.keys?.length
    ? (() => {
        const merged = mergeTimeSeries(
          data.volumeByLevel,
          data.volumeByLevel.map(s => s.name),
        )
        return { data: merged, keys: data.volumeByLevel.map(s => s.name) }
      })()
    : volumeChart

  const errorRatioData = mergeTimeSeries([data.errorRatio], ['Error Ratio'])

  const volumeFormatter = (value: unknown, name: unknown) =>
    [`${formatNumber(value as number)} logs/s`, name as string]

  const ratioFormatter = (value: unknown, name: unknown) =>
    [formatPercent(value as number), name as string]

  // Severity order for stacking
  const severityOrder = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG']
  const chartKeys = volumeChartFallback?.keys
    ? [...volumeChartFallback.keys].sort((a, b) => severityOrder.indexOf(a) - severityOrder.indexOf(b))
    : []

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <MetricCard
            title="Total Log Volume"
            value={current?.totalVolume != null ? `${formatNumber(current.totalVolume)} logs/s` : 'N/A'}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            title="Error Volume"
            value={current?.errorVolume != null ? `${formatNumber(current.errorVolume)} logs/s` : 'N/A'}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <ErrorRatioGauge ratio={current?.errorRatio} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            title="Distinct Patterns"
            value={current?.distinctPatterns != null ? String(current.distinctPatterns) : 'N/A'}
          />
        </Grid>
      </Grid>

      {/* ── Log volume stacked area chart ────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Log Volume by Severity
        </Typography>
        {volumeChartFallback && volumeChartFallback.data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={volumeChartFallback.data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip labelFormatter={(l) => formatDateTime(l as number)} formatter={volumeFormatter} />
              <Legend />
              {chartKeys.map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="severity"
                  stroke={SEVERITY_COLORS[key] ?? CHART_COLORS[0]}
                  fill={SEVERITY_COLORS[key] ?? CHART_COLORS[0]}
                  fillOpacity={0.6}
                  strokeWidth={1}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No log volume data available.
          </Typography>
        )}
      </Paper>

      {/* ── Error ratio chart ───────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Error Log Ratio
        </Typography>
        {errorRatioData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={errorRatioData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tickFormatter={(v) => formatPercent(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip labelFormatter={(l) => formatDateTime(l as number)} formatter={ratioFormatter} />
              <Area
                type="monotone"
                dataKey="Error Ratio"
                stroke={CHART_COLORS[2]}
                fill={CHART_COLORS[2]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No error ratio data available.
          </Typography>
        )}
      </Paper>

      {/* ── Top patterns table ──────────────────────────────────────────── */}
      <Paper variant="outlined">
        <Box sx={{ p: 2, pb: 0 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Top Log Patterns
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click a pattern to view its volume trend over time.
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Pattern</TableCell>
                <TableCell>Level</TableCell>
                <TableCell align="right">Count</TableCell>
                <TableCell align="right">%</TableCell>
                <TableCell align="center">Trend</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.topPatterns && data.topPatterns.length > 0 ? (
                data.topPatterns.map((p: LogPattern, idx: number) => {
                  const isSelected = selectedPatternIdx === idx
                  const hasTrend = isSelected && p.trendSeries && p.trendSeries.length > 0
                  return (
                    <React.Fragment key={idx}>
                      <TableRow
                        hover
                        selected={isSelected}
                        onClick={() => setSelectedPatternIdx(isSelected ? null : idx)}
                        sx={{ cursor: 'pointer', '& > td': hasTrend ? { borderBottom: 'none' } : undefined }}
                      >
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                              ...(isSelected
                                ? { whiteSpace: 'pre-wrap', wordBreak: 'break-all' }
                                : { maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                            }}
                          >
                            {p.pattern}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={p.level}
                            size="small"
                            sx={{
                              bgcolor: SEVERITY_COLORS[p.level] ?? '#9e9e9e',
                              color: 'common.white',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">{formatNumber(p.count)}</TableCell>
                        <TableCell align="right">{p.percentage.toFixed(1)}%</TableCell>
                        <TableCell align="center"><TrendIcon trend={p.trend} /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={6} sx={{ p: 0, border: 'none' }}>
                          <Collapse in={hasTrend} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                              <Typography variant="body2" fontWeight={600} gutterBottom>
                                Volume trend for this pattern
                              </Typography>
                              <ResponsiveContainer width="100%" height={180}>
                                <AreaChart
                                  data={p.trendSeries!.map((dp: MetricDataPoint) => ({ time: dp.timestamp, Count: dp.value }))}
                                  margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                  <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="rgba(0,0,0,0.3)" />
                                  <YAxis tick={{ fontSize: 11 }} stroke="rgba(0,0,0,0.3)" width={50} />
                                  <Tooltip
                                    labelFormatter={(label) => formatDateTime(label as number)}
                                    formatter={(value: unknown) => [`${formatNumber(value as number)} logs`, 'Count']}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="Count"
                                    stroke={SEVERITY_COLORS[p.level] ?? CHART_COLORS[0]}
                                    fill={SEVERITY_COLORS[p.level] ?? CHART_COLORS[0]}
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No log patterns found. Ensure Elasticsearch is accessible and contains log data.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
