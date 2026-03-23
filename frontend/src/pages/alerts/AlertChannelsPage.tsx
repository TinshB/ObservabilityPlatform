import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Alert, Snackbar, Tooltip, Switch,
  Skeleton,
} from '@mui/material'
import AddIcon    from '@mui/icons-material/Add'
import EditIcon   from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { AlertChannel, ChannelType, CreateAlertChannelPayload, UpdateAlertChannelPayload } from '@/types'
import * as alertChannelService from '@/services/alertChannelService'
import { type FieldErrors, parseApiError, hasFieldErrors, clearFieldError } from '@/utils/formErrors'

const CHANNEL_TYPES: { value: ChannelType; label: string; configHint: string }[] = [
  { value: 'EMAIL',    label: 'Email',    configHint: 'recipients (comma-separated emails)' },
  { value: 'SMS',      label: 'SMS',      configHint: 'phone numbers (comma-separated, e.g. +1234567890)' },
  { value: 'MS_TEAMS', label: 'MS Teams', configHint: 'webhook URL from your Teams channel connector' },
]

function channelTypeColor(t: string): 'primary' | 'secondary' | 'info' {
  if (t === 'EMAIL') return 'primary'
  if (t === 'SMS') return 'secondary'
  return 'info'
}

/** Parse a JSON config string into a user-friendly display. */
function formatConfig(channelType: string, config: string): string {
  try {
    const parsed = JSON.parse(config)
    if (channelType === 'EMAIL' && parsed.recipients) {
      return (parsed.recipients as string[]).join(', ')
    }
    if (channelType === 'SMS' && parsed.phoneNumbers) {
      return (parsed.phoneNumbers as string[]).join(', ')
    }
    if (channelType === 'MS_TEAMS' && parsed.webhookUrl) {
      const url = parsed.webhookUrl as string
      return url.length > 60 ? url.substring(0, 60) + '...' : url
    }
  } catch { /* fallback below */ }
  return config.length > 80 ? config.substring(0, 80) + '...' : config
}

interface ConfigForm {
  // EMAIL
  recipients: string
  from: string
  // SMS
  phoneNumbers: string
  // MS_TEAMS
  webhookUrl: string
}

const EMPTY_CONFIG: ConfigForm = { recipients: '', from: '', phoneNumbers: '', webhookUrl: '' }

/** Convert structured config fields to a JSON string based on channel type. */
function buildConfigJson(type: ChannelType, cfg: ConfigForm): string {
  switch (type) {
    case 'EMAIL':
      return JSON.stringify({
        recipients: cfg.recipients.split(',').map(s => s.trim()).filter(Boolean),
        ...(cfg.from.trim() ? { from: cfg.from.trim() } : {}),
      })
    case 'SMS':
      return JSON.stringify({
        phoneNumbers: cfg.phoneNumbers.split(',').map(s => s.trim()).filter(Boolean),
      })
    case 'MS_TEAMS':
      return JSON.stringify({ webhookUrl: cfg.webhookUrl.trim() })
  }
}

/** Parse a JSON config string back to structured fields. */
function parseConfigJson(type: string, config: string): ConfigForm {
  const form = { ...EMPTY_CONFIG }
  try {
    const parsed = JSON.parse(config)
    if (type === 'EMAIL') {
      form.recipients = (parsed.recipients ?? []).join(', ')
      form.from = parsed.from ?? ''
    } else if (type === 'SMS') {
      form.phoneNumbers = (parsed.phoneNumbers ?? []).join(', ')
    } else if (type === 'MS_TEAMS') {
      form.webhookUrl = parsed.webhookUrl ?? ''
    }
  } catch { /* best-effort */ }
  return form
}

function isConfigValid(type: ChannelType, cfg: ConfigForm): boolean {
  switch (type) {
    case 'EMAIL':    return cfg.recipients.trim().length > 0
    case 'SMS':      return cfg.phoneNumbers.trim().length > 0
    case 'MS_TEAMS': return cfg.webhookUrl.trim().length > 0
  }
}

