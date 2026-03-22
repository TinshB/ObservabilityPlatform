import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Skeleton,
  Tooltip,
  TextField,
  InputAdornment,
  LinearProgress,
} from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import TimelineIcon from '@mui/icons-material/Timeline'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SearchIcon from '@mui/icons-material/Search'
import type { PrometheusStorageResponse } from '@/types'
import * as billingService from '@/services/billingService'
import SummaryCard from './SummaryCard'
import { formatCurrency, formatNumber } from './formatUtils'

type PromSortField = 'serviceName' | 'seriesCount' | 'seriesPercentage' | 'estimatedStorageBytes' | 'estimatedCostUsd'
type SortDirection = 'asc' | 'desc'

interface Props {
  onError: (message: string) => void
}

export default function PrometheusStorageTab({ onError }: Props) {
  const [data, setData] = useState<PrometheusStorageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<PromSortField>('seriesCount')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await billingService.getPrometheusStorage()
      setData(result)
    } catch {
      onError('Failed to load Prometheus storage data')
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSort = (field: PromSortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const filteredServices = (data?.services ?? [])
    .filter(svc => svc.serviceName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })

  return (
    <Box>
      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <SummaryCard
          title="TSDB Storage"
          value={data?.totalStorageSizeFormatted}
          icon={<StorageIcon />}
          color="primary"
          loading={loading}
        />
        <SummaryCard
          title="Total Cost"
          value={data ? formatCurrency(data.totalCostUsd) : undefined}
          subtitle={data ? `@ ${formatCurrency(data.costPerGbUsd)}/GB` : undefined}
          icon={<AttachMoneyIcon />}
          color="success"
          loading={loading}
        />
        <SummaryCard
          title="Active Series"
          value={data ? formatNumber(data.totalActiveSeries) : undefined}
          icon={<TimelineIcon />}
          color="info"
          loading={loading}
        />
        <SummaryCard
          title="Retention"
          value={data?.retentionPeriod}
          subtitle={data ? `${formatNumber(data.totalLabelValuePairs)} label pairs` : undefined}
          icon={<ScheduleIcon />}
          color="warning"
          loading={loading}
        />
      </Box>

      {/* ── Per-Service Table ────────────────────────────────────────────── */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={600}>Per-Service Breakdown</Typography>
          <TextField
            size="small"
            placeholder="Search services…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ width: 260 }}
          />
        </Box>

        <TableContainer sx={{ maxHeight: 520 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <SortableCell label="Service / Job" field="serviceName" sort={sortField} dir={sortDir} onSort={handleSort} />
                <SortableCell label="Active Series" field="seriesCount" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <TableCell align="right">% of Total</TableCell>
                <SortableCell label="Est. Storage" field="estimatedStorageBytes" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <SortableCell label="Est. Cost (USD)" field="estimatedCostUsd" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {search ? 'No services match your search' : 'No service data available'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredServices.map(svc => (
                  <TableRow key={svc.serviceName} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize={13}>
                        {svc.serviceName}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{formatNumber(svc.seriesCount)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(svc.seriesPercentage, 100)}
                          sx={{ width: 60, height: 6, borderRadius: 3 }}
                        />
                        <Tooltip title={`${svc.seriesPercentage}% of all active series`}>
                          <Chip label={`${svc.seriesPercentage}%`} size="small" variant="outlined" />
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={`${formatNumber(svc.estimatedStorageBytes)} bytes`}>
                        <Typography variant="body2">{svc.estimatedStorageFormatted}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        {formatCurrency(svc.estimatedCostUsd)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {!loading && filteredServices.length > 0 && (
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredServices.length} of {data?.services.length ?? 0} services
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  )
}

function SortableCell({ label, field, sort, dir, onSort, align = 'left' }: {
  label: string; field: PromSortField; sort: PromSortField; dir: SortDirection
  onSort: (f: PromSortField) => void; align?: 'left' | 'right'
}) {
  return (
    <TableCell align={align} sortDirection={sort === field ? dir : false}>
      <TableSortLabel active={sort === field} direction={sort === field ? dir : 'asc'} onClick={() => onSort(field)}>
        {label}
      </TableSortLabel>
    </TableCell>
  )
}
