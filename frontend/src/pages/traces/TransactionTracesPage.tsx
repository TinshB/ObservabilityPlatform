import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Snackbar,
  Alert,
  Skeleton,
  Tooltip,
  Button,
  IconButton,
  MenuItem,
  Popover,
  Checkbox,
  FormControlLabel,
  FormGroup,
  TextField,
} from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import dayjs, { type Dayjs } from 'dayjs'
import type { TraceSummary, TraceSearchParams, TimeRangePreset } from '@/types'
import * as traceService from '@/services/traceService'
import * as metricsService from '@/services/metricsService'
import { useCustomBreadcrumbs } from '@/hooks/useBreadcrumb'
import { formatDuration, formatTime, formatTracePath, formatTransaction } from '@/utils/traceUtils'

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20
const DEFAULT_RANGE = 'LAST_15M'

// ── Column definitions ──────────────────────────────────────────────────────

type ColumnKey = 'traceId' | 'rootService' | 'rootOperation' | 'startTime' | 'httpStatusCode' | 'duration' | 'spans' | 'errors' | 'services'
type SortDirection = 'asc' | 'desc'

interface ColumnDef {
  key: ColumnKey
  label: string
  sortable: boolean
  defaultVisible: boolean
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'traceId',        label: 'Trace ID',        sortable: false, defaultVisible: true },
  { key: 'rootService',    label: 'Root Service',    sortable: false, defaultVisible: true },
  { key: 'rootOperation',  label: 'Operation',        sortable: false, defaultVisible: true },
  { key: 'startTime',      label: 'Start Time',      sortable: true,  defaultVisible: true },
  { key: 'httpStatusCode', label: 'HTTP Status',     sortable: true,  defaultVisible: true },
  { key: 'duration',       label: 'Duration',        sortable: false, defaultVisible: true },
  { key: 'spans',          label: 'Spans',           sortable: false, defaultVisible: true },
  { key: 'errors',         label: 'Errors',          sortable: false, defaultVisible: true },
  { key: 'services',       label: 'Services',        sortable: false, defaultVisible: true },
]

const DEFAULT_VISIBLE = new Set<ColumnKey>(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))

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

