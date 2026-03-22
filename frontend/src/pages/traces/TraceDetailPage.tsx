import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tooltip,
  Collapse,
  IconButton,
  Snackbar,
  Alert,
  Skeleton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Button,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ArticleIcon from '@mui/icons-material/Article'
import TableHead from '@mui/material/TableHead'
import type { TraceDetailResponse, SpanDetail, SpanLog, LogEntry } from '@/types'
import * as traceService from '@/services/traceService'
import { getLogsByTraceId } from '@/services/logService'
import SpanBreakupPanel from './SpanBreakupPanel'
import AiSuggestionsPanel from './AiSuggestionsPanel'
import { useBreadcrumb } from '@/hooks/useBreadcrumb'

// ── Service colour palette ──────────────────────────────────────────────────

const SERVICE_COLORS = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828',
  '#00838f', '#4e342e', '#283593', '#558b2f', '#ad1457',
  '#00695c', '#bf360c', '#1565c0', '#6a1b9a', '#e65100',
]

function getServiceColor(serviceName: string, serviceMap: Map<string, number>): string {
  if (!serviceMap.has(serviceName)) {
    serviceMap.set(serviceName, serviceMap.size)
  }
  return SERVICE_COLORS[serviceMap.get(serviceName)! % SERVICE_COLORS.length]
}

function parseLogTimestamp(ts: string): Date {
  const num = Number(ts)
  if (!isNaN(num) && isFinite(num) && /^[\d.eE+-]+$/.test(ts.trim())) {
    if (num > 1e16) return new Date(num / 1e6)   // nanos  → millis
    if (num > 1e13) return new Date(num / 1e3)    // micros → millis
    return new Date(Math.round(num))               // millis
  }
  return new Date(ts)
}

