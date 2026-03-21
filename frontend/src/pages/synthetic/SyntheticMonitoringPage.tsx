import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
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
  Collapse,
} from '@mui/material'
import AddIcon           from '@mui/icons-material/Add'
import DeleteIcon        from '@mui/icons-material/Delete'
import RefreshIcon       from '@mui/icons-material/Refresh'
import ClearIcon         from '@mui/icons-material/Clear'
import PauseCircleIcon   from '@mui/icons-material/PauseCircle'
import PlayCircleIcon    from '@mui/icons-material/PlayCircle'
import ExpandMoreIcon    from '@mui/icons-material/ExpandMore'
import ExpandLessIcon    from '@mui/icons-material/ExpandLess'
import CheckCircleIcon   from '@mui/icons-material/CheckCircle'
import ErrorIcon         from '@mui/icons-material/Error'
import dayjs             from 'dayjs'
import * as syntheticService from '@/services/syntheticService'
import type { SyntheticCheck, SyntheticResult } from '@/types'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'] as const

const CRON_PRESETS = [
  { label: 'Every 1 minute',  value: '0 */1 * * * *' },
  { label: 'Every 5 minutes', value: '0 */5 * * * *' },
  { label: 'Every 15 minutes', value: '0 */15 * * * *' },
  { label: 'Every 30 minutes', value: '0 */30 * * * *' },
  { label: 'Every hour',      value: '0 0 * * * *' },
] as const

