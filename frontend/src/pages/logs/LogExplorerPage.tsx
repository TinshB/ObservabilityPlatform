import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Autocomplete,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Collapse,
  InputAdornment,
  Snackbar,
  Alert,
  Skeleton,
  Tooltip,
  CircularProgress,
  Popover,
  Button,
} from '@mui/material'
import SearchIcon       from '@mui/icons-material/Search'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon   from '@mui/icons-material/KeyboardArrowUp'
import ContentCopyIcon       from '@mui/icons-material/ContentCopy'
import OpenInNewIcon         from '@mui/icons-material/OpenInNew'
import CalendarMonthIcon     from '@mui/icons-material/CalendarMonth'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import dayjs, { type Dayjs } from 'dayjs'
import type { Service, TimeRangePreset, LogEntry, LogSeverity, LogSearchParams } from '@/types'
import * as serviceService from '@/services/serviceService'
import * as metricsService from '@/services/metricsService'
import * as logService     from '@/services/logService'
import InlineLogDiagnosis  from './InlineLogDiagnosis'

// ── Constants ───────────────────────────────────────────────────────────────

const SEVERITY_OPTIONS: LogSeverity[] = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']

const SEVERITY_COLORS: Record<LogSeverity, string> = {
  FATAL: '#b71c1c',
  ERROR: '#d32f2f',
  WARN:  '#ed6c02',
  INFO:  '#1976d2',
  DEBUG: '#9e9e9e',
  TRACE: '#bdbdbd',
}

const DEFAULT_RANGE = 'LAST_1H'
const DEFAULT_PAGE_SIZE = 50

// ── Severity chip ───────────────────────────────────────────────────────────

function SeverityChip({ severity }: { severity: LogSeverity }) {
  return (
    <Chip
      label={severity}
      size="small"
      sx={{
        fontWeight: 600,
        fontSize: '0.7rem',
        color: 'common.white',
        backgroundColor: SEVERITY_COLORS[severity] ?? '#757575',
        minWidth: 56,
      }}
    />
  )
}

// ── Expandable log row ──────────────────────────────────────────────────────

function parseTimestamp(ts: string): Date {
  // Numeric string (integer or float) — epoch millis, micros, or nanos
  const num = Number(ts)
  if (!isNaN(num) && isFinite(num) && /^[\d.eE+-]+$/.test(ts.trim())) {
    if (num > 1e16) return new Date(num / 1e6)   // nanos  → millis
    if (num > 1e13) return new Date(num / 1e3)    // micros → millis
    return new Date(Math.round(num))               // millis (may be float)
  }
  return new Date(ts)
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false)

  const parsed = entry.timestamp ? parseTimestamp(entry.timestamp) : null
  const formattedTime = parsed && !isNaN(parsed.getTime())
    ? parsed.toLocaleString('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      } as Intl.DateTimeFormatOptions)
    : '—'

  const handleCopy = (text: string | null) => {
    if (text) navigator.clipboard.writeText(text)
  }

  return (
    <>
      <TableRow
        hover
        sx={{ cursor: 'pointer', ...(open && { '& > *': { borderBottom: 'unset' } }) }}
        onClick={() => setOpen(!open)}
      >
        <TableCell padding="checkbox" sx={{ width: 40 }}>
          <IconButton size="small">
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          {formattedTime}
        </TableCell>
        <TableCell>
          <SeverityChip severity={entry.severity} />
        </TableCell>
        <TableCell sx={{ fontSize: '0.8rem' }}>
          {entry.serviceName ?? '—'}
        </TableCell>
        <TableCell
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.8rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.body ?? '—'}
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      {open && (
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0, borderBottom: 'unset' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, backgroundColor: 'action.hover', borderRadius: 1, my: 1 }}>
              {/* Full log body */}
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Message
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5, mb: 2,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                {entry.body ?? '(empty)'}
              </Paper>

              {/* Trace context — Story 7.5: clickable trace link */}
              {(entry.traceId || entry.spanId) && (
                <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
                  {entry.traceId && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Trace ID:</Typography>
                      <Typography
                        component={RouterLink}
                        to={`/traces/${encodeURIComponent(entry.traceId)}`}
                        variant="caption"
                        fontFamily='"JetBrains Mono", monospace'
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {entry.traceId}
                      </Typography>
                      <Tooltip title="View trace">
                        <IconButton
                          component="a"
                          href={`/traces/${encodeURIComponent(entry.traceId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          sx={{ color: 'primary.main' }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy trace ID">
                        <IconButton size="small" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleCopy(entry.traceId) }}>
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                  {entry.spanId && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Span ID:</Typography>
                      <Typography variant="caption" fontFamily='"JetBrains Mono", monospace'>
                        {entry.spanId}
                      </Typography>
                      <Tooltip title="Copy span ID">
                        <IconButton size="small" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleCopy(entry.spanId) }}>
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              )}

              {/* Extra attributes */}
              {entry.attributes && Object.keys(entry.attributes).length > 0 && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Attributes
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {Object.entries(entry.attributes).map(([key, value]) => (
                      <Chip
                        key={key}
                        label={`${key}: ${value}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}
                      />
                    ))}
                  </Box>
                </>
              )}

              {/* AI Diagnosis for error logs */}
              {(entry.severity === 'ERROR' || entry.severity === 'FATAL') && (
                <InlineLogDiagnosis entry={entry} />
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
      )}
    </>
  )
}

