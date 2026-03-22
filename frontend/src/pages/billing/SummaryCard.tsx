import { Box, Card, CardContent, Typography, Skeleton } from '@mui/material'

interface SummaryCardProps {
  title: string
  value?: string
  subtitle?: string
  icon: React.ReactNode
  color: 'primary' | 'success' | 'info' | 'warning' | 'error'
  loading: boolean
}

export default function SummaryCard({ title, value, subtitle, icon, color, loading }: SummaryCardProps) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, pb: '16px !important' }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1.5,
            bgcolor: `${color}.main`,
            color: `${color}.contrastText`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" noWrap>{title}</Typography>
          {loading ? (
            <Skeleton variant="text" width={80} height={32} />
          ) : (
            <Typography variant="h6" fontWeight={700}>{value ?? '—'}</Typography>
          )}
          {subtitle && !loading && (
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
