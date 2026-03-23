import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  FormControlLabel,
  Switch,
  Typography,
  Autocomplete,
} from '@mui/material'
import type { Widget, WidgetType, DataSourceType } from '@/types/dashboard'
import { v4 as uuidv4 } from 'uuid'

const WIDGET_TYPES: { value: WidgetType; label: string }[] = [
  { value: 'TIME_SERIES', label: 'Time Series (Line)' },
  { value: 'BAR', label: 'Bar Chart' },
  { value: 'PIE', label: 'Pie Chart' },
  { value: 'TABLE', label: 'Table' },
  { value: 'STAT', label: 'Stat / Number' },
  { value: 'GAUGE', label: 'Gauge' },
]

const DATA_SOURCE_TYPES: { value: DataSourceType; label: string }[] = [
  { value: 'PROMETHEUS', label: 'Metrics' },
  { value: 'ELASTICSEARCH', label: 'Logs' },
  { value: 'JAEGER', label: 'Traces' },
  { value: 'POSTGRESQL', label: 'PostgreSQL' },
]

// ── Predefined queries per datasource ──────────────────────────────────────

interface PredefinedQuery {
  label: string
  query: string
}

const PREDEFINED_QUERIES: Record<DataSourceType, PredefinedQuery[]> = {
  PROMETHEUS: [
    { label: 'Request Rate (RPS)', query: 'sum(rate(http_server_request_duration_seconds_count{job="$service"}[5m]))' },
    { label: 'Error Rate (%)', query: 'sum(rate(http_server_request_duration_seconds_count{job="$service",http_response_status_code=~"5.."}[5m])) / sum(rate(http_server_request_duration_seconds_count{job="$service"}[5m]))' },
    { label: 'Latency P50', query: 'histogram_quantile(0.50, sum by(le)(rate(http_server_request_duration_seconds_bucket{job="$service"}[5m])))' },
    { label: 'Latency P95', query: 'histogram_quantile(0.95, sum by(le)(rate(http_server_request_duration_seconds_bucket{job="$service"}[5m])))' },
    { label: 'Latency P99', query: 'histogram_quantile(0.99, sum by(le)(rate(http_server_request_duration_seconds_bucket{job="$service"}[5m])))' },
    { label: 'Request Rate by Route', query: 'sum by(http_route)(rate(http_server_request_duration_seconds_count{job="$service"}[5m]))' },
    { label: 'Error Rate by Route', query: 'sum by(http_route)(rate(http_server_request_duration_seconds_count{job="$service",http_response_status_code=~"5.."}[5m]))' },
    { label: 'CPU Usage (cores)', query: 'sum(rate(process_cpu_seconds_total{job="$service"}[5m]))' },
    { label: 'JVM Heap Used', query: 'sum(jvm_memory_used_bytes{job="$service",area="heap"})' },
    { label: 'JVM Heap Max', query: 'sum(jvm_memory_max_bytes{job="$service",area="heap"})' },
    { label: 'JVM Threads Live', query: 'sum(jvm_threads_live_threads{job="$service"})' },
    { label: 'GC Pause Time', query: 'sum(rate(jvm_gc_pause_seconds_sum{job="$service"}[5m]))' },
    { label: 'Active DB Connections', query: 'sum(hikaricp_connections_active{job="$service"})' },
    { label: 'Redis Cache Hit Ratio', query: 'sum(rate(cache_gets_total{job="$service",result="hit"}[5m])) / sum(rate(cache_gets_total{job="$service"}[5m]))' },
    { label: 'System CPU Utilisation', query: 'avg(system_cpu_usage{job="$service"})' },
    { label: 'Process Resident Memory', query: 'sum(process_resident_memory_bytes{job="$service"})' },
  ],
  ELASTICSEARCH: [
    { label: 'Error Logs', query: 'level:ERROR' },
    { label: 'Warning Logs', query: 'level:WARN' },
    { label: 'Exception Logs', query: 'exception OR stacktrace OR "stack_trace"' },
    { label: 'Timeout Errors', query: 'timeout OR "timed out" OR TimeoutException' },
    { label: 'Connection Errors', query: 'ConnectionRefused OR "connection reset" OR "connection refused"' },
    { label: 'OOM Errors', query: 'OutOfMemoryError OR "out of memory"' },
    { label: 'Authentication Failures', query: 'unauthorized OR "401" OR "403" OR "access denied"' },
    { label: 'Database Errors', query: 'SQLException OR "database" AND (error OR fail)' },
    { label: 'All Logs (no filter)', query: '*' },
  ],
  JAEGER: [
    { label: 'All Traces for Service', query: '$service' },
    { label: 'Error Traces', query: '$service error=true' },
    { label: 'Slow Traces (>1s)', query: '$service minDuration=1s' },
    { label: 'Slow Traces (>500ms)', query: '$service minDuration=500ms' },
    { label: 'Traces for Specific Route', query: '$service http.route=/api/v1/...' },
  ],
  POSTGRESQL: [
    { label: 'Services Table', query: 'services' },
    { label: 'Users Table', query: 'users' },
    { label: 'Alerts Table', query: 'alerts' },
    { label: 'Workflows Table', query: 'workflows' },
    { label: 'Reports Table', query: 'reports' },
  ],
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onSave: (widget: Widget) => void
  editWidget: Widget | null
  /** When opening for a blank type from the library drawer */
  initialType?: WidgetType
  initialGridSize?: { w: number; h: number }
}

