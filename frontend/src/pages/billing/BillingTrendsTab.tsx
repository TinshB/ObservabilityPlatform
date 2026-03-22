import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  Skeleton,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import StorageIcon from '@mui/icons-material/Storage'
import ComputerIcon from '@mui/icons-material/Computer'
import BadgeIcon from '@mui/icons-material/Badge'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import type { BillingTrendResponse } from '@/types'
import * as billingService from '@/services/billingService'
import SummaryCard from './SummaryCard'
import { formatCurrency } from './formatUtils'

const CATEGORY_COLORS = {
  storage: '#2196F3',
  compute: '#FF9800',
  licence: '#9C27B0',
  total: '#4CAF50',
}

interface Props {
  onError: (message: string) => void
}

export default function BillingTrendsTab({ onError }: Props) {
  const [trendData, setTrendData] = useState<BillingTrendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const theme = useTheme()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await billingService.getBillingTrends(
        startDate || undefined,
        endDate || undefined,
      )
      setTrendData(data)
    } catch {
      onError('Failed to load billing trend data')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, onError])

  useEffect(() => { fetchData() }, [fetchData])

  const months = trendData?.months ?? []

  // Calculate month-over-month change
  const latestMonth = months.length > 0 ? months[months.length - 1] : null
  const previousMonth = months.length > 1 ? months[months.length - 2] : null
  const momChange = latestMonth && previousMonth && previousMonth.totalCostUsd > 0
    ? ((latestMonth.totalCostUsd - previousMonth.totalCostUsd) / previousMonth.totalCostUsd) * 100
    : null

  const tooltipStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
  }

  return (
    <Box>
      {/* ── Date Range Filter ───────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Start Date"
          type="date"
          size="small"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="End Date"
          type="date"
          size="small"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        {trendData && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            Showing {trendData.monthCount} month{trendData.monthCount !== 1 ? 's' : ''}
            {trendData.startDate && ` (${trendData.startDate} to ${trendData.endDate})`}
          </Typography>
        )}
      </Box>

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(5, 1fr)' }, gap: 2, mb: 3 }}>
        <SummaryCard
          title="Total Cost"
          value={loading ? undefined : formatCurrency(trendData?.grandTotalCostUsd ?? 0)}
          subtitle={trendData ? `${trendData.monthCount} months` : undefined}
          icon={<AttachMoneyIcon />}
          color="success"
          loading={loading}
        />
        <SummaryCard
          title="Storage Cost"
          value={loading ? undefined : formatCurrency(trendData?.totalStorageCostUsd ?? 0)}
          icon={<StorageIcon />}
          color="primary"
          loading={loading}
        />
        <SummaryCard
          title="Compute Cost"
          value={loading ? undefined : formatCurrency(trendData?.totalComputeCostUsd ?? 0)}
          icon={<ComputerIcon />}
          color="warning"
          loading={loading}
        />
        <SummaryCard
          title="Licence Cost"
          value={loading ? undefined : formatCurrency(trendData?.totalLicenceCostUsd ?? 0)}
          icon={<BadgeIcon />}
          color="info"
          loading={loading}
        />
        <SummaryCard
          title="Month-over-Month"
          value={loading ? undefined : momChange !== null ? `${momChange >= 0 ? '+' : ''}${momChange.toFixed(1)}%` : 'N/A'}
          subtitle={latestMonth?.monthLabel}
          icon={<TrendingUpIcon />}
          color={momChange !== null && momChange > 0 ? 'error' : 'success'}
          loading={loading}
        />
      </Box>

      {/* ── Trend Line Chart ────────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} mb={2}>
          Monthly Cost Trend
        </Typography>
        {loading ? (
          <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 1 }} />
        ) : months.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 350 }}>
            <Typography color="text.secondary">No trend data available for the selected range</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={months} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              />
              <YAxis
                tickFormatter={(v: number) => `$${v}`}
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              />
              <RechartsTooltip
                contentStyle={tooltipStyle}
                formatter={(value: unknown, name: unknown) => [
                  formatCurrency(value as number),
                  String(name),
                ]}
                labelFormatter={(label) => String(label)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="totalCostUsd"
                name="Total"
                stroke={CATEGORY_COLORS.total}
                strokeWidth={3}
                dot={{ r: 5 }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="storageCostUsd"
                name="Storage"
                stroke={CATEGORY_COLORS.storage}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="computeCostUsd"
                name="Compute"
                stroke={CATEGORY_COLORS.compute}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="licenceCostUsd"
                name="Licences"
                stroke={CATEGORY_COLORS.licence}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Paper>

      {/* ── Stacked Area Chart ──────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} mb={2}>
          Cost Distribution Over Time
        </Typography>
        {loading ? (
          <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
        ) : months.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
            <Typography color="text.secondary">No trend data available</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={months} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              />
              <YAxis
                tickFormatter={(v: number) => `$${v}`}
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              />
              <RechartsTooltip
                contentStyle={tooltipStyle}
                formatter={(value: unknown, name: unknown) => [
                  formatCurrency(value as number),
                  String(name),
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="storageCostUsd"
                name="Storage"
                stackId="1"
                stroke={CATEGORY_COLORS.storage}
                fill={CATEGORY_COLORS.storage}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="computeCostUsd"
                name="Compute"
                stackId="1"
                stroke={CATEGORY_COLORS.compute}
                fill={CATEGORY_COLORS.compute}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="licenceCostUsd"
                name="Licences"
                stackId="1"
                stroke={CATEGORY_COLORS.licence}
                fill={CATEGORY_COLORS.licence}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Paper>

      {/* ── Monthly Breakdown Table ─────────────────────────────────────── */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={600}>Monthly Breakdown</Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Month</TableCell>
                <TableCell align="right">Storage</TableCell>
                <TableCell align="right">Compute</TableCell>
                <TableCell align="right">Licences</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : months.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      No trend data available
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {months.map((m) => (
                    <TableRow key={m.month} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{m.monthLabel}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ color: CATEGORY_COLORS.storage }}>
                          {formatCurrency(m.storageCostUsd)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ color: CATEGORY_COLORS.compute }}>
                          {formatCurrency(m.computeCostUsd)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ color: CATEGORY_COLORS.licence }}>
                          {formatCurrency(m.licenceCostUsd)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color="success.main">
                          {formatCurrency(m.totalCostUsd)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow sx={{ '& td': { fontWeight: 700, borderTop: 2, borderColor: 'divider' } }}>
                    <TableCell>Total</TableCell>
                    <TableCell align="right" sx={{ color: CATEGORY_COLORS.storage }}>
                      {formatCurrency(trendData?.totalStorageCostUsd ?? 0)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: CATEGORY_COLORS.compute }}>
                      {formatCurrency(trendData?.totalComputeCostUsd ?? 0)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: CATEGORY_COLORS.licence }}>
                      {formatCurrency(trendData?.totalLicenceCostUsd ?? 0)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>
                      {formatCurrency(trendData?.grandTotalCostUsd ?? 0)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
