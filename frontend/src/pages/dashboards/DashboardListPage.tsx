import { useEffect, useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  Snackbar,
  Alert,
  Pagination,
  Autocomplete,
  CircularProgress,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { useNavigate } from 'react-router-dom'
import type { Dashboard, CreateDashboardPayload } from '@/types/dashboard'
import type { PagedResponse } from '@/types'
import {
  listDashboards,
  createDashboard,
  deleteDashboard,
  cloneDashboard,
} from '@/services/dashboardService'
import { useAuthStore } from '@/store'
import { getServices } from '@/services/serviceService'
import type { Service } from '@/types'
import TemplateGallery from './components/TemplateGallery'

const DEFAULT_DASHBOARD_KEY = 'obs-default-dashboard'

export default function DashboardListPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [dashboards, setDashboards] = useState<PagedResponse<Dashboard> | null>(null)
  const [defaultId, setDefaultId] = useState<string | null>(() => localStorage.getItem(DEFAULT_DASHBOARD_KEY))
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [serviceOptions, setServiceOptions] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(null)
  const [cloneName, setCloneName] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })

  const fetchDashboards = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listDashboards({ search: search || undefined, page, size: 12, isTemplate: false })
      setDashboards(result)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load dashboards', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchDashboards() }, [fetchDashboards])

  // Fetch services when create dialog opens
  useEffect(() => {
    if (!createOpen) return
    const fetchServices = async () => {
      setServicesLoading(true)
      try {
        const result = await getServices({ size: 200, active: true })
        setServiceOptions(result.content)
      } catch {
        // Silently fail — user can still create without services
      } finally {
        setServicesLoading(false)
      }
    }
    fetchServices()
  }, [createOpen])

  const handleCreate = async () => {
    try {
      const serviceNames = selectedServices.map((s) => s.name)
      const payload: CreateDashboardPayload = {
        name: newName || 'Untitled Dashboard',
        description: newDesc || undefined,
        ownerId: user?.id,
        tags: serviceNames.length > 0 ? serviceNames.join(',') : undefined,
      }
      const created = await createDashboard(payload)
      setCreateOpen(false)
      setNewName('')
      setNewDesc('')
      setSelectedServices([])
      navigate(`/dashboards/${created.id}`)
    } catch {
      setSnackbar({ open: true, message: 'Failed to create dashboard', severity: 'error' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDashboard(id)
      setSnackbar({ open: true, message: 'Dashboard deleted', severity: 'success' })
      fetchDashboards()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete dashboard', severity: 'error' })
    }
  }

  const openCloneDialog = (id: string, sourceName: string) => {
    setCloneSourceId(id)
    setCloneName(sourceName)
    setCloneOpen(true)
  }

  const toggleDefault = (id: string) => {
    const newId = defaultId === id ? null : id
    setDefaultId(newId)
    if (newId) {
      localStorage.setItem(DEFAULT_DASHBOARD_KEY, newId)
    } else {
      localStorage.removeItem(DEFAULT_DASHBOARD_KEY)
    }
    setSnackbar({
      open: true,
      message: newId ? 'Set as default dashboard' : 'Default dashboard cleared',
      severity: 'success',
    })
  }

  const handleClone = async () => {
    if (!user?.id || !cloneSourceId) return
    try {
      const cloned = await cloneDashboard(cloneSourceId, user.id, cloneName || undefined)
      setCloneOpen(false)
      setSnackbar({ open: true, message: 'Dashboard cloned', severity: 'success' })
      navigate(`/dashboards/${cloned.id}`)
    } catch {
      setSnackbar({ open: true, message: 'Failed to clone dashboard', severity: 'error' })
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DashboardCustomizeIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Dashboards</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New Dashboard
        </Button>
      </Box>

      {/* Template Gallery (US 13.7) */}
      <TemplateGallery onClone={openCloneDialog} />

      {/* My Dashboards section */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>My Dashboards</Typography>
      </Box>

      <TextField
        size="small"
        placeholder="Search dashboards..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0) }}
        sx={{ mb: 2, width: 300 }}
      />

      <Grid container spacing={2}>
        {dashboards?.content.map((d) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={d.id}>
            <Card
              variant="outlined"
              sx={{
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main' },
                transition: 'border-color 0.2s',
              }}
              onClick={() => navigate(`/dashboards/${d.id}`)}
            >
              <CardContent sx={{ pb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600} noWrap>
                  {d.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {d.description || 'No description'}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  <Chip label={`${d.widgetCount} widgets`} size="small" variant="outlined" />
                  {d.tags && d.tags.split(',').map((tag) => (
                    <Chip key={tag} label={tag.trim()} size="small" color="primary" variant="outlined" />
                  ))}
                </Box>
              </CardContent>
              <CardActions sx={{ pt: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                  Updated {new Date(d.updatedAt).toLocaleDateString()}
                </Typography>
                <Tooltip title={defaultId === d.id ? 'Remove as default' : 'Set as default'}>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleDefault(d.id) }}>
                    {defaultId === d.id
                      ? <StarIcon fontSize="small" color="warning" />
                      : <StarBorderIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Clone">
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); openCloneDialog(d.id, d.name) }}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(d.id) }}>
                    <DeleteIcon fontSize="small" color="error" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {!loading && dashboards && dashboards.content.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <DashboardCustomizeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body1" color="text.secondary">
            No dashboards yet. Create one or use a template above!
          </Typography>
        </Box>
      )}

      {dashboards && dashboards.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={dashboards.totalPages}
            page={page + 1}
            onChange={(_, p) => setPage(p - 1)}
          />
        </Box>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Dashboard</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
            size="small"
            sx={{ mt: 1, mb: 2 }}
            autoFocus
          />
          <TextField
            label="Description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          <Autocomplete
            multiple
            options={serviceOptions}
            getOptionLabel={(option) => option.name}
            value={selectedServices}
            onChange={(_, value) => setSelectedServices(value)}
            loading={servicesLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Services"
                size="small"
                placeholder="Select services..."
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {servicesLoading ? <CircularProgress size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.id}
                  label={option.name}
                  size="small"
                />
              ))
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Clone / Use Template Dialog */}
      <Dialog open={cloneOpen} onClose={() => setCloneOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Name Your Dashboard</DialogTitle>
        <DialogContent>
          <TextField
            label="Dashboard Name"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleClone() }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloneOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleClone}>Clone</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
