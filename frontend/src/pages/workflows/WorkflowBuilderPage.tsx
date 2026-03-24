import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Alert, Snackbar, Tooltip, Chip, Skeleton,
  Divider, Card, Autocomplete, CircularProgress,
} from '@mui/material'
import ArrowBackIcon    from '@mui/icons-material/ArrowBack'
import AddIcon          from '@mui/icons-material/Add'
import EditIcon         from '@mui/icons-material/Edit'
import DeleteIcon       from '@mui/icons-material/Delete'
import PlayArrowIcon    from '@mui/icons-material/PlayArrow'
import BarChartIcon     from '@mui/icons-material/BarChart'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import type { Workflow, WorkflowStep, Service } from '@/types'
import * as workflowService from '@/services/workflowService'
import { getServices } from '@/services/serviceService'
import { getServiceOperations } from '@/services/traceService'
import { useBreadcrumb } from '@/hooks/useBreadcrumb'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

interface ApiEntry {
  serviceName: string
  httpMethod: string
  pathPattern: string
}

const EMPTY_API_ENTRY: ApiEntry = { serviceName: '', httpMethod: 'GET', pathPattern: '' }

/** Group flat steps by stepOrder into logical steps. */
function groupByStep(steps: WorkflowStep[]): Map<number, WorkflowStep[]> {
  const map = new Map<number, WorkflowStep[]>()
  for (const s of steps) {
    const group = map.get(s.stepOrder) ?? []
    group.push(s)
    map.set(s.stepOrder, group)
  }
  return new Map([...map.entries()].sort(([a], [b]) => a - b))
}

function methodColor(method: string): 'success' | 'primary' | 'warning' | 'error' | 'info' | 'default' {
  switch (method) {
    case 'GET':    return 'success'
    case 'POST':   return 'primary'
    case 'PUT':    return 'warning'
    case 'PATCH':  return 'info'
    case 'DELETE': return 'error'
    default:       return 'default'
  }
}

