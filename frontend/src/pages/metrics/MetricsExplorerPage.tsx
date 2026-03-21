import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  MenuItem,
  Tab,
  Tabs,
  Paper,
  Chip,
  Snackbar,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Popover,
  Button,
} from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import dayjs, { type Dayjs } from 'dayjs'
import {
  Grid,
  Skeleton as TableSkeleton,
} from '@mui/material'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import type { Service, TimeRangePreset, ApmOverviewResponse, ServiceMetricsResponse, TimeSeries } from '@/types'
import * as serviceService from '@/services/serviceService'
import * as metricsService from '@/services/metricsService'
import { getApmOverview } from '@/services/serviceDeepDiveService'
import { formatNumber, formatLatency, formatPercent, formatTime, formatDateTime, CHART_COLORS } from './chartUtils'
import ServiceMetricsTab from './ServiceMetricsTab'
import ApiMetricsTab from './ApiMetricsTab'
import InfraMetricsTab from './InfraMetricsTab'
import WebVitalsTab from './WebVitalsTab'
import QueryMetricsTab from './QueryMetricsTab'
import LogMetricsTab from './LogMetricsTab'

const TAB_KEYS = ['service', 'api', 'infra', 'webvitals', 'query', 'logmetrics'] as const
type TabKey = typeof TAB_KEYS[number]

const TAB_LABELS: Record<TabKey, string> = {
  service:    'Service',
  api:        'API',
  infra:      'Infra',
  webvitals:  'Web Vitals',
  query:      'Query',
  logmetrics: 'Log Metrics',
}

const DEFAULT_RANGE = 'LAST_1H'

interface SnackbarState {
  open: boolean
  message: string
  severity: 'success' | 'error' | 'warning' | 'info'
}