export default function WidgetConfigDialog({
  open,
  onClose,
  onSave,
  editWidget,
  initialType,
  initialGridSize,
}: Props) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<WidgetType>('TIME_SERIES')
  const [dsType, setDsType] = useState<DataSourceType>('PROMETHEUS')
  const [query, setQuery] = useState('')
  const [unit, setUnit] = useState('')
  const [legend, setLegend] = useState(true)
  const [stacked, setStacked] = useState(false)
  const [thresholdWarn, setThresholdWarn] = useState('')
  const [thresholdCrit, setThresholdCrit] = useState('')

  useEffect(() => {
    if (editWidget) {
      setTitle(editWidget.title)
      setType(editWidget.type)
      setDsType(editWidget.dataSource.type)
      setQuery(editWidget.dataSource.query)
      setUnit(editWidget.options.unit || '')
      setLegend(editWidget.options.legend !== false)
      setStacked(editWidget.options.stacked === true)
      const t = editWidget.options.thresholds
      setThresholdWarn(t?.[0] != null ? String(t[0]) : '')
      setThresholdCrit(t?.[1] != null ? String(t[1]) : '')
    } else {
      setTitle('')
      setType(initialType ?? 'TIME_SERIES')
      setDsType('PROMETHEUS')
      setQuery('')
      setUnit('')
      setLegend(true)
      setStacked(false)
      setThresholdWarn('')
      setThresholdCrit('')
    }
  }, [editWidget, open, initialType])

  const showThresholds = type === 'STAT' || type === 'GAUGE'
  const showStackedLegend = type === 'TIME_SERIES' || type === 'BAR' || type === 'PIE'

  const predefinedOptions = PREDEFINED_QUERIES[dsType] ?? []

  const handleSave = () => {
    const thresholds: number[] = []
    if (thresholdWarn && !isNaN(Number(thresholdWarn))) thresholds.push(Number(thresholdWarn))
    if (thresholdCrit && !isNaN(Number(thresholdCrit))) thresholds.push(Number(thresholdCrit))

    const gridSize = editWidget?.gridPos
      ?? (initialGridSize ? { x: 0, y: Infinity, ...initialGridSize } : { x: 0, y: Infinity, w: 6, h: 4 })

    const widget: Widget = {
      id: editWidget?.id || uuidv4(),
      title: title || 'Untitled Widget',
      type,
      gridPos: gridSize,
      dataSource: {
        type: dsType,
        query,
      },
      options: {
        unit: unit || undefined,
        legend,
        stacked,
        thresholds: thresholds.length > 0 ? thresholds : undefined,
      },
    }
    onSave(widget)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editWidget ? 'Edit Widget' : 'Add Widget'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            size="small"
          />

          <FormControl fullWidth size="small">
            <InputLabel>Widget Type</InputLabel>
            <Select
              value={type}
              label="Widget Type"
              onChange={(e) => setType(e.target.value as WidgetType)}
            >
              {WIDGET_TYPES.map((wt) => (
                <MenuItem key={wt.value} value={wt.value}>{wt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Data Source</InputLabel>
            <Select
              value={dsType}
              label="Data Source"
              onChange={(e) => {
                setDsType(e.target.value as DataSourceType)
                setQuery('')
              }}
            >
              {DATA_SOURCE_TYPES.map((ds) => (
                <MenuItem key={ds.value} value={ds.value}>{ds.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Predefined query suggestions */}
          <Autocomplete
            freeSolo
            options={predefinedOptions}
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : option.label
            }
            value={predefinedOptions.find((o) => o.query === query) ?? null}
            inputValue={query}
            onInputChange={(_, value) => setQuery(value)}
            onChange={(_, value) => {
              if (value && typeof value !== 'string') {
                setQuery(value.query)
                if (!title) setTitle(value.label)
              }
            }}
            renderOption={(props, option) => (
              <li {...props} key={option.label}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{option.label}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem', wordBreak: 'break-all' }}>
                    {option.query}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Query"
                multiline
                rows={3}
                size="small"
                placeholder={
                  dsType === 'PROMETHEUS'
                    ? 'Type or select a PromQL query...'
                    : dsType === 'ELASTICSEARCH'
                      ? 'Type or select a log search query...'
                      : dsType === 'JAEGER'
                        ? 'Type or select a trace query...'
                        : 'Enter table name...'
                }
                helperText="Select a predefined query or type a custom one"
              />
            )}
          />

          <TextField
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            size="small"
            placeholder="req/s, s, %, bytes"
            helperText="Used by Stat/Gauge to format values"
          />

          {showThresholds && (
            <>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Thresholds
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Warning"
                  value={thresholdWarn}
                  onChange={(e) => setThresholdWarn(e.target.value)}
                  size="small"
                  type="number"
                  sx={{ flex: 1 }}
                  helperText="Orange above this"
                />
                <TextField
                  label="Critical"
                  value={thresholdCrit}
                  onChange={(e) => setThresholdCrit(e.target.value)}
                  size="small"
                  type="number"
                  sx={{ flex: 1 }}
                  helperText="Red above this"
                />
              </Box>
            </>
          )}

          {showStackedLegend && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel
                control={<Switch checked={legend} onChange={(_, v) => setLegend(v)} size="small" />}
                label="Show Legend"
              />
              <FormControlLabel
                control={<Switch checked={stacked} onChange={(_, v) => setStacked(v)} size="small" />}
                label="Stacked"
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!query.trim()}>
          {editWidget ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