export default function TransactionTracesPage() {
  const { operation } = useParams<{ operation: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const decodedOperation = decodeURIComponent(operation ?? '')

  const serviceId   = searchParams.get('service') ?? ''
  const serviceName = searchParams.get('serviceName') ?? ''

  // ── Time range ──────────────────────────────────────────────────────
  const [presets, setPresets]           = useState<TimeRangePreset[]>([])
  const [selectedRange, setSelectedRange] = useState(
    searchParams.get('range') || DEFAULT_RANGE,
  )
  const [customRange, setCustomRange]       = useState<{ start: Date; end: Date } | null>(null)
  const [timeLabel, setTimeLabel]           = useState('Last 15 minutes')
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(null)
  const [pickerStart, setPickerStart]       = useState<Dayjs | null>(null)
  const [pickerEnd, setPickerEnd]           = useState<Dayjs | null>(null)

  // Initialise from URL custom range params
  useEffect(() => {
    const urlStart = searchParams.get('start')
    const urlEnd   = searchParams.get('end')
    if (urlStart && urlEnd) {
      setCustomRange({ start: new Date(urlStart), end: new Date(urlEnd) })
      setSelectedRange('')
      setTimeLabel(`${dayjs(urlStart).format('MMM D, HH:mm')} — ${dayjs(urlEnd).format('MMM D, HH:mm')}`)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load presets
  useEffect(() => {
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
    loadPresets()
  }, [])

  const rangeSeconds = useMemo(() => {
    if (customRange) {
      return Math.round((customRange.end.getTime() - customRange.start.getTime()) / 1000)
    }
    return presets.find(p => p.key === selectedRange)?.durationSeconds ?? 900
  }, [selectedRange, customRange, presets])

  const handleRangeChange = (range: string) => {
    setSelectedRange(range)
    setCustomRange(null)
    const preset = presets.find(p => p.key === range)
    setTimeLabel(preset?.label ?? range)
  }

  const handleApplyCustomRange = () => {
    if (!pickerStart || !pickerEnd || !pickerStart.isBefore(pickerEnd)) return
    setCustomRange({ start: pickerStart.toDate(), end: pickerEnd.toDate() })
    setSelectedRange('')
    setTimeLabel(`${pickerStart.format('MMM D, HH:mm')} — ${pickerEnd.format('MMM D, HH:mm')}`)
    setCalendarAnchor(null)
  }

  const calendarOpen = Boolean(calendarAnchor)

  // ── Breadcrumb: Home → Transactions → <serviceName> → <operation> ──
  // Build time range query string for breadcrumb links
  const timeQs = useMemo(() => {
    if (customRange) {
      return `start=${customRange.start.toISOString()}&end=${customRange.end.toISOString()}`
    }
    if (selectedRange) return `range=${selectedRange}`
    return ''
  }, [selectedRange, customRange])

  useCustomBreadcrumbs(
    useMemo(() => {
      const svcParams = serviceId ? `service=${serviceId}` : ''
      const timeParam = timeQs ? `&${timeQs}` : ''
      const txnListQs = [svcParams, timeQs].filter(Boolean).join('&')

      const c = [
        { label: 'Home', path: '/home' },
        { label: 'Transactions', path: `/transactions${txnListQs ? `?${txnListQs}` : ''}` },
      ]
      if (serviceName) {
        c.push({ label: serviceName, path: `/transactions?${svcParams}${timeParam}` })
      }
      c.push({ label: decodedOperation, path: '' })
      return c
    }, [serviceName, serviceId, decodedOperation, timeQs]),
  )

  // ── Trace data ──────────────────────────────────────────────────────────
  const [traces, setTraces]     = useState<TraceSummary[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [limit, setLimit]       = useState(DEFAULT_LIMIT)

  // ── Duration filters ──────────────────────────────────────────────────
  const [minDuration, setMinDuration] = useState('')
  const [maxDuration, setMaxDuration] = useState('')

  // ── Column visibility ──────────────────────────────────────────────────
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_VISIBLE))
  const [columnAnchor, setColumnAnchor] = useState<HTMLElement | null>(null)

  // ── Sorting ───────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<ColumnKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  // ── Snackbar ────────────────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState<{
    open: boolean; message: string; severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'info' })

  // ── Fetch traces ──────────────────────────────────────────────────────
  const fetchTraces = useCallback(async () => {
    if (!serviceId || !decodedOperation) return

    setLoading(true)
    try {
      const params: TraceSearchParams = {
        operation: decodedOperation,
        limit,
      }
      if (customRange) {
        params.start = customRange.start.toISOString()
        params.end   = customRange.end.toISOString()
      } else if (selectedRange) {
        params.range = selectedRange
      }
      if (minDuration.trim()) params.minDuration = minDuration.trim()
      if (maxDuration.trim()) params.maxDuration = maxDuration.trim()

      const result = await traceService.getServiceTraces(serviceId, params)
      // Filter to only traces matching the selected transaction route
      const filtered = result.traces.filter(t => formatTransaction(t) === decodedOperation)
      setTraces(filtered)
      setTotal(filtered.length)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load traces', severity: 'error' })
      setTraces([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [serviceId, decodedOperation, selectedRange, customRange, minDuration, maxDuration, limit])

  useEffect(() => {
    fetchTraces()
  }, [fetchTraces])

  // ── Handlers ────────────────────────────────────────────────────────────
  const buildTimeParams = (params: URLSearchParams) => {
    if (customRange) {
      params.set('start', customRange.start.toISOString())
      params.set('end', customRange.end.toISOString())
    } else if (selectedRange) {
      params.set('range', selectedRange)
    }
  }

  const handleTraceClick = (traceId: string) => {
    const params = new URLSearchParams()
    if (serviceId) params.set('service', serviceId)
    if (serviceName) params.set('serviceName', serviceName)
    buildTimeParams(params)
    const qs = params.toString()
    navigate(`/transactions/${encodeURIComponent(operation ?? '')}/traces/${encodeURIComponent(traceId)}${qs ? `?${qs}` : ''}`)
  }

  const handleBack = () => {
    const params = new URLSearchParams()
    if (serviceId) params.set('service', serviceId)
    if (serviceName) params.set('serviceName', serviceName)
    buildTimeParams(params)
    const qs = params.toString()
    navigate(`/transactions${qs ? `?${qs}` : ''}`)
  }

  const handleLoadMore = () => setLimit((prev) => prev + 20)

  // ── Sorting ───────────────────────────────────────────────────────────
  const handleSort = (key: ColumnKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedTraces = useMemo(() => {
    if (!sortKey) return traces
    const sorted = [...traces]
    sorted.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'startTime') {
        cmp = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      } else if (sortKey === 'httpStatusCode') {
        cmp = (a.httpStatusCode ?? 0) - (b.httpStatusCode ?? 0)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [traces, sortKey, sortDir])

  // ── Column toggle ─────────────────────────────────────────────────────
  const handleColumnToggle = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const visibleColumnDefs = ALL_COLUMNS.filter(c => visibleColumns.has(c.key))


  return (
    <Box>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <IconButton size="small" onClick={handleBack}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Traces
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {decodedOperation}
          </Typography>
        </Box>
      </Box>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Time range */}
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
          sx={{ width: 130 }}
          label="Min Duration"
          placeholder="e.g. 100ms"
          value={minDuration}
          onChange={(e) => setMinDuration(e.target.value)}
          size="small"
        />
        <TextField
          sx={{ width: 130 }}
          label="Max Duration"
          placeholder="e.g. 5s"
          value={maxDuration}
          onChange={(e) => setMaxDuration(e.target.value)}
          size="small"
        />
      </Paper>

      {/* ── Results summary + column selector ─────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {loading
            ? 'Loading traces...'
            : `${traces.length} trace${traces.length !== 1 ? 's' : ''} returned`}
          {total > 0 && !loading && ` (${total} total)`}
        </Typography>
        <Tooltip title="Select columns">
          <IconButton size="small" onClick={(e) => setColumnAnchor(e.currentTarget)}>
            <ViewColumnIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Trace table ───────────────────────────────────────────────── */}
      <Paper variant="outlined">
        <TableContainer sx={{ maxHeight: 'calc(100vh - 360px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {visibleColumnDefs.map((col) => (
                  <TableCell
                    key={col.key}
                    align={col.key === 'spans' || col.key === 'errors' || col.key === 'httpStatusCode' ? 'center' : 'left'}
                    sx={{ fontWeight: 600 }}
                    sortDirection={sortKey === col.key ? sortDir : false}
                  >
                    {col.sortable ? (
                      <TableSortLabel
                        active={sortKey === col.key}
                        direction={sortKey === col.key ? sortDir : 'desc'}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {visibleColumnDefs.map((col) => (
                      <TableCell key={col.key} align={col.key === 'spans' || col.key === 'errors' || col.key === 'httpStatusCode' ? 'center' : 'left'}>
                        <Skeleton variant="text" width={col.key === 'duration' ? 180 : 100} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sortedTraces.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnDefs.length} sx={{ textAlign: 'center', py: 6 }}>
                    <Typography variant="body1" color="text.secondary">
                      No traces found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Try adjusting your duration filters or time range
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedTraces.map((trace) => {
                  const opLabel = formatTracePath(trace)
                  return (
                    <TableRow
                      key={trace.traceId}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleTraceClick(trace.traceId)}
                    >
                      {visibleColumns.has('traceId') && (
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
                      )}

                      {visibleColumns.has('rootService') && (
                        <TableCell sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {trace.rootService}
                        </TableCell>
                      )}

                      {visibleColumns.has('rootOperation') && (
                        <TableCell
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.8rem',
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Tooltip title={opLabel} arrow>
                            <span>{opLabel}</span>
                          </Tooltip>
                        </TableCell>
                      )}

                      {visibleColumns.has('startTime') && (
                        <TableCell
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatTime(trace.startTime)}
                        </TableCell>
                      )}

                      {visibleColumns.has('httpStatusCode') && (
                        <TableCell align="center">
                          {trace.httpStatusCode != null ? (
                            <Chip
                              label={trace.httpStatusCode}
                              size="small"
                              sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 44 }}
                              color={
                                trace.httpStatusCode >= 500 ? 'error'
                                : trace.httpStatusCode >= 400 ? 'warning'
                                : 'success'
                              }
                            />
                          ) : (
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                      )}

                      {visibleColumns.has('duration') && (
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '0.8rem',
                              color: trace.errorCount > 0 ? 'error.main' : 'text.primary',
                            }}
                          >
                            {formatDuration(trace.durationMicros)}
                          </Typography>
                        </TableCell>
                      )}

                      {visibleColumns.has('spans') && (
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight={500}>
                            {trace.spanCount}
                          </Typography>
                        </TableCell>
                      )}

                      {visibleColumns.has('errors') && (
                        <TableCell align="center">
                          <ErrorIndicator errorCount={trace.errorCount} spanCount={trace.spanCount} />
                        </TableCell>
                      )}

                      {visibleColumns.has('services') && (
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
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Load more */}
        {!loading && sortedTraces.length > 0 && sortedTraces.length >= limit && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Button variant="outlined" size="small" onClick={handleLoadMore}>
              Load more traces
            </Button>
          </Box>
        )}
      </Paper>

      {/* ── Column Selector Popover ──────────────────────────────────── */}
      <Popover
        open={Boolean(columnAnchor)}
        anchorEl={columnAnchor}
        onClose={() => setColumnAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 2, minWidth: 200 } } }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
          Toggle Columns
        </Typography>
        <FormGroup>
          {ALL_COLUMNS.map((col) => (
            <FormControlLabel
              key={col.key}
              control={
                <Checkbox
                  size="small"
                  checked={visibleColumns.has(col.key)}
                  onChange={() => handleColumnToggle(col.key)}
                />
              }
              label={<Typography variant="body2">{col.label}</Typography>}
            />
          ))}
        </FormGroup>
      </Popover>

      {/* ── Calendar Popover ──────────────────────────────────────────── */}
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

      {/* ── Snackbar ─────────────────────────────────────────────────── */}
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
