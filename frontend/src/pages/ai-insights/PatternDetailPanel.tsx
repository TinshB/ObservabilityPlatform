import {
  Drawer, Box, Typography, IconButton, Divider, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, Button, Stack,
  Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import WarningIcon from '@mui/icons-material/Warning'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts'
import type { FlowPattern } from '@/services/flowAnalysisService'

interface Props {
  pattern: FlowPattern | null
  onClose: () => void
  onConvert: (pattern: FlowPattern) => void
}

export default function PatternDetailPanel({ pattern, onClose, onConvert }: Props) {
  if (!pattern) return null

  // Find bottleneck step (highest latency contribution)
  const totalLatency = pattern.steps.reduce((sum, s) => sum + s.avgLatencyMs, 0)
  const bottleneckIndex = pattern.steps.reduce(
    (maxIdx, s, i, arr) => s.avgLatencyMs > arr[maxIdx].avgLatencyMs ? i : maxIdx, 0,
  )

  // Stacked bar chart data
  const chartData = pattern.steps.map((step) => ({
    name: step.serviceName.length > 15
      ? step.serviceName.substring(0, 13) + '...'
      : step.serviceName,
    latencyMs: Math.round(step.avgLatencyMs),
    errorRate: step.errorRate * 100,
    fullName: step.serviceName,
    method: step.method,
    path: step.path,
  }))

  const COLORS = ['#1976d2', '#0288d1', '#00897b', '#7b1fa2', '#f57c00', '#d32f2f', '#546e7a', '#5c6bc0']

  return (
    <Drawer
      anchor="right"
      open={!!pattern}
      onClose={onClose}
      PaperProps={{ sx: { width: 440, p: 0 } }}
    >
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={600} noWrap sx={{ flex: 1 }}>
          {pattern.name}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider />

      <Box sx={{ p: 2, overflow: 'auto' }}>
        {/* Summary metrics */}
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
          <Chip label={`${pattern.frequency} traces`} variant="outlined" />
          <Chip label={`Avg: ${Math.round(pattern.avgLatencyMs)}ms`} variant="outlined" />
          {pattern.p95LatencyMs && (
            <Chip label={`P95: ${Math.round(pattern.p95LatencyMs)}ms`} variant="outlined" />
          )}
          {pattern.p99LatencyMs && (
            <Chip label={`P99: ${Math.round(pattern.p99LatencyMs)}ms`} variant="outlined" />
          )}
          <Chip
            label={`${(pattern.errorRate * 100).toFixed(1)}% errors`}
            variant="outlined"
            color={pattern.errorRate > 0.05 ? 'error' : pattern.errorRate > 0.01 ? 'warning' : 'success'}
          />
        </Stack>

        {/* Step breakdown table */}
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Step Breakdown
        </Typography>
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Path</TableCell>
              <TableCell align="right">Latency</TableCell>
              <TableCell align="right">Err %</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pattern.steps.map((step, i) => (
              <TableRow
                key={i}
                sx={{
                  bgcolor: i === bottleneckIndex ? 'warning.50' : undefined,
                }}
              >
                <TableCell>{step.order}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {step.serviceName}
                    {i === bottleneckIndex && (
                      <Tooltip title="Bottleneck — highest latency contribution">
                        <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={step.method || '—'} size="small" variant="outlined" />
                </TableCell>
                <TableCell sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <Tooltip title={step.path || '—'}>
                    <Typography variant="caption" noWrap>{step.path || '—'}</Typography>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  {Math.round(step.avgLatencyMs)}ms
                  <Typography variant="caption" color="text.secondary" display="block">
                    {totalLatency > 0 ? Math.round((step.avgLatencyMs / totalLatency) * 100) : 0}%
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {(step.errorRate * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Latency breakdown chart */}
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Latency Contribution
        </Typography>
        <Box sx={{ height: 220, mb: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" unit="ms" />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
              <RTooltip
                formatter={(value: number, _: string, props: any) =>
                  [`${value}ms — ${props.payload.method || ''} ${props.payload.path || ''}`, 'Latency']
                }
              />
              <Bar dataKey="latencyMs" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>

        {/* Sample traces */}
        {pattern.sampleTraceIds.length > 0 && (
          <>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Sample Traces
            </Typography>
            <Stack spacing={0.5} sx={{ mb: 2 }}>
              {pattern.sampleTraceIds.slice(0, 5).map((traceId) => (
                <Box key={traceId} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: 'primary.main',
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                    onClick={() => window.open(`/traces/${traceId}`, '_blank')}
                  >
                    {traceId}
                  </Typography>
                  <OpenInNewIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                </Box>
              ))}
            </Stack>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Convert action */}
        <Button
          fullWidth
          variant="contained"
          startIcon={<AccountTreeIcon />}
          onClick={() => onConvert(pattern)}
          sx={{ mb: 1 }}
        >
          Convert to Monitored Workflow
        </Button>
      </Box>
    </Drawer>
  )
}
