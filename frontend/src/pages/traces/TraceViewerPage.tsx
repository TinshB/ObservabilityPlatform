import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Autocomplete,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  Alert,
  Skeleton,
  Tooltip,
  CircularProgress,
  LinearProgress,
  Button,
  IconButton,
  MenuItem,
  Popover,
} from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import dayjs, { type Dayjs } from 'dayjs'
import type { Service, TimeRangePreset, TraceSummary, TraceSearchParams } from '@/types'
import * as serviceService from '@/services/serviceService'
import * as metricsService from '@/services/metricsService'
import * as traceService   from '@/services/traceService'

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_RANGE = 'LAST_1H'
const DEFAULT_LIMIT = 20

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Format microseconds to a human-readable duration string. */
function formatDuration(micros: number): string {
  if (micros < 1000) return `${micros}µs`
  if (micros < 1_000_000) return `${(micros / 1000).toFixed(1)}ms`
  return `${(micros / 1_000_000).toFixed(2)}s`
}

/** Format ISO timestamp to short locale string. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  } as Intl.DateTimeFormatOptions)
}

// ── Duration bar ────────────────────────────────────────────────────────────

function DurationBar({ durationMicros, maxDuration, hasError }: {
  durationMicros: number
  maxDuration: number
  hasError: boolean
}) {
  const pct = maxDuration > 0 ? Math.max((durationMicros / maxDuration) * 100, 2) : 2

  return (
    <Tooltip title={formatDuration(durationMicros)} arrow>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
        <Box sx={{ flexGrow: 1, position: 'relative' }}>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: 'action.disabledBackground',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundColor: hasError ? 'error.main' : 'primary.main',
              },
            }}
          />
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.75rem',
            minWidth: 60,
            textAlign: 'right',
          }}
        >
          {formatDuration(durationMicros)}
        </Typography>
      </Box>
    </Tooltip>
  )
}

// ── Error indicator ─────────────────────────────────────────────────────────

function ErrorIndicator({ errorCount, spanCount }: { errorCount: number; spanCount: number }) {
  if (errorCount === 0) {
    return (
      <Tooltip title="No errors">
        <CheckCircleOutlineIcon sx={{ fontSize: 18, color: 'success.main' }} />
      </Tooltip>
    )
  }
  return (
    <Tooltip title={`${errorCount} error span${errorCount > 1 ? 's' : ''} / ${spanCount} total`}>
      <Chip
        icon={<ErrorOutlineIcon sx={{ fontSize: 14 }} />}
        label={errorCount}
        size="small"
        color="error"
        sx={{ fontWeight: 600, fontSize: '0.75rem' }}
      />
    </Tooltip>
  )
}

// ── Main page component ─────────────────────────────────────────────────────

export default function TraceViewerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // ── Services ────────────────────────────────────────────────────────────
  const [services, setServices]             = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  // ── Operations (Story 7.3) ──────────────────────────────────────────────
  const [operations, setOperations]           = useState<string[]>([])
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null)

  // ── Time range ──────────────────────────────────────────────────────────
  const [presets, setPresets]           = useState<TimeRangePreset[]>([])
  const [selectedRange, setSelectedRange] = useState(
    searchParams.get('range') || DEFAULT_RANGE,
  )

  // ── Custom date range (calendar popover — same as Workflow Dashboard) ──
  const [customRange, setCustomRange]       = useState<{ start: Date; end: Date } | null>(null)
  const [timeLabel, setTimeLabel]           = useState('Last 1 hour')
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(null)
  const [pickerStart, setPickerStart]       = useState<Dayjs | null>(null)
  const [pickerEnd, setPickerEnd]           = useState<Dayjs | null>(null)

  // ── Duration filters ────────────────────────────────────────────────────
  const [minDuration, setMinDuration] = useState(searchParams.get('minDuration') || '')
  const [maxDuration, setMaxDuration] = useState(searchParams.get('maxDuration') || '')

  // ── Limit / pagination ──────────────────────────────────────────────────
  const [limit, setLimit] = useState(DEFAULT_LIMIT)

  // ── Trace data ──────────────────────────────────────────────────────────
  const [traces, setTraces]     = useState<TraceSummary[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)

  // ── Snackbar ────────────────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState<{
    open: boolean; message: string; severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'info' })

  // ── Load services + presets on mount ──────────────────────────────────
  useEffect(() => {
    async function loadServices() {
      try {
        const result = await serviceService.getServices({ size: 200, active: true })
        setServices(result.content)

        const urlServiceId = searchParams.get('service')
        if (urlServiceId) {
          const match = result.content.find((s) => s.id === urlServiceId)
          if (match) setSelectedService(match)
        }
      } catch {
        setSnackbar({ open: true, message: 'Failed to load services', severity: 'error' })
      } finally {
        setServicesLoading(false)
      }
    }

    async function loadPresets() {
      try {
        setPresets(await metricsService.getTimeRangePresets())
      } catch {
        setPresets([
          { key: 'LAST_15M', label: 'Last 15 minutes', durationSeconds: 900,     stepSeconds: 15,    rateWindow: '1m' },
          { key: 'LAST_1H',  label: 'Last 1 hour',     durationSeconds: 3600,    stepSeconds: 30,    rateWindow: '2m' },
          { key: 'LAST_3H',  label: 'Last 3 hours',    durationSeconds: 10800,   stepSeconds: 60,    rateWindow: '5m' },
          { key: 'LAST_6H',  label: 'Last 6 hours',    durationSeconds: 21600,   stepSeconds: 120,   rateWindow: '5m' },
          { key: 'LAST_12H', label: 'Last 12 hours',   durationSeconds: 43200,   stepSeconds: 300,   rateWindow: '10m' },
          { key: 'LAST_24H', label: 'Last 24 hours',   durationSeconds: 86400,   stepSeconds: 600,   rateWindow: '15m' },
          { key: 'LAST_3D',  label: 'Last 3 days',     durationSeconds: 259200,  stepSeconds: 1800,  rateWindow: '30m' },
          { key: 'LAST_7D',  label: 'Last 7 days',     durationSeconds: 604800,  stepSeconds: 3600,  rateWindow: '1h' },
          { key: 'LAST_30D', label: 'Last 30 days',    durationSeconds: 2592000, stepSeconds: 14400, rateWindow: '4h' },
        ])
      }
    }

    loadServices()
    loadPresets()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load operations when service changes ──────────────────────────────
  useEffect(() => {
    if (!selectedService) {
      setOperations([])
      setSelectedOperation(null)
      return
    }

    let cancelled = false
    async function loadOps() {
      try {
        const ops = await traceService.getServiceOperations(selectedService!.id)
        if (!cancelled) setOperations(ops)
      } catch {
        if (!cancelled) setOperations([])
      }
    }
    loadOps()
    return () => { cancelled = true }
  }, [selectedService])

  // ── Fetch traces ──────────────────────────────────────────────────────
  const fetchTraces = useCallback(async () => {
    if (!selectedService) {
      setTraces([])
      setTotal(0)
      return
    }

    setLoading(true)
    try {
      const params: TraceSearchParams = { limit }

      if (customRange) {
        params.start = customRange.start.toISOString()
        params.end   = customRange.end.toISOString()
      } else {
        params.range = selectedRange
      }

      if (selectedOperation) params.operation = selectedOperation
      if (minDuration.trim()) params.minDuration = minDuration.trim()
      if (maxDuration.trim()) params.maxDuration = maxDuration.trim()

      const result = await traceService.getServiceTraces(selectedService.id, params)
      setTraces(result.traces)
      setTotal(result.total)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load traces', severity: 'error' })
      setTraces([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [selectedService, selectedOperation, selectedRange, customRange, minDuration, maxDuration, limit])

  useEffect(() => {
    fetchTraces()
  }, [fetchTraces])

  // ── URL sync ────────────────────────────────────────────────────────────
  const syncUrl = useCallback(
    (svc: Service | null, range: string) => {
      const params: Record<string, string> = {}
      if (svc) params.service = svc.id
      params.range = range
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleServiceChange = (_: unknown, svc: Service | null) => {
    setSelectedService(svc)
    setSelectedOperation(null)
    syncUrl(svc, selectedRange)
  }

  const handleRangeChange = (range: string) => {
    setSelectedRange(range)
    setCustomRange(null)
    const preset = presets.find(p => p.key === range)
    setTimeLabel(preset?.label ?? range)
    syncUrl(selectedService, range)
  }

  const rangeSeconds = useMemo(() => {
    if (customRange) {
      return Math.round((customRange.end.getTime() - customRange.start.getTime()) / 1000)
    }
    return presets.find(p => p.key === selectedRange)?.durationSeconds ?? 3600
  }, [selectedRange, customRange, presets])

  const handleApplyCustomRange = () => {
    if (!pickerStart || !pickerEnd || !pickerStart.isBefore(pickerEnd)) return
    setCustomRange({ start: pickerStart.toDate(), end: pickerEnd.toDate() })
    setSelectedRange('')
    setTimeLabel(`${pickerStart.format('MMM D, HH:mm')} — ${pickerEnd.format('MMM D, HH:mm')}`)
    setCalendarAnchor(null)
  }

  const calendarOpen = Boolean(calendarAnchor)

  const handleTraceClick = (traceId: string) => {
    // Carry service + range context so breadcrumb back-nav preserves filters
    const params = new URLSearchParams()
    if (selectedService) params.set('service', selectedService.id)
    if (selectedRange) params.set('range', selectedRange)
    const qs = params.toString()
    navigate(`/traces/${encodeURIComponent(traceId)}${qs ? `?${qs}` : ''}`)
  }

  const handleLoadMore = () => {
    setLimit((prev) => prev + 20)
  }

  // Max duration for bar scaling
  const maxDurationValue = traces.length > 0
    ? Math.max(...traces.map((t) => t.durationMicros))
    : 1

  return (
    <Box>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Trace Viewer
      </Typography>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Service selector */}
        <Autocomplete
          sx={{ minWidth: 260, flexGrow: 1, maxWidth: 400 }}
          options={services}
          loading={servicesLoading}
          value={selectedService}
          onChange={handleServiceChange}
          getOptionLabel={(s) => s.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography variant="body2" fontWeight={500}>{option.name}</Typography>
                <Chip label={option.environment} size="small" sx={{ ml: 'auto' }}
                  color={option.environment === 'production' ? 'error'
                    : option.environment === 'staging' ? 'warning' : 'success'}
                />
              </Box>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Service"
              placeholder="Select a service..."
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {servicesLoading ? <CircularProgress size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        {/* Operation filter (Story 7.3) */}
        <Autocomplete
          sx={{ minWidth: 240 }}
          options={operations}
          value={selectedOperation}
          onChange={(_, op) => setSelectedOperation(op)}
          disabled={!selectedService || operations.length === 0}
          renderInput={(params) => (
            <TextField {...params} label="Operation / Endpoint" placeholder="All operations" />
          )}
        />

        {/* Time range — dropdown + custom calendar */}
        <TextField
          select
          label="Time Range"
          size="small"
          sx={{ minWidth: 170 }}
          value={customRange ? '__CUSTOM__' : selectedRange}
          onChange={(e) => {
            if (e.target.value !== '__CUSTOM__') handleRangeChange(e.target.value)
          }}
        >
          {presets.map((p) => (
            <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>
          ))}
          {customRange && (
            <MenuItem value="__CUSTOM__">{timeLabel}</MenuItem>
          )}
        </TextField>

        {/* Calendar button for custom date range */}
        <Tooltip title="Pick custom date range">
          <IconButton
            size="small"
            onClick={(e: React.MouseEvent<HTMLElement>) => {
              setPickerStart(customRange ? dayjs(customRange.start) : dayjs().subtract(rangeSeconds, 'second'))
              setPickerEnd(customRange ? dayjs(customRange.end) : dayjs())
              setCalendarAnchor(e.currentTarget)
            }}
          >
            <CalendarMonthIcon />
          </IconButton>
        </Tooltip>

        {/* Duration filters */}
        <TextField
          sx={{ width: 120 }}
          label="Min Duration"
          placeholder="e.g. 100ms"
          value={minDuration}
          onChange={(e) => setMinDuration(e.target.value)}
          size="small"
        />
        <TextField
          sx={{ width: 120 }}
          label="Max Duration"
          placeholder="e.g. 5s"
          value={maxDuration}
          onChange={(e) => setMaxDuration(e.target.value)}
          size="small"
        />
      </Paper>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {!selectedService ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select a service to view traces
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Use the service selector above to choose a registered service and explore its distributed traces.
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Results summary */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {loading ? 'Loading traces...' : `${traces.length} trace${traces.length !== 1 ? 's' : ''} returned`}
              {total > 0 && !loading && ` (${total} total)`}
            </Typography>
          </Box>

          {/* Trace list table */}
          <Paper variant="outlined">
            <TableContainer sx={{ maxHeight: 'calc(100vh - 360px)' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, minWidth: 180 }}>Trace ID</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 130 }}>Root Service</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 160 }}>Root Operation</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>Start Time</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 200 }}>Duration</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 70 }} align="center">Spans</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 70 }} align="center">Errors</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 160 }}>Services</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton variant="text" width={120} /></TableCell>
                        <TableCell><Skeleton variant="text" width={100} /></TableCell>
                        <TableCell><Skeleton variant="text" width={130} /></TableCell>
                        <TableCell><Skeleton variant="text" width={110} /></TableCell>
                        <TableCell><Skeleton variant="rounded" width={180} height={8} /></TableCell>
                        <TableCell align="center"><Skeleton variant="text" width={30} /></TableCell>
                        <TableCell align="center"><Skeleton variant="circular" width={18} height={18} /></TableCell>
                        <TableCell><Skeleton variant="text" width={100} /></TableCell>
                      </TableRow>
                    ))
                  ) : traces.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography variant="body1" color="text.secondary">
                          No traces found
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Try adjusting your filters, time range, or duration thresholds
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    traces.map((trace) => (
                      <TableRow
                        key={trace.traceId}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleTraceClick(trace.traceId)}
                      >
                        {/* Trace ID */}
                        <TableCell
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.8rem',
                            color: 'primary.main',
                          }}
                        >
                          <Tooltip title="View trace detail" arrow>
                            <span>{trace.traceId.substring(0, 16)}...</span>
                          </Tooltip>
                        </TableCell>

                        {/* Root service */}
                        <TableCell sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {trace.rootService}
                        </TableCell>

                        {/* Root operation */}
                        <TableCell
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.8rem',
                            maxWidth: 220,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Tooltip title={trace.rootOperation} arrow>
                            <span>{trace.rootOperation}</span>
                          </Tooltip>
                        </TableCell>

                        {/* Start time */}
                        <TableCell
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatTime(trace.startTime)}
                        </TableCell>

                        {/* Duration bar */}
                        <TableCell>
                          <DurationBar
                            durationMicros={trace.durationMicros}
                            maxDuration={maxDurationValue}
                            hasError={trace.errorCount > 0}
                          />
                        </TableCell>

                        {/* Span count */}
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight={500}>
                            {trace.spanCount}
                          </Typography>
                        </TableCell>

                        {/* Error indicator */}
                        <TableCell align="center">
                          <ErrorIndicator errorCount={trace.errorCount} spanCount={trace.spanCount} />
                        </TableCell>

                        {/* Services */}
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {trace.services.slice(0, 3).map((svc) => (
                              <Chip
                                key={svc}
                                label={svc}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            ))}
                            {trace.services.length > 3 && (
                              <Chip
                                label={`+${trace.services.length - 3}`}
                                size="small"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Load more */}
            {!loading && traces.length > 0 && traces.length >= limit && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <Button variant="outlined" size="small" onClick={handleLoadMore}>
                  Load more traces
                </Button>
              </Box>
            )}
          </Paper>
        </>
      )}

      {/* ── Calendar Popover (same as Workflow Dashboard) ─────────────── */}
      <Popover
        open={calendarOpen}
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
            <DateTimePicker
              label="From"
              value={pickerStart}
              onChange={(v) => setPickerStart(v)}
              maxDateTime={pickerEnd ?? undefined}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
            <DateTimePicker
              label="To"
              value={pickerEnd}
              onChange={(v) => setPickerEnd(v)}
              minDateTime={pickerStart ?? undefined}
              maxDateTime={dayjs()}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
            <Button
              variant="contained"
              size="small"
              fullWidth
              onClick={handleApplyCustomRange}
              disabled={!pickerStart || !pickerEnd || !pickerStart.isBefore(pickerEnd)}
            >
              Apply Range
            </Button>
          </Box>
        </LocalizationProvider>
      </Popover>

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
