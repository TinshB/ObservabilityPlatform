import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Alert, Snackbar, Tooltip, Skeleton,
  TablePagination, TextField, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DoneAllIcon     from '@mui/icons-material/DoneAll'
import RefreshIcon     from '@mui/icons-material/Refresh'
import RuleIcon        from '@mui/icons-material/Rule'
import { useNavigate }  from 'react-router-dom'
import type { Alert as AlertType, AlertState, AlertSeverity } from '@/types'
import * as alertService from '@/services/alertService'

const AlertHistoryPage = lazy(() => import('./AlertHistoryPage'))

const STATES: AlertState[]       = ['FIRING', 'PENDING', 'RESOLVED', 'OK']
const SEVERITIES: AlertSeverity[] = ['CRITICAL', 'WARNING', 'INFO']

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

export default function AlertsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(0)
  const [alerts, setAlerts]   = useState<AlertType[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(0)
  const [size, setSize]       = useState(20)
  const [totalElements, setTotalElements] = useState(0)

  // Filters
  const [stateFilter, setStateFilter]       = useState<string>('')
  const [severityFilter, setSeverityFilter] = useState<string>('')

  // Action dialog
  const [actionAlert, setActionAlert]   = useState<AlertType | null>(null)
  const [actionType, setActionType]     = useState<'acknowledge' | 'resolve' | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' },
  )

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, size }
      if (stateFilter) params.state = stateFilter
      if (severityFilter) params.severity = severityFilter
      const result = await alertService.listAlerts(params)
      setAlerts(result.content)
      setTotalElements(result.totalElements)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load alerts', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [page, size, stateFilter, severityFilter])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  // ── Actions ──────────────────────────────────────────────────
  const openAction = (alert: AlertType, type: 'acknowledge' | 'resolve') => {
    setActionAlert(alert)
    setActionType(type)
  }

  const handleAction = async () => {
    if (!actionAlert || !actionType) return
    try {
      if (actionType === 'acknowledge') {
        await alertService.acknowledgeAlert(actionAlert.id)
        setSnackbar({ open: true, message: 'Alert acknowledged', severity: 'success' })
      } else {
        await alertService.resolveAlert(actionAlert.id)
        setSnackbar({ open: true, message: 'Alert resolved', severity: 'success' })
      }
      setActionAlert(null)
      setActionType(null)
      fetchAlerts()
    } catch (err: any) {
      const msg = err?.response?.data?.message || `Failed to ${actionType} alert`
      setSnackbar({ open: true, message: msg, severity: 'error' })
    }
  }

  const firingCount = alerts.filter(a => a.state === 'FIRING').length

  return (
    <Box>
      {/* ── Header + Tabs (sticky) ────────────────────────────── */}
      <Box sx={{ position: 'sticky', top: 64, zIndex: 10, bgcolor: 'background.default', mx: -3, px: 3, pb: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h5" fontWeight={700}>Alerts</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<RuleIcon />} onClick={() => navigate('/sla-rules')}>
              SLA Rules
            </Button>
          </Box>
        </Box>

        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={firingCount > 0 ? `Active Alerts (${firingCount})` : 'Active Alerts'} />
          <Tab label="History" />
        </Tabs>
      </Box>

      {activeTab === 1 ? (
        <Suspense fallback={<Skeleton variant="rectangular" height={400} />}>
          <AlertHistoryPage />
        </Suspense>
      ) : (
      <Box>
      {/* ── Filters (sticky) ──────────────────────────────────── */}
      <Box sx={{ position: 'sticky', top: 170, zIndex: 9, bgcolor: 'background.default', mx: -3, px: 3, pb: 1 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
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
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={fetchAlerts}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* ── Table ───────────────────────────────────────────────── */}
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100vh - 300px)' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 90 }}>State</TableCell>
              <TableCell sx={{ width: 100 }}>Severity</TableCell>
              <TableCell>Rule</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Fired At</TableCell>
              <TableCell>Acknowledged</TableCell>
              <TableCell align="right">Actions</TableCell>
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
                    {stateFilter || severityFilter
                      ? 'No alerts match the current filters.'
                      : 'No alerts yet. Alerts will appear when SLA rules detect breaches.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : alerts.map((alert) => (
              <TableRow key={alert.id} hover
                sx={{
                  backgroundColor: alert.state === 'FIRING' ? 'error.50' : undefined,
                  '&:hover': { backgroundColor: alert.state === 'FIRING' ? 'error.100' : undefined },
                }}>
                <TableCell sx={{ py: 0.5 }}><Chip label={alert.state} size="small" color={stateColor(alert.state)} sx={{ height: 22, fontSize: '0.75rem' }} /></TableCell>
                <TableCell sx={{ py: 0.5 }}><Chip label={alert.severity} size="small" color={severityColor(alert.severity)} sx={{ height: 22, fontSize: '0.75rem' }} /></TableCell>
                <TableCell>
                  <Typography fontWeight={600} fontSize="0.875rem">{alert.slaRuleName}</Typography>
                </TableCell>
                <TableCell>{alert.serviceName}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {alert.message || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {alert.evaluatedValue != null ? Number(alert.evaluatedValue).toFixed(4) : '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontSize="0.8rem">{formatDate(alert.firedAt)}</Typography>
                </TableCell>
                <TableCell>
                  {alert.acknowledgedAt ? (
                    <Tooltip title={`By ${alert.acknowledgedBy} at ${formatDate(alert.acknowledgedAt)}`}>
                      <Chip label={alert.acknowledgedBy} size="small" color="success" variant="outlined" />
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  {alert.state === 'FIRING' && !alert.acknowledgedAt && (
                    <Tooltip title="Acknowledge">
                      <IconButton size="small" color="primary" onClick={() => openAction(alert, 'acknowledge')}>
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {(alert.state === 'FIRING' || alert.state === 'PENDING') && (
                    <Tooltip title="Resolve">
                      <IconButton size="small" color="success" onClick={() => openAction(alert, 'resolve')}>
                        <DoneAllIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {!loading && totalElements > 0 && (
        <Paper variant="outlined" sx={{ borderTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <TablePagination
            component="div" count={totalElements} page={page} rowsPerPage={size}
            onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(+e.target.value); setPage(0) }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </Paper>
      )}
      </Box>
      )}

      {/* ── Action Confirmation Dialog ──────────────────────────── */}
      <Dialog open={!!actionAlert && !!actionType} onClose={() => { setActionAlert(null); setActionType(null) }}>
        <DialogTitle>
          {actionType === 'acknowledge' ? 'Acknowledge Alert' : 'Resolve Alert'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {actionType === 'acknowledge'
              ? <>Are you sure you want to acknowledge the alert for <strong>{actionAlert?.slaRuleName}</strong>?</>
              : <>Are you sure you want to manually resolve the alert for <strong>{actionAlert?.slaRuleName}</strong>?</>}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setActionAlert(null); setActionType(null) }}>Cancel</Button>
          <Button variant="contained"
            color={actionType === 'acknowledge' ? 'primary' : 'success'}
            onClick={handleAction}>
            {actionType === 'acknowledge' ? 'Acknowledge' : 'Resolve'}
          </Button>
        </DialogActions>
      </Dialog>

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
