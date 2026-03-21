import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Box,
  Snackbar,
  Alert,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Autocomplete,
  TextField,
  Chip,
  CircularProgress,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize'
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout'
import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { useDashboardStore } from '@/store/dashboardStore'
import {
  getDashboard,
  updateDashboard,
  resolveWidgets,
} from '@/services/dashboardService'
import type { Widget, WidgetType, WidgetDataRequest } from '@/types/dashboard'
import type { Service } from '@/types'
import { getServices } from '@/services/serviceService'
import { useDebounce } from '@/hooks/useDebounce'
import DashboardToolbar from './components/DashboardToolbar'
import WidgetCard from './components/WidgetCard'
import WidgetConfigDialog from './components/WidgetConfigDialog'
import WidgetLibraryDrawer from './components/WidgetLibraryDrawer'
import { defaultTimeRange, computeStep } from './components/TimeRangePicker'
import type { TimeRange } from './components/TimeRangePicker'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { useBreadcrumb } from '@/hooks/useBreadcrumb'

export default function DashboardCanvasPage() {
  const { dashboardId } = useParams<{ dashboardId: string }>()
  const { width, containerRef } = useContainerWidth()
  const {
    dashboard,
    parsedLayout,
    widgetData,
    dirty,
    loading,
    resolving,
    setDashboard,
    setLoading,
    setResolving,
    setError,
    updateGridLayout,
    addWidget,
    updateWidget,
    removeWidget,
    setWidgetData,
    getLayoutJson,
    markClean,
    reset,
  } = useDashboardStore()

  const [saving, setSaving] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<Widget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [blankType, setBlankType] = useState<WidgetType | undefined>(undefined)
  const [blankSize, setBlankSize] = useState<{ w: number; h: number } | undefined>(undefined)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })

  // Dynamic breadcrumb — shows dashboard name once loaded
  useBreadcrumb(dashboardId, dashboard?.name ?? dashboardId)

  // Service selection state
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [serviceOptions, setServiceOptions] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [servicesDirty, setServicesDirty] = useState(false)

  // Load dashboard
  useEffect(() => {
    if (!dashboardId) return
    const load = async () => {
      setLoading(true)
      try {
        const d = await getDashboard(dashboardId)
        setDashboard(d)
      } catch {
        setError('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { reset() }
  }, [dashboardId, setDashboard, setLoading, setError, reset])

  // Fetch service options
  useEffect(() => {
    const fetchServices = async () => {
      setServicesLoading(true)
      try {
        const result = await getServices({ size: 200, active: true })
        setServiceOptions(result.content)
      } catch {
        // Silently fail
      } finally {
        setServicesLoading(false)
      }
    }
    fetchServices()
  }, [])

  // Initialize selected services from dashboard tags
  useEffect(() => {
    if (!dashboard?.tags || serviceOptions.length === 0) {
      if (dashboard && !dashboard.tags) setSelectedServices([])
      return
    }
    const tagNames = dashboard.tags.split(',').map((t) => t.trim()).filter(Boolean)
    const matched = serviceOptions.filter((s) => tagNames.includes(s.name))
    setSelectedServices(matched)
    setServicesDirty(false)
  }, [dashboard?.tags, serviceOptions])

  // Warn before unloading with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Resolve widget data
  const doResolve = useCallback(async () => {
    if (!parsedLayout || parsedLayout.widgets.length === 0) return
    setResolving(true)
    try {
      const stepSeconds = computeStep(timeRange.start, timeRange.end)

      const widgetRequests: WidgetDataRequest[] = parsedLayout.widgets.map((w) => ({
        widgetId: w.id,
        dataSourceType: w.dataSource.type,
        query: w.dataSource.query,
        params: w.dataSource.params,
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
        stepSeconds,
      }))

      const variables: Record<string, string> = {}
      if (selectedServices.length > 0) {
        variables.services = selectedServices.map((s) => s.name).join(',')
      }

      const response = await resolveWidgets({
        widgets: widgetRequests,
        variables,
      })
      setWidgetData(response.results)
    } catch {
      setSnackbar({ open: true, message: 'Failed to resolve widget data', severity: 'error' })
    } finally {
      setResolving(false)
    }
  }, [parsedLayout, timeRange, selectedServices, setResolving, setWidgetData])

  // Resolve on initial load and when variables or time range change
  useEffect(() => {
    if (parsedLayout && parsedLayout.widgets.length > 0) {
      doResolve()
    }
  }, [parsedLayout?.widgets.length, timeRange, selectedServices]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save dashboard (layout + services)
  const handleSave = useCallback(async () => {
    if (!dashboard) return
    setSaving(true)
    try {
      const tags = selectedServices.length > 0
        ? selectedServices.map((s) => s.name).join(',')
        : ''
      await updateDashboard(dashboard.id, { layout: getLayoutJson(), tags })
      markClean()
      setServicesDirty(false)
      setSnackbar({ open: true, message: 'Dashboard saved', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to save dashboard', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }, [dashboard, getLayoutJson, markClean, selectedServices])

  // Debounced auto-save on layout change
  const debouncedSave = useDebounce(handleSave, 1000)

  const handleLayoutChange = useCallback(
    (currentLayout: Layout, _allLayouts: ResponsiveLayouts) => {
      updateGridLayout(currentLayout)
      debouncedSave()
    },
    [updateGridLayout, debouncedSave],
  )

  // Widget config dialog
  const handleWidgetSave = (widget: Widget) => {
    if (editWidget) {
      updateWidget(widget)
    } else {
      addWidget(widget)
    }
    setEditWidget(null)
    setBlankType(undefined)
    setBlankSize(undefined)
  }

  const handleEdit = (widget: Widget) => {
    setEditWidget(widget)
    setBlankType(undefined)
    setBlankSize(undefined)
    setDialogOpen(true)
  }

  // Widget Library drawer callbacks
  const handleAddBlank = (type: WidgetType, w: number, h: number) => {
    setEditWidget(null)
    setBlankType(type)
    setBlankSize({ w, h })
    setDialogOpen(true)
  }

  const handleAddPreset = (widget: Widget) => {
    addWidget(widget)
  }

  // Widget delete with confirmation
  const handleRemoveRequest = (widgetId: string) => {
    setDeleteTarget(widgetId)
  }

  const handleRemoveConfirm = () => {
    if (deleteTarget) {
      removeWidget(deleteTarget)
    }
    setDeleteTarget(null)
  }

  if (loading) return <LoadingSpinner fullScreen message="Loading dashboard..." />

  if (!dashboard || !parsedLayout) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        Dashboard not found
      </Box>
    )
  }

  // Build react-grid-layout items
  const layoutItems: LayoutItem[] = parsedLayout.widgets.map((w) => ({
    i: w.id,
    x: w.gridPos.x,
    y: w.gridPos.y,
    w: w.gridPos.w,
    h: w.gridPos.h,
    minW: 2,
    minH: 2,
  }))

  const deleteWidgetTitle = deleteTarget
    ? parsedLayout.widgets.find((w) => w.id === deleteTarget)?.title ?? 'this widget'
    : ''

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      <DashboardToolbar
        title={dashboard.name}
        dirty={dirty || servicesDirty}
        saving={saving}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onAddWidget={() => setDrawerOpen(true)}
        onSave={handleSave}
        onRefresh={doResolve}
      />

      {/* Service selector bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.5,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
          Services
        </Typography>
        <Autocomplete
          multiple
          size="small"
          options={serviceOptions}
          getOptionLabel={(option) => option.name}
          value={selectedServices}
          onChange={(_, value) => {
            setSelectedServices(value)
            setServicesDirty(true)
          }}
          loading={servicesLoading}
          sx={{ flex: 1, minWidth: 250 }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={selectedServices.length === 0 ? 'Select services...' : ''}
              size="small"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {servicesLoading ? <CircularProgress size={16} /> : null}
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
                color="primary"
                variant="outlined"
              />
            ))
          }
          isOptionEqualToValue={(option, value) => option.id === value.id}
        />
      </Box>

      <Box ref={containerRef} sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {parsedLayout.widgets.length === 0 ? (
          /* Empty canvas state */
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 300,
              gap: 2,
              color: 'text.secondary',
            }}
          >
            <DashboardCustomizeIcon sx={{ fontSize: 64, opacity: 0.3 }} />
            <Typography variant="h6" color="text.secondary">
              This dashboard is empty
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Open the widget library to add your first widget.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setDrawerOpen(true)}
            >
              Open Widget Library
            </Button>
          </Box>
        ) : (
          <ResponsiveGridLayout
            className="layout"
            width={width}
            layouts={{ lg: layoutItems }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={80}
            onLayoutChange={handleLayoutChange}
            dragConfig={{ enabled: true, handle: '.drag-handle' }}
            resizeConfig={{ enabled: true, handles: ['se'] }}
            compactor={verticalCompactor}
          >
            {parsedLayout.widgets.map((w) => (
              <div key={w.id}>
                <WidgetCard
                  widget={w}
                  data={widgetData[w.id]}
                  resolving={resolving}
                  onEdit={handleEdit}
                  onRemove={handleRemoveRequest}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </Box>

      {/* Widget Library Drawer (US 13.6) */}
      <WidgetLibraryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAddBlank={handleAddBlank}
        onAddPreset={handleAddPreset}
      />

      {/* Widget Config Dialog */}
      <WidgetConfigDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditWidget(null); setBlankType(undefined); setBlankSize(undefined) }}
        onSave={handleWidgetSave}
        editWidget={editWidget}
        initialType={blankType}
        initialGridSize={blankSize}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
      >
        <DialogTitle>Remove Widget</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove &ldquo;{deleteWidgetTitle}&rdquo; from this dashboard? This change will be saved automatically.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={handleRemoveConfirm} color="error" variant="contained">
            Remove
          </Button>
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
