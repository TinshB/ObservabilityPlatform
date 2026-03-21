import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  TextField,
  InputAdornment,
  Skeleton,
  Alert,
  Chip,
} from '@mui/material'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import type { ApiMetricsResponse, TimeSeries, StatusCodeGroup } from '@/types'
import type { MetricsParams } from '@/services/metricsService'
import * as metricsService from '@/services/metricsService'
import {
  mergeTimeSeries,
  formatTime,
  formatDateTime,
  formatLatency,
  formatPercent,
  formatNumber,
  statusCodeColor,
  CHART_COLORS,
} from './chartUtils'

interface Props {
  serviceId: string
  serviceName: string
  params: MetricsParams
}

type SortField = 'route' | 'avgLatency' | 'p99Latency' | 'errorRate' | 'rps'
type SortDir = 'asc' | 'desc'

interface EndpointSummary {
  route: string
  avgLatency: number
  p99Latency: number
  errorRate: number
  rps: number
}

function buildEndpointSummary(data: ApiMetricsResponse): EndpointSummary[] {
  const routes = new Set<string>()
  for (const s of data.latencyP50ByRoute) {
    const route = s.labels?.http_route ?? s.name
    routes.add(route)
  }

  return Array.from(routes).map((route) => {
    const findLast = (list: TimeSeries[], r: string) => {
      const series = list.find((s) => (s.labels?.http_route ?? s.name) === r)
      if (!series?.dataPoints?.length) return 0
      return series.dataPoints[series.dataPoints.length - 1].value
    }

    const avg = (list: TimeSeries[], r: string) => {
      const series = list.find((s) => (s.labels?.http_route ?? s.name) === r)
      if (!series?.dataPoints?.length) return 0
      const sum = series.dataPoints.reduce((a, dp) => a + dp.value, 0)
      return sum / series.dataPoints.length
    }

    const totalForRoute = data.statusCodeDistribution
      .filter((sc) => sc.httpRoute === route)
      .reduce((a, sc) => a + sc.requestCount, 0)

    const errorsForRoute = data.statusCodeDistribution
      .filter((sc) => sc.httpRoute === route && sc.statusCode.startsWith('5'))
      .reduce((a, sc) => a + sc.requestCount, 0)

    return {
      route,
      avgLatency: avg(data.latencyP50ByRoute, route),
      p99Latency: findLast(data.latencyP99ByRoute, route),
      errorRate: totalForRoute > 0 ? errorsForRoute / totalForRoute : 0,
      rps: findLast(data.throughputByRoute, route),
    }
  })
}