export default function SyntheticMonitoringPage() {
  // ── Checks state ────────────────────────────────
  const [checks, setChecks]       = useState<SyntheticCheck[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [size, setSize]           = useState(20)
  const [loading, setLoading]     = useState(true)
  const [filterActive, setFilterActive] = useState<'' | 'true' | 'false'>('')

  // ── Expanded row for results ────────────────────
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [results, setResults]             = useState<SyntheticResult[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)

  // ── Create dialog ───────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm]             = useState({
    name: '',
    url: '',
    httpMethod: 'GET',
    scheduleCron: '0 */5 * * * *',
    timeoutMs: '5000',
    expectedStatusCode: '200',
    expectedBodyContains: '',
    maxLatencyMs: '',
    serviceName: '',
    slaRuleId: '',
  })
  const [submitting, setSubmitting] = useState(false)

  // ── Snackbar ────────────────────────────────────
  const [snackbar, setSnackbar] = useState<{
    open: boolean; message: string; severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  // ── Fetch checks ────────────────────────────────
  const fetchChecks = useCallback(async () => {
    setLoading(true)
    try {
      const result = await syntheticService.listChecks({
        active: filterActive === '' ? undefined : filterActive === 'true',
        page,
        size,
      })
      setChecks(result.content)
      setTotal(result.totalElements)
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to load checks', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [filterActive, page, size])

  useEffect(() => { fetchChecks() }, [fetchChecks])

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchChecks, 30_000)
    return () => clearInterval(interval)
  }, [fetchChecks])

  // ── Fetch results for expanded row ──────────────
  const handleExpand = async (checkId: string) => {
    if (expandedId === checkId) {
      setExpandedId(null)
      return
    }
    setExpandedId(checkId)
    setResultsLoading(true)
    try {
      const data = await syntheticService.getRecentResults(checkId)
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setResultsLoading(false)
    }
  }

  // ── Create check ────────────────────────────────
  const handleCreate = async () => {
    setSubmitting(true)
    try {
      await syntheticService.createCheck({
        name: form.name,
        url: form.url,
        httpMethod: form.httpMethod,
        scheduleCron: form.scheduleCron,
        timeoutMs: parseInt(form.timeoutMs) || 5000,
        expectedStatusCode: form.expectedStatusCode ? parseInt(form.expectedStatusCode) : undefined,
        expectedBodyContains: form.expectedBodyContains || undefined,
        maxLatencyMs: form.maxLatencyMs ? parseInt(form.maxLatencyMs) : undefined,
        serviceName: form.serviceName || undefined,
        slaRuleId: form.slaRuleId || undefined,
      })
      setSnackbar({ open: true, message: 'Synthetic check created', severity: 'success' })
      setCreateOpen(false)
      setForm({ name: '', url: '', httpMethod: 'GET', scheduleCron: '0 */5 * * * *', timeoutMs: '5000', expectedStatusCode: '200', expectedBodyContains: '', maxLatencyMs: '', serviceName: '', slaRuleId: '' })
      fetchChecks()
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to create check', severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Toggle active/paused ────────────────────────
  const handleToggle = async (check: SyntheticCheck) => {
    try {
      await syntheticService.updateCheck(check.id, { active: !check.active })
      setSnackbar({ open: true, message: check.active ? 'Check paused' : 'Check activated', severity: 'success' })
      fetchChecks()
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Update failed', severity: 'error' })
    }
  }

  // ── Delete check ────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this synthetic check and all its results?')) return
    try {
      await syntheticService.deleteCheck(id)
      setSnackbar({ open: true, message: 'Check deleted', severity: 'success' })
      if (expandedId === id) setExpandedId(null)
      fetchChecks()
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Delete failed', severity: 'error' })
    }
  }

  const hasFilters = filterActive !== ''

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Synthetic Monitoring</Typography>
          <Typography variant="body2" color="text.secondary">
            Create scheduled HTTP probes, validate responses, and track availability.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New Check
        </Button>
      </Box>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterActive}
              label="Status"
              onChange={(e) => { setFilterActive(e.target.value as any); setPage(0) }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Paused</MenuItem>
            </Select>
          </FormControl>
          {hasFilters && (
            <Button size="small" startIcon={<ClearIcon />} onClick={() => { setFilterActive(''); setPage(0) }}>
              Clear
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Refresh">
            <IconButton onClick={fetchChecks} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Checks table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={40} />
              <TableCell>Name</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Assertions</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : checks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No synthetic checks configured. Click "New Check" to create one.
                </TableCell>
              </TableRow>
            ) : checks.map((check) => (
              <>
                <TableRow key={check.id} hover sx={{ '& > *': { borderBottom: expandedId === check.id ? 'none' : undefined } }}>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleExpand(check.id)}>
                      {expandedId === check.id ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{check.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 250, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {check.url}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={check.httpMethod} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{check.scheduleCron}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {check.expectedStatusCode && <Chip label={`${check.expectedStatusCode}`} size="small" variant="outlined" />}
                      {check.maxLatencyMs && <Chip label={`< ${check.maxLatencyMs}ms`} size="small" variant="outlined" />}
                      {check.expectedBodyContains && <Chip label="body" size="small" variant="outlined" />}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{check.serviceName || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={check.active ? 'Active' : 'Paused'}
                      size="small"
                      color={check.active ? 'success' : 'default'}
                      variant={check.active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title={check.active ? 'Pause' : 'Activate'}>
                        <IconButton size="small" onClick={() => handleToggle(check)}>
                          {check.active ? <PauseCircleIcon fontSize="small" /> : <PlayCircleIcon fontSize="small" color="success" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(check.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>

                {/* Expanded: recent probe results */}
                <TableRow key={`${check.id}-results`}>
                  <TableCell colSpan={9} sx={{ p: 0 }}>
                    <Collapse in={expandedId === check.id} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 2, backgroundColor: 'action.hover' }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Recent Probe Results</Typography>
                        {resultsLoading ? (
                          <CircularProgress size={20} />
                        ) : results.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">No results yet — probes will execute on the configured schedule.</Typography>
                        ) : (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Time</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>HTTP Code</TableCell>
                                <TableCell>Latency</TableCell>
                                <TableCell>Status Match</TableCell>
                                <TableCell>Body Match</TableCell>
                                <TableCell>Latency Match</TableCell>
                                <TableCell>Error</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {results.map((r) => (
                                <TableRow key={r.id}>
                                  <TableCell>
                                    <Typography variant="caption">{dayjs(r.executedAt).format('YYYY-MM-DD HH:mm:ss')}</Typography>
                                  </TableCell>
                                  <TableCell>
                                    {r.success
                                      ? <CheckCircleIcon fontSize="small" color="success" />
                                      : <ErrorIcon fontSize="small" color="error" />}
                                  </TableCell>
                                  <TableCell>{r.statusCode ?? '—'}</TableCell>
                                  <TableCell>{r.latencyMs != null ? `${r.latencyMs}ms` : '—'}</TableCell>
                                  <TableCell>{renderMatch(r.statusCodeMatch)}</TableCell>
                                  <TableCell>{renderMatch(r.bodyMatch)}</TableCell>
                                  <TableCell>{renderMatch(r.latencyMatch)}</TableCell>
                                  <TableCell>
                                    <Typography variant="caption" color="error.main" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {r.errorMessage || '—'}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={size}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setSize(+e.target.value); setPage(0) }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </TableContainer>

      {/* ── Create Check Dialog ──────────────────────────────────────────────── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Synthetic Check</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Check Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required fullWidth
            placeholder="e.g., Order API Health"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Method</InputLabel>
              <Select value={form.httpMethod} label="Method"
                onChange={(e) => setForm({ ...form, httpMethod: e.target.value })}>
                {HTTP_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="URL"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              required fullWidth
              placeholder="https://api.example.com/health"
            />
          </Box>
          <FormControl fullWidth>
            <InputLabel>Schedule</InputLabel>
            <Select value={form.scheduleCron} label="Schedule"
              onChange={(e) => setForm({ ...form, scheduleCron: e.target.value })}>
              {CRON_PRESETS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Timeout (ms)" type="number"
              value={form.timeoutMs}
              onChange={(e) => setForm({ ...form, timeoutMs: e.target.value })}
              fullWidth
            />
            <TextField
              label="Expected Status Code" type="number"
              value={form.expectedStatusCode}
              onChange={(e) => setForm({ ...form, expectedStatusCode: e.target.value })}
              fullWidth placeholder="200"
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Max Latency (ms)" type="number"
              value={form.maxLatencyMs}
              onChange={(e) => setForm({ ...form, maxLatencyMs: e.target.value })}
              fullWidth placeholder="Optional"
            />
            <TextField
              label="Service Name"
              value={form.serviceName}
              onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
              fullWidth placeholder="Optional"
            />
          </Box>
          <TextField
            label="Expected Body Contains"
            value={form.expectedBodyContains}
            onChange={(e) => setForm({ ...form, expectedBodyContains: e.target.value })}
            fullWidth placeholder="Optional substring match"
          />
          <TextField
            label="SLA Rule ID"
            value={form.slaRuleId}
            onChange={(e) => setForm({ ...form, slaRuleId: e.target.value })}
            fullWidth placeholder="Optional — attach to existing SLA rule"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={submitting || !form.name || !form.url}
            startIcon={submitting ? <CircularProgress size={18} /> : <AddIcon />}
          >
            Create Check
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
        <MuiAlert severity={snackbar.severity} variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Box>
  )
}

function renderMatch(match?: boolean | null) {
  if (match === null || match === undefined) return <Typography variant="caption" color="text.secondary">—</Typography>
  return match
    ? <CheckCircleIcon fontSize="small" color="success" />
    : <ErrorIcon fontSize="small" color="error" />
}
