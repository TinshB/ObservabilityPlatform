import { Box, Typography } from '@mui/material'
import type { TimeSeries } from '@/types'
import type { WidgetOptions } from '@/types/dashboard'
import { formatNumber, formatLatency, formatPercent } from '@/pages/metrics/chartUtils'

interface Props {
  data: TimeSeries[]
  options: WidgetOptions
}

function formatGaugeValue(value: number, unit?: string): string {
  if (unit === 'percent' || unit === '%') return formatPercent(value)
  if (unit === 'seconds' || unit === 's') return formatLatency(value)
  if (unit === 'reqps' || unit === 'req/s') return `${formatNumber(value)} req/s`
  if (unit === 'bytes') return `${formatNumber(value)} B`
  return formatNumber(value)
}

function getGaugeColor(value: number, thresholds?: number[]): string {
  if (!thresholds || thresholds.length < 2) return '#1976d2'
  if (value >= thresholds[1]) return '#d32f2f'
  if (value >= thresholds[0]) return '#ed6c02'
  return '#2e7d32'
}

export default function GaugeRenderer({ data, options }: Props) {
  if (!data.length || !data[0].dataPoints.length) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography variant="h4" color="text.secondary">N/A</Typography>
      </Box>
    )
  }

  const lastPoint = data[0].dataPoints[data[0].dataPoints.length - 1]
  const value = lastPoint.value
  const color = getGaugeColor(value, options.thresholds)
  const label = data[0].name || ''

  // Semicircular gauge: map value to 0-180 degrees
  const maxVal = options.thresholds?.length
    ? options.thresholds[options.thresholds.length - 1] * 1.2
    : 100
  const clampedPercent = Math.min(100, Math.max(0, (value / maxVal) * 100))
  const sweepDeg = (clampedPercent / 100) * 180

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 0.5,
      }}
    >
      {/* Semicircular gauge arc */}
      <Box sx={{ position: 'relative', width: 120, height: 68, overflow: 'hidden' }}>
        {/* Background arc (gray) */}
        <Box
          sx={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: `conic-gradient(
              #e0e0e0 0deg 180deg,
              transparent 180deg 360deg
            )`,
            transform: 'rotate(-90deg)',
          }}
        />
        {/* Filled arc (colored) */}
        <Box
          sx={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: `conic-gradient(
              ${color} 0deg ${sweepDeg}deg,
              transparent ${sweepDeg}deg 360deg
            )`,
            transform: 'rotate(-90deg)',
          }}
        />
        {/* Inner cutout */}
        <Box
          sx={{
            position: 'absolute',
            top: 15,
            left: 15,
            width: 90,
            height: 90,
            borderRadius: '50%',
            bgcolor: 'background.paper',
          }}
        />
        {/* Value text centered on the arc */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            textAlign: 'center',
          }}
        >
          <Typography variant="h5" fontWeight={700} sx={{ color, lineHeight: 1 }}>
            {formatGaugeValue(value, options.unit)}
          </Typography>
        </Box>
      </Box>
      {label && (
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      )}
    </Box>
  )
}
