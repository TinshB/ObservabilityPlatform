import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tooltip,
  Skeleton,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import type { ApmOverviewResponse, ApmServiceHealthSummary, TimeRangePreset } from '@/types'
import * as serviceDeepDiveService from '@/services/serviceDeepDiveService'
import * as metricsService from '@/services/metricsService'

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_RANGE = 'LAST_1H'

const HEALTH_COLORS: Record<string, string> = {
  healthy:   '#2e7d32',
  degraded:  '#ed6c02',
  unhealthy: '#d32f2f',
  unknown:   '#9e9e9e',
}

const HEALTH_TOOLTIPS: Record<string, string> = {
  healthy:   'Service is operating normally — error rate is below threshold, latency is within acceptable limits, and all health checks are passing.',
  degraded:  'Service is experiencing partial issues — elevated error rates or increased latency detected, but still serving traffic. Requires attention to prevent further deterioration.',
  unhealthy: 'Service is critically impaired — error rate or latency has exceeded critical thresholds, or key health checks are failing. Immediate investigation is recommended.',
  unknown:   'Health status cannot be determined — the service may not be reporting metrics, is newly registered, or telemetry data is unavailable for the selected time range.',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatLatency(seconds: number | null): string {
  if (seconds == null) return '—'
  if (seconds < 0.001) return `${(seconds * 1_000_000).toFixed(0)}µs`
  if (seconds < 1) return `${(seconds * 1000).toFixed(1)}ms`
  return `${seconds.toFixed(2)}s`
}

function formatRate(rate: number | null): string {
  if (rate == null) return '—'
  return `${rate.toFixed(1)}/s`
}

function formatPercent(value: number | null): string {
  if (value == null) return '—'
  return `${(value * 100).toFixed(2)}%`
}

function healthIcon(status: string, size = 18) {
  switch (status) {
    case 'healthy':   return <CheckCircleOutlineIcon sx={{ fontSize: size, color: HEALTH_COLORS.healthy }} />
    case 'degraded':  return <WarningAmberIcon sx={{ fontSize: size, color: HEALTH_COLORS.degraded }} />
    case 'unhealthy': return <ErrorOutlineIcon sx={{ fontSize: size, color: HEALTH_COLORS.unhealthy }} />
    default:          return <HelpOutlineIcon sx={{ fontSize: size, color: HEALTH_COLORS.unknown }} />
  }
}

function healthChipColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'healthy': return 'success'
    case 'degraded': return 'warning'
    case 'unhealthy': return 'error'
    default: return 'default'
  }
}

// ── Summary stat card ───────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 140, flex: 1, textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
      <Typography
        variant="h4"
        fontWeight={700}
        sx={{ fontFamily: '"JetBrains Mono", monospace', mt: 0.5, color: color || 'text.primary' }}
      >
        {value}
      </Typography>
    </Paper>
  )
}

// ── Health distribution pie chart ────────────────────────────────────────────

