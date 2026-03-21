import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material'
import type { Widget, WidgetDataResponse } from '@/types/dashboard'
import TimeSeriesRenderer from '@/pages/dashboards/components/renderers/TimeSeriesRenderer'
import BarChartRenderer from '@/pages/dashboards/components/renderers/BarChartRenderer'
import PieChartRenderer from '@/pages/dashboards/components/renderers/PieChartRenderer'
import TableRenderer from '@/pages/dashboards/components/renderers/TableRenderer'
import StatRenderer from '@/pages/dashboards/components/renderers/StatRenderer'
import GaugeRenderer from '@/pages/dashboards/components/renderers/GaugeRenderer'

interface Props {
  widget: Widget
  data: WidgetDataResponse | undefined
  resolving: boolean
}

export default function ReadOnlyWidgetCard({ widget, data, resolving }: Props) {
  const renderContent = () => {
    if (resolving) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <CircularProgress size={32} />
        </Box>
      )
    }

    if (data?.error) {
      return <Alert severity="error" sx={{ m: 1, fontSize: '0.75rem' }}>{data.error}</Alert>
    }

    if (!data) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">No data</Typography>
        </Box>
      )
    }

    const timeSeries = data.timeSeries ?? []
    const rawData = data.rawData
    const options = widget.options ?? {}

    switch (widget.type) {
      case 'TIME_SERIES':
        return <TimeSeriesRenderer data={timeSeries} options={options} />
      case 'BAR':
        return <BarChartRenderer data={timeSeries} options={options} />
      case 'PIE':
        return <PieChartRenderer data={timeSeries} options={options} />
      case 'TABLE':
        return <TableRenderer data={timeSeries} rawData={rawData} options={options} />
      case 'STAT':
        return <StatRenderer data={timeSeries} options={options} />
      case 'GAUGE':
        return <GaugeRenderer data={timeSeries} options={options} />
      default:
        return <Typography variant="body2" color="text.secondary">Unknown widget type</Typography>
    }
  }

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header — read-only, no menu */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          py: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          minHeight: 36,
        }}
      >
        <Typography variant="subtitle2" noWrap fontWeight={600} fontSize="0.8rem">
          {widget.title}
        </Typography>
      </Box>

      {/* Content */}
      <CardContent sx={{ flex: 1, p: 1, '&:last-child': { pb: 1 }, overflow: 'hidden' }}>
        {renderContent()}
      </CardContent>
    </Card>
  )
}
