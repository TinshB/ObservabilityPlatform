import { useState } from 'react'
import {
  Drawer,
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Divider,
  Tabs,
  Tab,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import TimelineIcon from '@mui/icons-material/Timeline'
import BarChartIcon from '@mui/icons-material/BarChart'
import PieChartIcon from '@mui/icons-material/PieChart'
import TableChartIcon from '@mui/icons-material/TableChart'
import PinIcon from '@mui/icons-material/Pin'
import SpeedIcon from '@mui/icons-material/Speed'
import type { Widget, WidgetType, DataSourceType } from '@/types/dashboard'
import { v4 as uuidv4 } from 'uuid'

// ── Widget type catalog ─────────────────────────────────────────────────

interface WidgetTypeInfo {
  type: WidgetType
  label: string
  description: string
  icon: React.ReactNode
  defaultW: number
  defaultH: number
}

const WIDGET_TYPE_CATALOG: WidgetTypeInfo[] = [
  { type: 'TIME_SERIES', label: 'Time Series', description: 'Line or stacked area chart for trends over time', icon: <TimelineIcon />, defaultW: 6, defaultH: 4 },
  { type: 'BAR',         label: 'Bar Chart',   description: 'Vertical bars for comparing categories or rankings', icon: <BarChartIcon />, defaultW: 6, defaultH: 4 },
  { type: 'PIE',         label: 'Pie Chart',   description: 'Proportional breakdown of a single metric', icon: <PieChartIcon />, defaultW: 4, defaultH: 4 },
  { type: 'TABLE',       label: 'Table',       description: 'Tabular data — logs, query results, or time-series', icon: <TableChartIcon />, defaultW: 6, defaultH: 4 },
  { type: 'STAT',        label: 'Stat',        description: 'Single big number with optional threshold colors', icon: <PinIcon />, defaultW: 3, defaultH: 2 },
  { type: 'GAUGE',       label: 'Gauge',       description: 'Semicircular gauge for utilization or percentage values', icon: <SpeedIcon />, defaultW: 3, defaultH: 2 },
]

// ── Widget presets ──────────────────────────────────────────────────────

interface WidgetPreset {
  label: string
  description: string
  category: string
  type: WidgetType
  dsType: DataSourceType
  query: string
  options: Record<string, unknown>
  w: number
  h: number
}

const WIDGET_PRESETS: WidgetPreset[] = [
  // Service
  {
    label: 'Request Rate', description: 'Requests per second', category: 'Service',
    type: 'STAT', dsType: 'PROMETHEUS',
    query: 'sum(rate(http_server_request_duration_seconds_count{job="$service"}[5m]))',
    options: { unit: 'req/s' }, w: 3, h: 2,
  },
  {
    label: 'Error Rate %', description: '5xx percentage over time', category: 'Service',
    type: 'STAT', dsType: 'PROMETHEUS',
    query: 'sum(rate(http_server_request_duration_seconds_count{job="$service",http_response_status_code=~"5.."}[5m])) / sum(rate(http_server_request_duration_seconds_count{job="$service"}[5m])) * 100',
    options: { unit: '%', thresholds: [1, 5] }, w: 3, h: 2,
  },
  {
    label: 'P95 Latency', description: '95th percentile response time', category: 'Service',
    type: 'STAT', dsType: 'PROMETHEUS',
    query: 'histogram_quantile(0.95, sum by(le) (rate(http_server_request_duration_seconds_bucket{job="$service"}[5m])))',
    options: { unit: 's' }, w: 3, h: 2,
  },
  {
    label: 'Request Rate Over Time', description: 'Trend by HTTP method', category: 'Service',
    type: 'TIME_SERIES', dsType: 'PROMETHEUS',
    query: 'sum by(http_request_method) (rate(http_server_request_duration_seconds_count{job="$service"}[5m]))',
    options: { legend: true }, w: 6, h: 4,
  },
  // Infrastructure
  {
    label: 'CPU Usage', description: 'Current CPU utilization gauge', category: 'Infrastructure',
    type: 'GAUGE', dsType: 'PROMETHEUS',
    query: '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
    options: { unit: '%', thresholds: [60, 85] }, w: 3, h: 2,
  },
  {
    label: 'Memory Usage', description: 'Current memory utilization gauge', category: 'Infrastructure',
    type: 'GAUGE', dsType: 'PROMETHEUS',
    query: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
    options: { unit: '%', thresholds: [70, 90] }, w: 3, h: 2,
  },
  {
    label: 'Network I/O', description: 'Network bytes in/out by instance', category: 'Infrastructure',
    type: 'TIME_SERIES', dsType: 'PROMETHEUS',
    query: 'sum by(instance) (rate(node_network_receive_bytes_total[5m]) + rate(node_network_transmit_bytes_total[5m]))',
    options: { legend: true, unit: 'bytes/s' }, w: 6, h: 4,
  },
  // Database
  {
    label: 'Active DB Connections', description: 'PostgreSQL active connections', category: 'Database',
    type: 'STAT', dsType: 'PROMETHEUS',
    query: 'sum(pg_stat_activity_count{state="active"})',
    options: {}, w: 3, h: 2,
  },
  {
    label: 'Cache Hit Ratio', description: 'PostgreSQL buffer cache hit %', category: 'Database',
    type: 'TIME_SERIES', dsType: 'PROMETHEUS',
    query: 'sum(pg_stat_database_blks_hit) / (sum(pg_stat_database_blks_hit) + sum(pg_stat_database_blks_read)) * 100',
    options: { legend: true, unit: '%' }, w: 6, h: 4,
  },
  // Logs
  {
    label: 'Error Logs Table', description: 'Recent error-level log entries', category: 'Logs',
    type: 'TABLE', dsType: 'ELASTICSEARCH',
    query: 'service.name:"$service" AND severity:ERROR',
    options: {}, w: 6, h: 4,
  },
  // API
  {
    label: 'Error Breakdown', description: 'Error count by HTTP status code', category: 'API',
    type: 'PIE', dsType: 'PROMETHEUS',
    query: 'sum by(http_response_status_code) (increase(http_server_request_duration_seconds_count{job="$service",http_response_status_code=~"[45].."}[1h]))',
    options: { legend: true }, w: 4, h: 4,
  },
  {
    label: 'Slowest Endpoints', description: 'Top 10 endpoints by P99 latency', category: 'API',
    type: 'BAR', dsType: 'PROMETHEUS',
    query: 'topk(10, histogram_quantile(0.99, sum by(le, http_route) (rate(http_server_request_duration_seconds_bucket{job="$service"}[5m]))))',
    options: { unit: 's' }, w: 8, h: 4,
  },
]

// ── Component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onAddBlank: (type: WidgetType, w: number, h: number) => void
  onAddPreset: (widget: Widget) => void
}

