import { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Snackbar,
  Alert,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import StorageIcon from '@mui/icons-material/Storage'
import BarChartIcon from '@mui/icons-material/BarChart'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import BadgeIcon from '@mui/icons-material/Badge'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import StorageOverviewTab from './StorageOverviewTab'
import ElasticsearchStorageTab from './ElasticsearchStorageTab'
import PrometheusStorageTab from './PrometheusStorageTab'
import JaegerStorageTab from './JaegerStorageTab'
import LicenceTiersTab from './LicenceTiersTab'
import BillingTrendsTab from './BillingTrendsTab'

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const handleError = useCallback((message: string) => {
    setSnackbar({ open: true, message, severity: 'error' })
  }, [])

  const handleSuccess = useCallback((message: string) => {
    setSnackbar({ open: true, message, severity: 'success' })
  }, [])

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Billings</Typography>
        <Typography variant="body2" color="text.secondary">
          Storage costs, licence management, and cost analytics
        </Typography>
      </Box>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          aria-label="Billing tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<DashboardIcon />} iconPosition="start" label="Overview" />
          <Tab icon={<StorageIcon />} iconPosition="start" label="Logs" />
          <Tab icon={<BarChartIcon />} iconPosition="start" label="Metrics" />
          <Tab icon={<AccountTreeIcon />} iconPosition="start" label="Traces" />
          <Tab icon={<BadgeIcon />} iconPosition="start" label="Licences" />
          <Tab icon={<TrendingUpIcon />} iconPosition="start" label="Trends" />
        </Tabs>
      </Box>

      {/* ── Tab Content ─────────────────────────────────────────────────── */}
      {activeTab === 0 && <StorageOverviewTab onError={handleError} />}
      {activeTab === 1 && <ElasticsearchStorageTab onError={handleError} />}
      {activeTab === 2 && <PrometheusStorageTab onError={handleError} />}
      {activeTab === 3 && <JaegerStorageTab onError={handleError} />}
      {activeTab === 4 && <LicenceTiersTab onError={handleError} onSuccess={handleSuccess} />}
      {activeTab === 5 && <BillingTrendsTab onError={handleError} />}

      {/* ── Snackbar ────────────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