export default function MetricsExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Services ───────────────────────────────────────────────────────────────
  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  // ── Time range ─────────────────────────────────────────────────────────────
  const [presets, setPresets] = useState<TimeRangePreset[]>([])
  const [selectedRange, setSelectedRange] = useState(
    searchParams.get('range') || DEFAULT_RANGE,
  )

  // ── Custom date range (calendar popover) ───────────────────────────────────
  const [customRange, setCustomRange]       = useState<{ start: Date; end: Date } | null>(null)
  const [timeLabel, setTimeLabel]           = useState('Last 1 hour')
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(null)
  const [pickerStart, setPickerStart]       = useState<Dayjs | null>(null)
  const [pickerEnd, setPickerEnd]           = useState<Dayjs | null>(null)

  const rangeSeconds = useMemo(() => {
    if (customRange) return Math.round((customRange.end.getTime() - customRange.start.getTime()) / 1000)
    return presets.find(p => p.key === selectedRange)?.durationSeconds ?? 3600
  }, [selectedRange, customRange, presets])

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabFromUrl = searchParams.get('level') as TabKey | null
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabFromUrl && TAB_KEYS.includes(tabFromUrl) ? tabFromUrl : 'service',
  )

  // ── All-services overview ──────────────────────────────────────────────────
  const [overview, setOverview] = useState<ApmOverviewResponse | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [allServiceMetrics, setAllServiceMetrics] = useState<Map<string, ServiceMetricsResponse>>(new Map())

  // ── Feedback ───────────────────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false, message: '', severity: 'info',
  })

  // ── Load services + presets on mount ────────────────────────────────────────
  useEffect(() => {
    async function loadServices() {
      try {
        const page = await serviceService.getServices({ size: 200, active: true })
        setServices(page.content)

        // Auto-select from URL param
        const urlServiceId = searchParams.get('service')
        if (urlServiceId) {
          const match = page.content.find((s) => s.id === urlServiceId)
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
        const p = await metricsService.getTimeRangePresets()
        setPresets(p)
      } catch {
        // Fall back to hardcoded presets
        setPresets([
          { key: 'LAST_15M', label: 'Last 15 minutes', durationSeconds: 900,    stepSeconds: 15,    rateWindow: '1m' },
          { key: 'LAST_1H',  label: 'Last 1 hour',     durationSeconds: 3600,   stepSeconds: 30,    rateWindow: '2m' },
          { key: 'LAST_3H',  label: 'Last 3 hours',    durationSeconds: 10800,  stepSeconds: 60,    rateWindow: '5m' },
          { key: 'LAST_6H',  label: 'Last 6 hours',    durationSeconds: 21600,  stepSeconds: 120,   rateWindow: '5m' },
          { key: 'LAST_12H', label: 'Last 12 hours',   durationSeconds: 43200,  stepSeconds: 300,   rateWindow: '10m' },
          { key: 'LAST_24H', label: 'Last 24 hours',   durationSeconds: 86400,  stepSeconds: 600,   rateWindow: '15m' },
          { key: 'LAST_3D',  label: 'Last 3 days',     durationSeconds: 259200, stepSeconds: 1800,  rateWindow: '30m' },
          { key: 'LAST_7D',  label: 'Last 7 days',     durationSeconds: 604800, stepSeconds: 3600,  rateWindow: '1h' },
          { key: 'LAST_30D', label: 'Last 30 days',    durationSeconds: 2592000,stepSeconds: 14400, rateWindow: '4h' },
        ])
      }
    }

    loadServices()
    loadPresets()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch overview + per-service time series when no service selected ───────
  useEffect(() => {
    if (selectedService) return
    let cancelled = false
    setOverviewLoading(true)
    setAllServiceMetrics(new Map())

    getApmOverview(metricsParams)
      .then(async (data) => {
        if (cancelled) return
        setOverview(data)

        // Fetch time-series metrics for each service in parallel (cap at 10)
        const toFetch = data.services.slice(0, 10)
        const results = await Promise.allSettled(
          toFetch.map((svc) =>
            metricsService.getServiceMetrics(svc.serviceId, metricsParams)
              .then((m) => [svc.serviceName, m] as const)
          ),
        )

        if (cancelled) return
        const map = new Map<string, ServiceMetricsResponse>()
        for (const r of results) {
          if (r.status === 'fulfilled') map.set(r.value[0], r.value[1])
        }
        setAllServiceMetrics(map)
      })
      .catch(() => { if (!cancelled) setOverview(null) })
      .finally(() => { if (!cancelled) setOverviewLoading(false) })
    return () => { cancelled = true }
  }, [selectedService, selectedRange, customRange]) // eslint-disable-line react-hooks/exhaustive-deps

  // Merge per-service TimeSeries into a shared time-axis dataset for Recharts
  const buildTimeSeriesChart = useCallback(
    (extractor: (m: ServiceMetricsResponse) => TimeSeries | null | undefined) => {
      const map = new Map<number, Record<string, number>>()
      const names: string[] = []

      for (const [name, metrics] of allServiceMetrics) {
        const ts = extractor(metrics)
        if (!ts?.dataPoints?.length) continue
        names.push(name)
        for (const dp of ts.dataPoints) {
          let row = map.get(dp.timestamp)
          if (!row) { row = { time: dp.timestamp }; map.set(dp.timestamp, row) }
          row[name] = dp.value
        }
      }

      return {
        data: Array.from(map.values()).sort((a, b) => a.time - b.time),
        serviceNames: names,
      }
    },
    [allServiceMetrics],
  )

  const handleOverviewServiceClick = (serviceName: string) => {
    const svc = overview?.services.find((s) => s.serviceName === serviceName)
    if (!svc) return
    const match = services.find((s) => s.id === svc.serviceId)
    if (match) {
      setSelectedService(match)
      syncUrl(match, activeTab, selectedRange)
    }
  }

  // ── Sync URL ────────────────────────────────────────────────────────────────
  const syncUrl = useCallback(
    (svc: Service | null, tab: TabKey, range: string) => {
      const params: Record<string, string> = {}
      if (svc) params.service = svc.id
      params.level = tab
      params.range = range
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  const handleServiceChange = (_: unknown, svc: Service | null) => {
    setSelectedService(svc)
    syncUrl(svc, activeTab, selectedRange)
  }

  const handleTabChange = (_: React.SyntheticEvent, tab: TabKey) => {
    setActiveTab(tab)
    syncUrl(selectedService, tab, selectedRange)
  }

  const handleRangeChange = (range: string) => {
    setSelectedRange(range)
    setCustomRange(null)
    const preset = presets.find(p => p.key === range)
    setTimeLabel(preset?.label ?? range)
    syncUrl(selectedService, activeTab, range)
  }

  const handleApplyCustomRange = () => {
    if (!pickerStart || !pickerEnd || !pickerStart.isBefore(pickerEnd)) return
    setCustomRange({ start: pickerStart.toDate(), end: pickerEnd.toDate() })
    setSelectedRange('')
    setTimeLabel(`${pickerStart.format('MMM D, HH:mm')} — ${pickerEnd.format('MMM D, HH:mm')}`)
    setCalendarAnchor(null)
  }

  const calendarOpen = Boolean(calendarAnchor)

  const metricsParams: metricsService.MetricsParams = customRange
    ? { start: customRange.start.toISOString(), end: customRange.end.toISOString() }
    : { range: selectedRange }

  return (
    <Box>
      {/* ── Sticky header + controls ─────────────────────────────────────── */}
      <Box sx={{ position: 'sticky', top: 64, zIndex: 10, bgcolor: 'background.default', mx: -3, px: 3, pt: 0, pb: 0 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        Metrics Explorer
      </Typography>

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Service selector */}
        <Autocomplete
          sx={{ minWidth: 300, flexGrow: 1 }}
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
              label="Select Service"
              placeholder="Search services..."
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
      </Paper>
      </Box>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      {selectedService ? (
        <>
          <Paper variant="outlined" sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              {TAB_KEYS.map((key) => (
                <Tab
                  key={key}
                  value={key}
                  label={TAB_LABELS[key]}
                />
              ))}
            </Tabs>
          </Paper>

          {/* ── Tab content ────────────────────────────────────────────── */}
          {activeTab === 'service' && (
            <ServiceMetricsTab
              serviceId={selectedService.id}
              serviceName={selectedService.name}
              params={metricsParams}
            />
          )}
          {activeTab === 'api' && (
            <ApiMetricsTab
              serviceId={selectedService.id}
              serviceName={selectedService.name}
              params={metricsParams}
            />
          )}
          {activeTab === 'infra' && (
            <InfraMetricsTab
              serviceId={selectedService.id}
              serviceName={selectedService.name}
              params={metricsParams}
            />
          )}
          {activeTab === 'webvitals' && (
            <WebVitalsTab
              serviceId={selectedService.id}
              serviceName={selectedService.name}
              params={metricsParams}
            />
          )}
          {activeTab === 'query' && (
            <QueryMetricsTab
              serviceId={selectedService.id}
              serviceName={selectedService.name}
              params={metricsParams}
            />
          )}
          {activeTab === 'logmetrics' && (
            <LogMetricsTab
              serviceId={selectedService.id}
              serviceName={selectedService.name}
              params={metricsParams}
            />
          )}
        </>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            All Services Overview
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              Click any service name to drill into that service
            </Typography>
          </Typography>

          {overviewLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[1, 2, 3].map((i) => (
                <TableSkeleton key={i} variant="rounded" height={300} />
              ))}
            </Box>
          ) : overview && overview.services.length > 0 ? (() => {
            const svcs = overview.services
            const colorMap = Object.fromEntries(svcs.map((s, i) => [s.serviceName, CHART_COLORS[i % CHART_COLORS.length]]))
            const healthColor = (status: string) =>
              status === 'HEALTHY' ? '#2e7d32' : status === 'DEGRADED' ? '#ed6c02' : '#d32f2f'

            // Build time-series datasets
            const latencyChart = buildTimeSeriesChart((m) => m.latencyP95)
            const errorChart = buildTimeSeriesChart((m) => m.errorRate)
            const rpsChart = buildTimeSeriesChart((m) => m.requestRate)

            const hasTimeSeries = latencyChart.data.length > 0 || errorChart.data.length > 0 || rpsChart.data.length > 0

            return (
              <>
                {/* ── Summary cards ──────────────────────────────────── */}
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Total Services</Typography>
                      <Typography variant="h4" fontWeight={700}>{overview.totalServices}</Typography>
                    </Paper>
                  </Grid>
                  {(['HEALTHY', 'DEGRADED', 'UNHEALTHY'] as const).map((status) => (
                    <Grid item xs={6} sm={3} key={status}>
                      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">{status.charAt(0) + status.slice(1).toLowerCase()}</Typography>
                        <Typography variant="h4" fontWeight={700} color={healthColor(status)}>
                          {overview.healthDistribution[status] ?? 0}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                {!hasTimeSeries && allServiceMetrics.size === 0 && !overviewLoading && (
                  <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                    <CircularProgress size={24} sx={{ mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Loading time-series data for all services...
                    </Typography>
                  </Paper>
                )}

                {/* ── P95 Latency (time-series) ───────────────────────── */}
                {latencyChart.data.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>P95 Latency</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={latencyChart.data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                        <defs>
                          {latencyChart.serviceNames.map((name, i) => (
                            <linearGradient key={name} id={`ov-lat-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={colorMap[name]} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={colorMap[name]} stopOpacity={0.05} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="rgba(0,0,0,0.3)" />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatLatency(v)} stroke="rgba(0,0,0,0.3)" width={65} />
                        <RechartsTooltip
                          labelFormatter={(l) => formatDateTime(l as number)}
                          formatter={(v: unknown, name: unknown) => [formatLatency(v as number), name as string]}
                        />
                        <Legend onClick={(e) => handleOverviewServiceClick(String(e.value))} wrapperStyle={{ cursor: 'pointer' }} />
                        {latencyChart.serviceNames.map((name, i) => (
                          <Area key={name} type="monotone" dataKey={name}
                            stroke={colorMap[name]} fill={`url(#ov-lat-${i})`}
                            strokeWidth={2} dot={false} connectNulls />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </Paper>
                )}

                {/* ── Error Rate (time-series) ────────────────────────── */}
                {errorChart.data.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>Error Rate</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={errorChart.data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                        <defs>
                          {errorChart.serviceNames.map((name, i) => (
                            <linearGradient key={name} id={`ov-err-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={colorMap[name]} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={colorMap[name]} stopOpacity={0.05} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="rgba(0,0,0,0.3)" />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatPercent(v)} stroke="rgba(0,0,0,0.3)" width={65} />
                        <RechartsTooltip
                          labelFormatter={(l) => formatDateTime(l as number)}
                          formatter={(v: unknown, name: unknown) => [formatPercent(v as number), name as string]}
                        />
                        <Legend onClick={(e) => handleOverviewServiceClick(String(e.value))} wrapperStyle={{ cursor: 'pointer' }} />
                        {errorChart.serviceNames.map((name, i) => (
                          <Area key={name} type="monotone" dataKey={name}
                            stroke={colorMap[name]} fill={`url(#ov-err-${i})`}
                            strokeWidth={2} dot={false} connectNulls />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </Paper>
                )}

                {/* ── Throughput (time-series) ─────────────────────────── */}
                {rpsChart.data.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>Throughput (req/s)</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={rpsChart.data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                        <defs>
                          {rpsChart.serviceNames.map((name, i) => (
                            <linearGradient key={name} id={`ov-rps-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={colorMap[name]} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={colorMap[name]} stopOpacity={0.05} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="rgba(0,0,0,0.3)" />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} stroke="rgba(0,0,0,0.3)" width={65} />
                        <RechartsTooltip
                          labelFormatter={(l) => formatDateTime(l as number)}
                          formatter={(v: unknown, name: unknown) => [`${formatNumber(v as number)} req/s`, name as string]}
                        />
                        <Legend onClick={(e) => handleOverviewServiceClick(String(e.value))} wrapperStyle={{ cursor: 'pointer' }} />
                        {rpsChart.serviceNames.map((name, i) => (
                          <Area key={name} type="monotone" dataKey={name}
                            stroke={colorMap[name]} fill={`url(#ov-rps-${i})`}
                            strokeWidth={2} dot={false} connectNulls />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </Paper>
                )}
              </>
            )
          })() : (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No service data available for the selected time range.
              </Typography>
            </Paper>
          )}
        </Box>
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
