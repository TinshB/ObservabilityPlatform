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
  { value: 'PROMETHEUS', label: 'Prometheus' },
  { value: 'ELASTICSEARCH', label: 'Elasticsearch' },
  { value: 'JAEGER', label: 'Jaeger' },
  { value: 'POSTGRESQL', label: 'PostgreSQL' },
]

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
              onChange={(e) => setDsType(e.target.value as DataSourceType)}
            >
              {DATA_SOURCE_TYPES.map((ds) => (
                <MenuItem key={ds.value} value={ds.value}>{ds.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
            multiline
            rows={3}
            size="small"
            placeholder={
              dsType === 'PROMETHEUS'
                ? 'sum(rate(http_server_request_duration_seconds_count{job="$service",environment="$environment"}[5m]))'
                : dsType === 'ELASTICSEARCH'
                  ? 'error OR exception'
                  : dsType === 'JAEGER'
                    ? 'my-service'
                    : 'services'
            }
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