export default function ApiMetricsTab({ serviceId, serviceName, params }: Props) {
  const [data, setData] = useState<ApiMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('errorRate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await metricsService.getApiMetrics(serviceId, params)
      setData(resp)
      setSelectedRoute(null)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to load API metrics'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [serviceId, params.range]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  const endpointSummaries = useMemo(() => {
    if (!data) return []
    const summaries = buildEndpointSummary(data)
    return summaries.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [data, sortField, sortDir])

  const filteredSummaries = useMemo(() => {
    if (!searchQuery.trim()) return endpointSummaries
    const q = searchQuery.toLowerCase()
    return endpointSummaries.filter((ep) => ep.route.toLowerCase().includes(q))
  }, [endpointSummaries, searchQuery])

  const paginatedSummaries = useMemo(() => {
    const start = page * rowsPerPage
    return filteredSummaries.slice(start, start + rowsPerPage)
  }, [filteredSummaries, page, rowsPerPage])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setPage(0)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Skeleton variant="rounded" height={300} />
        <Skeleton variant="rounded" height={300} />
      </Box>
    )
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
  }

  if (!data || endpointSummaries.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No API-level metrics available. Ensure {serviceName} has OTel SDK auto-instrumentation emitting per-route metrics.
        </Typography>
      </Paper>
    )
  }

  // ── Per-route detail charts ─────────────────────────────────────────────────
  const routeFilter = (list: TimeSeries[], route: string) =>
    list.find((s) => (s.labels?.http_route ?? s.name) === route) ?? null

  const selectedLatencyData = selectedRoute
    ? mergeTimeSeries(
        [
          routeFilter(data.latencyP50ByRoute, selectedRoute),
          routeFilter(data.latencyP95ByRoute, selectedRoute),
          routeFilter(data.latencyP99ByRoute, selectedRoute),
        ],
        ['P50', 'P95', 'P99'],
      )
    : []

  const selectedThroughputData = selectedRoute
    ? mergeTimeSeries(
        [routeFilter(data.throughputByRoute, selectedRoute)],
        ['RPS'],
      )
    : []

  const selectedStatusCodes = selectedRoute
    ? data.statusCodeDistribution
        .filter((sc) => sc.httpRoute === selectedRoute)
        .sort((a, b) => a.statusCode.localeCompare(b.statusCode))
    : data.statusCodeDistribution.reduce<StatusCodeGroup[]>((acc, sc) => {
        const existing = acc.find((a) => a.statusCode === sc.statusCode)
        if (existing) {
          existing.requestCount += sc.requestCount
        } else {
          acc.push({ ...sc, httpRoute: 'all' })
        }
        return acc
      }, []).sort((a, b) => a.statusCode.localeCompare(b.statusCode))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Endpoint summary table ────────────────────────────────────── */}
      <Paper variant="outlined">
        <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              API Endpoints
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Click a row to view detailed charts for that endpoint.
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder="Search routes..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  /
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 240 }}
          />
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'route'}
                    direction={sortField === 'route' ? sortDir : 'asc'}
                    onClick={() => handleSort('route')}
                  >
                    Route
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortField === 'avgLatency'}
                    direction={sortField === 'avgLatency' ? sortDir : 'asc'}
                    onClick={() => handleSort('avgLatency')}
                  >
                    Avg Latency
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortField === 'p99Latency'}
                    direction={sortField === 'p99Latency' ? sortDir : 'asc'}
                    onClick={() => handleSort('p99Latency')}
                  >
                    P99 Latency
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortField === 'errorRate'}
                    direction={sortField === 'errorRate' ? sortDir : 'asc'}
                    onClick={() => handleSort('errorRate')}
                  >
                    Error Rate
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortField === 'rps'}
                    direction={sortField === 'rps' ? sortDir : 'asc'}
                    onClick={() => handleSort('rps')}
                  >
                    RPS
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedSummaries.length > 0 ? (
                paginatedSummaries.map((ep) => (
                  <TableRow
                    key={ep.route}
                    hover
                    selected={selectedRoute === ep.route}
                    onClick={() => setSelectedRoute(selectedRoute === ep.route ? null : ep.route)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontFamily="JetBrains Mono, monospace" fontSize="0.8125rem">
                        {ep.route}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{formatLatency(ep.avgLatency)}</TableCell>
                    <TableCell align="right">{formatLatency(ep.p99Latency)}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={formatPercent(ep.errorRate)}
                        size="small"
                        color={ep.errorRate > 0.05 ? 'error' : ep.errorRate > 0.01 ? 'warning' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">{formatNumber(ep.rps)} req/s</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      No endpoints matching "{searchQuery}"
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredSummaries.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10))
            setPage(0)
          }}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Paper>

      {/* ── Detail charts ─────────────────────────────────────────────── */}
      <Typography variant="subtitle1" fontWeight={600}>
        {selectedRoute ? `Endpoint: ${selectedRoute}` : 'All Endpoints (Aggregated)'}
      </Typography>

      {/* Latency chart */}
      {selectedRoute && selectedLatencyData.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Latency (P50 / P95 / P99)
          </Typography>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={selectedLatencyData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tickFormatter={(v) => formatLatency(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip
                labelFormatter={(label) => formatDateTime(label as number)}
                formatter={(value: unknown, name: unknown) => [formatLatency(value as number), name as string]}
              />
              <Legend />
              <Line type="monotone" dataKey="P50" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P95" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="P99" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Status code distribution */}
      {selectedStatusCodes.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Status Code Distribution
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={selectedStatusCodes} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="statusCode" tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={60} />
              <Tooltip formatter={(value: unknown) => [formatNumber(value as number), 'Requests']} />
              <Bar dataKey="requestCount" name="Requests" radius={[4, 4, 0, 0]}>
                {selectedStatusCodes.map((entry, i) => (
                  <Cell key={i} fill={statusCodeColor(entry.statusCode)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Throughput chart */}
      {selectedRoute && selectedThroughputData.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Throughput (RPS)
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={selectedThroughputData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={60} />
              <Tooltip
                labelFormatter={(label) => formatDateTime(label as number)}
                formatter={(value: unknown, name: unknown) => [`${formatNumber(value as number)} req/s`, name as string]}
              />
              <Area type="monotone" dataKey="RPS" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Paper>
      )}
    </Box>
  )
}
