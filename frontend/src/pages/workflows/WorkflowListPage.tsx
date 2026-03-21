import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, Snackbar, Tooltip, Switch, Skeleton,
  TablePagination,
} from '@mui/material'
import AddIcon      from '@mui/icons-material/Add'
import EditIcon     from '@mui/icons-material/Edit'
import DeleteIcon   from '@mui/icons-material/Delete'
import BuildIcon    from '@mui/icons-material/Build'
import BarChartIcon from '@mui/icons-material/BarChart'
import type { Workflow, CreateWorkflowPayload, UpdateWorkflowPayload } from '@/types'
import * as workflowService from '@/services/workflowService'

const EMPTY_FORM: CreateWorkflowPayload = {
  name: '', description: '', ownerTeam: '',
  maxDurationMs: undefined, maxErrorRatePct: undefined,
}

export default function WorkflowListPage() {
  const navigate = useNavigate()

  const [workflows, setWorkflows]       = useState<Workflow[]>([])
  const [loading, setLoading]           = useState(true)
  const [page, setPage]                 = useState(0)
  const [size, setSize]                 = useState(10)
  const [totalElements, setTotalElements] = useState(0)

  const [dialogOpen, setDialogOpen]     = useState(false)
  const [editingWf, setEditingWf]       = useState<Workflow | null>(null)
  const [form, setForm]                 = useState<CreateWorkflowPayload>({ ...EMPTY_FORM })

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingWf, setDeletingWf]     = useState<Workflow | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' },
  )

  const fetchWorkflows = useCallback(async () => {
    setLoading(true)
    try {
      const result = await workflowService.listWorkflows({ page, size })
      setWorkflows(result.content)
      setTotalElements(result.totalElements)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load workflows', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [page, size])

  useEffect(() => { fetchWorkflows() }, [fetchWorkflows])

  // ── Create / Edit dialog ────────────────────────────────────
  const openCreate = () => {
    setEditingWf(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const openEdit = (wf: Workflow) => {
    setEditingWf(wf)
    setForm({
      name: wf.name,
      description: wf.description ?? '',
      ownerTeam: wf.ownerTeam ?? '',
      maxDurationMs: wf.maxDurationMs ?? undefined,
      maxErrorRatePct: wf.maxErrorRatePct ?? undefined,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      if (editingWf) {
        const payload: UpdateWorkflowPayload = {
          name: form.name, description: form.description, ownerTeam: form.ownerTeam,
          maxDurationMs: form.maxDurationMs, maxErrorRatePct: form.maxErrorRatePct,
        }
        await workflowService.updateWorkflow(editingWf.id, payload)
        setSnackbar({ open: true, message: 'Workflow updated', severity: 'success' })
      } else {
        await workflowService.createWorkflow(form)
        setSnackbar({ open: true, message: 'Workflow created', severity: 'success' })
      }
      setDialogOpen(false)
      fetchWorkflows()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to save workflow'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    }
  }

  // ── Toggle enabled ──────────────────────────────────────────
  const handleToggleEnabled = async (wf: Workflow) => {
    try {
      await workflowService.updateWorkflow(wf.id, { enabled: !wf.enabled })
      fetchWorkflows()
    } catch {
      setSnackbar({ open: true, message: 'Failed to toggle workflow', severity: 'error' })
    }
  }

  // ── Delete ──────────────────────────────────────────────────
  const confirmDelete = (wf: Workflow) => { setDeletingWf(wf); setDeleteConfirmOpen(true) }
  const handleDelete = async () => {
    if (!deletingWf) return
    try {
      await workflowService.deleteWorkflow(deletingWf.id)
      setSnackbar({ open: true, message: 'Workflow deleted', severity: 'success' })
      setDeleteConfirmOpen(false)
      setDeletingWf(null)
      fetchWorkflows()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete workflow', severity: 'error' })
    }
  }

  const updateField = <K extends keyof CreateWorkflowPayload>(k: K, v: CreateWorkflowPayload[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Business Workflows</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Create Workflow</Button>
      </Box>

      {/* ── Table ───────────────────────────────────────────────── */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Owner Team</TableCell>
              <TableCell align="center">Steps</TableCell>
              <TableCell align="center">Enabled</TableCell>
              <TableCell align="center">Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : workflows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No workflows configured yet. Create one to start mapping business flows.</Typography>
                </TableCell>
              </TableRow>
            ) : workflows.map((wf) => (
              <TableRow key={wf.id} hover>
                <TableCell>
                  <Typography fontWeight={600} fontSize="0.875rem">{wf.name}</Typography>
                  {wf.description && (
                    <Typography variant="caption" color="text.secondary">{wf.description}</Typography>
                  )}
                </TableCell>
                <TableCell>{wf.ownerTeam || <Typography variant="caption" color="text.secondary">—</Typography>}</TableCell>
                <TableCell align="center">
                  <Chip label={wf.stepCount} size="small" variant="outlined" />
                </TableCell>
                <TableCell align="center">
                  <Switch checked={wf.enabled} size="small" onChange={() => handleToggleEnabled(wf)} />
                </TableCell>
                <TableCell align="center">
                  <Chip label={wf.active ? 'Active' : 'Inactive'} size="small"
                    color={wf.active ? 'success' : 'default'} variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Open Builder">
                    <IconButton size="small" color="primary" onClick={() => navigate(`/workflows/${wf.id}`)}>
                      <BuildIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Dashboard">
                    <IconButton size="small" onClick={() => navigate(`/workflows/${wf.id}/dashboard`)}>
                      <BarChartIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(wf)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => confirmDelete(wf)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingWf ? 'Edit Workflow' : 'Create Workflow'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Workflow Name" required value={form.name}
            onChange={(e) => updateField('name', e.target.value)} />
          <TextField label="Description" value={form.description ?? ''}
            onChange={(e) => updateField('description', e.target.value)} multiline rows={2} />
          <TextField label="Owner Team" value={form.ownerTeam ?? ''}
            onChange={(e) => updateField('ownerTeam', e.target.value)} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Max Duration (ms)" type="number" value={form.maxDurationMs ?? ''}
              onChange={(e) => updateField('maxDurationMs', e.target.value ? parseInt(e.target.value) : undefined)}
              helperText="SLA threshold for total workflow duration" fullWidth />
            <TextField label="Max Error Rate (%)" type="number" value={form.maxErrorRatePct ?? ''}
              onChange={(e) => updateField('maxErrorRatePct', e.target.value ? parseFloat(e.target.value) : undefined)}
              inputProps={{ step: 0.1, min: 0, max: 100 }} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name}>
            {editingWf ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Workflow</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deletingWf?.name}</strong>?
            This will also remove all steps and correlated instances. This action cannot be undone.
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
