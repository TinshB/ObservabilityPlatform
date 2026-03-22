import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Skeleton,
} from '@mui/material'
import type { WorkflowStepMetrics } from '@/types'
import * as workflowService from '@/services/workflowService'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatLatency(seconds?: number | null): string {
  if (seconds == null) return '—'
  const ms = seconds * 1000
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatRps(rps?: number | null): string {
  if (rps == null) return '—'
  if (rps < 0.01) return '0 req/s'
  if (rps < 10) return `${rps.toFixed(2)} req/s`
  if (rps < 100) return `${rps.toFixed(1)} req/s`
  return `${Math.round(rps)} req/s`
}

function formatErrorPct(ratio?: number | null): string {
  if (ratio == null) return '—'
  return `${(ratio * 100).toFixed(1)}%`
}

function errorColor(ratio?: number | null): string {
  if (ratio == null) return 'text.secondary'
  if (ratio < 0.01) return '#2e7d32'
  if (ratio < 0.05) return '#ed6c02'
  return '#d32f2f'
}

function formatTraces(count?: number | null, errors?: number | null): string {
  if (count == null) return '—'
  if (errors != null && errors > 0) return `${count} (${errors} err)`
  return `${count}`
}

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  workflowId: string
  refreshKey: number
}

export default function WorkflowStepMetricsPanel({ workflowId, refreshKey }: Props) {
  const [steps, setSteps] = useState<WorkflowStepMetrics[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    workflowService.getStepMetrics(workflowId)
      .then((res) => { if (!cancelled) setSteps(res.steps) })
      .catch(() => { if (!cancelled) setSteps([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [workflowId, refreshKey])

  return (
    <Paper variant="outlined" sx={{ mb: 3 }}>
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Step Metrics</Typography>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }}>#</TableCell>
              <TableCell>Step</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Endpoint</TableCell>
              <TableCell align="right">RPS</TableCell>
              <TableCell align="right">Error %</TableCell>
              <TableCell align="right">P50</TableCell>
              <TableCell align="right">P95</TableCell>
              <TableCell align="right">P99</TableCell>
              <TableCell align="right">Traces</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : steps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No step metrics available</Typography>
                </TableCell>
              </TableRow>
            ) : steps.map((step) => (
              <TableRow key={step.stepId} hover>
                <TableCell>
                  <Box sx={{
                    width: 22, height: 22, borderRadius: '50%',
                    backgroundColor: 'primary.main', color: 'primary.contrastText',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700,
                  }}>
                    {step.stepOrder}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={500} noWrap>
                    {step.label || `Step ${step.stepOrder}`}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap>{step.serviceName}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem" noWrap>
                    {step.httpMethod} {step.pathPattern}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                    {formatRps(step.requestRate)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem"
                    sx={{ color: errorColor(step.errorRate) }}>
                    {formatErrorPct(step.errorRate)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                    {formatLatency(step.latencyP50)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                    {formatLatency(step.latencyP95)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                    {formatLatency(step.latencyP99)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                    {step.recentErrorCount != null && step.recentErrorCount > 0 ? (
                      <>
                        {step.recentTraceCount}{' '}
                        <Box component="span" sx={{ color: '#d32f2f' }}>
                          ({step.recentErrorCount} err)
                        </Box>
                      </>
                    ) : (
                      formatTraces(step.recentTraceCount, step.recentErrorCount)
                    )}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
