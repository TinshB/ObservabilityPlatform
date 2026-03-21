import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tooltip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import type { SpanBreakupResponse, OperationBreakup } from '@/types'
import * as traceService from '@/services/traceService'

// ── Service colour palette (same as TraceDetailPage) ────────────────────────

const SERVICE_COLORS = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828',
  '#00838f', '#4e342e', '#283593', '#558b2f', '#ad1457',
  '#00695c', '#bf360c', '#1565c0', '#6a1b9a', '#e65100',
]

function getServiceColor(name: string, map: Map<string, number>): string {
  if (!map.has(name)) map.set(name, map.size)
  return SERVICE_COLORS[map.get(name)! % SERVICE_COLORS.length]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(micros: number): string {
  if (micros < 1000) return `${micros}µs`
  if (micros < 1_000_000) return `${(micros / 1000).toFixed(1)}ms`
  return `${(micros / 1_000_000).toFixed(2)}s`
}

// ── Stacked duration bar ────────────────────────────────────────────────────

function StackedBar({ op, traceDuration, color }: {
  op: OperationBreakup
  traceDuration: number
  color: string
}) {
  const totalPct = traceDuration > 0
    ? Math.max((op.totalDurationMicros / traceDuration) * 100, 0.5)
    : 0
  const selfPct = traceDuration > 0
    ? Math.max((op.selfTimeMicros / traceDuration) * 100, 0.3)
    : 0

  return (
    <Tooltip
      title={`Total: ${formatDuration(op.totalDurationMicros)} (${op.percentOfTrace}%) · Self: ${formatDuration(op.selfTimeMicros)}`}
      arrow
    >
      <Box sx={{ position: 'relative', height: 16, minWidth: 120 }}>
        {/* Background track */}
        <Box sx={{ position: 'absolute', top: 6, left: 0, right: 0, height: 4, backgroundColor: 'grey.200', borderRadius: 2 }} />
        {/* Total duration (lighter) */}
        <Box
          sx={{
            position: 'absolute',
            top: 3,
            left: 0,
            width: `${totalPct}%`,
            height: 10,
            borderRadius: 1,
            backgroundColor: color,
            opacity: 0.3,
            minWidth: 3,
          }}
        />
        {/* Self-time (solid) */}
        <Box
          sx={{
            position: 'absolute',
            top: 3,
            left: 0,
            width: `${selfPct}%`,
            height: 10,
            borderRadius: 1,
            backgroundColor: op.errorCount > 0 ? 'error.main' : color,
            opacity: 0.85,
            minWidth: 2,
          }}
        />
      </Box>
    </Tooltip>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function SpanBreakupPanel({ traceId }: { traceId: string }) {
  const [data, setData] = useState<SpanBreakupResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const result = await traceService.getSpanBreakup(traceId)
        if (!cancelled) setData(result)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [traceId])

  const serviceColorMap = new Map<string, number>()

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ mt: 3 }}>
        <Box sx={{ p: 2 }}>
          <Skeleton variant="text" width={200} height={28} sx={{ mb: 1 }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={32} sx={{ mb: 0.5 }} />
          ))}
        </Box>
      </Paper>
    )
  }

  if (error || !data) {
    return (
      <Paper variant="outlined" sx={{ mt: 3, p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {error ? 'Failed to load span breakup' : 'No span breakup data'}
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper variant="outlined" sx={{ mt: 3 }}>
      {/* Header */}
      <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Span Breakup
        </Typography>
        <Chip label={`${data.totalSpans} spans`} size="small" variant="outlined" />
        <Chip label={`${data.serviceCount} services`} size="small" variant="outlined" />
        <Chip label={`${data.operations.length} operations`} size="small" variant="outlined" />
      </Box>

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>Service</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 200 }}>Operation</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 60 }} align="center">Spans</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 60 }} align="center">Errors</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 200 }}>Duration (total / self)</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 80 }} align="right">Avg</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 70 }} align="right">% Trace</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.operations.map((op, idx) => {
              const color = getServiceColor(op.serviceName, serviceColorMap)
              return (
                <TableRow key={idx} hover>
                  {/* Service chip */}
                  <TableCell>
                    <Chip
                      label={op.serviceName}
                      size="small"
                      sx={{
                        backgroundColor: color,
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 22,
                        maxWidth: 130,
                      }}
                    />
                  </TableCell>

                  {/* Operation name */}
                  <TableCell>
                    <Tooltip title={op.operationName} arrow>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '0.78rem',
                          maxWidth: 260,
                        }}
                      >
                        {op.operationName}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  {/* Span count */}
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={500}>
                      {op.spanCount}
                    </Typography>
                  </TableCell>

                  {/* Error count */}
                  <TableCell align="center">
                    {op.errorCount > 0 ? (
                      <Chip
                        icon={<ErrorOutlineIcon sx={{ fontSize: 12 }} />}
                        label={op.errorCount}
                        size="small"
                        color="error"
                        sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">0</Typography>
                    )}
                  </TableCell>

                  {/* Stacked duration bar */}
                  <TableCell>
                    <StackedBar op={op} traceDuration={data.traceDurationMicros} color={color} />
                  </TableCell>

                  {/* Avg duration */}
                  <TableCell align="right">
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}
                    >
                      {formatDuration(op.avgDurationMicros)}
                    </Typography>
                  </TableCell>

                  {/* % of trace */}
                  <TableCell align="right">
                    <Typography
                      variant="caption"
                      fontWeight={op.percentOfTrace > 50 ? 700 : 400}
                      color={op.percentOfTrace > 50 ? 'error.main' : 'text.primary'}
                      sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}
                    >
                      {op.percentOfTrace}%
                    </Typography>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