function HealthPieChart({ distribution }: { distribution: Record<string, number> }) {
  const chartData = Object.entries(distribution)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ name: status, value: count }))

  if (chartData.length === 0) return null

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ width: 120, height: 120 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={50}
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={HEALTH_COLORS[entry.name] || '#9e9e9e'} />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value, name) => [`${value} services`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Health Distribution</Typography>
        {Object.entries(distribution).map(([status, count]) => (
          <Tooltip
            key={status}
            title={HEALTH_TOOLTIPS[status] || `Status: ${status}`}
            arrow
            placement="right"
            slotProps={{ tooltip: { sx: { maxWidth: 280, fontSize: '0.75rem', lineHeight: 1.5 } } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3, cursor: 'help' }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: HEALTH_COLORS[status] || '#9e9e9e' }} />
              <Typography variant="caption" sx={{ textTransform: 'capitalize', minWidth: 70 }}>{status}</Typography>
              <Typography variant="caption" fontWeight={600}>{count}</Typography>
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Paper>
  )
}

// ── Service health grid card ────────────────────────────────────────────────

function ServiceHealthCard({ svc, onClick }: { svc: ApmServiceHealthSummary; onClick: () => void }) {
  const pct = Math.round(svc.healthScore * 100)

  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 2 },
        borderLeft: 4,
        borderLeftColor: HEALTH_COLORS[svc.healthStatus] || HEALTH_COLORS.unknown,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {healthIcon(svc.healthStatus, 16)}
        <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flex: 1 }}>
          {svc.serviceName}
        </Typography>
        <Chip
          label={svc.environment}
          size="small"
          color={svc.environment === 'production' ? 'error'
            : svc.environment === 'staging' ? 'warning' : 'success'}
          sx={{ fontSize: '0.65rem', height: 18 }}
        />
      </Box>

      {/* Health bar */}
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 4,
          borderRadius: 2,
          mb: 1,
          backgroundColor: 'action.disabledBackground',
          '& .MuiLinearProgress-bar': {
            borderRadius: 2,
            backgroundColor: HEALTH_COLORS[svc.healthStatus] || HEALTH_COLORS.unknown,
          },
        }}
      />

      {/* Metrics row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          P95: <strong>{formatLatency(svc.latencyP95)}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Err: <strong>{formatPercent(svc.errorRate)}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          RPS: <strong>{formatRate(svc.requestRate)}</strong>
        </Typography>
      </Box>
    </Paper>
  )
}

// ── Top unhealthy services table ────────────────────────────────────────────

function TopUnhealthyTable({ services, onServiceClick }: {
  services: ApmServiceHealthSummary[]
  onServiceClick: (id: string) => void
}) {
  if (services.length === 0) {
    return (
      <Typography variant="body2" color="success.main" sx={{ py: 2, textAlign: 'center' }}>
        All services are healthy
      </Typography>
    )
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Service</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Environment</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="center">Health</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">P95 Latency</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">Error Rate</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">RPS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {services.map((svc) => (
            <TableRow
              key={svc.serviceId}
              hover
              sx={{ cursor: 'pointer' }}
              onClick={() => onServiceClick(svc.serviceId)}
            >
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {healthIcon(svc.healthStatus, 16)}
                  <Typography variant="body2" fontWeight={500}>{svc.serviceName}</Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Chip
                  label={svc.environment}
                  size="small"
                  color={svc.environment === 'production' ? 'error'
                    : svc.environment === 'staging' ? 'warning' : 'success'}
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              </TableCell>
              <TableCell align="center">
                <Chip
                  label={`${Math.round(svc.healthScore * 100)}%`}
                  size="small"
                  color={healthChipColor(svc.healthStatus)}
                  sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                />
              </TableCell>
              <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' }}>
                {formatLatency(svc.latencyP95)}
              </TableCell>
              <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' }}>
                {formatPercent(svc.errorRate)}
              </TableCell>
              <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' }}>
                {formatRate(svc.requestRate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// ── Service list table (all services) ───────────────────────────────────────

function ServiceListTable({ services, onServiceClick }: {
  services: ApmServiceHealthSummary[]
  onServiceClick: (id: string) => void
}) {
  return (
    <TableContainer sx={{ maxHeight: 'calc(100vh - 500px)' }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Service</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Environment</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Team</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="center">Health</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">P95 Latency</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">Error Rate</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">RPS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {services.map((svc) => (
            <TableRow
              key={svc.serviceId}
              hover
              sx={{ cursor: 'pointer' }}
              onClick={() => onServiceClick(svc.serviceId)}
            >
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {healthIcon(svc.healthStatus, 16)}
                  <Typography variant="body2" fontWeight={500}>{svc.serviceName}</Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Chip
                  label={svc.environment}
                  size="small"
                  color={svc.environment === 'production' ? 'error'
                    : svc.environment === 'staging' ? 'warning' : 'success'}
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">{svc.ownerTeam}</Typography>
              </TableCell>
              <TableCell align="center">
                <Tooltip title={`${svc.healthStatus} (${Math.round(svc.healthScore * 100)}%)`} arrow>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.round(svc.healthScore * 100)}
                      sx={{
                        width: 50,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'action.disabledBackground',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          backgroundColor: HEALTH_COLORS[svc.healthStatus] || HEALTH_COLORS.unknown,
                        },
                      }}
                    />
                    <Typography variant="caption" fontWeight={600} sx={{ minWidth: 28 }}>
                      {Math.round(svc.healthScore * 100)}
                    </Typography>
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' }}>
                {formatLatency(svc.latencyP95)}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.8rem',
                  color: svc.errorRate != null && svc.errorRate > 0.05 ? 'error.main' : 'text.primary',
                  fontWeight: svc.errorRate != null && svc.errorRate > 0.05 ? 700 : 400,
                }}
              >
                {formatPercent(svc.errorRate)}
              </TableCell>
              <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' }}>
                {formatRate(svc.requestRate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// ── Main page component ─────────────────────────────────────────────────────

export default function ApmOverviewPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [selectedRange, setSelectedRange] = useState(searchParams.get('range') || DEFAULT_RANGE)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    (searchParams.get('view') as 'grid' | 'list') || 'grid',
  )
  const [presets, setPresets] = useState<TimeRangePreset[]>([])
  const [data, setData] = useState<ApmOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [snackbar, setSnackbar] = useState<{
    open: boolean; message: string; severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'info' })

  // Load presets
  useEffect(() => {
    async function loadPresets() {
      try {
        setPresets(await metricsService.getTimeRangePresets())
      } catch {
        setPresets([
          { key: 'LAST_15M', label: 'Last 15 minutes', durationSeconds: 900, stepSeconds: 15, rateWindow: '1m' },
          { key: 'LAST_1H', label: 'Last 1 hour', durationSeconds: 3600, stepSeconds: 30, rateWindow: '2m' },
          { key: 'LAST_6H', label: 'Last 6 hours', durationSeconds: 21600, stepSeconds: 120, rateWindow: '5m' },
          { key: 'LAST_24H', label: 'Last 24 hours', durationSeconds: 86400, stepSeconds: 600, rateWindow: '15m' },
          { key: 'LAST_7D', label: 'Last 7 days', durationSeconds: 604800, stepSeconds: 3600, rateWindow: '1h' },
        ])
      }
    }
    loadPresets()
  }, [])

  // Fetch overview
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await serviceDeepDiveService.getApmOverview({ range: selectedRange })
      setData(result)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load APM overview', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [selectedRange])

  useEffect(() => { fetchData() }, [fetchData])

  // URL sync
  const syncUrl = (range: string, view: string) => {
    const params: Record<string, string> = {}
    if (range !== DEFAULT_RANGE) params.range = range
    if (view !== 'grid') params.view = view
    setSearchParams(params, { replace: true })
  }

  const handleRangeChange = (range: string) => {
    setSelectedRange(range)
    syncUrl(range, viewMode)
  }

  const handleViewChange = (_: unknown, view: 'grid' | 'list' | null) => {
    if (view) {
      setViewMode(view)
      syncUrl(selectedRange, view)
    }
  }

  const handleServiceClick = (serviceId: string) => {
    navigate(`/services/${serviceId}`)
  }

  // Derived stats
  const globalErrorRate = data
    ? data.services.filter((s) => s.errorRate != null).reduce((sum, s) => sum + (s.errorRate ?? 0), 0)
      / Math.max(data.services.filter((s) => s.errorRate != null).length, 1)
    : null
  const globalRps = data
    ? data.services.reduce((sum, s) => sum + (s.requestRate ?? 0), 0)
    : null

  return (
    <Box>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          APM Overview
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewChange}
            size="small"
          >
            <ToggleButton value="grid"><GridViewIcon sx={{ fontSize: 18 }} /></ToggleButton>
            <ToggleButton value="list"><ViewListIcon sx={{ fontSize: 18 }} /></ToggleButton>
          </ToggleButtonGroup>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={selectedRange}
              label="Time Range"
              onChange={(e) => handleRangeChange(e.target.value)}
            >
              {presets.map((p) => (
                <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* ── Summary stats ────────────────────────────────────────────────── */}
      {loading ? (
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" sx={{ flex: 1, height: 90 }} />
          ))}
        </Box>
      ) : data ? (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <StatCard label="Total Services" value={data.totalServices} />
          <StatCard
            label="Avg Error Rate"
            value={formatPercent(globalErrorRate)}
            color={globalErrorRate != null && globalErrorRate > 0.05 ? '#d32f2f' : undefined}
          />
          <StatCard label="Total Throughput" value={formatRate(globalRps)} />
          <HealthPieChart distribution={data.healthDistribution} />
        </Box>
      ) : null}

      {/* ── Signal counts ────────────────────────────────────────────────── */}
      {data && (
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          <Chip
            label={`${data.signalCounts.metricsEnabled} metrics-enabled`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`${data.signalCounts.logsEnabled} logs-enabled`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`${data.signalCounts.tracesEnabled} traces-enabled`}
            size="small"
            variant="outlined"
          />
        </Box>
      )}

      {/* ── Top unhealthy ────────────────────────────────────────────────── */}
      {data && data.topUnhealthy.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Top Unhealthy Services
          </Typography>
          <TopUnhealthyTable services={data.topUnhealthy} onServiceClick={handleServiceClick} />
        </Paper>
      )}

      {/* ── All services (grid or list) ──────────────────────────────────── */}
      {loading ? (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" width={280} height={100} />
          ))}
        </Box>
      ) : data && data.services.length > 0 ? (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              All Services ({data.services.length})
            </Typography>
          </Box>

          {viewMode === 'grid' ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
              {data.services.map((svc) => (
                <ServiceHealthCard
                  key={svc.serviceId}
                  svc={svc}
                  onClick={() => handleServiceClick(svc.serviceId)}
                />
              ))}
            </Box>
          ) : (
            <Paper variant="outlined">
              <ServiceListTable services={data.services} onServiceClick={handleServiceClick} />
            </Paper>
          )}
        </>
      ) : data ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No services registered
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Register services to see the APM overview.
          </Typography>
        </Paper>
      ) : null}

      {/* ── Snackbar ─────────────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