// ── Main page component ─────────────────────────────────────────────────────

export default function LogExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Services ────────────────────────────────────────────────────────────
  const [services, setServices]             = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  // ── Severity filter ─────────────────────────────────────────────────────
  const [selectedSeverities, setSelectedSeverities] = useState<LogSeverity[]>([])

  // ── Time range ──────────────────────────────────────────────────────────
  const [presets, setPresets]           = useState<TimeRangePreset[]>([])
  const [selectedRange, setSelectedRange] = useState(
    searchParams.get('range') || DEFAULT_RANGE,
  )

  // ── Custom date range (calendar popover) ───────────────────────────────
  const [customRange, setCustomRange]       = useState<{ start: Date; end: Date } | null>(null)
  const [timeLabel, setTimeLabel]           = useState('Last 1 hour')
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(null)
  const [pickerStart, setPickerStart]       = useState<Dayjs | null>(null)
  const [pickerEnd, setPickerEnd]           = useState<Dayjs | null>(null)

  const rangeSeconds = useMemo(() => {
    if (customRange) return Math.round((customRange.end.getTime() - customRange.start.getTime()) / 1000)
    return presets.find(p => p.key === selectedRange)?.durationSeconds ?? 3600
  }, [selectedRange, customRange, presets])

  // ── Trace ID filter (Story 9.2: jump to logs from traces) ──────────────
  const [traceIdFilter, setTraceIdFilter] = useState(searchParams.get('traceId') || '')

  // ── Full-text search ────────────────────────────────────────────────────
  const [searchText, setSearchText]         = useState(searchParams.get('q') || '')
  const [submittedSearch, setSubmittedSearch] = useState(searchParams.get('q') || '')

  // ── Pagination ──────────────────────────────────────────────────────────
  const [page, setPage]     = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // ── Log data ────────────────────────────────────────────────────────────
  const [entries, setEntries]     = useState<LogEntry[]>([])
  const [totalHits, setTotalHits] = useState(0)
  const [loading, setLoading]     = useState(false)

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

        const urlServiceId = searchParams.get('serviceId')
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

  // ── Fetch logs ──────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      // Story 9.2: if traceId is present, use the dedicated trace-log endpoint
      if (traceIdFilter) {
        const result = await logService.getLogsByTraceId(traceIdFilter, { page, size: pageSize })
        setEntries(result.entries)
        setTotalHits(result.totalHits)
      } else {
        const params: LogSearchParams = { page, size: pageSize }
        if (customRange) {
          params.start = customRange.start.toISOString()
          params.end   = customRange.end.toISOString()
        } else {
          params.range = selectedRange
        }
        if (selectedService) params.serviceId = selectedService.id
        if (selectedSeverities.length > 0) params.severity = selectedSeverities
        if (submittedSearch.trim()) params.q = submittedSearch.trim()

        const result = await logService.searchLogs(params)
        setEntries(result.entries)
        setTotalHits(result.totalHits)
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to search logs', severity: 'error' })
      setEntries([])
      setTotalHits(0)
    } finally {
      setLoading(false)
    }
  }, [selectedService, selectedSeverities, submittedSearch, selectedRange, customRange, page, pageSize, traceIdFilter])

  // Trigger search on filter/pagination changes
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // ── URL sync ────────────────────────────────────────────────────────────
  const syncUrl = useCallback(
    (svc: Service | null, range: string, q: string) => {
      const params: Record<string, string> = {}
      if (svc) params.serviceId = svc.id
      params.range = range
      if (q.trim()) params.q = q.trim()
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleServiceChange = (_: unknown, svc: Service | null) => {
    setSelectedService(svc)
    setPage(0)
    syncUrl(svc, selectedRange, submittedSearch)
  }

  const handleRangeChange = (range: string) => {
    setSelectedRange(range)
    setCustomRange(null)
    const preset = presets.find(p => p.key === range)
    setTimeLabel(preset?.label ?? range)
    setPage(0)
    syncUrl(selectedService, range, submittedSearch)
  }

  const handleApplyCustomRange = () => {
    if (!pickerStart || !pickerEnd || !pickerStart.isBefore(pickerEnd)) return
    setCustomRange({ start: pickerStart.toDate(), end: pickerEnd.toDate() })
    setSelectedRange('')
    setTimeLabel(`${pickerStart.format('MMM D, HH:mm')} — ${pickerEnd.format('MMM D, HH:mm')}`)
    setCalendarAnchor(null)
    setPage(0)
  }

  const calendarOpen = Boolean(calendarAnchor)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittedSearch(searchText)
    setPage(0)
    syncUrl(selectedService, selectedRange, searchText)
  }

  const handleSeverityChange = (event: { target: { value: unknown } }) => {
    setSelectedSeverities(event.target.value as LogSeverity[])
    setPage(0)
  }

  const handlePageChange = (_: unknown, newPage: number) => setPage(newPage)

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10))
    setPage(0)
  }

  return (
    <Box>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight={700}>
          Log Explorer
        </Typography>
        {traceIdFilter && (
          <Chip
            label={`Trace: ${traceIdFilter.substring(0, 16)}...`}
            onDelete={() => {
              setTraceIdFilter('')
              const params = new URLSearchParams(searchParams)
              params.delete('traceId')
              setSearchParams(params, { replace: true })
            }}
            color="primary"
            size="small"
            sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}
          />
        )}
      </Box>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Service filter */}
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
              placeholder="All services"
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

        {/* Severity filter */}
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel>Severity</InputLabel>
          <Select
            multiple
            value={selectedSeverities}
            label="Severity"
            onChange={handleSeverityChange}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {(selected as LogSeverity[]).map((s) => (
                  <SeverityChip key={s} severity={s} />
                ))}
              </Box>
            )}
          >
            {SEVERITY_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                <SeverityChip severity={s} />
                <Typography variant="body2" sx={{ ml: 1 }}>{s}</Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Time range dropdown + calendar */}
        <TextField
          select
          label="Time Range"
          size="small"
          sx={{ minWidth: 170 }}
          value={customRange ? '__CUSTOM__' : selectedRange}
          onChange={(e) => { if (e.target.value !== '__CUSTOM__') handleRangeChange(e.target.value) }}
        >
          {presets.map((p) => (
            <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>
          ))}
          {customRange && <MenuItem value="__CUSTOM__">{timeLabel}</MenuItem>}
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

        {/* Full-text search */}
        <Box component="form" onSubmit={handleSearchSubmit} sx={{ flexGrow: 1, minWidth: 250 }}>
          <TextField
            fullWidth
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search log messages..."
            label="Search"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchSubmit(e)
            }}
          />
        </Box>
      </Paper>

      {/* ── Results summary ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {loading ? 'Searching...' : `${totalHits.toLocaleString()} log entries found`}
        </Typography>
      </Box>

      {/* ── Log table ────────────────────────────────────────────────────── */}
      <Paper variant="outlined">
        <TableContainer sx={{ maxHeight: 'calc(100vh - 340px)' }}>
          <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 48 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 140 }} />
              <col />
            </colgroup>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Service</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell padding="checkbox" />
                    <TableCell><Skeleton variant="text" width={150} /></TableCell>
                    <TableCell><Skeleton variant="rounded" width={56} height={24} /></TableCell>
                    <TableCell><Skeleton variant="text" width={100} /></TableCell>
                    <TableCell><Skeleton variant="text" /></TableCell>
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6 }}>
                    <Typography variant="body1" color="text.secondary">
                      No log entries found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Try adjusting your filters or time range
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry, idx) => (
                  <LogRow key={`${entry.timestamp}-${idx}`} entry={entry} />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalHits}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={pageSize}
          onRowsPerPageChange={handlePageSizeChange}
          rowsPerPageOptions={[25, 50, 100]}
        />
      </Paper>



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
            <DateTimePicker label="From" value={pickerStart} onChange={(v) => setPickerStart(v)}
              maxDateTime={pickerEnd ?? undefined}
              slotProps={{ textField: { size: 'small', fullWidth: true } }} />
            <DateTimePicker label="To" value={pickerEnd} onChange={(v) => setPickerEnd(v)}
              minDateTime={pickerStart ?? undefined} maxDateTime={dayjs()}
              slotProps={{ textField: { size: 'small', fullWidth: true } }} />
            <Button variant="contained" size="small" fullWidth onClick={handleApplyCustomRange}
              disabled={!pickerStart || !pickerEnd || !pickerStart.isBefore(pickerEnd)}>
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
