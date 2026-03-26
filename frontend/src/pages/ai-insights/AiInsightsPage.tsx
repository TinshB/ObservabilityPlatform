import { useState } from 'react'
import {
  Box, Typography, Tabs, Tab, Paper,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import FlowDiagramTab from './FlowDiagramTab'

export default function AiInsightsPage() {
  const [tab, setTab] = useState(0)

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AutoAwesomeIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" fontWeight={700}>
          AI Insights
        </Typography>
      </Box>

      <Paper sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Flow Diagram Generator" />
          <Tab label="Analysis History" />
        </Tabs>
      </Paper>

      {tab === 0 && <FlowDiagramTab />}
      {tab === 1 && (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          Analysis history will appear here once you run your first analysis.
        </Typography>
      )}
    </Box>
  )
}
