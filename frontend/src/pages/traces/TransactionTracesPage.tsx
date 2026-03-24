import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Snackbar,
  Alert,
  Skeleton,
  Tooltip,
  LinearProgress,
  Button,
  IconButton,
  Popover,
  Checkbox,
  FormControlLabel,
  FormGroup,
  TextField,
} from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import type { TraceSummary, TraceSearchParams } from '@/types'
import * as traceService from '@/services/traceService'
import { useBreadcrumb } from '@/hooks/useBreadcrumb'
import { formatDuration, formatTime, formatRootOperation } from '@/utils/traceUtils'

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20

// ── Column definitions ──────────────────────────────────────────────────────

type ColumnKey = 'traceId' | 'rootService' | 'rootOperation' | 'startTime' | 'httpStatusCode' | 'duration' | 'spans' | 'errors' | 'services'
type SortDirection = 'asc' | 'desc'

interface ColumnDef {
  key: ColumnKey
  label: string
  sortable: boolean
  defaultVisible: boolean
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'traceId',        label: 'Trace ID',        sortable: false, defaultVisible: true },
  { key: 'rootService',    label: 'Root Service',    sortable: false, defaultVisible: true },
  { key: 'rootOperation',  label: 'Root Operation',  sortable: false, defaultVisible: true },
  { key: 'startTime',      label: 'Start Time',      sortable: true,  defaultVisible: true },
  { key: 'httpStatusCode', label: 'HTTP Status',     sortable: true,  defaultVisible: true },
  { key: 'duration',       label: 'Duration',        sortable: false, defaultVisible: true },
  { key: 'spans',          label: 'Spans',           sortable: false, defaultVisible: true },
  { key: 'errors',         label: 'Errors',          sortable: false, defaultVisible: true },
  { key: 'services',       label: 'Services',        sortable: false, defaultVisible: true },
]

const DEFAULT_VISIBLE = new Set<ColumnKey>(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))

// ── Duration bar ────────────────────────────────────────────────────────────

function DurationBar({ durationMicros, maxDuration, hasError }: {
  durationMicros: number
  maxDuration: number
  hasError: boolean
}) {
  const pct = maxDuration > 0 ? Math.max((durationMicros / maxDuration) * 100, 2) : 2

  return (
    <Tooltip title={formatDuration(durationMicros)} arrow>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
        <Box sx={{ flexGrow: 1, position: 'relative' }}>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: 'action.disabledBackground',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundColor: hasError ? 'error.main' : 'primary.main',
              },
            }}
          />
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.75rem',
            minWidth: 60,
            textAlign: 'right',
          }}
        >
          {formatDuration(durationMicros)}
        </Typography>
      </Box>
    </Tooltip>
  )
}

// ── Error indicator ─────────────────────────────────────────────────────────

function ErrorIndicator({ errorCount, spanCount }: { errorCount: number; spanCount: number }) {
  if (errorCount === 0) {
    return (
      <Tooltip title="No errors">
        <CheckCircleOutlineIcon sx={{ fontSize: 18, color: 'success.main' }} />
      </Tooltip>
    )
  }
  return (
    <Tooltip title={`${errorCount} error span${errorCount > 1 ? 's' : ''} / ${spanCount} total`}>
      <Chip
        icon={<ErrorOutlineIcon sx={{ fontSize: 14 }} />}
        label={errorCount}
        size="small"
        color="error"
        sx={{ fontWeight: 600, fontSize: '0.75rem' }}
      />
    </Tooltip>
  )
}

// ── Main page component ─────────────────────────────────────────────────────

