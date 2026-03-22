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
} from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import DescriptionIcon from '@mui/icons-material/Description'
import GridViewIcon from '@mui/icons-material/GridView'
import SearchIcon from '@mui/icons-material/Search'
import type { ElasticsearchStorageResponse } from '@/types'
import * as billingService from '@/services/billingService'
import SummaryCard from './SummaryCard'
import { formatCurrency, formatNumber } from './formatUtils'

type EsSortField = 'indexName' | 'storageSizeBytes' | 'documentCount' | 'totalShardCount' | 'costUsd'
type SortDirection = 'asc' | 'desc'

interface Props {
  onError: (message: string) => void
}

export default function ElasticsearchStorageTab({ onError }: Props) {
  const [data, setData] = useState<ElasticsearchStorageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<EsSortField>('storageSizeBytes')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await billingService.getElasticsearchStorage()
      setData(result)
    } catch {
      onError('Failed to load Elasticsearch storage data')
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSort = (field: EsSortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const filteredIndices = (data?.indices ?? [])
    .filter(idx => idx.indexName.toLowerCase().includes(search.toLowerCase()))
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
          title="Total Storage"
          value={data?.totalStorageSizeFormatted}
          icon={<StorageIcon />}
          color="primary"
          loading={loading}
        />
        <SummaryCard
          title="Total Cost"
          value={data ? formatCurrency(data.totalCostUsd) : undefined}
          icon={<AttachMoneyIcon />}
          color="success"
          loading={loading}
        />
        <SummaryCard
          title="Documents"
          value={data ? formatNumber(data.totalDocumentCount) : undefined}
          icon={<DescriptionIcon />}
          color="info"
          loading={loading}
        />
        <SummaryCard
          title="Indices"
          value={data ? String(data.indexCount) : undefined}
          subtitle={data ? `@ ${formatCurrency(data.costPerGbUsd)}/GB` : undefined}
          icon={<GridViewIcon />}
          color="warning"
          loading={loading}
        />
      </Box>

      {/* ── Index Table ─────────────────────────────────────────────────── */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={600}>Per-Index Breakdown</Typography>
          <TextField
            size="small"
            placeholder="Search indices…"
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
                <SortableCell label="Index Name" field="indexName" sort={sortField} dir={sortDir} onSort={handleSort} />
                <SortableCell label="Storage Size" field="storageSizeBytes" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <SortableCell label="Documents" field="documentCount" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <SortableCell label="Shards" field="totalShardCount" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
                <SortableCell label="Cost (USD)" field="costUsd" sort={sortField} dir={sortDir} onSort={handleSort} align="right" />
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
              ) : filteredIndices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {search ? 'No indices match your search' : 'No index data available'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredIndices.map(idx => (
                  <TableRow key={idx.indexName} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize={13}>
                        {idx.indexName}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={`${formatNumber(idx.storageSizeBytes)} bytes`}>
                        <Typography variant="body2">{idx.storageSizeFormatted}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{formatNumber(idx.documentCount)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={`${idx.primaryShardCount} primary + ${idx.replicaShardCount} replica`}>
                        <Chip label={idx.totalShardCount} size="small" variant="outlined" />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        {formatCurrency(idx.costUsd)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {!loading && filteredIndices.length > 0 && (
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredIndices.length} of {data?.indexCount ?? 0} indices
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  )
}

function SortableCell({ label, field, sort, dir, onSort, align = 'left' }: {
  label: string; field: EsSortField; sort: EsSortField; dir: SortDirection
  onSort: (f: EsSortField) => void; align?: 'left' | 'right'
}) {
  return (
    <TableCell align={align} sortDirection={sort === field ? dir : false}>
      <TableSortLabel active={sort === field} direction={sort === field ? dir : 'asc'} onClick={() => onSort(field)}>
        {label}
      </TableSortLabel>
    </TableCell>
  )
}