export default function WorkflowBuilderPage() {
  const { workflowId } = useParams<{ workflowId: string }>()
  const navigate = useNavigate()

  const [workflow, setWorkflow]   = useState<Workflow | null>(null)
  const [steps, setSteps]         = useState<WorkflowStep[]>([])
  const [loading, setLoading]     = useState(true)

  // Dynamic breadcrumb — shows workflow name once loaded
  useBreadcrumb(workflowId, workflow?.name ?? workflowId)

  // Step dialog (multi-API)
  const [stepDialogOpen, setStepDialogOpen] = useState(false)
  const [editingStepOrder, setEditingStepOrder] = useState<number | null>(null)
  const [stepLabel, setStepLabel]               = useState('')
  const [stepOrder, setStepOrder]               = useState(1)
  const [apiEntries, setApiEntries]             = useState<ApiEntry[]>([{ ...EMPTY_API_ENTRY }])
  // Track original step IDs being edited so we can delete removed ones
  const [editingStepIds, setEditingStepIds]     = useState<string[]>([])



  // Delete confirm
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingStepOrder, setDeletingStepOrder] = useState<number | null>(null)
  const [deletingStepGroup, setDeletingStepGroup] = useState<WorkflowStep[]>([])

  // Service & operation lookups
  const [services, setServices]                 = useState<Service[]>([])
  const [servicesLoading, setServicesLoading]   = useState(false)
  const [operations, setOperations]             = useState<string[]>([])
  const [operationsLoading, setOperationsLoading] = useState(false)

  // Correlation
  const [correlating, setCorrelating] = useState(false)



  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'success' },
  )

  const groupedSteps = groupByStep(steps)
  const sortedStepOrders = [...groupedSteps.keys()]

  const fetchData = useCallback(async () => {
    if (!workflowId) return
    setLoading(true)
    try {
      const [wf, stepList] = await Promise.all([
        workflowService.getWorkflow(workflowId),
        workflowService.listSteps(workflowId),
      ])
      setWorkflow(wf)
      setSteps(stepList)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load workflow', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [workflowId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Step CRUD ──────────────────────────────────────────────────

  // Keep a ref to the latest services list so async callbacks see it
  const servicesRef = useRef<Service[]>(services)
  servicesRef.current = services

  // Fetch all services (called when dialog opens)
  const fetchServices = useCallback(async (): Promise<Service[]> => {
    if (servicesRef.current.length > 0) return servicesRef.current
    setServicesLoading(true)
    try {
      const result = await getServices({ size: 200, active: true })
      setServices(result.content)
      return result.content
    } catch { return [] }
    finally { setServicesLoading(false) }
  }, [])

  // Fetch operations for a service by name (resolves service ID from list)
  const fetchOperations = useCallback(async (serviceName: string, svcList?: Service[]) => {
    setOperations([])
    if (!serviceName) return
    const list = svcList ?? servicesRef.current
    const svc = list.find((s: Service) => s.name === serviceName)
    if (!svc) return
    setOperationsLoading(true)
    try {
      const ops = await getServiceOperations(svc.id)
      setOperations(ops)
    } catch { /* ignore — user can still type manually */ }
    finally { setOperationsLoading(false) }
  }, [])

  // Parse an operation string like "GET /api/v1/users" into method + path
  const parseOperation = (op: string) => {
    const parts = op.trim().split(/\s+/, 2)
    if (parts.length === 2 && HTTP_METHODS.includes(parts[0].toUpperCase())) {
      return { httpMethod: parts[0].toUpperCase(), pathPattern: parts[1] }
    }
    return { httpMethod: '', pathPattern: op }
  }

  const openAddStep = () => {
    setEditingStepOrder(null)
    setEditingStepIds([])
    const nextOrder = sortedStepOrders.length > 0 ? Math.max(...sortedStepOrders) + 1 : 1
    setStepOrder(nextOrder)
    setStepLabel('')
    setApiEntries([{ ...EMPTY_API_ENTRY }])
    setOperations([])
    setStepDialogOpen(true)
    fetchServices()
  }

  const openEditStepGroup = (order: number) => {
    const group = groupedSteps.get(order) ?? []
    setEditingStepOrder(order)
    setEditingStepIds(group.map(s => s.id))
    setStepOrder(order)
    setStepLabel(group[0]?.label ?? '')
    setApiEntries(group.map(s => ({
      serviceName: s.serviceName,
      httpMethod: s.httpMethod,
      pathPattern: s.pathPattern,
    })))
    setOperations([])
    setStepDialogOpen(true)
    fetchServices()
  }

  const handleSaveStep = async () => {
    if (!workflowId) return
    const validEntries = apiEntries.filter(e => e.serviceName && e.pathPattern)
    if (validEntries.length === 0) return

    try {
      // Collect step IDs to delete before recreating
      const idsToDelete: string[] = []

      if (editingStepOrder !== null) {
        // Editing — delete old entries for this step group
        idsToDelete.push(...editingStepIds)
      } else {
        // Adding — if a step group with this order already exists, merge with it
        const existingGroup = groupedSteps.get(stepOrder) ?? []
        if (existingGroup.length > 0) {
          idsToDelete.push(...existingGroup.map(s => s.id))
          // Preserve existing APIs that aren't duplicated by the new entries
          for (const existing of existingGroup) {
            const isDuplicate = validEntries.some(
              e => e.serviceName === existing.serviceName
                && e.httpMethod === existing.httpMethod
                && e.pathPattern === existing.pathPattern,
            )
            if (!isDuplicate) {
              validEntries.push({
                serviceName: existing.serviceName,
                httpMethod: existing.httpMethod,
                pathPattern: existing.pathPattern,
              })
            }
          }
        }
      }

      for (const id of idsToDelete) {
        await workflowService.deleteStep(workflowId, id)
      }

      // Resolve label: use explicit label, fall back to existing group label
      const effectiveLabel = stepLabel || (groupedSteps.get(stepOrder)?.[0]?.label ?? '')

      // Create one WorkflowStep per API entry, all sharing the same stepOrder + label
      for (const entry of validEntries) {
        await workflowService.createStep(workflowId, {
          stepOrder,
          serviceName: entry.serviceName,
          httpMethod: entry.httpMethod,
          pathPattern: entry.pathPattern,
          label: effectiveLabel,
        })
      }
      setSnackbar({ open: true, message: editingStepOrder !== null ? 'Step updated' : 'Step added', severity: 'success' })
      setStepDialogOpen(false)
      fetchData()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to save step'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    }
  }

  const confirmDeleteStepGroup = (order: number) => {
    setDeletingStepOrder(order)
    setDeletingStepGroup(groupedSteps.get(order) ?? [])
    setDeleteConfirmOpen(true)
  }
  const handleDeleteStep = async () => {
    if (!workflowId || deletingStepGroup.length === 0) return
    try {
      for (const step of deletingStepGroup) {
        await workflowService.deleteStep(workflowId, step.id)
      }
      setSnackbar({ open: true, message: 'Step deleted', severity: 'success' })
      setDeleteConfirmOpen(false)
      setDeletingStepOrder(null)
      setDeletingStepGroup([])
      fetchData()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete step', severity: 'error' })
    }
  }

  const addApiEntry = () => setApiEntries(prev => [...prev, { ...EMPTY_API_ENTRY }])
  const removeApiEntry = (idx: number) => setApiEntries(prev => prev.filter((_, i) => i !== idx))
  const updateApiEntry = (idx: number, field: keyof ApiEntry, value: string) =>
    setApiEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))

  // ── Correlation ────────────────────────────────────────────────

  const handleCorrelate = async () => {
    if (!workflowId) return
    setCorrelating(true)
    try {
      const result = await workflowService.correlate({
        workflowId, lookbackMinutes: 60, traceLimit: 50,
      })
      setSnackbar({
        open: true,
        severity: 'info',
        message: `Correlation complete: ${result.tracesAnalyzed} traces analyzed, ${result.instancesCreated} instances created, ${result.instancesUpdated} updated`,
      })
    } catch {
      setSnackbar({ open: true, message: 'Correlation failed', severity: 'error' })
    } finally {
      setCorrelating(false)
    }
  }

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} />
        <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={300} sx={{ mt: 2, borderRadius: 1 }} />
      </Box>
    )
  }

  if (!workflow) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="text.secondary">Workflow not found.</Typography>
        <Button onClick={() => navigate('/workflows')} sx={{ mt: 2 }}>Back to Workflows</Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <IconButton onClick={() => navigate('/workflows')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700}>{workflow.name}</Typography>
        <Chip label={workflow.enabled ? 'Enabled' : 'Disabled'} size="small"
          color={workflow.enabled ? 'success' : 'default'} variant="outlined" sx={{ ml: 1 }} />
        <Chip label={workflow.active ? 'Active' : 'Inactive'} size="small"
          color={workflow.active ? 'primary' : 'default'} variant="outlined" />
      </Box>
      {workflow.description && (
        <Typography variant="body2" color="text.secondary" sx={{ ml: 5.5, mb: 2 }}>
          {workflow.description}
        </Typography>
      )}

      {/* ── Workflow Info Bar ────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        {workflow.ownerTeam && (
          <Box>
            <Typography variant="caption" color="text.secondary">Owner Team</Typography>
            <Typography variant="body2" fontWeight={600}>{workflow.ownerTeam}</Typography>
          </Box>
        )}
        <Box>
          <Typography variant="caption" color="text.secondary">Stages</Typography>
          <Typography variant="body2" fontWeight={600}>{sortedStepOrders.length}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">APIs</Typography>
          <Typography variant="body2" fontWeight={600}>{steps.length}</Typography>
        </Box>
        {workflow.maxDurationMs != null && (
          <Box>
            <Typography variant="caption" color="text.secondary">Max Duration</Typography>
            <Typography variant="body2" fontWeight={600}>{workflow.maxDurationMs}ms</Typography>
          </Box>
        )}
        {workflow.maxErrorRatePct != null && (
          <Box>
            <Typography variant="caption" color="text.secondary">Max Error Rate</Typography>
            <Typography variant="body2" fontWeight={600}>{workflow.maxErrorRatePct}%</Typography>
          </Box>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" startIcon={<BarChartIcon />}
          onClick={() => navigate(`/workflows/${workflowId}/dashboard`)}>
          Dashboard
        </Button>
        <Button variant="outlined" startIcon={<PlayArrowIcon />} onClick={handleCorrelate}
          disabled={correlating || steps.length === 0}>
          {correlating ? 'Correlating...' : 'Run Correlation'}
        </Button>
      </Paper>

      {/* ── Step Pipeline Visualization ─────────────────────────── */}
      {steps.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, overflowX: 'auto' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            Workflow Pipeline
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0.5, minWidth: 'max-content' }}>
            {sortedStepOrders.map((order, i) => {
              const group = groupedSteps.get(order)!
              const label = group[0].label || `Step ${order}`
              return (
                <React.Fragment key={order}>
                  <Box sx={{
                    display: 'flex', flexDirection: 'column',
                    borderRadius: 2, border: '2px solid', borderColor: 'primary.main',
                    backgroundColor: 'background.paper', minWidth: 180, maxWidth: 280, overflow: 'hidden',
                  }}>
                    {/* Stage header */}
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      px: 1.5, py: 0.75,
                      backgroundColor: 'primary.main', color: 'primary.contrastText',
                    }}>
                      <Box sx={{
                        width: 22, height: 22, borderRadius: '50%',
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                      }}>
                        {order}
                      </Box>
                      <Typography variant="caption" fontWeight={700} noWrap>
                        {label}
                      </Typography>
                      {group.length > 1 && (
                        <Chip label={`${group.length} APIs`} size="small"
                          sx={{ ml: 'auto', height: 18, fontSize: '0.6rem', fontWeight: 700,
                            backgroundColor: 'rgba(255,255,255,0.2)', color: 'inherit' }} />
                      )}
                    </Box>
                    {/* API entries */}
                    <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {group.map((step) => (
                        <Box key={step.id} sx={{
                          display: 'flex', alignItems: 'center', gap: 0.5,
                          p: 0.5, borderRadius: 1, backgroundColor: 'action.hover',
                        }}>
                          <Chip label={step.httpMethod} size="small" color={methodColor(step.httpMethod)}
                            sx={{ fontWeight: 600, fontSize: '0.6rem', height: 18, minWidth: 42 }} />
                          <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
                            <Typography variant="caption" fontWeight={600} noWrap sx={{ display: 'block', fontSize: '0.7rem' }}>
                              {step.serviceName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap
                              sx={{ display: 'block', fontSize: '0.65rem', fontFamily: '"JetBrains Mono", monospace' }}>
                              {step.pathPattern}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  {i < sortedStepOrders.length - 1 && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <ArrowForwardIcon sx={{ color: 'text.disabled', fontSize: 22 }} />
                    </Box>
                  )}
                </React.Fragment>
              )
            })}
          </Box>
        </Paper>
      )}

      {/* ── Step List (Drag & Drop) ─────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>Steps</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAddStep}>
          Add Step
        </Button>
      </Box>

      {steps.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No steps defined yet. Add steps to define the expected API call sequence for this workflow.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {sortedStepOrders.map((order) => {
            const group = groupedSteps.get(order)!
            const label = group[0]?.label
            return (
              <Card key={order} variant="outlined"
                sx={{
                  '&:hover': { borderColor: 'primary.main' },
                  transition: 'all 0.15s ease',
                  overflow: 'hidden',
                }}
              >
                {/* Step header bar */}
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 2, py: 1,
                  backgroundColor: 'action.hover',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}>
                  <Box sx={{
                    width: 28, height: 28, borderRadius: '50%', backgroundColor: 'primary.main',
                    color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                  }}>
                    {order}
                  </Box>
                  <Typography variant="body2" fontWeight={700} sx={{ flexGrow: 1 }}>
                    {label || `Step ${order}`}
                  </Typography>
                  {group.length > 1 && (
                    <Chip label={`${group.length} APIs`} size="small" variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }} />
                  )}
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Tooltip title="Edit step">
                      <IconButton size="small" onClick={() => openEditStepGroup(order)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete step">
                      <IconButton size="small" color="error" onClick={() => confirmDeleteStepGroup(order)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* API entries */}
                <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {group.map((step, idx) => (
                    <Box key={step.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1, borderRadius: 1,
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'action.hover',
                    }}>
                      <Chip label={step.httpMethod} size="small" color={methodColor(step.httpMethod)}
                        sx={{ fontWeight: 600, minWidth: 55, flexShrink: 0, fontSize: '0.75rem' }} />
                      <Typography variant="body2" fontWeight={500} sx={{ minWidth: 120 }}>
                        {step.serviceName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap
                        sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.82rem' }}>
                        {step.pathPattern}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Card>
            )
          })}
        </Box>
      )}

      {/* ── Add / Edit Step Dialog (Multi-API) ─────────────────── */}
      <Dialog open={stepDialogOpen} onClose={() => setStepDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingStepOrder !== null ? 'Edit Step' : 'Add Step'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Step Label" value={stepLabel}
              onChange={(e) => setStepLabel(e.target.value)} fullWidth
              helperText="Human-readable name for this step (optional)" />
            <TextField label="Step Order" type="number" required value={stepOrder}
              onChange={(e) => setStepOrder(parseInt(e.target.value) || 1)}
              inputProps={{ min: 1 }} sx={{ width: 120 }} />
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" fontWeight={600}>
              API Configurations ({apiEntries.length})
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addApiEntry}>
              Add API
            </Button>
          </Box>

          {apiEntries.map((entry, idx) => (
            <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  API {idx + 1}
                </Typography>
                {apiEntries.length > 1 && (
                  <IconButton size="small" color="error" onClick={() => removeApiEntry(idx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>

              {/* Service Name */}
              <Autocomplete
                freeSolo
                options={services.map(s => s.name)}
                loading={servicesLoading}
                value={entry.serviceName}
                onInputChange={(_e, value) => updateApiEntry(idx, 'serviceName', value)}
                onChange={(_e, value) => {
                  updateApiEntry(idx, 'serviceName', value ?? '')
                  if (value) fetchOperations(value)
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Service Name" required size="small"
                    sx={{ mb: 1.5 }}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {servicesLoading && <CircularProgress size={18} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              {/* Method + Path */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField label="Method" select required value={entry.httpMethod} size="small"
                  onChange={(e) => updateApiEntry(idx, 'httpMethod', e.target.value)}
                  sx={{ minWidth: 110 }}>
                  {HTTP_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
                <Autocomplete
                  freeSolo
                  options={operations}
                  loading={operationsLoading}
                  value={entry.pathPattern}
                  onInputChange={(_e, value) => {
                    const parsed = parseOperation(value)
                    if (parsed.httpMethod) updateApiEntry(idx, 'httpMethod', parsed.httpMethod)
                    updateApiEntry(idx, 'pathPattern', parsed.pathPattern)
                  }}
                  onChange={(_e, value) => {
                    if (!value) { updateApiEntry(idx, 'pathPattern', ''); return }
                    const parsed = parseOperation(value)
                    if (parsed.httpMethod) updateApiEntry(idx, 'httpMethod', parsed.httpMethod)
                    updateApiEntry(idx, 'pathPattern', parsed.pathPattern)
                  }}
                  sx={{ flexGrow: 1 }}
                  renderInput={(params) => (
                    <TextField {...params} label="Path Pattern" required size="small"
                      placeholder="/api/v1/resource"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {operationsLoading && <CircularProgress size={18} />}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Box>
            </Paper>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStepDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveStep}
            disabled={apiEntries.every(e => !e.serviceName || !e.pathPattern)}>
            {editingStepOrder !== null ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Step Confirmation ────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Step</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete step <strong>{deletingStepGroup[0]?.label || `Step ${deletingStepOrder}`}</strong>
            {deletingStepGroup.length > 1 && ` (${deletingStepGroup.length} API configurations)`}?
            This may affect correlated instances.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteStep}>Delete</Button>
        </DialogActions>
      </Dialog>

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