export default function WidgetLibraryDrawer({ open, onClose, onAddBlank, onAddPreset }: Props) {
  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState('')

  const filteredTypes = WIDGET_TYPE_CATALOG.filter(
    (t) => t.label.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()),
  )

  const presetCategories = [...new Set(WIDGET_PRESETS.map((p) => p.category))]
  const filteredPresets = WIDGET_PRESETS.filter(
    (p) => p.label.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()),
  )

  const handlePresetClick = (preset: WidgetPreset) => {
    const widget: Widget = {
      id: uuidv4(),
      title: preset.label,
      type: preset.type,
      gridPos: { x: 0, y: Infinity, w: preset.w, h: preset.h },
      dataSource: { type: preset.dsType, query: preset.query },
      options: preset.options as Widget['options'],
    }
    onAddPreset(widget)
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 380 } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>Widget Library</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ px: 2, pb: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search widgets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
        <Tab label="Types" />
        <Tab label="Presets" />
      </Tabs>

      <Divider />

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {tab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {filteredTypes.map((wt) => (
              <Card key={wt.type} variant="outlined">
                <CardActionArea onClick={() => { onAddBlank(wt.type, wt.defaultW, wt.defaultH); onClose() }}>
                  <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1.5 }}>
                    <Box sx={{ color: 'primary.main', display: 'flex' }}>{wt.icon}</Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600}>{wt.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{wt.description}</Typography>
                    </Box>
                    <Chip label={`${wt.defaultW}x${wt.defaultH}`} size="small" variant="outlined" />
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
            {filteredTypes.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No widget types match your search.
              </Typography>
            )}
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {presetCategories.map((cat) => {
              const catPresets = filteredPresets.filter((p) => p.category === cat)
              if (catPresets.length === 0) return null
              return (
                <Box key={cat}>
                  <Typography variant="overline" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    {cat}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {catPresets.map((preset) => (
                      <Card key={preset.label} variant="outlined">
                        <CardActionArea onClick={() => { handlePresetClick(preset); onClose() }}>
                          <CardContent sx={{ py: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography variant="subtitle2" fontWeight={600}>{preset.label}</Typography>
                              <Chip label={preset.type} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
                            </Box>
                            <Typography variant="caption" color="text.secondary">{preset.description}</Typography>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    ))}
                  </Box>
                </Box>
              )
            })}
            {filteredPresets.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No presets match your search.
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Drawer>
  )
}
