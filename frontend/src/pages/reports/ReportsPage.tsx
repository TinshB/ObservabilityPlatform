import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert as MuiAlert,
  CircularProgress,
} from '@mui/material'
import AddIcon           from '@mui/icons-material/Add'
import DownloadIcon      from '@mui/icons-material/Download'
import DeleteIcon        from '@mui/icons-material/Delete'
import RefreshIcon       from '@mui/icons-material/Refresh'
import ScheduleIcon      from '@mui/icons-material/Schedule'
import AssessmentIcon    from '@mui/icons-material/Assessment'
import ClearIcon         from '@mui/icons-material/Clear'
import PauseCircleIcon   from '@mui/icons-material/PauseCircle'
import PlayCircleIcon    from '@mui/icons-material/PlayCircle'
import dayjs             from 'dayjs'
import relativeTime      from 'dayjs/plugin/relativeTime'
import * as reportService from '@/services/reportService'

dayjs.extend(relativeTime)
import type {
  Report,
  ReportType,
  ReportStatus,
  ReportSchedule,
  ScheduleFrequency,
} from '@/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ReportStatus, 'default' | 'info' | 'success' | 'error'> = {
  QUEUED:     'default',
  GENERATING: 'info',
  COMPLETED:  'success',
  FAILED:     'error',
}

