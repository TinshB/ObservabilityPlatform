import React from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useNavigate } from 'react-router-dom'
import TimeRangePicker from './TimeRangePicker'
import type { TimeRange } from './TimeRangePicker'

interface Props {
  title: string
  dirty: boolean
  saving: boolean
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
  onAddWidget: () => void
  onSave: () => void
  onRefresh: () => void
}

export default function DashboardToolbar({
  title,
  dirty,
  saving,
  timeRange,
  onTimeRangeChange,
  onAddWidget,
  onSave,
  onRefresh,
}: Props) {
  const navigate = useNavigate()

  return (
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
      <Tooltip title="Back to dashboards">
        <IconButton size="small" onClick={() => navigate('/dashboards')}>
          <ArrowBackIcon />
        </IconButton>
      </Tooltip>

      <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }} noWrap>
        {title}
      </Typography>

      {dirty && <Chip label="Unsaved" size="small" color="warning" variant="outlined" />}

      <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} />

      <Tooltip title="Refresh data">
        <IconButton size="small" onClick={onRefresh}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>

      <Button
        variant="outlined"
        size="small"
        startIcon={<AddIcon />}
        onClick={onAddWidget}
      >
        Add Widget
      </Button>

      <Button
        variant="contained"
        size="small"
        startIcon={<SaveIcon />}
        onClick={onSave}
        disabled={!dirty || saving}
      >
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </Box>
  )
}
