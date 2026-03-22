import { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Alert,
} from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { Widget, WidgetDataResponse } from '@/types/dashboard'
import TimeSeriesRenderer from './renderers/TimeSeriesRenderer'
import BarChartRenderer from './renderers/BarChartRenderer'
import PieChartRenderer from './renderers/PieChartRenderer'
import TableRenderer from './renderers/TableRenderer'
import StatRenderer from './renderers/StatRenderer'
import GaugeRenderer from './renderers/GaugeRenderer'

interface Props {
  widget: Widget
  data: WidgetDataResponse | undefined
  resolving: boolean
  onEdit: (widget: Widget) => void
  onRemove: (widgetId: string) => void
}

export default function WidgetCard({ widget, data, resolving, onEdit, onRemove }: Props) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)

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
      {/* Header */}
      <Box
        className="drag-handle"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          minHeight: 36,
          cursor: 'move',
        }}
      >
        <Typography variant="subtitle2" noWrap fontWeight={600} fontSize="0.8rem">
          {widget.title}
        </Typography>
        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem onClick={() => { setMenuAnchor(null); onEdit(widget) }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMenuAnchor(null); onRemove(widget.id) }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Remove</ListItemText>
          </MenuItem>
        </Menu>
      </Box>

      {/* Content */}
      <CardContent sx={{ flex: 1, p: 1, '&:last-child': { pb: 1 }, overflow: 'hidden' }}>
        {renderContent()}
      </CardContent>
    </Card>
  )
}
