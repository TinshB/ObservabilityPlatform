import { Outlet } from 'react-router-dom'
import { Box, Paper, Typography } from '@mui/material'

/**
 * Centred card layout used for unauthenticated pages (Login, SSO redirect).
 *
 * Full brand header / logo added in Sprint 2 design pass.
 */
export default function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight:      '100vh',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        px: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        {/* Platform branding */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={700} color="primary.dark">
            System Insights
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Unified visibility into your applications
          </Typography>
        </Box>

        <Paper sx={{ p: 4 }} variant="outlined">
          <Outlet />
        </Paper>
      </Box>
    </Box>
  )
}
