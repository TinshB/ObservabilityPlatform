import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel, Select,
  MenuItem, Alert, Snackbar, Tooltip, Switch, InputAdornment, Skeleton,
} from '@mui/material'
import AddIcon        from '@mui/icons-material/Add'
import EditIcon       from '@mui/icons-material/Edit'
import BlockIcon      from '@mui/icons-material/Block'
import SearchIcon     from '@mui/icons-material/Search'
import ClearIcon      from '@mui/icons-material/Clear'
import SensorsIcon    from '@mui/icons-material/Sensors'
import type { Service, ServiceFilters, PagedResponse } from '@/types'
import * as serviceService from '@/services/serviceService'

const ENV_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  production: 'error',
  staging:    'warning',
  dev:        'success',
}

export default function ServicesPage() {
  const navigate = useNavigate()
  const [services, setServices]     = useState<Service[]>([])
  const [page, setPage]             = useState(0)
  const [size, setSize]             = useState(20)
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [snackbar, setSnackbar]     = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  // Filters
  const [search, setSearch]               = useState('')
  const [envFilter, setEnvFilter]         = useState('')
  const [teamFilter, setTeamFilter]       = useState('')
  const [tierFilter, setTierFilter]       = useState('')
  const [filterOptions, setFilterOptions] = useState<ServiceFilters>({ environments: [], teams: [], tiers: [] })

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '', ownerTeam: '', environment: '', tier: '' })

  // Edit dialog
  const [editOpen, setEditOpen]     = useState(false)
  const [editService, setEditService] = useState<Service | null>(null)
  const [editForm, setEditForm]     = useState({ description: '', ownerTeam: '', environment: '', tier: '' })

  // Signals dialog
  const [signalsOpen, setSignalsOpen]       = useState(false)
  const [signalsService, setSignalsService] = useState<Service | null>(null)
  const [signalsForm, setSignalsForm]       = useState({ metricsEnabled: true, logsEnabled: true, tracesEnabled: true })

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const params: serviceService.ServiceListParams = { page, size }
      if (search)     params.search      = search
      if (envFilter)  params.environment = envFilter
      if (teamFilter) params.team        = teamFilter
      if (tierFilter) params.tier        = tierFilter

      const data: PagedResponse<Service> = await serviceService.getServices(params)
      setServices(data.content)
      setTotal(data.totalElements)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load services', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [page, size, search, envFilter, teamFilter, tierFilter])

  const fetchFilters = useCallback(async () => {
    try {
      const data = await serviceService.getFilterOptions()
      setFilterOptions(data)
    } catch { /* filters are optional */ }
  }, [])

  useEffect(() => { fetchServices() }, [fetchServices])
  useEffect(() => { fetchFilters() }, [fetchFilters])

  // ── Create service ──────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      await serviceService.createService(createForm)
      setSnackbar({ open: true, message: 'Service registered successfully', severity: 'success' })
      setCreateOpen(false)
      setCreateForm({ name: '', description: '', ownerTeam: '', environment: '', tier: '' })
      fetchServices()
      fetchFilters()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to register service'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    }
  }

  // ── Edit service ────────────────────────────────────────────────
  const openEdit = (svc: Service) => {
    setEditService(svc)
    setEditForm({
      description: svc.description || '',
      ownerTeam:   svc.ownerTeam || '',
      environment: svc.environment || '',
      tier:        svc.tier || '',
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editService) return
    try {
      await serviceService.updateService(editService.id, editForm)
      setSnackbar({ open: true, message: 'Service updated successfully', severity: 'success' })
      setEditOpen(false)
      fetchServices()
      fetchFilters()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to update service'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    }
  }

  // ── Deactivate service ──────────────────────────────────────────
  const handleDeactivate = async (svc: Service) => {
    if (!window.confirm(`Deactivate service "${svc.name}"?`)) return
    try {
      await serviceService.deactivateService(svc.id)
      setSnackbar({ open: true, message: 'Service deactivated', severity: 'success' })
      fetchServices()
    } catch {
      setSnackbar({ open: true, message: 'Failed to deactivate service', severity: 'error' })
    }
  }

  // ── Signal toggles ──────────────────────────────────────────────
  const openSignals = (svc: Service) => {
    setSignalsService(svc)
    setSignalsForm({
      metricsEnabled: svc.metricsEnabled,
      logsEnabled:    svc.logsEnabled,
      tracesEnabled:  svc.tracesEnabled,
    })
    setSignalsOpen(true)
  }

  const handleToggleSignals = async () => {
    if (!signalsService) return
    try {
      await serviceService.toggleSignals(signalsService.id, signalsForm)
      setSnackbar({ open: true, message: 'Signal toggles updated', severity: 'success' })
      setSignalsOpen(false)
      fetchServices()
    } catch {
      setSnackbar({ open: true, message: 'Failed to update signal toggles', severity: 'error' })
    }
  }

  // ── Clear filters ───────────────────────────────────────────────
  const clearFilters = () => {
    setSearch('')
    setEnvFilter('')
    setTeamFilter('')
    setTierFilter('')
    setPage(0)
  }
  const hasFilters = search || envFilter || teamFilter || tierFilter

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Service Catalog</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Register Service
        </Button>
      </Box>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small" placeholder="Search services..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ minWidth: 240 }}
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Environment</InputLabel>
            <Select value={envFilter} label="Environment"
              onChange={(e) => { setEnvFilter(e.target.value); setPage(0) }}>
              <MenuItem value="">All</MenuItem>
              {filterOptions.environments.map((env) => (
                <MenuItem key={env} value={env}>{env}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Team</InputLabel>
            <Select value={teamFilter} label="Team"
              onChange={(e) => { setTeamFilter(e.target.value); setPage(0) }}>
              <MenuItem value="">All</MenuItem>
              {filterOptions.teams.map((team) => (
                <MenuItem key={team} value={team}>{team}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Tier</InputLabel>
            <Select value={tierFilter} label="Tier"
              onChange={(e) => { setTierFilter(e.target.value); setPage(0) }}>
              <MenuItem value="">All</MenuItem>
              {filterOptions.tiers.map((tier) => (
                <MenuItem key={tier} value={tier}>{tier}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {hasFilters && (
            <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters}>
              Clear
            </Button>
          )}
        </Box>
      </Paper>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Service Name</TableCell>
              <TableCell>Environment</TableCell>
              <TableCell>Team</TableCell>
              <TableCell>Tier</TableCell>
              <TableCell>Signals</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton variant="text" width={120} /></TableCell>
                  <TableCell><Skeleton variant="rounded" width={70} height={24} /></TableCell>
                  <TableCell><Skeleton variant="text" width={80} /></TableCell>
                  <TableCell><Skeleton variant="text" width={40} /></TableCell>
                  <TableCell><Skeleton variant="rounded" width={80} height={24} /></TableCell>
                  <TableCell><Skeleton variant="text" width={60} /></TableCell>
                  <TableCell><Skeleton variant="rounded" width={50} height={24} /></TableCell>
                  <TableCell><Skeleton variant="circular" width={32} height={32} /></TableCell>
                </TableRow>
              ))
            ) : services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="body1" color="text.secondary">No services found</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Try adjusting your filters or register a new service
                  </Typography>
                </TableCell>
              </TableRow>
            ) : services.map((svc) => (
              <TableRow key={svc.id}>
                <TableCell>
                  <Typography
                    fontWeight={600}
                    fontSize="0.875rem"
                    sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => navigate(`/services/${svc.id}`)}
                  >
                    {svc.name}
                  </Typography>
                  {svc.description && (
                    <Typography variant="caption" color="text.secondary">{svc.description}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {svc.environment ? (
                    <Chip label={svc.environment} size="small"
                      color={ENV_COLORS[svc.environment] || 'default'} />
                  ) : '—'}
                </TableCell>
                <TableCell>{svc.ownerTeam || '—'}</TableCell>
                <TableCell>{svc.tier || '—'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Chip label="M" size="small" variant={svc.metricsEnabled ? 'filled' : 'outlined'}
                      color={svc.metricsEnabled ? 'primary' : 'default'}
                      title={`Metrics: ${svc.metricsEnabled ? 'ON' : 'OFF'}`} />
                    <Chip label="L" size="small" variant={svc.logsEnabled ? 'filled' : 'outlined'}
                      color={svc.logsEnabled ? 'primary' : 'default'}
                      title={`Logs: ${svc.logsEnabled ? 'ON' : 'OFF'}`} />
                    <Chip label="T" size="small" variant={svc.tracesEnabled ? 'filled' : 'outlined'}
                      color={svc.tracesEnabled ? 'primary' : 'default'}
                      title={`Traces: ${svc.tracesEnabled ? 'ON' : 'OFF'}`} />
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={svc.registrationSource === 'AUTO_DISCOVERED' ? 'Auto' : 'Manual'}
                    size="small" variant="outlined"
                    color={svc.registrationSource === 'AUTO_DISCOVERED' ? 'info' : 'default'} />
                </TableCell>
                <TableCell>
                  <Chip label={svc.active ? 'Active' : 'Inactive'} size="small"
                    color={svc.active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(svc)}><EditIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Signal Toggles">
                    <IconButton size="small" onClick={() => openSignals(svc)}><SensorsIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Deactivate">
                    <IconButton size="small" onClick={() => handleDeactivate(svc)} disabled={!svc.active}>
                      <BlockIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div" count={total} page={page} rowsPerPage={size}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value)); setPage(0) }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </TableContainer>

      {/* ── Create Service Dialog ─────────────────────────────────── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Register Service</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Service Name" required value={createForm.name}
            onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} />
          <TextField label="Description" multiline rows={2} value={createForm.description}
            onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))} />
          <TextField label="Owner Team" value={createForm.ownerTeam}
            onChange={(e) => setCreateForm(f => ({ ...f, ownerTeam: e.target.value }))} />
          <FormControl>
            <InputLabel>Environment</InputLabel>
            <Select value={createForm.environment} label="Environment"
              onChange={(e) => setCreateForm(f => ({ ...f, environment: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="dev">dev</MenuItem>
              <MenuItem value="staging">staging</MenuItem>
              <MenuItem value="production">production</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Tier</InputLabel>
            <Select value={createForm.tier} label="Tier"
              onChange={(e) => setCreateForm(f => ({ ...f, tier: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="tier-1">tier-1</MenuItem>
              <MenuItem value="tier-2">tier-2</MenuItem>
              <MenuItem value="tier-3">tier-3</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!createForm.name.trim()}>
            Register
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Service Dialog ───────────────────────────────────── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Service: {editService?.name}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Description" multiline rows={2} value={editForm.description}
            onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} />
          <TextField label="Owner Team" value={editForm.ownerTeam}
            onChange={(e) => setEditForm(f => ({ ...f, ownerTeam: e.target.value }))} />
          <FormControl>
            <InputLabel>Environment</InputLabel>
            <Select value={editForm.environment} label="Environment"
              onChange={(e) => setEditForm(f => ({ ...f, environment: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="dev">dev</MenuItem>
              <MenuItem value="staging">staging</MenuItem>
              <MenuItem value="production">production</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Tier</InputLabel>
            <Select value={editForm.tier} label="Tier"
              onChange={(e) => setEditForm(f => ({ ...f, tier: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="tier-1">tier-1</MenuItem>
              <MenuItem value="tier-2">tier-2</MenuItem>
              <MenuItem value="tier-3">tier-3</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* ── Signal Toggles Dialog ─────────────────────────────────── */}
      <Dialog open={signalsOpen} onClose={() => setSignalsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Signal Toggles: {signalsService?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography>Metrics</Typography>
              <Switch checked={signalsForm.metricsEnabled}
                onChange={(e) => setSignalsForm(f => ({ ...f, metricsEnabled: e.target.checked }))} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography>Logs</Typography>
              <Switch checked={signalsForm.logsEnabled}
                onChange={(e) => setSignalsForm(f => ({ ...f, logsEnabled: e.target.checked }))} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography>Traces</Typography>
              <Switch checked={signalsForm.tracesEnabled}
                onChange={(e) => setSignalsForm(f => ({ ...f, tracesEnabled: e.target.checked }))} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSignalsOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleToggleSignals}>Apply</Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ──────────────────────────────────────────────── */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
