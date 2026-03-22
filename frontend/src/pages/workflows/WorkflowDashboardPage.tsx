import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Skeleton, Snackbar, Alert, TablePagination,
  TextField, MenuItem, Button, Card, CardContent, IconButton, Drawer,
  Divider, LinearProgress, Popover,
} from '@mui/material'
import ArrowBackIcon     from '@mui/icons-material/ArrowBack'
import RefreshIcon       from '@mui/icons-material/Refresh'
import CloseIcon         from '@mui/icons-material/Close'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import dayjs, { type Dayjs } from 'dayjs'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type {
  Workflow, WorkflowInstance, WorkflowInstanceStatus,
  WorkflowStep, LiveCorrelationResponse,
} from '@/types'
import * as workflowService from '@/services/workflowService'
import WorkflowSankeyChart from './WorkflowSankeyChart'
import WorkflowStepMetricsPanel from './WorkflowStepMetricsPanel'
import { useBreadcrumb } from '@/hooks/useBreadcrumb'

// ── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  COMPLETE:    '#2e7d32',
  IN_PROGRESS: '#1976d2',
  FAILED:      '#d32f2f',
}

const TIME_PRESETS = [
  { label: 'Last 1 hour',   value: '1h',  seconds: 3600 },
  { label: 'Last 6 hours',  value: '6h',  seconds: 21600 },
  { label: 'Last 24 hours', value: '24h', seconds: 86400 },
  { label: 'Last 7 days',   value: '7d',  seconds: 604800 },
] as const

