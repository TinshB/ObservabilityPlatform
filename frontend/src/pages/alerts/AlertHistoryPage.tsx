import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Skeleton, Snackbar, Alert, TablePagination,
  TextField, MenuItem, Button, Card, CardContent, IconButton, Tooltip, Popover,
} from '@mui/material'
import RefreshIcon   from '@mui/icons-material/Refresh'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { useSearchParams } from 'react-router-dom'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import dayjs, { type Dayjs } from 'dayjs'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { Alert as AlertType, AlertState, AlertSeverity, AlertHistoryResponse, Service } from '@/types'
import * as alertService from '@/services/alertService'
import { getServices } from '@/services/serviceService'

// ── Constants ───────────────────────────────────────────────────────────────

const STATES: AlertState[]        = ['FIRING', 'PENDING', 'RESOLVED', 'OK']
const SEVERITIES: AlertSeverity[] = ['CRITICAL', 'WARNING', 'INFO']

const TIME_PRESETS = [
  { label: 'Last 1 hour',  value: '1h',  seconds: 3600 },
  { label: 'Last 6 hours', value: '6h',  seconds: 21600 },
  { label: 'Last 24 hours', value: '24h', seconds: 86400 },
  { label: 'Last 7 days',  value: '7d',  seconds: 604800 },
  { label: 'Last 30 days', value: '30d', seconds: 2592000 },
] as const

