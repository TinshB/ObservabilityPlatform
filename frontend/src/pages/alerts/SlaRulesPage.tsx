import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Alert, Snackbar, Tooltip, Switch,
  Skeleton, TablePagination, Autocomplete, Checkbox,
} from '@mui/material'
import AddIcon    from '@mui/icons-material/Add'
import EditIcon   from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type {
  SlaRule, Service, AlertChannel, CreateSlaRulePayload, UpdateSlaRulePayload,
  SignalType, SlaOperator, AlertSeverity, AlertGroupKey,
} from '@/types'
import * as slaService from '@/services/slaService'
import * as alertChannelService from '@/services/alertChannelService'
import { getServices } from '@/services/serviceService'

const SIGNAL_TYPES: SignalType[] = ['METRICS', 'LOGS']
const OPERATORS: { value: SlaOperator; label: string }[] = [
  { value: 'GT',  label: '> (Greater than)' },
  { value: 'GTE', label: '>= (Greater or equal)' },
  { value: 'LT',  label: '< (Less than)' },
  { value: 'LTE', label: '<= (Less or equal)' },
  { value: 'EQ',  label: '= (Equal)' },
  { value: 'NEQ', label: '!= (Not equal)' },
]
const SEVERITIES: AlertSeverity[] = ['CRITICAL', 'WARNING', 'INFO']
const METRIC_PRESETS = ['p99_latency', 'p95_latency', 'p50_latency', 'error_rate', 'request_rate']
const LOG_CONDITION_PRESETS = ['error_count', 'error_ratio', 'total_log_volume']
const WINDOW_PRESETS = ['1m', '5m', '15m', '30m', '1h']
const GROUP_KEYS: { value: AlertGroupKey; label: string }[] = [
  { value: 'service',          label: 'Service (default)' },
  { value: 'service+severity', label: 'Service + Severity' },
  { value: 'service+signal',   label: 'Service + Signal Type' },
  { value: 'none',             label: 'No grouping' },
]
const SUPPRESSION_PRESETS = ['5m', '15m', '30m', '1h', '4h']

const EMPTY_FORM: CreateSlaRulePayload = {
  serviceId: '', name: '', description: '', signalType: 'METRICS',
  metricName: '', logCondition: '', operator: 'GT', threshold: 0,
  evaluationWindow: '5m', pendingPeriods: 1, severity: 'WARNING',
  groupKey: 'service', suppressionWindow: '15m', channelIds: [],
}

function severityColor(s: string): 'error' | 'warning' | 'info' {
  if (s === 'CRITICAL') return 'error'
  if (s === 'WARNING') return 'warning'
  return 'info'
}

