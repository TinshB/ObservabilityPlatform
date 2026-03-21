import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Snackbar,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import RefreshIcon from '@mui/icons-material/Refresh'
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize'
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout'
import type { LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { Dashboard, DashboardLayout, WidgetDataRequest, WidgetDataResponse } from '@/types/dashboard'
import { getDashboard, resolveWidgets } from '@/services/dashboardService'
import { defaultTimeRange, computeStep } from '@/pages/dashboards/components/TimeRangePicker'
import TimeRangePicker from '@/pages/dashboards/components/TimeRangePicker'
import type { TimeRange } from '@/pages/dashboards/components/TimeRangePicker'
import ReadOnlyWidgetCard from './ReadOnlyWidgetCard'

const DEFAULT_DASHBOARD_KEY = 'obs-default-dashboard'

export default function DashboardPage() {
  const navigate = useNavigate()
  const defaultId = localStorage.getItem(DEFAULT_DASHBOARD_KEY)

  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [parsedLayout, setParsedLayout] = useState<DashboardLayout | null>(null)
  const [widgetData, setWidgetData] = useState<Record<string, WidgetDataResponse>>({})
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })

  const { width, containerRef } = useContainerWidth()

  // Load default dashboard
  useEffect(() => {
    if (!defaultId) return
    const load = async () => {
      setLoading(true)
      try {
        const d = await getDashboard(defaultId)
        setDashboard(d)
        try {
          const layout: DashboardLayout = JSON.parse(d.layout || '{"widgets":[],"variables":[]}')
          setParsedLayout(layout)
        } catch {
          setParsedLayout({ widgets: [], variables: [] })
        }
      } catch {
        setSnackbar({ open: true, message: 'Failed to load default dashboard', severity: 'error' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [defaultId])

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

      // Include dashboard-level services in variables
      const variables: Record<string, string> = {}
      if (dashboard?.tags) {
        variables.services = dashboard.tags
      }

      const response = await resolveWidgets({
        widgets: widgetRequests,
        variables,
      })
      const dataMap: Record<string, WidgetDataResponse> = {}
      response.results.forEach((r) => { dataMap[r.widgetId] = r })
      setWidgetData(dataMap)
    } catch {
      setSnackbar({ open: true, message: 'Failed to resolve widget data', severity: 'error' })
    } finally {
      setResolving(false)
    }
  }, [parsedLayout, timeRange])

  // Resolve on load and time range change
  useEffect(() => {
    if (parsedLayout && parsedLayout.widgets.length > 0) {
      doResolve()
    }
  }, [parsedLayout?.widgets.length, timeRange]) // eslint-disable-line react-hooks/exhaustive-deps

  // No default dashboard set
  if (!defaultId) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <HomeIcon color="primary" />
          <Typography variant="h4" fontWeight={700}>Home</Typography>
        </Box>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <DashboardCustomizeIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No default dashboard selected
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Set a default dashboard from the Custom Dashboards section to display it here.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/dashboards')}>
            Go to Custom Dashboards
          </Button>
        </Box>
      </Box>
    )
  }

  // Loading state
  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <HomeIcon color="primary" />
          <Typography variant="h4" fontWeight={700}>Home</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Box>
    )
  }

  if (!dashboard || !parsedLayout) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <HomeIcon color="primary" />
          <Typography variant="h4" fontWeight={700}>Home</Typography>
        </Box>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary">
            Dashboard not found. It may have been deleted.
          </Typography>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/dashboards')}>
            Go to Custom Dashboards
          </Button>
        </Box>
      </Box>
    )
  }

  // Build grid layout items (static — no drag/resize)
  const layoutItems: LayoutItem[] = parsedLayout.widgets.map((w) => ({
    i: w.id,
    x: w.gridPos.x,
    y: w.gridPos.y,
    w: w.gridPos.w,
    h: w.gridPos.h,
    static: true,
  }))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      {/* Read-only toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <HomeIcon color="primary" />
        <Typography variant="h6" fontWeight={700} sx={{ mr: 1 }}>
          Home
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {dashboard.name}
        </Typography>
        {dashboard.tags && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {dashboard.tags.split(',').map((tag) => (
              <Chip key={tag} label={tag.trim()} size="small" color="primary" variant="outlined" />
            ))}
          </Box>
        )}
        <Box sx={{ flexGrow: 1 }} />

        <TimeRangePicker value={timeRange} onChange={setTimeRange} />

        <Tooltip title="Refresh data">
          <IconButton size="small" onClick={doResolve}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Read-only canvas */}
      <Box ref={containerRef} sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {parsedLayout.widgets.length === 0 ? (
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
              Add widgets from the Custom Dashboards section.
            </Typography>
            <Button variant="outlined" onClick={() => navigate(`/dashboards/${dashboard.id}`)}>
              Edit in Custom Dashboards
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
            dragConfig={{ enabled: false }}
            resizeConfig={{ enabled: false }}
            compactor={verticalCompactor}
          >
            {parsedLayout.widgets.map((w) => (
              <div key={w.id}>
                <ReadOnlyWidgetCard
                  widget={w}
                  data={widgetData[w.id]}
                  resolving={resolving}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </Box>

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
