import { useState, useEffect, useCallback, useMemo } from 'react'
import { useCustomBreadcrumbs } from '@/hooks/useBreadcrumb'
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
  TableSortLabel,
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
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import dayjs, { type Dayjs } from 'dayjs'
import type { Service, TimeRangePreset, TransactionSummary, TransactionSearchParams } from '@/types'
import * as serviceService from '@/services/serviceService'
import * as metricsService from '@/services/metricsService'
import * as traceService   from '@/services/traceService'
import { formatDuration } from '@/utils/traceUtils'

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_RANGE = 'LAST_15M'

// ── Sorting ─────────────────────────────────────────────────────────────────

type TxnSortKey = 'transaction' | 'errorRate' | 'rps' | 'slowest'
type SortDirection = 'asc' | 'desc'

// ── Main page component ─────────────────────────────────────────────────────

export default function TraceViewerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // ── Services ────────────────────────────────────────────────────────────
  const [services, setServices]             = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<Service | null>(null)

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

  // ── Transaction data ──────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<TransactionSummary[]>([])
  const [loading, setLoading]           = useState(false)

  // ── Sorting ───────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<TxnSortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  // ── Snackbar ────────────────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState<{
    open: boolean; message: string; severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'info' })

  // ── Breadcrumb: Home → Transactions → <serviceName> ──────────────────
  useCustomBreadcrumbs(
    useMemo(() => {
      const c = [
        { label: 'Home', path: '/home' },
        { label: 'Transactions', path: '/transactions' },
      ]
      if (selectedService) {
        c.push({ label: selectedService.name, path: `/transactions?service=${selectedService.id}` })
      }
      return c
    }, [selectedService]),
  )

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

  // ── Fetch transactions ────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    if (!selectedService) {
      setTransactions([])
      return
    }

    setLoading(true)
    try {
      const params: TransactionSearchParams = {
        serviceName: selectedService.name,
      }

      if (customRange) {
        params.start = customRange.start.toISOString()
        params.end   = customRange.end.toISOString()
      } else {
        params.range = selectedRange
      }

      const result = await traceService.getServiceTransactions(selectedService.id, params)
      setTransactions(result.transactions)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load transactions', severity: 'error' })
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [selectedService, selectedRange, customRange])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

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

  const handleTransactionClick = (txn: TransactionSummary) => {
    const params = new URLSearchParams()
    if (selectedService) {
      params.set('service', selectedService.id)
      params.set('serviceName', selectedService.name)
    }
    if (customRange) {
      params.set('start', customRange.start.toISOString())
      params.set('end', customRange.end.toISOString())
    } else if (selectedRange) {
      params.set('range', selectedRange)
    }
    const qs = params.toString()
    navigate(`/transactions/${encodeURIComponent(txn.transaction)}${qs ? `?${qs}` : ''}`)
  }

  // ── Sorting ───────────────────────────────────────────────────────────
  const handleSort = (key: TxnSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedTransactions = useMemo(() => {
    if (!sortKey) return transactions
    const sorted = [...transactions]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'transaction': cmp = a.transaction.localeCompare(b.transaction); break
        case 'errorRate':   cmp = a.errorRate - b.errorRate; break
        case 'rps':         cmp = a.requestsPerSecond - b.requestsPerSecond; break
        case 'slowest':     cmp = a.slowestDurationMicros - b.slowestDurationMicros; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [transactions, sortKey, sortDir])

  // ── Slowest-bar scaling ────────────────────────────────────────────────
  const maxSlowest = transactions.length > 0
    ? Math.max(...transactions.map(t => t.slowestDurationMicros))
    : 1

  return (
    <Box>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Transaction Viewer
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
      </Paper>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {!selectedService ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select a service to view transactions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Use the service selector above to choose a registered service and explore its transactions.
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Results summary */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {loading
                ? 'Loading transactions...'
                : `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} found`}
            </Typography>
          </Box>

          {/* Transaction list table */}
          <Paper variant="outlined">
            <TableContainer sx={{ maxHeight: 'calc(100vh - 320px)' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>Service Name</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 260 }}>
                      <TableSortLabel
                        active={sortKey === 'transaction'}
                        direction={sortKey === 'transaction' ? sortDir : 'desc'}
                        onClick={() => handleSort('transaction')}
                      >
                        Transaction
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 110 }} align="right">
                      <TableSortLabel
                        active={sortKey === 'errorRate'}
                        direction={sortKey === 'errorRate' ? sortDir : 'desc'}
                        onClick={() => handleSort('errorRate')}
                      >
                        Error Rate
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 90 }} align="right">
                      <TableSortLabel
                        active={sortKey === 'rps'}
                        direction={sortKey === 'rps' ? sortDir : 'desc'}
                        onClick={() => handleSort('rps')}
                      >
                        RPS
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 220 }}>
                      <TableSortLabel
                        active={sortKey === 'slowest'}
                        direction={sortKey === 'slowest' ? sortDir : 'desc'}
                        onClick={() => handleSort('slowest')}
                      >
                        Slowest Transaction Time
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 80 }} align="center">Traces</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton variant="text" width={100} /></TableCell>
                        <TableCell><Skeleton variant="text" width={200} /></TableCell>
                        <TableCell align="right"><Skeleton variant="text" width={50} /></TableCell>
                        <TableCell align="right"><Skeleton variant="text" width={40} /></TableCell>
                        <TableCell><Skeleton variant="rounded" width={180} height={8} /></TableCell>
                        <TableCell align="center"><Skeleton variant="text" width={30} /></TableCell>
                      </TableRow>
                    ))
                  ) : sortedTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography variant="body1" color="text.secondary">
                          No transactions found
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Try adjusting your time range or selecting a different service
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedTransactions.map((txn) => {
                      const barPct = maxSlowest > 0
                        ? Math.max((txn.slowestDurationMicros / maxSlowest) * 100, 2)
                        : 2

                      return (
                        <TableRow
                          key={txn.transaction}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleTransactionClick(txn)}
                        >
                          {/* Service name */}
                          <TableCell sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            {txn.serviceName}
                          </TableCell>

                          {/* Transaction */}
                          <TableCell
                            sx={{
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '0.8rem',
                              maxWidth: 360,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Tooltip title={txn.transaction} arrow>
                              <span>{txn.transaction}</span>
                            </Tooltip>
                          </TableCell>

                          {/* Error rate */}
                          <TableCell align="right">
                            <Chip
                              label={`${txn.errorRate.toFixed(1)}%`}
                              size="small"
                              sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 52 }}
                              color={
                                txn.errorRate > 5 ? 'error'
                                : txn.errorRate > 1 ? 'warning'
                                : 'success'
                              }
                            />
                          </TableCell>

                          {/* RPS */}
                          <TableCell
                            align="right"
                            sx={{
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '0.8rem',
                            }}
                          >
                            {txn.requestsPerSecond < 0.01
                              ? '< 0.01'
                              : txn.requestsPerSecond < 1
                                ? txn.requestsPerSecond.toFixed(2)
                                : txn.requestsPerSecond.toFixed(1)}
                          </TableCell>

                          {/* Slowest transaction time — bar + label */}
                          <TableCell>
                            <Tooltip title={formatDuration(txn.slowestDurationMicros)} arrow>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
                                <Box sx={{ flexGrow: 1 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={barPct}
                                    sx={{
                                      height: 8,
                                      borderRadius: 4,
                                      backgroundColor: 'action.disabledBackground',
                                      '& .MuiLinearProgress-bar': {
                                        borderRadius: 4,
                                        backgroundColor: txn.errorRate > 5 ? 'error.main' : 'primary.main',
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
                                  {formatDuration(txn.slowestDurationMicros)}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </TableCell>

                          {/* Trace count */}
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight={500}>
                              {txn.traceCount}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

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