export default function AlertChannelsPage() {
  const [channels, setChannels]   = useState<AlertChannel[]>([])
  const [loading, setLoading]     = useState(true)

  const [dialogOpen, setDialogOpen]     = useState(false)
  const [editingChannel, setEditingChannel] = useState<AlertChannel | null>(null)
  const [name, setName]                 = useState('')
  const [channelType, setChannelType]   = useState<ChannelType>('EMAIL')
  const [configForm, setConfigForm]     = useState<ConfigForm>({ ...EMPTY_CONFIG })
  const [fieldErrors, setFieldErrors]   = useState<FieldErrors>({})

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingChannel, setDeletingChannel]     = useState<AlertChannel | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' },
  )

  const fetchChannels = useCallback(async () => {
    setLoading(true)
    try {
      setChannels(await alertChannelService.listChannels())
    } catch {
      setSnackbar({ open: true, message: 'Failed to load channels', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChannels() }, [fetchChannels])

  // ── Open create / edit ─────────────────────────────────────
  const openCreate = () => {
    setEditingChannel(null)
    setName('')
    setChannelType('EMAIL')
    setConfigForm({ ...EMPTY_CONFIG })
    setFieldErrors({})
    setDialogOpen(true)
  }

  const openEdit = (ch: AlertChannel) => {
    setEditingChannel(ch)
    setName(ch.name)
    setChannelType(ch.channelType as ChannelType)
    setConfigForm(parseConfigJson(ch.channelType, ch.config))
    setFieldErrors({})
    setDialogOpen(true)
  }

  // ── Save ───────────────────────────────────────────────────
  const handleSave = async () => {
    const configJson = buildConfigJson(channelType, configForm)

    try {
      if (editingChannel) {
        const payload: UpdateAlertChannelPayload = { name, channelType, config: configJson }
        await alertChannelService.updateChannel(editingChannel.id, payload)
        setSnackbar({ open: true, message: 'Channel updated', severity: 'success' })
      } else {
        const payload: CreateAlertChannelPayload = { name, channelType, config: configJson }
        await alertChannelService.createChannel(payload)
        setSnackbar({ open: true, message: 'Channel created', severity: 'success' })
      }
      setDialogOpen(false)
      fetchChannels()
    } catch (err: unknown) {
      const { fieldErrors: fe, message } = parseApiError(err)
      setFieldErrors(fe)
      if (!hasFieldErrors(fe)) {
        setSnackbar({ open: true, message, severity: 'error' })
      }
    }
  }

  // ── Toggle enabled ─────────────────────────────────────────
  const handleToggle = async (ch: AlertChannel) => {
    try {
      await alertChannelService.updateChannel(ch.id, { enabled: !ch.enabled })
      fetchChannels()
    } catch {
      setSnackbar({ open: true, message: 'Failed to toggle channel', severity: 'error' })
    }
  }

  // ── Delete ─────────────────────────────────────────────────
  const confirmDelete = (ch: AlertChannel) => { setDeletingChannel(ch); setDeleteConfirmOpen(true) }
  const handleDelete = async () => {
    if (!deletingChannel) return
    try {
      await alertChannelService.deleteChannel(deletingChannel.id)
      setSnackbar({ open: true, message: 'Channel deleted', severity: 'success' })
      setDeleteConfirmOpen(false)
      setDeletingChannel(null)
      fetchChannels()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete channel', severity: 'error' })
    }
  }

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Notification Channels</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Create Channel</Button>
      </Box>

      {/* ── Table ───────────────────────────────────────────────── */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Configuration</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : channels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">
                    No notification channels configured yet. Create one so SLA rules can send alerts.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : channels.map((ch) => (
              <TableRow key={ch.id} hover>
                <TableCell>
                  <Typography fontWeight={600} fontSize="0.875rem">{ch.name}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={ch.channelType} size="small" color={channelTypeColor(ch.channelType)} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                    {formatConfig(ch.channelType, ch.config)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Switch checked={ch.enabled} size="small" onChange={() => handleToggle(ch)} />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(ch.createdAt).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(ch)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => confirmDelete(ch)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Create / Edit Dialog ────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingChannel ? 'Edit Channel' : 'Create Notification Channel'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Channel Name" required value={name}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name}
            onChange={(e) => { setName(e.target.value); setFieldErrors(prev => clearFieldError(prev, 'name')) }} />

          <TextField label="Channel Type" select value={channelType}
            onChange={(e) => { setChannelType(e.target.value as ChannelType); setConfigForm({ ...EMPTY_CONFIG }) }}>
            {CHANNEL_TYPES.map(t => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>

          {/* Type-specific config fields */}
          {channelType === 'EMAIL' && (
            <>
              <TextField
                label="Recipients"
                required
                value={configForm.recipients}
                error={!!fieldErrors.config}
                helperText={fieldErrors.config || 'Comma-separated email addresses (e.g. ops@example.com, team@example.com)'}
                onChange={(e) => { setConfigForm(f => ({ ...f, recipients: e.target.value })); setFieldErrors(prev => clearFieldError(prev, 'config')) }}
              />
              <TextField
                label="From Address"
                value={configForm.from}
                helperText="Optional sender address (default: system address)"
                onChange={(e) => setConfigForm(f => ({ ...f, from: e.target.value }))}
              />
            </>
          )}

          {channelType === 'SMS' && (
            <TextField
              label="Phone Numbers"
              required
              value={configForm.phoneNumbers}
              error={!!fieldErrors.config}
              helperText={fieldErrors.config || 'Comma-separated phone numbers with country code (e.g. +1234567890)'}
              onChange={(e) => { setConfigForm(f => ({ ...f, phoneNumbers: e.target.value })); setFieldErrors(prev => clearFieldError(prev, 'config')) }}
            />
          )}

          {channelType === 'MS_TEAMS' && (
            <TextField
              label="Webhook URL"
              required
              value={configForm.webhookUrl}
              error={!!fieldErrors.config}
              helperText={fieldErrors.config || 'Incoming webhook URL from your MS Teams channel connector'}
              onChange={(e) => { setConfigForm(f => ({ ...f, webhookUrl: e.target.value })); setFieldErrors(prev => clearFieldError(prev, 'config')) }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}
            disabled={!name.trim() || !isConfigValid(channelType, configForm)}>
            {editingChannel ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Channel</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete channel <strong>{deletingChannel?.name}</strong>?
            Any SLA rules using this channel will stop sending notifications to it.
          </Typography>
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
