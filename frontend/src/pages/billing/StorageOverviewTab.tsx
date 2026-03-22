import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
} from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import BadgeIcon from '@mui/icons-material/Badge'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import type { StorageSummaryResponse, LicenceCostSummaryResponse } from '@/types'
import * as billingService from '@/services/billingService'
import SummaryCard from './SummaryCard'
import { formatCurrency } from './formatUtils'

// Logs, Metrics, Traces, Licences
const COST_COLORS = ['#2196F3', '#FF9800', '#4CAF50', '#9C27B0']

interface Props {
  onError: (message: string) => void
}

export default function StorageOverviewTab({ onError }: Props) {
  const [storageData, setStorageData] = useState<StorageSummaryResponse | null>(null)
  const [licenceData, setLicenceData] = useState<LicenceCostSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const theme = useTheme()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [storage, licence] = await Promise.allSettled([
        billingService.getStorageSummary(),
        billingService.getLicenceCostSummary(),
      ])
      if (storage.status === 'fulfilled') setStorageData(storage.value)
      else onError('Failed to load storage summary')
      if (licence.status === 'fulfilled') setLicenceData(licence.value)
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => { fetchData() }, [fetchData])

  const storageCost = storageData?.totalCostUsd ?? 0
  const licenceCost = licenceData?.totalMonthlyCostUsd ?? 0
  const grandTotal = storageCost + licenceCost

  const costChartData = [
    { name: 'Logs', value: storageData?.elasticsearchCostUsd ?? 0 },
    { name: 'Metrics', value: storageData?.prometheusCostUsd ?? 0 },
    { name: 'Traces', value: storageData?.jaegerCostUsd ?? 0 },
    { name: 'Licences', value: licenceCost },
  ].filter(d => d.value > 0)

  const costBarData = [
    { name: 'Logs', cost: storageData?.elasticsearchCostUsd ?? 0 },
    { name: 'Metrics', cost: storageData?.prometheusCostUsd ?? 0 },
    { name: 'Traces', cost: storageData?.jaegerCostUsd ?? 0 },
    { name: 'Licences', cost: licenceCost },
  ]

  return (
    <Box>
      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <SummaryCard
          title="Total Monthly Cost"
          value={loading ? undefined : formatCurrency(grandTotal)}
          icon={<AttachMoneyIcon />}
          color="success"
          loading={loading}
        />
        <SummaryCard
          title="Storage Cost"
          value={loading ? undefined : formatCurrency(storageCost)}
          subtitle={storageData?.totalSizeFormatted}
          icon={<StorageIcon />}
          color="primary"
          loading={loading}
        />
        <SummaryCard
          title="Licence Cost"
          value={loading ? undefined : formatCurrency(licenceCost)}
          subtitle={licenceData ? `${licenceData.totalUsers} users` : undefined}
          icon={<BadgeIcon />}
          color="info"
          loading={loading}
        />
        <SummaryCard
          title="Annual Projection"
          value={loading ? undefined : formatCurrency(grandTotal * 12)}
          icon={<AttachMoneyIcon />}
          color="warning"
          loading={loading}
        />
      </Box>

      {/* ── Charts Row ──────────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Cost Distribution Pie Chart */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>Cost Distribution</Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <Skeleton variant="circular" width={200} height={200} />
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={costChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={(props: PieLabelRenderProps) => `${props.name} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`}
                >
                  {costChartData.map((entry, index) => (
                    <Cell key={index} fill={COST_COLORS[['Logs', 'Metrics', 'Traces', 'Licences'].indexOf(entry.name)] ?? COST_COLORS[0]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                  formatter={(value: unknown, name: unknown) => [
                    `${formatCurrency(value as number)}`,
                    String(name),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Paper>

        {/* Cost Comparison Bar Chart */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>Cost by Category</Typography>
          {loading ? (
            <Box sx={{ py: 4 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" height={35} sx={{ mb: 1, borderRadius: 1 }} />
              ))}
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={costBarData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `$${v}`}
                  tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={70}
                  tick={{ fontSize: 13, fill: theme.palette.text.primary }}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                  formatter={(value: unknown) => [formatCurrency(value as number), 'Cost']}
                />
                <Legend />
                <Bar dataKey="cost" name="Monthly Cost (USD)" radius={[0, 4, 4, 0]}>
                  {costBarData.map((_, index) => (
                    <Cell key={index} fill={COST_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </Box>

      {/* ── Breakdown Table ─────────────────────────────────────────────── */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={600}>Cost Breakdown</Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell align="right">Details</TableCell>
                <TableCell align="right">Monthly Cost (USD)</TableCell>
                <TableCell align="right">% of Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <>
                  <CostRow
                    name="Logs (Elasticsearch)"
                    color={COST_COLORS[0]}
                    detail={storageData?.elasticsearchSizeFormatted ?? '—'}
                    costUsd={storageData?.elasticsearchCostUsd ?? 0}
                    totalCost={grandTotal}
                  />
                  <CostRow
                    name="Metrics (Prometheus)"
                    color={COST_COLORS[1]}
                    detail={storageData?.prometheusSizeFormatted ?? '—'}
                    costUsd={storageData?.prometheusCostUsd ?? 0}
                    totalCost={grandTotal}
                  />
                  <CostRow
                    name="Traces (Jaeger)"
                    color={COST_COLORS[2]}
                    detail={storageData?.jaegerSizeFormatted ?? '—'}
                    costUsd={storageData?.jaegerCostUsd ?? 0}
                    totalCost={grandTotal}
                  />
                  <CostRow
                    name="Licences"
                    color={COST_COLORS[3]}
                    detail={licenceData ? `${licenceData.totalUsers} users` : '—'}
                    costUsd={licenceCost}
                    totalCost={grandTotal}
                  />
                  <TableRow sx={{ '& td': { fontWeight: 700, borderTop: 2, borderColor: 'divider' } }}>
                    <TableCell>Total</TableCell>
                    <TableCell />
                    <TableCell align="right" sx={{ color: 'success.main' }}>
                      {formatCurrency(grandTotal)}
                    </TableCell>
                    <TableCell align="right">100%</TableCell>
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

function CostRow({ name, color, detail, costUsd, totalCost }: {
  name: string; color: string; detail: string; costUsd: number; totalCost: number
}) {
  const pct = totalCost > 0 ? ((costUsd / totalCost) * 100).toFixed(1) : '0.0'

  return (
    <TableRow hover>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
          <Typography variant="body2">{name}</Typography>
        </Box>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" color="text.secondary">{detail}</Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight={600} color="success.main">
          {formatCurrency(costUsd)}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2">{pct}%</Typography>
      </TableCell>
    </TableRow>
  )
}
