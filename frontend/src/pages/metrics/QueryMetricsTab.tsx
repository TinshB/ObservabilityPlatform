import { useState, useEffect, useCallback } from 'react'
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
  TableSortLabel,
  Chip,
  Collapse,
  IconButton,
} from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import CodeIcon from '@mui/icons-material/Code'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { QueryMetricsResponse, QuerySummary } from '@/types'
import type { MetricsParams } from '@/services/metricsService'
import * as metricsService from '@/services/metricsService'
import {
  mergeTimeSeries,
  mergeTimeSeriesByLabel,
  formatTime,
  formatDateTime,
  formatLatency,
  formatNumber,
  CHART_COLORS,
} from './chartUtils'

interface Props {
  serviceId: string
  serviceName: string
  params: MetricsParams
}

type SortKey = 'operation' | 'collection' | 'avgExecTime' | 'p95ExecTime' | 'callCount'
type SortDir = 'asc' | 'desc'

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

function QueryRow({ row }: { row: QuerySummary }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow
        hover
        sx={{ cursor: 'pointer', '& > *': { borderBottom: open ? 'none' : undefined } }}
        onClick={() => setOpen(!open)}
      >
        <TableCell padding="checkbox">
          <IconButton size="small">
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={500}>{row.operation}</Typography>
        </TableCell>
        <TableCell>{row.collection}</TableCell>
        <TableCell align="right">{formatLatency(row.avgExecTime)}</TableCell>
        <TableCell align="right">{formatLatency(row.p95ExecTime)}</TableCell>
        <TableCell align="right">{row.callCount != null ? formatNumber(row.callCount) : 'N/A'}</TableCell>
        <TableCell align="center">
          {row.slowQuery ? (
            <Chip label="Slow" size="small" color="error" />
          ) : (
            <Chip label="OK" size="small" color="success" variant="outlined" />
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, my: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {row.operation} {row.collection} — Avg: {formatLatency(row.avgExecTime)}, P95: {formatLatency(row.p95ExecTime)}, Calls: {row.callCount != null ? formatNumber(row.callCount) : 'N/A'}/s
              </Typography>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export default function QueryMetricsTab({ serviceId, serviceName, params }: Props) {
  const [data, setData] = useState<QueryMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('p95ExecTime')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showQueries, setShowQueries] = useState(false)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await metricsService.getQueryMetrics(serviceId, params)
      setData(resp)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to load query metrics'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [serviceId, params.range]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={6} sm={3} key={i}>
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
          No query metrics available. Ensure OTel JDBC instrumentation is active for {serviceName}.
        </Typography>
      </Paper>
    )
  }

  const current = data.current
  const queries = [...(data.queries ?? [])].sort((a, b) => {
    const aVal = a[sortKey] ?? 0
    const bVal = b[sortKey] ?? 0
    const cmp = typeof aVal === 'string'
      ? (aVal as string).localeCompare(bVal as string)
      : (aVal as number) - (bVal as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const latencyData = mergeTimeSeries(
    [data.avgLatency, data.p95Latency],
    ['Avg (P50)', 'P95'],
  )
  const queryRateData = mergeTimeSeries([data.queryRate], ['Queries/s'])

  const latencyByOpChart = data.latencyByOperation?.length
    ? mergeTimeSeriesByLabel(data.latencyByOperation, 'db_operation_name')
    : null

  const latencyFormatter = (value: unknown, name: unknown) =>
    [formatLatency(value as number), name as string]
  const rateFormatter = (value: unknown, name: unknown) =>
    [`${formatNumber(value as number)} q/s`, name as string]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Instant metric cards ────────────────────────────────────────── */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <MetricCard title="Avg Latency (P50)" value={formatLatency(current?.avgLatency)} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard title="P95 Latency" value={formatLatency(current?.p95Latency)} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard title="Query Rate" value={current?.queryRate != null ? `${formatNumber(current.queryRate)} q/s` : 'N/A'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            title="Slow Queries"
            value={current?.slowQueryCount != null ? String(current.slowQueryCount) : '0'}
            subtitle="P95 > 500ms"
          />
        </Grid>
      </Grid>

      {/* ── Query summary table ─────────────────────────────────────────── */}
      <Paper variant="outlined">
        <Typography variant="subtitle1" fontWeight={600} sx={{ p: 2, pb: 0 }}>
          Query Operations
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>
                  <TableSortLabel active={sortKey === 'operation'} direction={sortKey === 'operation' ? sortDir : 'asc'} onClick={() => handleSort('operation')}>
                    Operation
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel active={sortKey === 'collection'} direction={sortKey === 'collection' ? sortDir : 'asc'} onClick={() => handleSort('collection')}>
                    Table
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel active={sortKey === 'avgExecTime'} direction={sortKey === 'avgExecTime' ? sortDir : 'asc'} onClick={() => handleSort('avgExecTime')}>
                    Avg Latency
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel active={sortKey === 'p95ExecTime'} direction={sortKey === 'p95ExecTime' ? sortDir : 'asc'} onClick={() => handleSort('p95ExecTime')}>
                    P95 Latency
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel active={sortKey === 'callCount'} direction={sortKey === 'callCount' ? sortDir : 'asc'} onClick={() => handleSort('callCount')}>
                    Call Rate
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {queries.length > 0 ? (
                queries.map((q, idx) => <QueryRow key={`${q.operation}-${q.collection}-${idx}`} row={q} />)
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No query operations found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Overall latency chart ───────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          DB Operation Latency
        </Typography>
        {latencyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={latencyData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tickFormatter={(v) => formatLatency(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip labelFormatter={(l) => formatDateTime(l as number)} formatter={latencyFormatter} />
              <Legend />
              <Line type="monotone" dataKey="Avg (P50)" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P95" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No latency data available.
          </Typography>
        )}
      </Paper>

      {/* ── Query rate chart ────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Query Rate
        </Typography>
        {queryRateData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={queryRateData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip labelFormatter={(l) => formatDateTime(l as number)} formatter={rateFormatter} />
              <Area type="monotone" dataKey="Queries/s" stroke={CHART_COLORS[4]} fill={CHART_COLORS[4]} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No query rate data available.
          </Typography>
        )}
      </Paper>

      {/* ── Per-operation latency chart ──────────────────────────────────── */}
      {latencyByOpChart && latencyByOpChart.data.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Latency by Operation
          </Typography>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={latencyByOpChart.data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tickFormatter={(v) => formatLatency(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip labelFormatter={(l) => formatDateTime(l as number)} formatter={latencyFormatter} />
              <Legend />
              {latencyByOpChart.keys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* ── Executed PromQL Queries ──────────────────────────────────────── */}
      {data.executedQueries && data.executedQueries.length > 0 && (
        <Paper variant="outlined">
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, cursor: 'pointer' }}
            onClick={() => setShowQueries(!showQueries)}
          >
            <CodeIcon fontSize="small" color="action" />
            <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
              Executed Queries ({data.executedQueries.filter(q => !q.startsWith('[resolve]')).length})
            </Typography>
            <IconButton size="small" sx={{ ml: 'auto' }}>
              {showQueries ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          </Box>
          <Collapse in={showQueries}>
            <Box sx={{ px: 2, pb: 2 }}>
              {data.executedQueries
                .filter(q => !q.startsWith('[resolve]'))
                .map((q, i) => (
                  <Typography
                    key={i}
                    variant="body2"
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.75rem',
                      p: 1,
                      mb: 0.5,
                      backgroundColor: 'action.hover',
                      borderRadius: 1,
                      wordBreak: 'break-all',
                    }}
                  >
                    {q}
                  </Typography>
                ))}
            </Box>
          </Collapse>
        </Paper>
      )}
    </Box>
  )
}