function formatLogTime(ts: string): string {
  const d = parseLogTimestamp(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(micros: number): string {
  if (micros < 1000) return `${micros}µs`
  if (micros < 1_000_000) return `${(micros / 1000).toFixed(1)}ms`
  return `${(micros / 1_000_000).toFixed(2)}s`
}

// ── Span tree building ──────────────────────────────────────────────────────

interface SpanNode {
  span: SpanDetail
  children: SpanNode[]
  depth: number
}

function buildSpanTree(spans: SpanDetail[]): SpanNode[] {
  const map = new Map<string, SpanNode>()
  const roots: SpanNode[] = []

  // Create nodes
  for (const span of spans) {
    map.set(span.spanId, { span, children: [], depth: 0 })
  }

  // Link parent → child
  for (const span of spans) {
    const node = map.get(span.spanId)!
    if (span.parentSpanId && map.has(span.parentSpanId)) {
      map.get(span.parentSpanId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by startTime, assign depths
  function assignDepth(node: SpanNode, depth: number) {
    node.depth = depth
    node.children.sort((a, b) => a.span.startTime - b.span.startTime)
    for (const child of node.children) assignDepth(child, depth + 1)
  }

  roots.sort((a, b) => a.span.startTime - b.span.startTime)
  for (const root of roots) assignDepth(root, 0)

  return roots
}

/** Flatten tree into DFS order for rendering. */
function flattenTree(roots: SpanNode[]): SpanNode[] {
  const result: SpanNode[] = []
  function walk(node: SpanNode) {
    result.push(node)
    for (const child of node.children) walk(child)
  }
  for (const root of roots) walk(root)
  return result
}

// ── Span Log Row ────────────────────────────────────────────────────────────

function SpanLogRow({ log, traceStartMicros }: { log: SpanLog; traceStartMicros: number }) {
  const offset = formatDuration(log.timestamp - traceStartMicros)

  return (
    <TableRow>
      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', py: 0.5, whiteSpace: 'nowrap' }}>
        +{offset}
      </TableCell>
      <TableCell sx={{ fontSize: '0.75rem', py: 0.5 }}>
        {Object.entries(log.fields).map(([k, v]) => (
          <Box key={k} component="span" sx={{ mr: 2 }}>
            <Typography component="span" variant="caption" fontWeight={600}>{k}: </Typography>
            <Typography component="span" variant="caption">{v}</Typography>
          </Box>
        ))}
      </TableCell>
    </TableRow>
  )
}

// ── Span Logs from Elasticsearch ─────────────────────────────────────────────

function SpanLogsSection({ logs, serviceName }: { logs: LogEntry[]; serviceName: string }) {
  if (logs.length === 0) return null

  return (
    <Box>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        Logs ({serviceName})
      </Typography>
      <Table size="small" sx={{ '& td, & th': { borderBottom: '1px solid', borderColor: 'divider', py: 0.4 } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', width: 160 }}>Timestamp</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', width: 70 }}>Severity</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem' }}>Message</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.map((log, idx) => (
            <TableRow key={idx}>
              <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                {formatLogTime(log.timestamp)}
              </TableCell>
              <TableCell>
                <Chip
                  label={log.severity}
                  size="small"
                  color={log.severity === 'ERROR' || log.severity === 'FATAL' ? 'error' : log.severity === 'WARN' ? 'warning' : 'default'}
                  sx={{ fontSize: '0.65rem', height: 18, fontWeight: 600 }}
                />
              </TableCell>
              <TableCell sx={{ fontSize: '0.75rem', maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.body || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}

// ── Span Row ────────────────────────────────────────────────────────────────

function SpanRow({
  node,
  traceStartMicros,
  traceDurationMicros,
  serviceColorMap,
  esLogs,
}: {
  node: SpanNode
  traceStartMicros: number
  traceDurationMicros: number
  serviceColorMap: Map<string, number>
  esLogs: LogEntry[]
}) {
  const [expanded, setExpanded] = useState(false)

  const { span } = node
  const svcColor = getServiceColor(span.serviceName, serviceColorMap)

  // Timing bar position
  const offsetPct = traceDurationMicros > 0
    ? ((span.startTime - traceStartMicros) / traceDurationMicros) * 100
    : 0
  const widthPct = traceDurationMicros > 0
    ? Math.max((span.durationMicros / traceDurationMicros) * 100, 0.5)
    : 100

  const hasTags = Object.keys(span.tags).length > 0
  const hasLogs = span.logs.length > 0
  const hasHttp = span.httpMethod || span.httpUrl || span.httpStatusCode
  // Always allow expand — ES logs are fetched lazily on expand
  const hasDetails = true

  return (
    <>
      {/* Main span row */}
      <Box
        onClick={() => hasDetails && setExpanded((p) => !p)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 0.75,
          px: 1,
          cursor: hasDetails ? 'pointer' : 'default',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: span.hasError ? 'error.50' : 'transparent',
          '&:hover': { backgroundColor: span.hasError ? 'error.100' : 'action.hover' },
          minHeight: 36,
        }}
      >
        {/* Left side: hierarchy + service label + operation name */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            minWidth: 380,
            maxWidth: 380,
            flexShrink: 0,
          }}
        >
          {/* Expand/collapse icon */}
          <Box sx={{ width: 24, flexShrink: 0 }}>
            {hasDetails ? (
              <IconButton size="small" sx={{ p: 0 }}>
                {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            ) : null}
          </Box>

          {/* Depth indentation */}
          <Box sx={{ width: node.depth * 20, flexShrink: 0 }} />

          {/* Connector line for child spans */}
          {node.depth > 0 && (
            <Box
              sx={{
                width: 12,
                height: '1px',
                backgroundColor: 'grey.400',
                mr: 0.5,
                flexShrink: 0,
              }}
            />
          )}

          {/* Service label */}
          <Chip
            label={span.serviceName}
            size="small"
            sx={{
              backgroundColor: svcColor,
              color: 'common.white',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 20,
              mr: 1,
              flexShrink: 0,
              maxWidth: 120,
            }}
          />

          {/* Operation name */}
          <Tooltip title={span.operationName} arrow>
            <Typography
              variant="body2"
              noWrap
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.78rem',
                fontWeight: span.hasError ? 600 : 400,
                color: span.hasError ? 'error.main' : 'text.primary',
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              {span.operationName}
            </Typography>
          </Tooltip>

          {/* Error icon */}
          {span.hasError && (
            <ErrorOutlineIcon sx={{ fontSize: 14, color: 'error.main', ml: 0.5, flexShrink: 0 }} />
          )}
        </Box>

        {/* Right side: timing bar */}
        <Box sx={{ flexGrow: 1, position: 'relative', height: 20, mx: 2 }}>
          {/* Background track */}
          <Box
            sx={{
              position: 'absolute',
              top: 9,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: 'action.disabledBackground',
            }}
          />
          {/* Timing bar */}
          <Tooltip title={`${formatDuration(span.durationMicros)} (started +${formatDuration(span.startTime - traceStartMicros)})`} arrow>
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                left: `${offsetPct}%`,
                width: `${widthPct}%`,
                height: 12,
                borderRadius: 1,
                backgroundColor: span.hasError ? 'error.main' : svcColor,
                opacity: 0.85,
                minWidth: 3,
              }}
            />
          </Tooltip>
        </Box>

        {/* Duration text */}
        <Typography
          variant="caption"
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.75rem',
            minWidth: 70,
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {formatDuration(span.durationMicros)}
        </Typography>
      </Box>

      {/* Expanded detail panel */}
      <Collapse in={expanded}>
        <Box sx={{ pl: `${24 + node.depth * 20 + (node.depth > 0 ? 12 : 0)}px`, pr: 2, py: 1.5, backgroundColor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>

          {/* HTTP info */}
          {hasHttp && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                HTTP
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {span.httpMethod && (
                  <Chip label={span.httpMethod} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                )}
                {span.httpStatusCode && (
                  <Chip
                    label={span.httpStatusCode}
                    size="small"
                    color={span.httpStatusCode >= 400 ? 'error' : 'success'}
                    sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                  />
                )}
                {span.httpUrl && (
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: '"JetBrains Mono", monospace', wordBreak: 'break-all' }}
                  >
                    {span.httpUrl}
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Tags */}
          {hasTags && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {Object.entries(span.tags).map(([key, val]) => (
                  <Chip
                    key={key}
                    label={`${key}=${val}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.7rem',
                      height: 22,
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Span Logs (inline) */}
          {hasLogs && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Span Logs ({span.logs.length})
              </Typography>
              <Table size="small" sx={{ '& td': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                <TableBody>
                  {span.logs.map((log, idx) => (
                    <SpanLogRow key={idx} log={log} traceStartMicros={traceStartMicros} />
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Logs from Elasticsearch */}
          <SpanLogsSection logs={esLogs} serviceName={span.serviceName} />
        </Box>
      </Collapse>
    </>
  )
}

// ── Service Legend ───────────────────────────────────────────────────────────

function ServiceLegend({ services, serviceColorMap }: { services: string[]; serviceColorMap: Map<string, number> }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {services.map((svc) => (
        <Chip
          key={svc}
          label={svc}
          size="small"
          sx={{
            backgroundColor: getServiceColor(svc, serviceColorMap),
            color: 'common.white',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        />
      ))}
    </Box>
  )
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function WaterfallSkeleton() {
  return (
    <Box>
      {Array.from({ length: 10 }).map((_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 0.75,
            px: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 380, gap: 1, pl: i < 3 ? 0 : i * 8 }}>
            <Skeleton variant="rounded" width={80} height={20} />
            <Skeleton variant="text" width={140} />
          </Box>
          <Box sx={{ flexGrow: 1, mx: 2 }}>
            <Skeleton variant="rounded" width={`${30 + Math.random() * 50}%`} height={12} sx={{ ml: `${Math.random() * 30}%` }} />
          </Box>
          <Skeleton variant="text" width={60} />
        </Box>
      ))}
    </Box>
  )
}

// ── Main page component ─────────────────────────────────────────────────────

export default function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>()
  const navigate = useNavigate()

  const [trace, setTrace] = useState<TraceDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [traceLogs, setTraceLogs] = useState<LogEntry[]>([])
  const [snackbar, setSnackbar] = useState<{
    open: boolean; message: string; severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'info' })

  // Dynamic breadcrumb — show truncated trace ID
  useBreadcrumb(traceId, traceId ? `${traceId.substring(0, 16)}…` : undefined)

  // Fetch trace detail
  useEffect(() => {
    if (!traceId) return

    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const result = await traceService.getTraceDetail(traceId!)
        if (!cancelled) setTrace(result)
      } catch {
        if (!cancelled) {
          setSnackbar({ open: true, message: 'Failed to load trace detail', severity: 'error' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [traceId])

  // Fetch all logs for this trace from Elasticsearch
  useEffect(() => {
    if (!traceId) return

    let cancelled = false
    async function loadLogs() {
      try {
        const result = await getLogsByTraceId(traceId!, { size: 500 })
        if (!cancelled) setTraceLogs(result.entries)
      } catch {
        // No logs is a valid state
      }
    }
    loadLogs()
    return () => { cancelled = true }
  }, [traceId])

  // Group logs by spanId for quick lookup
  const logsBySpanId = useMemo(() => {
    const map = new Map<string, LogEntry[]>()
    for (const log of traceLogs) {
      const key = log.spanId || '__no_span__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(log)
    }
    return map
  }, [traceLogs])

  // Build span tree and flatten for rendering
  const { flatNodes, traceStartMicros, traceDurationMicros } = useMemo(() => {
    if (!trace || trace.spans.length === 0) {
      return { flatNodes: [], traceStartMicros: 0, traceDurationMicros: 0 }
    }

    const tree = buildSpanTree(trace.spans)
    const flat = flattenTree(tree)

    const minStart = Math.min(...trace.spans.map((s) => s.startTime))
    const maxEnd = Math.max(...trace.spans.map((s) => s.startTime + s.durationMicros))

    return {
      flatNodes: flat,
      traceStartMicros: minStart,
      traceDurationMicros: maxEnd - minStart,
    }
  }, [trace])

  // Service color map (stable across renders via useMemo)
  const serviceColorMap = useMemo(() => {
    const map = new Map<string, number>()
    if (trace) {
      trace.services.forEach((svc) => getServiceColor(svc, map))
    }
    return map
  }, [trace])

  return (
    <Box>
      {/* ── Header (sticky) ─────────────────────────────────────────────── */}
      <Box sx={{ position: 'sticky', top: 64, zIndex: 10, bgcolor: 'background.default', mx: -3, px: 3, pt: 0, pb: 1 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      {loading ? (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Skeleton variant="text" width={300} height={32} sx={{ mb: 1 }} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Skeleton variant="rounded" width={100} height={24} />
            <Skeleton variant="rounded" width={100} height={24} />
            <Skeleton variant="rounded" width={100} height={24} />
          </Box>
        </Paper>
      ) : trace ? (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6" fontWeight={700}>
              Trace Detail
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                backgroundColor: 'action.selected',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                wordBreak: 'break-all',
              }}
            >
              {trace.traceId}
            </Typography>
          </Box>

          {/* Summary chips */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Chip
              label={`Duration: ${formatDuration(trace.durationMicros)}`}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Chip
              label={`${trace.spanCount} span${trace.spanCount !== 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            {trace.errorCount > 0 ? (
              <Chip
                icon={<ErrorOutlineIcon sx={{ fontSize: 14 }} />}
                label={`${trace.errorCount} error${trace.errorCount !== 1 ? 's' : ''}`}
                size="small"
                color="error"
                sx={{ fontWeight: 600 }}
              />
            ) : (
              <Chip
                icon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
                label="No errors"
                size="small"
                color="success"
                sx={{ fontWeight: 600 }}
              />
            )}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              Started {new Date(trace.startTime).toLocaleString()}
            </Typography>
          </Box>

          {/* Service legend + cross-signal navigation */}
          <Divider sx={{ mb: 1.5 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              Services:
            </Typography>
            <ServiceLegend services={trace.services} serviceColorMap={serviceColorMap} />
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArticleIcon />}
              onClick={() => navigate(`/logs?traceId=${encodeURIComponent(trace.traceId)}`)}
              sx={{ ml: 'auto' }}
            >
              View Logs
            </Button>
          </Box>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 6, mb: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Trace not found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The trace ID may be invalid or the data may have expired.
          </Typography>
        </Paper>
      )}

      </Box>

      {/* ── Waterfall view ──────────────────────────────────────────────── */}
      {trace && (
        <Paper variant="outlined">
          {/* Waterfall header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              py: 1,
              px: 1,
              borderBottom: '2px solid',
              borderColor: 'divider',
              backgroundColor: 'action.hover',
            }}
          >
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{ minWidth: 380, maxWidth: 380, flexShrink: 0, pl: '24px' }}
            >
              Service / Operation
            </Typography>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{ flexGrow: 1, textAlign: 'center', mx: 2 }}
            >
              Timeline
            </Typography>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{ minWidth: 70, textAlign: 'right', flexShrink: 0 }}
            >
              Duration
            </Typography>
          </Box>

          {/* Span rows */}
          {loading ? (
            <WaterfallSkeleton />
          ) : flatNodes.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No spans in this trace
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 'calc(100vh - 420px)', overflow: 'auto' }}>
              {flatNodes.map((node) => (
                <SpanRow
                  key={node.span.spanId}
                  node={node}
                  traceStartMicros={traceStartMicros}
                  traceDurationMicros={traceDurationMicros}
                  serviceColorMap={serviceColorMap}
                  esLogs={logsBySpanId.get(node.span.spanId) ?? []}
                />
              ))}
            </Box>
          )}
        </Paper>
      )}

      {/* ── AI Error Diagnosis ─────────────────────────────────────────── */}
      {trace && trace.errorCount > 0 && (
        <AiSuggestionsPanel
          traceId={trace.traceId}
          spans={trace.spans}
          traceLogs={traceLogs}
        />
      )}

      {/* ── Span Breakup (Story 8.4) ─────────────────────────────────────── */}
      {trace && traceId && (
        <SpanBreakupPanel traceId={traceId} />
      )}

      {/* ── Snackbar ─────────────────────────────────────────────────────── */}
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
