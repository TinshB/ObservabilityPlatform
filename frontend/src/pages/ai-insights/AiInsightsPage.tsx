import { Box, Typography, Paper, Chip } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

export default function AiInsightsPage() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 200px)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          textAlign: 'center',
          p: 6,
          maxWidth: 520,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Chip
          label="Coming Soon"
          color="primary"
          size="small"
          sx={{ mb: 2, fontWeight: 600 }}
        />
        <Typography variant="h4" fontWeight={700} gutterBottom>
          AI Insights
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Intelligent anomaly detection, root cause analysis, and predictive
          alerting — powered by machine learning across your metrics, logs, and
          traces.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This feature is currently under development. Stay tuned!
        </Typography>
      </Paper>
    </Box>
  )
}