export default function TransactionTracesPage() {
  const { operation } = useParams<{ operation: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const decodedOperation = decodeURIComponent(operation ?? '')
  useBreadcrumb(operation ?? '', decodedOperation)

  const serviceId = searchParams.get('service') ?? ''
  const range     = searchParams.get('range') ?? ''
  const start     = searchParams.get('start') ?? ''
  const end       = searchParams.get('end') ?? ''

  // ── Trace data ──────────────────────────────────────────────────────────
  const [traces, setTraces]     = useState<TraceSummary[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [limit, setLimit]       = useState(DEFAULT_LIMIT)

  // ── Duration filters ──────────────────────────────────────────────────
  const [minDuration, setMinDuration] = useState('')
  const [maxDuration, setMaxDuration] = useState('')

  // ── Column visibility ──────────────────────────────────────────────────
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_VISIBLE))
  const [columnAnchor, setColumnAnchor] = useState<HTMLElement | null>(null)

  // ── Sorting ───────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<ColumnKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  // ── Snackbar ────────────────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState<{
    open: boolean; message: string; severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'info' })

  // ── Fetch traces ──────────────────────────────────────────────────────
  const fetchTraces = useCallback(async () => {
    if (!serviceId || !decodedOperation) return

    setLoading(true)
    try {
      const params: TraceSearchParams = {
        operation: decodedOperation,
        limit,
      }
      if (start && end) {
        params.start = start
        params.end   = end
      } else if (range) {
        params.range = range
      }
      if (minDuration.trim()) params.minDuration = minDuration.trim()
      if (maxDuration.trim()) params.maxDuration = maxDuration.trim()

      const result = await traceService.getServiceTraces(serviceId, params)
      setTraces(result.traces)
      setTotal(result.total)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load traces', severity: 'error' })
      setTraces([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [serviceId, decodedOperation, range, start, end, minDuration, maxDuration, limit])

  useEffect(() => {
    fetchTraces()
  }, [fetchTraces])

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleTraceClick = (traceId: string) => {
    const params = new URLSearchParams()
    if (serviceId) params.set('service', serviceId)
    if (range) params.set('range', range)
    const qs = params.toString()
    navigate(`/traces/${encodeURIComponent(traceId)}${qs ? `?${qs}` : ''}`)
  }

  const handleBack = () => {
    const params = new URLSearchParams()
    if (serviceId) params.set('service', serviceId)
    if (range) params.set('range', range)
    const qs = params.toString()
    navigate(`/traces${qs ? `?${qs}` : ''}`)
  }

  const handleLoadMore = () => setLimit((prev) => prev + 20)

  // ── Sorting ───────────────────────────────────────────────────────────
  const handleSort = (key: ColumnKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedTraces = useMemo(() => {
    if (!sortKey) return traces
    const sorted = [...traces]
    sorted.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'startTime') {
        cmp = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      } else if (sortKey === 'httpStatusCode') {
        cmp = (a.httpStatusCode ?? 0) - (b.httpStatusCode ?? 0)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [traces, sortKey, sortDir])

  // ── Column toggle ─────────────────────────────────────────────────────
  const handleColumnToggle = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const visibleColumnDefs = ALL_COLUMNS.filter(c => visibleColumns.has(c.key))

  // Max duration for bar scaling
  const maxDurationValue = traces.length > 0
    ? Math.max(...traces.map((t) => t.durationMicros))
    : 1

  return (
    <Box>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <IconButton size="small" onClick={handleBack}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Traces
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {decodedOperation}
          </Typography>
        </Box>
      </Box>

      {/* ── Duration filters ──────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          sx={{ width: 130 }}
          label="Min Duration"
          placeholder="e.g. 100ms"
          value={minDuration}
          onChange={(e) => setMinDuration(e.target.value)}
          size="small"
        />
        <TextField
          sx={{ width: 130 }}
          label="Max Duration"
          placeholder="e.g. 5s"
          value={maxDuration}
          onChange={(e) => setMaxDuration(e.target.value)}
          size="small"
        />
      </Paper>

      {/* ── Results summary + column selector ─────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {loading
            ? 'Loading traces...'
            : `${traces.length} trace${traces.length !== 1 ? 's' : ''} returned`}
          {total > 0 && !loading && ` (${total} total)`}
        </Typography>
        <Tooltip title="Select columns">
          <IconButton size="small" onClick={(e) => setColumnAnchor(e.currentTarget)}>
            <ViewColumnIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Trace table ───────────────────────────────────────────────── */}
      <Paper variant="outlined">
        <TableContainer sx={{ maxHeight: 'calc(100vh - 360px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {visibleColumnDefs.map((col) => (
                  <TableCell
                    key={col.key}
                    align={col.key === 'spans' || col.key === 'errors' || col.key === 'httpStatusCode' ? 'center' : 'left'}
                    sx={{ fontWeight: 600 }}
                    sortDirection={sortKey === col.key ? sortDir : false}
                  >
                    {col.sortable ? (
                      <TableSortLabel
                        active={sortKey === col.key}
                        direction={sortKey === col.key ? sortDir : 'desc'}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {visibleColumnDefs.map((col) => (
                      <TableCell key={col.key} align={col.key === 'spans' || col.key === 'errors' || col.key === 'httpStatusCode' ? 'center' : 'left'}>
                        <Skeleton variant="text" width={col.key === 'duration' ? 180 : 100} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sortedTraces.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnDefs.length} sx={{ textAlign: 'center', py: 6 }}>
                    <Typography variant="body1" color="text.secondary">
                      No traces found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Try adjusting your duration filters or time range
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedTraces.map((trace) => {
                  const opLabel = formatRootOperation(trace)
                  return (
                    <TableRow
                      key={trace.traceId}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleTraceClick(trace.traceId)}
                    >
                      {visibleColumns.has('traceId') && (
                        <TableCell
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.8rem',
                            color: 'primary.main',
                          }}
                        >
                          <Tooltip title="View trace detail" arrow>
                            <span>{trace.traceId.substring(0, 16)}...</span>
                          </Tooltip>
                        </TableCell>
                      )}

                      {visibleColumns.has('rootService') && (
                        <TableCell sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {trace.rootService}
                        </TableCell>
                      )}

                      {visibleColumns.has('rootOperation') && (
                        <TableCell
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.8rem',
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Tooltip title={opLabel} arrow>
                            <span>{opLabel}</span>
                          </Tooltip>
                        </TableCell>
                      )}

                      {visibleColumns.has('startTime') && (
                        <TableCell
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatTime(trace.startTime)}
                        </TableCell>
                      )}

                      {visibleColumns.has('httpStatusCode') && (
                        <TableCell align="center">
                          {trace.httpStatusCode != null ? (
                            <Chip
                              label={trace.httpStatusCode}
                              size="small"
                              sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 44 }}
                              color={
                                trace.httpStatusCode >= 500 ? 'error'
                                : trace.httpStatusCode >= 400 ? 'warning'
                                : 'success'
                              }
                            />
                          ) : (
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                      )}

                      {visibleColumns.has('duration') && (
                        <TableCell>
                          <DurationBar
                            durationMicros={trace.durationMicros}
                            maxDuration={maxDurationValue}
                            hasError={trace.errorCount > 0}
                          />
                        </TableCell>
                      )}

                      {visibleColumns.has('spans') && (
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight={500}>
                            {trace.spanCount}
                          </Typography>
                        </TableCell>
                      )}

                      {visibleColumns.has('errors') && (
                        <TableCell align="center">
                          <ErrorIndicator errorCount={trace.errorCount} spanCount={trace.spanCount} />
                        </TableCell>
                      )}

                      {visibleColumns.has('services') && (
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {trace.services.slice(0, 3).map((svc) => (
                              <Chip
                                key={svc}
                                label={svc}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            ))}
                            {trace.services.length > 3 && (
                              <Chip
                                label={`+${trace.services.length - 3}`}
                                size="small"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            )}
                          </Box>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Load more */}
        {!loading && sortedTraces.length > 0 && sortedTraces.length >= limit && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Button variant="outlined" size="small" onClick={handleLoadMore}>
              Load more traces
            </Button>
          </Box>
        )}
      </Paper>

      {/* ── Column Selector Popover ──────────────────────────────────── */}
      <Popover
        open={Boolean(columnAnchor)}
        anchorEl={columnAnchor}
        onClose={() => setColumnAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 2, minWidth: 200 } } }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
          Toggle Columns
        </Typography>
        <FormGroup>
          {ALL_COLUMNS.map((col) => (
            <FormControlLabel
              key={col.key}
              control={
                <Checkbox
                  size="small"
                  checked={visibleColumns.has(col.key)}
                  onChange={() => handleColumnToggle(col.key)}
                />
              }
              label={<Typography variant="body2">{col.label}</Typography>}
            />
          ))}
        </FormGroup>
      </Popover>

      {/* ── Snackbar ─────────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