const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  DAILY:   'Daily',
  WEEKLY:  'Weekly',
  MONTHLY: 'Monthly',
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  // Tab state
  const [tab, setTab] = useState(0)

  // ── Reports tab state ───────────────────────────
  const [reports, setReports]       = useState<Report[]>([])
  const [reportTotal, setReportTotal] = useState(0)
  const [reportPage, setReportPage]   = useState(0)
  const [reportSize, setReportSize]   = useState(20)
  const [reportLoading, setReportLoading] = useState(true)
  const [filterType, setFilterType]     = useState<ReportType | ''>('')
  const [filterStatus, setFilterStatus] = useState<ReportStatus | ''>('')

  // ── Schedules tab state ─────────────────────────
  const [schedules, setSchedules]         = useState<ReportSchedule[]>([])
  const [scheduleTotal, setScheduleTotal] = useState(0)
  const [schedulePage, setSchedulePage]   = useState(0)
  const [scheduleSize, setScheduleSize]   = useState(20)
  const [scheduleLoading, setScheduleLoading] = useState(true)

  // ── Generate report dialog ──────────────────────
  const [genOpen, setGenOpen] = useState(false)
  const [genForm, setGenForm] = useState({
    name: '',
    reportType: 'KPI' as ReportType,
    serviceName: '',
    timeRangeStart: dayjs().subtract(7, 'day').format('YYYY-MM-DDTHH:mm'),
    timeRangeEnd:   dayjs().format('YYYY-MM-DDTHH:mm'),
  })
  const [genSubmitting, setGenSubmitting] = useState(false)

  // ── Schedule dialog ─────────────────────────────
  const [schedOpen, setSchedOpen] = useState(false)
  const [schedForm, setSchedForm] = useState({
    name: '',
    reportType: 'KPI' as ReportType,
    frequency: 'WEEKLY' as ScheduleFrequency,
    recipients: '',
    serviceName: '',
  })
  const [schedSubmitting, setSchedSubmitting] = useState(false)

  // ── Downloading state ───────────────────────────
  const [downloading, setDownloading] = useState<string | null>(null)

  // ── Snackbar ────────────────────────────────────
  const [snackbar, setSnackbar] = useState<{
    open: boolean; message: string; severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'success' })

  // ── Fetch reports ───────────────────────────────
  const fetchReports = useCallback(async () => {
    setReportLoading(true)
    try {
      const result = await reportService.listReports({
        reportType: filterType || undefined,
        status: filterStatus || undefined,
        page: reportPage,
        size: reportSize,
      })
      setReports(result.content)
      setReportTotal(result.totalElements)
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to load reports', severity: 'error' })
    } finally {
      setReportLoading(false)
    }
  }, [filterType, filterStatus, reportPage, reportSize])

  // ── Fetch schedules ─────────────────────────────
  const fetchSchedules = useCallback(async () => {
    setScheduleLoading(true)
    try {
      const result = await reportService.listSchedules({ page: schedulePage, size: scheduleSize })
      setSchedules(result.content)
      setScheduleTotal(result.totalElements)
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to load schedules', severity: 'error' })
    } finally {
      setScheduleLoading(false)
    }
  }, [schedulePage, scheduleSize])

  useEffect(() => { fetchReports() }, [fetchReports])
  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  // Auto-refresh reports every 15s to catch status changes
  useEffect(() => {
    if (tab !== 0) return
    const interval = setInterval(fetchReports, 15_000)
    return () => clearInterval(interval)
  }, [tab, fetchReports])

  // ── Generate report handler ─────────────────────
  const handleGenerate = async () => {
    setGenSubmitting(true)
    try {
      await reportService.generateReport({
        name: genForm.name,
        reportType: genForm.reportType,
        serviceName: genForm.serviceName || undefined,
        timeRangeStart: new Date(genForm.timeRangeStart).toISOString(),
        timeRangeEnd:   new Date(genForm.timeRangeEnd).toISOString(),
      })
      setSnackbar({ open: true, message: 'Report queued for generation', severity: 'success' })
      setGenOpen(false)
      setGenForm({
        name: '', reportType: 'KPI', serviceName: '',
        timeRangeStart: dayjs().subtract(7, 'day').format('YYYY-MM-DDTHH:mm'),
        timeRangeEnd: dayjs().format('YYYY-MM-DDTHH:mm'),
      })
      fetchReports()
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to generate report', severity: 'error' })
    } finally {
      setGenSubmitting(false)
    }
  }

  // ── Download PDF ────────────────────────────────
  const handleDownload = async (report: Report) => {
    setDownloading(report.id)
    try {
      const blob = await reportService.downloadReport(report.id)
      const url  = window.URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${report.reportType.toLowerCase()}-report-${report.id.substring(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Download failed', severity: 'error' })
    } finally {
      setDownloading(null)
    }
  }

  // ── Delete report ───────────────────────────────
  const handleDeleteReport = async (id: string) => {
    if (!window.confirm('Delete this report? The file will be removed.')) return
    try {
      await reportService.deleteReport(id)
      setSnackbar({ open: true, message: 'Report deleted', severity: 'success' })
      fetchReports()
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to delete report', severity: 'error' })
    }
  }

  // ── Create schedule handler ─────────────────────
  const handleCreateSchedule = async () => {
    setSchedSubmitting(true)
    try {
      const recipients = schedForm.recipients.split(',').map(s => s.trim()).filter(Boolean)
      await reportService.createSchedule({
        name: schedForm.name,
        reportType: schedForm.reportType,
        frequency: schedForm.frequency,
        recipients,
        serviceName: schedForm.serviceName || undefined,
      })
      setSnackbar({ open: true, message: 'Schedule created', severity: 'success' })
      setSchedOpen(false)
      setSchedForm({ name: '', reportType: 'KPI', frequency: 'WEEKLY', recipients: '', serviceName: '' })
      fetchSchedules()
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to create schedule', severity: 'error' })
    } finally {
      setSchedSubmitting(false)
    }
  }

  // ── Toggle schedule active/paused ───────────────
  const handleToggleSchedule = async (schedule: ReportSchedule) => {
    try {
      await reportService.updateSchedule(schedule.id, { active: !schedule.active })
      setSnackbar({
        open: true,
        message: schedule.active ? 'Schedule paused' : 'Schedule activated',
        severity: 'success',
      })
      fetchSchedules()
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to update schedule', severity: 'error' })
    }
  }

  // ── Delete schedule ─────────────────────────────
  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm('Delete this schedule?')) return
    try {
      await reportService.deleteSchedule(id)
      setSnackbar({ open: true, message: 'Schedule deleted', severity: 'success' })
      fetchSchedules()
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to delete schedule', severity: 'error' })
    }
  }

  // ── Clear filters ───────────────────────────────
  const hasFilters = filterType !== '' || filterStatus !== ''
  const clearFilters = () => { setFilterType(''); setFilterStatus(''); setReportPage(0) }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Reports</Typography>
          <Typography variant="body2" color="text.secondary">
            Generate KPI and Performance reports, download PDFs, and configure scheduled email delivery.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<ScheduleIcon />} onClick={() => setSchedOpen(true)}>
            New Schedule
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setGenOpen(true)}>
            Generate Report
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab icon={<AssessmentIcon />} iconPosition="start" label="Report History" />
          <Tab icon={<ScheduleIcon />}   iconPosition="start" label="Email Schedules" />
        </Tabs>
      </Box>

      {/* ── Tab 0: Report History ────────────────────────────────────────────── */}
      {tab === 0 && (
        <>
          {/* Filters */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Report Type</InputLabel>
                <Select
                  value={filterType}
                  label="Report Type"
                  onChange={(e) => { setFilterType(e.target.value as ReportType | ''); setReportPage(0) }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="KPI">KPI</MenuItem>
                  <MenuItem value="PERFORMANCE">Performance</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status"
                  onChange={(e) => { setFilterStatus(e.target.value as ReportStatus | ''); setReportPage(0) }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="QUEUED">Queued</MenuItem>
                  <MenuItem value="GENERATING">Generating</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                  <MenuItem value="FAILED">Failed</MenuItem>
                </Select>
              </FormControl>

              {hasFilters && (
                <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters}>
                  Clear
                </Button>
              )}

              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="Refresh">
                <IconButton onClick={fetchReports} size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>

          {/* Reports table */}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Time Range</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Requested</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><Skeleton /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      No reports found. Click "Generate Report" to create one.
                    </TableCell>
                  </TableRow>
                ) : reports.map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{report.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={report.reportType}
                        size="small"
                        color={report.reportType === 'KPI' ? 'primary' : 'secondary'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={report.status}
                        size="small"
                        color={STATUS_COLORS[report.status]}
                        variant={report.status === 'COMPLETED' ? 'filled' : 'outlined'}
                      />
                      {report.status === 'GENERATING' && (
                        <CircularProgress size={14} sx={{ ml: 1, verticalAlign: 'middle' }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {report.serviceName || 'All services'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(report.timeRangeStart).format('MMM D, HH:mm')} — {dayjs(report.timeRangeEnd).format('MMM D, HH:mm')}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatBytes(report.fileSizeBytes)}</TableCell>
                    <TableCell>
                      <Tooltip title={dayjs(report.createdAt).format('YYYY-MM-DD HH:mm:ss')}>
                        <Typography variant="caption" color="text.secondary">
                          {(dayjs(report.createdAt) as any).fromNow?.() || dayjs(report.createdAt).format('MMM D, HH:mm')}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        {report.status === 'COMPLETED' && (
                          <Tooltip title="Download PDF">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleDownload(report)}
                              disabled={downloading === report.id}
                            >
                              {downloading === report.id
                                ? <CircularProgress size={18} />
                                : <DownloadIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDeleteReport(report.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={reportTotal}
              page={reportPage}
              rowsPerPage={reportSize}
              onPageChange={(_, p) => setReportPage(p)}
              onRowsPerPageChange={(e) => { setReportSize(+e.target.value); setReportPage(0) }}
              rowsPerPageOptions={[10, 20, 50]}
            />
          </TableContainer>
        </>
      )}

      {/* ── Tab 1: Email Schedules ───────────────────────────────────────────── */}
      {tab === 1 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Report Type</TableCell>
                <TableCell>Frequency</TableCell>
                <TableCell>Recipients</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Run</TableCell>
                <TableCell>Next Run</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scheduleLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : schedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No email schedules configured. Click "New Schedule" to create one.
                  </TableCell>
                </TableRow>
              ) : schedules.map((schedule) => (
                <TableRow key={schedule.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{schedule.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={schedule.reportType}
                      size="small"
                      color={schedule.reportType === 'KPI' ? 'primary' : 'secondary'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{FREQUENCY_LABELS[schedule.frequency]}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {schedule.recipients.join(', ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {schedule.serviceName || 'All'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={schedule.active ? 'Active' : 'Paused'}
                      size="small"
                      color={schedule.active ? 'success' : 'default'}
                      variant={schedule.active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {schedule.lastRunAt ? dayjs(schedule.lastRunAt).format('MMM D, HH:mm') : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {schedule.nextRunAt ? dayjs(schedule.nextRunAt).format('MMM D, HH:mm') : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title={schedule.active ? 'Pause' : 'Activate'}>
                        <IconButton size="small" onClick={() => handleToggleSchedule(schedule)}>
                          {schedule.active ? <PauseCircleIcon fontSize="small" /> : <PlayCircleIcon fontSize="small" color="success" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteSchedule(schedule.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={scheduleTotal}
            page={schedulePage}
            rowsPerPage={scheduleSize}
            onPageChange={(_, p) => setSchedulePage(p)}
            onRowsPerPageChange={(e) => { setScheduleSize(+e.target.value); setSchedulePage(0) }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </TableContainer>
      )}

      {/* ── Generate Report Dialog ───────────────────────────────────────────── */}
      <Dialog open={genOpen} onClose={() => setGenOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Report</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Report Name"
            value={genForm.name}
            onChange={(e) => setGenForm({ ...genForm, name: e.target.value })}
            required
            fullWidth
            placeholder="e.g., Weekly KPI Report"
          />
          <FormControl fullWidth>
            <InputLabel>Report Type</InputLabel>
            <Select
              value={genForm.reportType}
              label="Report Type"
              onChange={(e) => setGenForm({ ...genForm, reportType: e.target.value as ReportType })}
            >
              <MenuItem value="KPI">KPI Report — SLA compliance, alerts, top offenders</MenuItem>
              <MenuItem value="PERFORMANCE">Performance Report — latency, throughput, error budgets</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Service Name (optional)"
            value={genForm.serviceName}
            onChange={(e) => setGenForm({ ...genForm, serviceName: e.target.value })}
            placeholder="Leave blank for all services"
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="From"
              type="datetime-local"
              value={genForm.timeRangeStart}
              onChange={(e) => setGenForm({ ...genForm, timeRangeStart: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="datetime-local"
              value={genForm.timeRangeEnd}
              onChange={(e) => setGenForm({ ...genForm, timeRangeEnd: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={genSubmitting || !genForm.name}
            startIcon={genSubmitting ? <CircularProgress size={18} /> : <AssessmentIcon />}
          >
            Generate
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Create Schedule Dialog ───────────────────────────────────────────── */}
      <Dialog open={schedOpen} onClose={() => setSchedOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Email Schedule</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Schedule Name"
            value={schedForm.name}
            onChange={(e) => setSchedForm({ ...schedForm, name: e.target.value })}
            required
            fullWidth
            placeholder="e.g., Weekly KPI Digest"
          />
          <FormControl fullWidth>
            <InputLabel>Report Type</InputLabel>
            <Select
              value={schedForm.reportType}
              label="Report Type"
              onChange={(e) => setSchedForm({ ...schedForm, reportType: e.target.value as ReportType })}
            >
              <MenuItem value="KPI">KPI Report</MenuItem>
              <MenuItem value="PERFORMANCE">Performance Report</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Frequency</InputLabel>
            <Select
              value={schedForm.frequency}
              label="Frequency"
              onChange={(e) => setSchedForm({ ...schedForm, frequency: e.target.value as ScheduleFrequency })}
            >
              <MenuItem value="DAILY">Daily (06:00 UTC)</MenuItem>
              <MenuItem value="WEEKLY">Weekly (Monday 06:00 UTC)</MenuItem>
              <MenuItem value="MONTHLY">Monthly (1st, 06:00 UTC)</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Recipients"
            value={schedForm.recipients}
            onChange={(e) => setSchedForm({ ...schedForm, recipients: e.target.value })}
            required
            fullWidth
            placeholder="email1@company.com, email2@company.com"
            helperText="Comma-separated email addresses"
          />
          <TextField
            label="Service Name (optional)"
            value={schedForm.serviceName}
            onChange={(e) => setSchedForm({ ...schedForm, serviceName: e.target.value })}
            placeholder="Leave blank for all services"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSchedOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateSchedule}
            disabled={schedSubmitting || !schedForm.name || !schedForm.recipients}
            startIcon={schedSubmitting ? <CircularProgress size={18} /> : <ScheduleIcon />}
          >
            Create Schedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ─────────────────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MuiAlert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Box>
  )
}