export default function SlaRulesPage() {
  const [rules, setRules]         = useState<SlaRule[]>([])
  const [services, setServices]   = useState<Service[]>([])
  const [channels, setChannels]   = useState<AlertChannel[]>([])
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(0)
  const [size, setSize]           = useState(10)
  const [totalElements, setTotalElements] = useState(0)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<SlaRule | null>(null)
  const [form, setForm] = useState<CreateSlaRulePayload>({ ...EMPTY_FORM })

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingRule, setDeletingRule] = useState<SlaRule | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' },
  )

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const result = await slaService.listRules({ page, size })
      setRules(result.content)
      setTotalElements(result.totalElements)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load SLA rules', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [page, size])

  const fetchMeta = useCallback(async () => {
    try {
      const [svcResult, chResult] = await Promise.all([
        getServices({ size: 200 }),
        alertChannelService.listChannels(),
      ])
      setServices(svcResult.content)
      setChannels(chResult)
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])
  useEffect(() => { fetchMeta() }, [fetchMeta])

  // ── Open create / edit dialog ────────────────────────────────
  const openCreate = () => {
    setEditingRule(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const openEdit = (rule: SlaRule) => {
    setEditingRule(rule)
    setForm({
      serviceId: rule.serviceId,
      name: rule.name,
      description: rule.description ?? '',
      signalType: rule.signalType,
      metricName: rule.metricName ?? '',
      logCondition: rule.logCondition ?? '',
      operator: rule.operator,
      threshold: rule.threshold,
      evaluationWindow: rule.evaluationWindow,
      pendingPeriods: rule.pendingPeriods,
      severity: rule.severity,
      groupKey: rule.groupKey,
      suppressionWindow: rule.suppressionWindow,
      channelIds: rule.channels.map(c => c.id),
    })
    setDialogOpen(true)
  }

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      if (editingRule) {
        const payload: UpdateSlaRulePayload = {
          name: form.name, description: form.description, signalType: form.signalType,
          metricName: form.metricName, logCondition: form.logCondition, operator: form.operator,
          threshold: form.threshold, evaluationWindow: form.evaluationWindow,
          pendingPeriods: form.pendingPeriods, severity: form.severity,
          groupKey: form.groupKey, suppressionWindow: form.suppressionWindow,
          channelIds: form.channelIds,
        }
        await slaService.updateRule(editingRule.id, payload)
        setSnackbar({ open: true, message: 'Rule updated', severity: 'success' })
      } else {
        await slaService.createRule(form)
        setSnackbar({ open: true, message: 'Rule created', severity: 'success' })
      }
      setDialogOpen(false)
      fetchRules()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to save rule'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    }
  }

  // ── Toggle enabled ───────────────────────────────────────────
  const handleToggleEnabled = async (rule: SlaRule) => {
    try {
      await slaService.updateRule(rule.id, { enabled: !rule.enabled })
      fetchRules()
    } catch {
      setSnackbar({ open: true, message: 'Failed to toggle rule', severity: 'error' })
    }
  }

  // ── Delete ───────────────────────────────────────────────────
  const confirmDelete = (rule: SlaRule) => { setDeletingRule(rule); setDeleteConfirmOpen(true) }
  const handleDelete = async () => {
    if (!deletingRule) return
    try {
      await slaService.deleteRule(deletingRule.id)
      setSnackbar({ open: true, message: 'Rule deleted', severity: 'success' })
      setDeleteConfirmOpen(false)
      setDeletingRule(null)
      fetchRules()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete rule', severity: 'error' })
    }
  }

  const updateField = <K extends keyof CreateSlaRulePayload>(k: K, v: CreateSlaRulePayload[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>SLA Rules</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Create Rule</Button>
      </Box>

      {/* ── Table ───────────────────────────────────────────────── */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Signal</TableCell>
              <TableCell>Condition</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell>Channels</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No SLA rules configured yet. Create one to start monitoring.</Typography>
                </TableCell>
              </TableRow>
            ) : rules.map((rule) => (
              <TableRow key={rule.id} hover>
                <TableCell>
                  <Typography fontWeight={600} fontSize="0.875rem">{rule.name}</Typography>
                  {rule.description && (
                    <Typography variant="caption" color="text.secondary">{rule.description}</Typography>
                  )}
                </TableCell>
                <TableCell>{rule.serviceName}</TableCell>
                <TableCell><Chip label={rule.signalType} size="small" variant="outlined" /></TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                    {rule.signalType === 'METRICS' ? rule.metricName : rule.logCondition}
                    {' '}{rule.operator} {rule.threshold}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    window: {rule.evaluationWindow}, pending: {rule.pendingPeriods}
                  </Typography>
                </TableCell>
                <TableCell><Chip label={rule.severity} size="small" color={severityColor(rule.severity)} /></TableCell>
                <TableCell>
                  <Switch checked={rule.enabled} size="small" onChange={() => handleToggleEnabled(rule)} />
                </TableCell>
                <TableCell>
                  {rule.channels.length > 0
                    ? rule.channels.map(c => <Chip key={c.id} label={c.name} size="small" sx={{ mr: 0.5, mb: 0.5 }} />)
                    : <Typography variant="caption" color="text.secondary">None</Typography>}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(rule)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => confirmDelete(rule)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
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

      {/* ── Create / Edit Dialog ────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingRule ? 'Edit SLA Rule' : 'Create SLA Rule'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {/* Name & Description */}
          <TextField label="Rule Name" required value={form.name}
            onChange={(e) => updateField('name', e.target.value)} />
          <TextField label="Description" value={form.description}
            onChange={(e) => updateField('description', e.target.value)} multiline rows={2} />

          {/* Service */}
          <TextField label="Service" select required value={form.serviceId}
            onChange={(e) => updateField('serviceId', e.target.value)}>
            {services.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>

          {/* Signal type */}
          <TextField label="Signal Type" select value={form.signalType}
            onChange={(e) => updateField('signalType', e.target.value as SignalType)}>
            {SIGNAL_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>

          {/* Condition builder — metric or log */}
          {form.signalType === 'METRICS' ? (
            <Autocomplete freeSolo options={METRIC_PRESETS} value={form.metricName ?? ''}
              onInputChange={(_, v) => updateField('metricName', v)}
              renderInput={(params) => <TextField {...params} label="Metric Name / PromQL" helperText="e.g. p99_latency, error_rate, or raw PromQL" />}
            />
          ) : (
            <Autocomplete freeSolo options={LOG_CONDITION_PRESETS} value={form.logCondition ?? ''}
              onInputChange={(_, v) => updateField('logCondition', v)}
              renderInput={(params) => <TextField {...params} label="Log Condition" helperText="e.g. error_count, error_ratio, or severity name" />}
            />
          )}

          {/* Operator & threshold */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Operator" select value={form.operator} sx={{ minWidth: 200 }}
              onChange={(e) => updateField('operator', e.target.value as SlaOperator)}>
              {OPERATORS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField label="Threshold" type="number" value={form.threshold} fullWidth
              onChange={(e) => updateField('threshold', parseFloat(e.target.value) || 0)}
              inputProps={{ step: 0.01 }} />
          </Box>

          {/* Window & pending periods */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Autocomplete freeSolo options={WINDOW_PRESETS} value={form.evaluationWindow ?? '5m'}
              onInputChange={(_, v) => updateField('evaluationWindow', v)} sx={{ flex: 1 }}
              renderInput={(params) => <TextField {...params} label="Evaluation Window" />}
            />
            <TextField label="Pending Periods" type="number" value={form.pendingPeriods ?? 1} sx={{ flex: 1 }}
              onChange={(e) => updateField('pendingPeriods', parseInt(e.target.value) || 1)}
              helperText="Consecutive breaches before firing"
              inputProps={{ min: 1 }} />
          </Box>

          {/* Severity */}
          <TextField label="Severity" select value={form.severity}
            onChange={(e) => updateField('severity', e.target.value as AlertSeverity)}>
            {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>

          {/* Story 11.2: Grouping & suppression */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Alert Grouping" select value={form.groupKey ?? 'service'} sx={{ flex: 1 }}
              onChange={(e) => updateField('groupKey', e.target.value as AlertGroupKey)}
              helperText="Group related alerts into a single notification">
              {GROUP_KEYS.map(g => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
            </TextField>
            <Autocomplete freeSolo options={SUPPRESSION_PRESETS} value={form.suppressionWindow ?? '15m'}
              onInputChange={(_, v) => updateField('suppressionWindow', v)} sx={{ flex: 1 }}
              renderInput={(params) => <TextField {...params} label="Suppression Window"
                helperText="Suppress repeat notifications for this duration" />}
            />
          </Box>

          {/* Channel selection */}
          <Autocomplete
            multiple disableCloseOnSelect
            options={channels}
            getOptionLabel={(ch) => `${ch.name} (${ch.channelType})`}
            value={channels.filter(ch => form.channelIds?.includes(ch.id))}
            onChange={(_, selected) => updateField('channelIds', selected.map(ch => ch.id))}
            renderOption={(props, option, { selected }) => (
              <li {...props}><Checkbox size="small" checked={selected} sx={{ mr: 1 }} />{option.name} ({option.channelType})</li>
            )}
            renderInput={(params) => <TextField {...params} label="Notification Channels" />}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}
            disabled={!form.name || !form.serviceId}>
            {editingRule ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete SLA Rule</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete rule <strong>{deletingRule?.name}</strong>? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
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
