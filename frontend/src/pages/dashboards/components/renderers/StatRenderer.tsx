import { Box, Typography } from '@mui/material'
import type { TimeSeries } from '@/types'
import type { WidgetOptions } from '@/types/dashboard'
import { formatNumber, formatLatency, formatPercent } from '@/pages/metrics/chartUtils'

interface Props {
  data: TimeSeries[]
  options: WidgetOptions
}

function formatStatValue(value: number, unit?: string): string {
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

export default function StatRenderer({ data, options }: Props) {
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

  // Gauge-style circular indicator
  const gaugePercent = options.thresholds?.length
    ? Math.min(100, (value / (options.thresholds[options.thresholds.length - 1] * 1.2)) * 100)
    : null

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
      {gaugePercent !== null && (
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `conic-gradient(${color} ${gaugePercent * 3.6}deg, #e0e0e0 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1,
          }}
        >
          <Box
            sx={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body2" fontWeight={700} color={color}>
              {gaugePercent.toFixed(0)}%
            </Typography>
          </Box>
        </Box>
      )}
      <Typography
        variant={gaugePercent !== null ? 'h5' : 'h3'}
        fontWeight={700}
        sx={{ color }}
      >
        {formatStatValue(value, options.unit)}
      </Typography>
      {label && (
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      )}
    </Box>
  )
}