const STATE_COLORS: Record<string, string> = {
  FIRING:   '#d32f2f',
  PENDING:  '#ed6c02',
  RESOLVED: '#2e7d32',
  OK:       '#9e9e9e',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function severityColor(s: string): 'error' | 'warning' | 'info' | 'default' {
  if (s === 'CRITICAL') return 'error'
  if (s === 'WARNING') return 'warning'
  if (s === 'INFO') return 'info'
  return 'default'
}

function stateColor(s: string): 'error' | 'warning' | 'success' | 'default' {
  if (s === 'FIRING') return 'error'
  if (s === 'PENDING') return 'warning'
  if (s === 'RESOLVED') return 'success'
  return 'default'
}

function formatDate(iso?: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString()
}

/**
 * Bucket alerts by hour/day for the trend chart.
 */
function buildTrendData(alerts: AlertType[], rangeSeconds: number) {
  if (alerts.length === 0) return []

  // Use day buckets for ranges > 24h, hour buckets otherwise
  const useDay = rangeSeconds > 86400
  const bucketMap = new Map<string, { firing: number; pending: number; resolved: number; ok: number }>()

  for (const a of alerts) {
    const d = new Date(a.createdAt)
    const key = useDay
      ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

    if (!bucketMap.has(key)) {
      bucketMap.set(key, { firing: 0, pending: 0, resolved: 0, ok: 0 })
    }
    const bucket = bucketMap.get(key)!
    const state = a.state.toLowerCase() as 'firing' | 'pending' | 'resolved' | 'ok'
    if (state in bucket) bucket[state]++
  }

  return Array.from(bucketMap.entries()).map(([name, counts]) => ({ name, ...counts }))
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AlertHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Data
  const [historyData, setHistoryData] = useState<AlertHistoryResponse | null>(null)
  const [services, setServices]       = useState<Service[]>([])
  const [loading, setLoading]         = useState(true)

  // Pagination
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  // Filters
  const [timePreset, setTimePreset]         = useState(searchParams.get('range') || '24h')
  const [stateFilter, setStateFilter]       = useState(searchParams.get('state') || '')
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || '')
  const [serviceFilter, setServiceFilter]   = useState(searchParams.get('serviceId') || '')

  // Custom date range (calendar popover)
  const [customRange, setCustomRange]       = useState<{ start: Date; end: Date } | null>(null)
  const [timeLabel, setTimeLabel]           = useState('Last 24 hours')
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(null)
  const [pickerStart, setPickerStart]       = useState<Dayjs | null>(null)
  const [pickerEnd, setPickerEnd]           = useState<Dayjs | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' },
  )

  // Load services for filter dropdown
  useEffect(() => {
    getServices({ size: 200, active: true })
      .then(r => setServices(r.content))
      .catch(() => {})
  }, [])

  const rangeSeconds = useMemo(() => {
    if (customRange) return Math.round((customRange.end.getTime() - customRange.start.getTime()) / 1000)
    return TIME_PRESETS.find(p => p.value === timePreset)?.seconds ?? 86400
  }, [timePreset, customRange])

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const end   = customRange ? customRange.end.toISOString() : new Date().toISOString()
      const start = customRange ? customRange.start.toISOString() : new Date(Date.now() - rangeSeconds * 1000).toISOString()

      const result = await alertService.listAlertHistory({
        start,
        end,
        serviceId: serviceFilter || undefined,
        state:     stateFilter || undefined,
        severity:  severityFilter || undefined,
        page,
        size,
      })
      setHistoryData(result)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load alert history', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [rangeSeconds, customRange, serviceFilter, stateFilter, severityFilter, page, size])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {}
    if (timePreset !== '24h') params.range = timePreset
    if (stateFilter) params.state = stateFilter
    if (severityFilter) params.severity = severityFilter
    if (serviceFilter) params.serviceId = serviceFilter
    setSearchParams(params, { replace: true })
  }, [timePreset, stateFilter, severityFilter, serviceFilter, setSearchParams])

  const alerts       = historyData?.alerts?.content ?? []
  const totalElements = historyData?.alerts?.totalElements ?? 0
  const stateCounts  = historyData?.stateCounts ?? {}
  const totalAlerts  = historyData?.totalAlerts ?? 0

  const trendData = useMemo(() => buildTrendData(alerts, rangeSeconds), [alerts, rangeSeconds])

  return (
    <Box>
      {/* ── Header + Summary + Filters (sticky) ─────────────── */}
      <Box sx={{ position: 'sticky', top: 170, zIndex: 9, bgcolor: 'background.default', mx: -3, px: 3, pb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Historical alerts with trend analysis
        </Typography>
        <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={fetchHistory}>
          Refresh
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <SummaryCard label="Total Alerts" value={totalAlerts} />
        <SummaryCard label="Firing"   value={stateCounts['FIRING'] ?? 0}   color={STATE_COLORS.FIRING} />
        <SummaryCard label="Pending"  value={stateCounts['PENDING'] ?? 0}  color={STATE_COLORS.PENDING} />
        <SummaryCard label="Resolved" value={stateCounts['RESOLVED'] ?? 0} color={STATE_COLORS.RESOLVED} />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField label="Time Range" select size="small"
          value={customRange ? '__CUSTOM__' : timePreset} sx={{ minWidth: 170 }}
          onChange={(e) => {
            if (e.target.value !== '__CUSTOM__') {
              setTimePreset(e.target.value)
              setCustomRange(null)
              const preset = TIME_PRESETS.find(p => p.value === e.target.value)
              setTimeLabel(preset?.label ?? e.target.value)
              setPage(0)
            }
          }}>
          {TIME_PRESETS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          {customRange && <MenuItem value="__CUSTOM__">{timeLabel}</MenuItem>}
        </TextField>
        <Tooltip title="Pick custom date range">
          <IconButton size="small"
            onClick={(e: React.MouseEvent<HTMLElement>) => {
              setPickerStart(customRange ? dayjs(customRange.start) : dayjs().subtract(rangeSeconds, 'second'))
              setPickerEnd(customRange ? dayjs(customRange.end) : dayjs())
              setCalendarAnchor(e.currentTarget)
            }}>
            <CalendarMonthIcon />
          </IconButton>
        </Tooltip>
        <TextField label="Service" select value={serviceFilter} size="small" sx={{ minWidth: 180 }}
          onChange={(e) => { setServiceFilter(e.target.value); setPage(0) }}>
          <MenuItem value="">All Services</MenuItem>
          {services.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
        </TextField>
        <TextField label="State" select value={stateFilter} sx={{ minWidth: 140 }}
          onChange={(e) => { setStateFilter(e.target.value); setPage(0) }}>
          <MenuItem value="">All</MenuItem>
          {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField label="Severity" select value={severityFilter} sx={{ minWidth: 140 }}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(0) }}>
          <MenuItem value="">All</MenuItem>
          {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
      </Box>
      </Box>

      {/* ── Trend Chart ─────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <TrendingUpIcon fontSize="small" color="action" />
          <Typography variant="subtitle2" fontWeight={600}>Alerts Over Time</Typography>
        </Box>
        {loading ? (
          <Skeleton variant="rectangular" height={220} />
        ) : trendData.length === 0 ? (
          <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">No alert data in the selected range</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <RechartsTooltip />
              <Legend />
              <Bar dataKey="firing"   stackId="a" fill={STATE_COLORS.FIRING}   name="Firing" />
              <Bar dataKey="pending"  stackId="a" fill={STATE_COLORS.PENDING}  name="Pending" />
              <Bar dataKey="resolved" stackId="a" fill={STATE_COLORS.RESOLVED} name="Resolved" />
              <Bar dataKey="ok"       stackId="a" fill={STATE_COLORS.OK}       name="OK" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Paper>

      {/* ── Table ───────────────────────────────────────────────── */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 90 }}>State</TableCell>
              <TableCell sx={{ width: 100 }}>Severity</TableCell>
              <TableCell>Rule</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Fired At</TableCell>
              <TableCell>Resolved At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">
                    {stateFilter || severityFilter || serviceFilter
                      ? 'No alerts match the current filters.'
                      : 'No historical alerts in the selected time range.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : alerts.map((alert) => (
              <TableRow key={alert.id} hover>
                <TableCell sx={{ py: 0.5 }}><Chip label={alert.state} size="small" color={stateColor(alert.state)} sx={{ height: 22, fontSize: '0.75rem' }} /></TableCell>
                <TableCell sx={{ py: 0.5 }}><Chip label={alert.severity} size="small" color={severityColor(alert.severity)} sx={{ height: 22, fontSize: '0.75rem' }} /></TableCell>
                <TableCell>
                  <Typography fontWeight={600} fontSize="0.875rem">{alert.slaRuleName}</Typography>
                </TableCell>
                <TableCell>{alert.serviceName}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {alert.message || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {alert.evaluatedValue != null ? Number(alert.evaluatedValue).toFixed(4) : '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontSize="0.8rem">{formatDate(alert.createdAt)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontSize="0.8rem">{formatDate(alert.firedAt)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontSize="0.8rem">{formatDate(alert.resolvedAt)}</Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && totalElements > 0 && (
          <TablePagination
            component="div" count={totalElements} page={page} rowsPerPage={size}
            onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(+e.target.value); setPage(0) }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        )}
      </TableContainer>

      {/* ── Calendar Popover ──────────────────────────────────── */}
      <Popover
        open={Boolean(calendarAnchor)}
        anchorEl={calendarAnchor}
        onClose={() => setCalendarAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 2.5, width: 340 } } }}
      >
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1.5, display: 'block' }}>
            Custom Date &amp; Time Range
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <DateTimePicker label="From" value={pickerStart} onChange={(v) => setPickerStart(v)}
              maxDateTime={pickerEnd ?? undefined}
              slotProps={{ textField: { size: 'small', fullWidth: true } }} />
            <DateTimePicker label="To" value={pickerEnd} onChange={(v) => setPickerEnd(v)}
              minDateTime={pickerStart ?? undefined} maxDateTime={dayjs()}
              slotProps={{ textField: { size: 'small', fullWidth: true } }} />
            <Button variant="contained" size="small" fullWidth
              onClick={() => {
                if (!pickerStart || !pickerEnd || !pickerStart.isBefore(pickerEnd)) return
                setCustomRange({ start: pickerStart.toDate(), end: pickerEnd.toDate() })
                setTimePreset('')
                setTimeLabel(`${pickerStart.format('MMM D, HH:mm')} — ${pickerEnd.format('MMM D, HH:mm')}`)
                setCalendarAnchor(null)
                setPage(0)
              }}
              disabled={!pickerStart || !pickerEnd || !pickerStart.isBefore(pickerEnd)}>
              Apply Range
            </Button>
          </Box>
        </LocalizationProvider>
      </Popover>

      {/* ── Snackbar ────────────────────────────────────────────── */}
      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ── Summary Card sub-component ──────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 140, flex: '1 1 0' }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h5" fontWeight={700} sx={{ color: color ?? 'text.primary' }}>
          {value.toLocaleString()}
        </Typography>
      </CardContent>
    </Card>
  )
}
