import { useState, useMemo } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  Popover,
  TextField,
  Typography,
} from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'

export interface TimeRange {
  start: Date
  end: Date
  label: string
}

interface Preset {
  label: string
  value: string
  seconds: number
}

const PRESETS: Preset[] = [
  { label: '5m', value: '5m', seconds: 5 * 60 },
  { label: '15m', value: '15m', seconds: 15 * 60 },
  { label: '30m', value: '30m', seconds: 30 * 60 },
  { label: '1h', value: '1h', seconds: 3600 },
  { label: '3h', value: '3h', seconds: 3 * 3600 },
  { label: '6h', value: '6h', seconds: 6 * 3600 },
  { label: '12h', value: '12h', seconds: 12 * 3600 },
  { label: '24h', value: '24h', seconds: 24 * 3600 },
  { label: '7d', value: '7d', seconds: 7 * 86400 },
  { label: '30d', value: '30d', seconds: 30 * 86400 },
]

/** Compute a reasonable step (in seconds) so we get ~120-200 data points. */
export function computeStep(start: Date, end: Date): number {
  const durationSec = (end.getTime() - start.getTime()) / 1000
  const raw = Math.round(durationSec / 150)
  // Snap to human-friendly intervals
  if (raw <= 15) return 15
  if (raw <= 30) return 30
  if (raw <= 60) return 60
  if (raw <= 120) return 120
  if (raw <= 300) return 300
  if (raw <= 600) return 600
  if (raw <= 1800) return 1800
  if (raw <= 3600) return 3600
  return Math.ceil(raw / 3600) * 3600
}

/** Format a Date to the `datetime-local` input value format. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Build a default time range (last 15 minutes). */
export function defaultTimeRange(): TimeRange {
  const end = new Date()
  const start = new Date(end.getTime() - 900 * 1000)
  return { start, end, label: 'Last 15m' }
}

interface Props {
  value: TimeRange
  onChange: (range: TimeRange) => void
}

export default function TimeRangePicker({ value, onChange }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const open = Boolean(anchorEl)

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget)
    setCustomStart(toLocalInput(value.start))
    setCustomEnd(toLocalInput(value.end))
  }

  const handlePreset = (preset: Preset) => {
    const end = new Date()
    const start = new Date(end.getTime() - preset.seconds * 1000)
    onChange({ start, end, label: `Last ${preset.label}` })
    setAnchorEl(null)
  }

  const handleApplyCustom = () => {
    const start = new Date(customStart)
    const end = new Date(customEnd)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) return
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    onChange({ start, end, label: `${fmt(start)} — ${fmt(end)}` })
    setAnchorEl(null)
  }

  const customValid = useMemo(() => {
    const s = new Date(customStart)
    const e = new Date(customEnd)
    return !isNaN(s.getTime()) && !isNaN(e.getTime()) && s < e
  }, [customStart, customEnd])

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AccessTimeIcon />}
        onClick={handleOpen}
        sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
      >
        {value.label}
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 2, width: 340 } } }}
      >
        {/* Quick presets */}
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
          Quick ranges
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
          {PRESETS.map((p) => (
            <Chip
              key={p.value}
              label={p.label}
              size="small"
              variant={value.label === `Last ${p.label}` ? 'filled' : 'outlined'}
              color={value.label === `Last ${p.label}` ? 'primary' : 'default'}
              onClick={() => handlePreset(p)}
              clickable
            />
          ))}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Custom range */}
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CalendarMonthIcon sx={{ fontSize: 14 }} /> Custom range
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="From"
            type="datetime-local"
            size="small"
            fullWidth
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            type="datetime-local"
            size="small"
            fullWidth
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleApplyCustom}
            disabled={!customValid}
            fullWidth
          >
            Apply
          </Button>
        </Box>
      </Popover>
    </>
  )
}