const STATUSES: WorkflowInstanceStatus[] = ['COMPLETE', 'IN_PROGRESS', 'FAILED']

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusChipColor(s: string): 'success' | 'primary' | 'error' | 'default' {
  if (s === 'COMPLETE')    return 'success'
  if (s === 'IN_PROGRESS') return 'primary'
  if (s === 'FAILED')      return 'error'
  return 'default'
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function formatDuration(ms?: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function buildTrendData(instances: WorkflowInstance[], rangeSeconds: number) {
  if (instances.length === 0) return []

  const useDay = rangeSeconds > 86400
  const bucketMap = new Map<string, { complete: number; in_progress: number; failed: number }>()

  for (const inst of instances) {
    const d = new Date(inst.startedAt ?? inst.createdAt)
    const key = useDay
      ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

    if (!bucketMap.has(key)) {
      bucketMap.set(key, { complete: 0, in_progress: 0, failed: 0 })
    }
    const bucket = bucketMap.get(key)!
    const status = inst.status.toLowerCase().replace('-', '_') as 'complete' | 'in_progress' | 'failed'
    if (status in bucket) bucket[status]++
  }

  return Array.from(bucketMap.entries()).map(([name, counts]) => ({ name, ...counts }))
}

// ── Component ───────────────────────────────────────────────────────────────

export default function WorkflowDashboardPage() {
  const { workflowId } = useParams<{ workflowId: string }>()
  const navigate = useNavigate()

  // Data
  const [workflow, setWorkflow]     = useState<Workflow | null>(null)
  const [liveData, setLiveData]     = useState<LiveCorrelationResponse | null>(null)
  const [steps, setSteps]           = useState<WorkflowStep[]>([])
  const [loading, setLoading]       = useState(true)

  // Dynamic breadcrumb — shows workflow name once loaded
  useBreadcrumb(workflowId, workflow?.name ?? workflowId)

  // Pagination (applied locally on live data)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  // Filters – time range
  const [activePreset, setActivePreset] = useState('24h')
  const [customRange, setCustomRange]   = useState<{ start: Date; end: Date } | null>(null)
  const [timeLabel, setTimeLabel]       = useState('Last 24 hours')
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(null)
  const [pickerStart, setPickerStart]   = useState<Dayjs | null>(null)
  const [pickerEnd, setPickerEnd]       = useState<Dayjs | null>(null)

  // Filters – status
  const [statusFilter, setStatusFilter] = useState('')

  // Detail drawer
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null)

  // Step metrics refresh
  const [refreshKey, setRefreshKey] = useState(0)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'success' },
  )

  const rangeSeconds = useMemo(() => {
    if (customRange) {
      return Math.round((customRange.end.getTime() - customRange.start.getTime()) / 1000)
    }
    return TIME_PRESETS.find(p => p.value === activePreset)?.seconds ?? 86400
  }, [activePreset, customRange])

  const stats = liveData?.stats ?? null
  const allInstances = liveData?.instances ?? []
  const filteredInstances = useMemo(() => {
    if (!statusFilter) return allInstances
    return allInstances.filter(i => i.status === statusFilter)
  }, [allInstances, statusFilter])
  const paginatedInstances = useMemo(() =>
    filteredInstances.slice(page * size, (page + 1) * size),
  [filteredInstances, page, size])
  const totalElements = filteredInstances.length

  const fetchWorkflow = useCallback(async () => {
    if (!workflowId) return
    try {
      const wf = await workflowService.getWorkflow(workflowId)
      setWorkflow(wf)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load workflow', severity: 'error' })
    }
  }, [workflowId])

  const fetchSteps = useCallback(async () => {
    if (!workflowId) return
    try {
      const s = await workflowService.listSteps(workflowId)
      setSteps(s)
    } catch {
      // Non-critical – Sankey will show empty state
    }
  }, [workflowId])

  const fetchLiveData = useCallback(async () => {
    if (!workflowId) return
    setLoading(true)
    try {
      const lookbackMinutes = customRange
        ? Math.ceil((customRange.end.getTime() - customRange.start.getTime()) / 60000)
        : Math.ceil(rangeSeconds / 60)
      const result = await workflowService.correlateLive(workflowId, { lookbackMinutes })
      setLiveData(result)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load live correlation data', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [workflowId, rangeSeconds, customRange])

  useEffect(() => { fetchWorkflow() }, [fetchWorkflow])
  useEffect(() => { fetchSteps() }, [fetchSteps])
  useEffect(() => { fetchLiveData() }, [fetchLiveData])

  const refreshAll = () => { fetchLiveData(); setRefreshKey(k => k + 1) }

  // ── Instance detail ────────────────────────────────────────────

  const openDetail = (inst: WorkflowInstance) => {
    setSelectedInstance(inst)
  }

  // ── Time-range handlers ────────────────────────────────────────

  const handleTimePreset = (preset: typeof TIME_PRESETS[number]) => {
    setActivePreset(preset.value)
    setCustomRange(null)
    setTimeLabel(preset.label)
    setPage(0)
  }

  const handleApplyCustomRange = () => {
    if (!pickerStart || !pickerEnd || !pickerStart.isBefore(pickerEnd)) return
    setCustomRange({ start: pickerStart.toDate(), end: pickerEnd.toDate() })
    setActivePreset('')
    setTimeLabel(`${pickerStart.format('MMM D, HH:mm')} — ${pickerEnd.format('MMM D, HH:mm')}`)
    setCalendarAnchor(null)
    setPage(0)
  }

  const calendarOpen = Boolean(calendarAnchor)

  // ── Chart data ─────────────────────────────────────────────────

  const trendData = useMemo(() => buildTrendData(filteredInstances, rangeSeconds), [filteredInstances, rangeSeconds])

  const pieData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'Complete',    value: stats.completeCount,   color: STATUS_COLORS.COMPLETE },
      { name: 'In Progress', value: stats.inProgressCount, color: STATUS_COLORS.IN_PROGRESS },
      { name: 'Failed',      value: stats.failedCount,     color: STATUS_COLORS.FAILED },
    ].filter(d => d.value > 0)
  }, [stats])

  return (
    <Box>
      {/* ── Header (sticky) ─────────────────────────────────────── */}
      <Box sx={{ position: 'sticky', top: 64, zIndex: 10, bgcolor: 'background.default', mx: -3, px: 3, pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={() => navigate('/workflows')} size="small">
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                {workflow?.name ?? 'Workflow Dashboard'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Execution analytics and instance monitoring
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
              {TIME_PRESETS.map(p => (
                <Chip
                  key={p.value}
                  label={p.label}
                  size="small"
                  variant={activePreset === p.value ? 'filled' : 'outlined'}
                  color={activePreset === p.value ? 'primary' : 'default'}
                  onClick={() => handleTimePreset(p)}
                  clickable
                />
              ))}
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CalendarMonthIcon />}
              onClick={(e: React.MouseEvent<HTMLElement>) => {
                setPickerStart(customRange ? dayjs(customRange.start) : dayjs().subtract(rangeSeconds, 'second'))
                setPickerEnd(customRange ? dayjs(customRange.end) : dayjs())
                setCalendarAnchor(e.currentTarget)
              }}
              sx={{ textTransform: 'none' }}
            >
              {timeLabel}
            </Button>
            <TextField label="Status" select value={statusFilter} size="small" sx={{ minWidth: 140 }}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}>
              <MenuItem value="">All</MenuItem>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
            </TextField>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refreshAll}>
              Refresh
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ── Summary Cards ───────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} variant="outlined" sx={{ minWidth: 140, flex: '1 1 0' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Skeleton variant="text" width={80} />
                <Skeleton variant="text" width={60} height={36} />
              </CardContent>
            </Card>
          ))
        ) : stats ? (
          <>
            <SummaryCard label="Total Instances" value={stats.totalInstances} />
            <SummaryCard label="Complete"    value={stats.completeCount}   color={STATUS_COLORS.COMPLETE} />
            <SummaryCard label="In Progress" value={stats.inProgressCount} color={STATUS_COLORS.IN_PROGRESS} />
            <SummaryCard label="Failed"      value={stats.failedCount}     color={STATUS_COLORS.FAILED} />
            <SummaryCard label="Success Rate" value={`${stats.successRatePct}%`}
              color={stats.successRatePct >= 90 ? STATUS_COLORS.COMPLETE : stats.successRatePct >= 50 ? '#ed6c02' : STATUS_COLORS.FAILED} />
          </>
        ) : (
          <SummaryCard label="Total Instances" value={0} />
        )}
      </Box>

      {/* ── Charts Row ──────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {/* Pie — Status distribution */}
        <Paper variant="outlined" sx={{ p: 2, flex: '0 0 280px' }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Status Distribution</Typography>
          {loading ? (
            <Skeleton variant="circular" width={120} height={120} sx={{ mx: 'auto' }} />
          ) : pieData.length === 0 ? (
            <Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body2" color="text.secondary">No data</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 120, height: 120 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={30} outerRadius={50} strokeWidth={2}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value, name) => [`${value} instances`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box>
                {pieData.map(d => (
                  <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: d.color }} />
                    <Typography variant="caption" sx={{ minWidth: 70 }}>{d.name}</Typography>
                    <Typography variant="caption" fontWeight={600}>{d.value}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Duration stats */}
        <Paper variant="outlined" sx={{ p: 2, flex: '0 0 220px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Latency Analysis</Typography>
          {loading ? (
            <>
              <Skeleton variant="text" /><Skeleton variant="text" /><Skeleton variant="text" />
            </>
          ) : stats ? (
            <>
              <DurationStat label="Avg Duration" value={stats.avgDurationMs} />
              <DurationStat label="Min Duration" value={stats.minDurationMs} />
              <DurationStat label="Max Duration" value={stats.maxDurationMs} />
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">No data</Typography>
          )}
        </Paper>

        {/* Bar — Trend over time */}
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 300 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Instances Over Time</Typography>
          {loading ? (
            <Skeleton variant="rectangular" height={140} />
          ) : trendData.length === 0 ? (
            <Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body2" color="text.secondary">No instance data in range</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="complete"    stackId="a" fill={STATUS_COLORS.COMPLETE}    name="Complete" />
                <Bar dataKey="in_progress" stackId="a" fill={STATUS_COLORS.IN_PROGRESS} name="In Progress" />
                <Bar dataKey="failed"      stackId="a" fill={STATUS_COLORS.FAILED}      name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </Box>

      {/* ── Sankey – Step Flow ──────────────────────────────────── */}
      <WorkflowSankeyChart instances={filteredInstances} steps={steps} loading={loading} />

      {/* ── Step Metrics ─────────────────────────────────────────── */}
      {workflowId && <WorkflowStepMetricsPanel workflowId={workflowId} refreshKey={refreshKey} />}

      {/* ── Calendar Popover ──────────────────────────────────── */}
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

      {/* ── Instance Table ──────────────────────────────────────── */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Trace ID</TableCell>
              <TableCell align="center">Matched Steps</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Started At</TableCell>
              <TableCell>Completed At</TableCell>
              <TableCell>Error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedInstances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">
                    {statusFilter
                      ? 'No instances match the current filters.'
                      : 'No workflow instances found. Run correlation to discover executions from traces.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : paginatedInstances.map((inst) => (
              <TableRow key={inst.id} hover sx={{ cursor: 'pointer' }}
                onClick={() => openDetail(inst)}>
                <TableCell>
                  <Chip label={inst.status.replace('_', ' ')} size="small"
                    color={statusChipColor(inst.status)} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem"
                    sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/traces/${inst.traceId}`) }}>
                    {inst.traceId}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">
                    {inst.matchedSteps}/{inst.totalSteps}
                  </Typography>
                  <LinearProgress variant="determinate"
                    value={inst.totalSteps > 0 ? (inst.matchedSteps / inst.totalSteps) * 100 : 0}
                    sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                    color={inst.matchedSteps === inst.totalSteps ? 'success' : 'primary'} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {formatDuration(inst.totalDurationMs)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontSize="0.8rem">{formatDate(inst.startedAt)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontSize="0.8rem">{formatDate(inst.completedAt)}</Typography>
                </TableCell>
                <TableCell>
                  {inst.error
                    ? <Chip label="Error" size="small" color="error" variant="outlined" />
                    : <Typography variant="caption" color="text.secondary">—</Typography>}
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

      {/* ── Instance Detail Drawer ──────────────────────────────── */}
      <Drawer anchor="right" open={!!selectedInstance} onClose={() => setSelectedInstance(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 } } }}>
        {selectedInstance && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>Instance Detail</Typography>
              <IconButton onClick={() => setSelectedInstance(null)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Summary fields */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
              <DetailField label="Status">
                <Chip label={selectedInstance.status.replace('_', ' ')} size="small"
                  color={statusChipColor(selectedInstance.status)} />
              </DetailField>
              <DetailField label="Trace ID">
                <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem"
                  sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  onClick={() => navigate(`/traces/${selectedInstance.traceId}`)}>
                  {selectedInstance.traceId}
                </Typography>
              </DetailField>
              <DetailField label="Duration">{formatDuration(selectedInstance.totalDurationMs)}</DetailField>
              <DetailField label="Started">{formatDate(selectedInstance.startedAt)}</DetailField>
              <DetailField label="Completed">{formatDate(selectedInstance.completedAt)}</DetailField>
              <DetailField label="Steps Matched">
                {selectedInstance.matchedSteps}/{selectedInstance.totalSteps}
              </DetailField>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Per-step breakdown */}
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Step Breakdown</Typography>

            {selectedInstance.steps && selectedInstance.steps.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {selectedInstance.steps.map((step, i) => (
                  <Paper key={step.id ?? i} variant="outlined" sx={{ p: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Box sx={{
                        width: 22, height: 22, borderRadius: '50%',
                        backgroundColor: step.error ? STATUS_COLORS.FAILED : STATUS_COLORS.COMPLETE,
                        color: 'common.white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                      }}>
                        {step.stepOrder}
                      </Box>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ flexGrow: 1 }}>
                        {step.label || step.operationName || step.serviceName}
                      </Typography>
                      {step.error && <Chip label="Error" size="small" color="error" variant="outlined" />}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, ml: 3.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {step.serviceName}
                      </Typography>
                      {step.httpStatus && (
                        <Typography variant="caption" fontFamily="monospace"
                          color={step.httpStatus >= 400 ? 'error.main' : 'text.secondary'}>
                          HTTP {step.httpStatus}
                        </Typography>
                      )}
                      <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                        {formatDuration(step.durationMs)}
                      </Typography>
                    </Box>
                    {step.operationName && (
                      <Typography variant="caption" fontFamily="monospace" color="text.secondary"
                        sx={{ ml: 3.5, display: 'block' }} noWrap>
                        {step.operationName}
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No step data available</Typography>
            )}
          </Box>
        )}
      </Drawer>

      {/* ── Snackbar ────────────────────────────────────────────── */}
      <Snackbar open={snackbar.open} autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 140, flex: '1 1 0' }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h5" fontWeight={700} sx={{ color: color ?? 'text.primary' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Typography>
      </CardContent>
    </Card>
  )
}

function DurationStat({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body1" fontWeight={600} fontFamily="monospace">
        {formatDuration(value)}
      </Typography>
    </Box>
  )
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Box>{typeof children === 'string'
        ? <Typography variant="body2" fontWeight={500}>{children}</Typography>
        : children}
      </Box>
    </Box>
  )
}
