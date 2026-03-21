import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tabs,
  Tab,
  Snackbar,
  Alert,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Switch,
  FormControlLabel,
  Button,
} from '@mui/material'
import { useBreadcrumb } from '@/hooks/useBreadcrumb'
import BarChartIcon from '@mui/icons-material/BarChart'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import * as d3 from 'd3'
import type {
  ServiceDeepDiveResponse,
  DeepDiveErrorTrace,
  DependencyGraph,
  DependencyEdge,
  TimeRangePreset,
} from '@/types'
import * as serviceDeepDiveService from '@/services/serviceDeepDiveService'
import * as serviceService from '@/services/serviceService'
import * as metricsService from '@/services/metricsService'
import { getDependencyGraph } from '@/services/dependencyService'

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_RANGE = 'LAST_1H'
const TAB_KEYS = ['overview', 'metrics', 'logs', 'traces', 'dependencies'] as const
type TabKey = typeof TAB_KEYS[number]

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(micros: number): string {
  if (micros < 1000) return `${micros}µs`
  if (micros < 1_000_000) return `${(micros / 1000).toFixed(1)}ms`
  return `${(micros / 1_000_000).toFixed(2)}s`
}

function formatLatency(seconds: number | null): string {
  if (seconds == null) return '—'
  if (seconds < 0.001) return `${(seconds * 1_000_000).toFixed(0)}µs`
  if (seconds < 1) return `${(seconds * 1000).toFixed(1)}ms`
  return `${seconds.toFixed(2)}s`
}

function formatRate(rate: number | null): string {
  if (rate == null) return '—'
  return `${rate.toFixed(1)} req/s`
}

function formatPercent(value: number | null): string {
  if (value == null) return '—'
  return `${(value * 100).toFixed(2)}%`
}

function healthIcon(status: string) {
  switch (status) {
    case 'healthy':
      return <CheckCircleOutlineIcon sx={{ fontSize: 20, color: 'success.main' }} />
    case 'degraded':
      return <WarningAmberIcon sx={{ fontSize: 20, color: 'warning.main' }} />
    case 'unhealthy':
      return <ErrorOutlineIcon sx={{ fontSize: 20, color: 'error.main' }} />
    default:
      return <HelpOutlineIcon sx={{ fontSize: 20, color: 'grey.500' }} />
  }
}

function healthColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'healthy': return 'success'
    case 'degraded': return 'warning'
    case 'unhealthy': return 'error'
    default: return 'default'
  }
}

// ── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, subtext }: {
  label: string; value: string; subtext?: string
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 150, flex: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
      <Typography
        variant="h5"
        fontWeight={700}
        sx={{ fontFamily: '"JetBrains Mono", monospace', mt: 0.5 }}
      >
        {value}
      </Typography>
      {subtext && (
        <Typography variant="caption" color="text.secondary">
          {subtext}
        </Typography>
      )}
    </Paper>
  )
}

// ── Health score gauge ──────────────────────────────────────────────────────

function HealthGauge({ score, status }: { score: number; status: string }) {
  const pct = Math.round(score * 100)
  return (
    <Paper variant="outlined" sx={{ p: 2.5, textAlign: 'center', minWidth: 180 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
        {healthIcon(status)}
        <Typography variant="subtitle2" fontWeight={700} textTransform="capitalize">
          {status}
        </Typography>
      </Box>
      <Typography
        variant="h3"
        fontWeight={700}
        sx={{ fontFamily: '"JetBrains Mono", monospace' }}
        color={healthColor(status) + '.main'}
      >
        {pct}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Health Score
      </Typography>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          mt: 1.5,
          height: 6,
          borderRadius: 3,
          backgroundColor: 'grey.200',
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            backgroundColor: `${healthColor(status)}.main`,
          },
        }}
      />
    </Paper>
  )
}

// ── Recent error traces table ───────────────────────────────────────────────

function RecentErrorsTable({ errors, onTraceClick }: {
  errors: DeepDiveErrorTrace[]
  onTraceClick: (id: string) => void
}) {
  if (errors.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No recent error traces found in this time range.
      </Typography>
    )
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Trace ID</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Root Operation</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Start Time</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">Duration</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="center">Errors</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {errors.map((err) => (
            <TableRow
              key={err.traceId}
              hover
              sx={{ cursor: 'pointer' }}
              onClick={() => onTraceClick(err.traceId)}
            >
              <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem', color: 'primary.main' }}>
                {err.traceId.substring(0, 16)}...
              </TableCell>
              <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' }}>
                <Tooltip title={err.rootOperation} arrow>
                  <span>{err.rootOperation.length > 40 ? err.rootOperation.substring(0, 40) + '...' : err.rootOperation}</span>
                </Tooltip>
              </TableCell>
              <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                {new Date(err.startTime).toLocaleString()}
              </TableCell>
              <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' }}>
                {formatDuration(err.durationMicros)}
              </TableCell>
              <TableCell align="center">
                <Chip
                  icon={<ErrorOutlineIcon sx={{ fontSize: 12 }} />}
                  label={err.errorCount}
                  size="small"
                  color="error"
                  sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// ── Tab panels ──────────────────────────────────────────────────────────────

function OverviewTab({ data, onTraceClick, onSignalToggle, signalSaving }: {
  data: ServiceDeepDiveResponse
  onTraceClick: (id: string) => void
  onSignalToggle: (signal: 'metricsEnabled' | 'logsEnabled' | 'tracesEnabled', value: boolean) => void
  signalSaving: boolean
}) {
  return (
    <Box>
      {/* Health + Key Metrics row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <HealthGauge score={data.healthScore} status={data.healthStatus} />
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          <MetricCard
            label="P95 Latency"
            value={formatLatency(data.keyMetrics?.latencyP95 ?? null)}
            subtext={data.keyMetrics?.latencyP99 != null ? `P99: ${formatLatency(data.keyMetrics.latencyP99)}` : undefined}
          />
          <MetricCard
            label="Error Rate"
            value={formatPercent(data.keyMetrics?.errorRate ?? null)}
          />
          <MetricCard
            label="Request Rate"
            value={formatRate(data.keyMetrics?.requestRate ?? null)}
          />
        </Box>
      </Box>

      {/* Summaries row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {/* Log summary */}
        {data.logSummary && (
          <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 220 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Log Summary
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Logs</Typography>
                <Typography variant="body1" fontWeight={600}>
                  {data.logSummary.totalLogs.toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Error Logs</Typography>
                <Typography variant="body1" fontWeight={600} color="error.main">
                  {data.logSummary.errorLogs.toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Error Ratio</Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatPercent(data.logSummary.errorRatio)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Enrichment</Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatPercent(data.logSummary.enrichmentScore)}
                </Typography>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Trace summary */}
        {data.traceSummary && (
          <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 220 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Trace Summary
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Traces</Typography>
                <Typography variant="body1" fontWeight={600}>
                  {data.traceSummary.traceCount}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">With Errors</Typography>
                <Typography variant="body1" fontWeight={600} color="error.main">
                  {data.traceSummary.errorTraceCount}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Avg Duration</Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatDuration(data.traceSummary.avgDurationMicros)}
                </Typography>
              </Box>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Signal toggles (Story 8.7) */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Signal Toggles
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={data.metricsEnabled}
                onChange={(e) => onSignalToggle('metricsEnabled', e.target.checked)}
                disabled={signalSaving}
                color="success"
              />
            }
            label="Metrics"
          />
          <FormControlLabel
            control={
              <Switch
                checked={data.logsEnabled}
                onChange={(e) => onSignalToggle('logsEnabled', e.target.checked)}
                disabled={signalSaving}
                color="success"
              />
            }
            label="Logs"
          />
          <FormControlLabel
            control={
              <Switch
                checked={data.tracesEnabled}
                onChange={(e) => onSignalToggle('tracesEnabled', e.target.checked)}
                disabled={signalSaving}
                color="success"
              />
            }
            label="Traces"
          />
        </Box>
      </Paper>

      {/* Recent error traces */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Recent Error Traces
        </Typography>
        <RecentErrorsTable errors={data.recentErrors} onTraceClick={onTraceClick} />
      </Paper>
    </Box>
  )
}

function MetricsTab({ data, serviceId, range }: {
  data: ServiceDeepDiveResponse; serviceId: string; range: string
}) {
  const navigate = useNavigate()
  const km = data.keyMetrics
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <MetricCard label="P50 Latency" value={formatLatency(km?.latencyP50 ?? null)} />
        <MetricCard label="P95 Latency" value={formatLatency(km?.latencyP95 ?? null)} />
        <MetricCard label="P99 Latency" value={formatLatency(km?.latencyP99 ?? null)} />
        <MetricCard label="Error Rate" value={formatPercent(km?.errorRate ?? null)} />
        <MetricCard label="Request Rate" value={formatRate(km?.requestRate ?? null)} />
      </Box>
      {!km && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No metric data available for the selected time range.
        </Typography>
      )}
      <Button
        variant="contained"
        startIcon={<BarChartIcon />}
        onClick={() => navigate(`/metrics?service=${serviceId}&range=${range}`)}
      >
        Open in Metrics Explorer
      </Button>
    </Box>
  )
}

function LogsTab({ data, serviceId }: {
  data: ServiceDeepDiveResponse; serviceId: string
}) {
  const navigate = useNavigate()
  const ls = data.logSummary
  return (
    <Box>
      {ls ? (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <MetricCard label="Total Logs" value={ls.totalLogs.toLocaleString()} />
          <MetricCard label="Error Logs" value={ls.errorLogs.toLocaleString()} subtext={ls.errorRatio != null ? `Error ratio: ${formatPercent(ls.errorRatio)}` : undefined} />
          <MetricCard label="Enrichment Score" value={formatPercent(ls.enrichmentScore)} />
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No log data available for the selected time range.
        </Typography>
      )}
      <Button
        variant="contained"
        onClick={() => navigate(`/logs?serviceId=${serviceId}`)}
      >
        Open in Log Explorer
      </Button>
    </Box>
  )
}

function TracesTab({ data, serviceId, onTraceClick }: {
  data: ServiceDeepDiveResponse; serviceId: string; onTraceClick: (id: string) => void
}) {
  const navigate = useNavigate()
  const ts = data.traceSummary
  return (
    <Box>
      {ts ? (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <MetricCard label="Total Traces" value={ts.traceCount.toLocaleString()} />
          <MetricCard label="Error Traces" value={ts.errorTraceCount.toLocaleString()} />
          <MetricCard label="Avg Duration" value={formatDuration(ts.avgDurationMicros)} />
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No trace data available for the selected time range.
        </Typography>
      )}
      {data.recentErrors.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Recent Error Traces
          </Typography>
          <RecentErrorsTable errors={data.recentErrors} onTraceClick={onTraceClick} />
        </Paper>
      )}
      <Button
        variant="contained"
        onClick={() => navigate(`/traces?service=${serviceId}`)}
      >
        Open in Trace Viewer
      </Button>
    </Box>
  )
}

// ── Dependency graph constants ───────────────────────────────────────────────

const DEP_NODE_COLORS: Record<string, string> = {
  SERVICE:         '#1976d2',
  DATABASE:        '#7b1fa2',
  CLOUD_COMPONENT: '#f57c00',
  CACHE:           '#d32f2f',
}

const DEP_EDGE_COLORS: Record<string, string> = {
  HTTP:     '#42a5f5',
  GRPC:     '#66bb6a',
  DATABASE: '#ab47bc',
  CLOUD:    '#ffa726',
  CACHE:    '#d32f2f',
}

const DEP_EDGE_DASH: Record<string, string> = {
  HTTP:     '',
  GRPC:     '8 4',
  DATABASE: '4 2',
  CLOUD:    '2 2',
  CACHE:    '6 3',
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  nodeType: string
  serviceId?: string
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string
  dependencyType: string
  callCount1h: number
  errorCount1h: number
  avgLatencyMs1h: number
}

function DependenciesTab({ serviceId }: { serviceId: string }) {
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement>(null)
  const [graph, setGraph] = useState<DependencyGraph | null>(null)
  const [depLoading, setDepLoading] = useState(true)
  const [depError, setDepError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDepLoading(true)
    setDepError(false)
    getDependencyGraph(serviceId)
      .then((data) => { if (!cancelled) setGraph(data) })
      .catch(() => { if (!cancelled) setDepError(true) })
      .finally(() => { if (!cancelled) setDepLoading(false) })
    return () => { cancelled = true }
  }, [serviceId])

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current || !graph || graph.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const container = svgRef.current.parentElement
    const width  = container?.clientWidth ?? 700
    const height = container?.clientHeight ?? 420

    svg.attr('width', width).attr('height', height)

    const nodes: SimNode[] = graph.nodes.map(n => ({ ...n }))
    const links: SimLink[] = graph.edges.map(e => ({ ...e, source: e.source, target: e.target }))

    // Arrow markers
    const defs = svg.append('defs')
    Object.entries(DEP_EDGE_COLORS).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `dep-arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 28).attr('refY', 0)
        .attr('markerWidth', 8).attr('markerHeight', 8)
        .attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', color)
    })

    // Zoom
    const g = svg.append('g')
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => g.attr('transform', event.transform)),
    )

    // Simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(140))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(36))

    // Links
    const link = g.append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links).join('line')
      .attr('stroke', d => DEP_EDGE_COLORS[d.dependencyType] ?? '#999')
      .attr('stroke-width', d => Math.max(1.5, Math.min(4, Math.log2(d.callCount1h + 1))))
      .attr('stroke-dasharray', d => DEP_EDGE_DASH[d.dependencyType] ?? '')
      .attr('marker-end', d => `url(#dep-arrow-${d.dependencyType})`)

    // Link labels
    const linkLabel = g.append('g')
      .selectAll<SVGTextElement, SimLink>('text')
      .data(links).join('text')
      .attr('font-size', 9).attr('fill', '#666').attr('text-anchor', 'middle')
      .text(d => d.callCount1h > 0 ? `${d.callCount1h}` : '')

    // Nodes
    const node = g.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes).join('g')
      .attr('cursor', 'grab')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null }),
      )

    node.each(function (d) {
      const el = d3.select(this)
      const color = DEP_NODE_COLORS[d.nodeType] ?? '#999'
      el.append('circle').attr('r', 16).attr('fill', color).attr('stroke', '#fff').attr('stroke-width', 2)
      el.append('text').attr('dy', 28).attr('text-anchor', 'middle')
        .attr('font-size', 10).attr('font-weight', 600).attr('fill', '#333')
        .text(d.label.length > 18 ? d.label.slice(0, 16) + '...' : d.label)
    })

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimNode).x!)
        .attr('y1', d => (d.source as SimNode).y!)
        .attr('x2', d => (d.target as SimNode).x!)
        .attr('y2', d => (d.target as SimNode).y!)
      linkLabel
        .attr('x', d => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
        .attr('y', d => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2 - 6)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => { simulation.stop() }
  }, [graph])

  const nodeCount = graph?.nodes.length ?? 0
  const edgeCount = graph?.edges.length ?? 0

  return (
    <Box>
      {/* Header row: counts + legend + link */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{depLoading ? '...' : nodeCount}</strong> Nodes
            {' / '}
            <strong>{depLoading ? '...' : edgeCount}</strong> Dependencies
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            {Object.entries(DEP_NODE_COLORS).map(([type, color]) => (
              <Chip key={type} size="small" label={type.replace('_', ' ')}
                sx={{ backgroundColor: color, color: '#fff', fontSize: '0.7rem', height: 22 }} />
            ))}
          </Box>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AccountTreeIcon />}
          onClick={() => navigate('/dependencies')}
        >
          View Full Dependency Map
        </Button>
      </Box>

      {/* Graph */}
      <Paper variant="outlined" sx={{ position: 'relative', height: 420, minHeight: 300, overflow: 'hidden', backgroundColor: '#fafafa' }}>
        {depLoading ? (
          <Box sx={{ p: 4 }}><Skeleton variant="rectangular" height={360} /></Box>
        ) : depError ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Failed to load dependency graph.</Typography>
          </Box>
        ) : nodeCount === 0 ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">No dependencies found for this service.</Typography>
          </Box>
        ) : (
          <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
        )}
      </Paper>
    </Box>
  )
}

// ── Main page component ─────────────────────────────────────────────────────

export default function ServiceDeepDivePage() {
  const { serviceId } = useParams<{ serviceId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Tab state
  const tabParam = searchParams.get('tab') as TabKey | null
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam && TAB_KEYS.includes(tabParam) ? tabParam : 'overview',
  )

  // Time range
  const [presets, setPresets] = useState<TimeRangePreset[]>([])
  const [selectedRange, setSelectedRange] = useState(
    searchParams.get('range') || DEFAULT_RANGE,
  )

  // Data
  const [data, setData] = useState<ServiceDeepDiveResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Dynamic breadcrumb label — shows service name once loaded
  useBreadcrumb(serviceId, data?.serviceName ?? serviceId)

  // Signal toggle
  const [signalSaving, setSignalSaving] = useState(false)

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    open: boolean; message: string; severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'info' })

  // Load time range presets
  useEffect(() => {
    async function loadPresets() {
      try {
        setPresets(await metricsService.getTimeRangePresets())
      } catch {
        setPresets([
          { key: 'LAST_15M', label: 'Last 15 minutes', durationSeconds: 900, stepSeconds: 15, rateWindow: '1m' },
          { key: 'LAST_1H', label: 'Last 1 hour', durationSeconds: 3600, stepSeconds: 30, rateWindow: '2m' },
          { key: 'LAST_3H', label: 'Last 3 hours', durationSeconds: 10800, stepSeconds: 60, rateWindow: '5m' },
          { key: 'LAST_6H', label: 'Last 6 hours', durationSeconds: 21600, stepSeconds: 120, rateWindow: '5m' },
          { key: 'LAST_24H', label: 'Last 24 hours', durationSeconds: 86400, stepSeconds: 600, rateWindow: '15m' },
          { key: 'LAST_7D', label: 'Last 7 days', durationSeconds: 604800, stepSeconds: 3600, rateWindow: '1h' },
        ])
      }
    }
    loadPresets()
  }, [])

  // Fetch deep dive data
  const fetchData = useCallback(async () => {
    if (!serviceId) return
    setLoading(true)
    try {
      const result = await serviceDeepDiveService.getServiceDeepDive(serviceId, { range: selectedRange })
      setData(result)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load service data', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [serviceId, selectedRange])

  useEffect(() => { fetchData() }, [fetchData])

  // URL sync
  const handleTabChange = (_: unknown, tab: TabKey) => {
    setActiveTab(tab)
    const params: Record<string, string> = { tab }
    if (selectedRange !== DEFAULT_RANGE) params.range = selectedRange
    setSearchParams(params, { replace: true })
  }

  const handleRangeChange = (range: string) => {
    setSelectedRange(range)
    const params: Record<string, string> = { tab: activeTab, range }
    setSearchParams(params, { replace: true })
  }

  const handleTraceClick = (traceId: string) => {
    navigate(`/traces/${encodeURIComponent(traceId)}`)
  }

  const handleSignalToggle = async (
    signal: 'metricsEnabled' | 'logsEnabled' | 'tracesEnabled',
    value: boolean,
  ) => {
    if (!serviceId) return
    setSignalSaving(true)
    try {
      await serviceService.toggleSignals(serviceId, { [signal]: value })
      setSnackbar({ open: true, message: `${signal.replace('Enabled', '')} ${value ? 'enabled' : 'disabled'}`, severity: 'success' })
      await fetchData()
    } catch {
      setSnackbar({ open: true, message: 'Failed to update signal toggle', severity: 'error' })
    } finally {
      setSignalSaving(false)
    }
  }

  return (
    <Box>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" fontWeight={700}>
            {loading ? <Skeleton variant="text" width={200} /> : data?.serviceName}
          </Typography>
          {data && (
            <>
              <Chip
                label={data.environment}
                size="small"
                color={data.environment === 'production' ? 'error'
                  : data.environment === 'staging' ? 'warning' : 'success'}
              />
              <Chip label={data.ownerTeam} size="small" variant="outlined" />
              {data.tier && <Chip label={`Tier: ${data.tier}`} size="small" variant="outlined" />}
            </>
          )}
        </Box>

        {/* Time range selector */}
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={selectedRange}
            label="Time Range"
            onChange={(e) => handleRangeChange(e.target.value)}
          >
            {presets.map((p) => (
              <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Overview" value="overview" />
          <Tab label="Metrics" value="metrics" />
          <Tab label="Logs" value="logs" />
          <Tab label="Traces" value="traces" />
          <Tab label="Dependencies" value="dependencies" />
        </Tabs>
      </Paper>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      {loading ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Skeleton variant="rounded" width={180} height={140} />
            <Skeleton variant="rounded" sx={{ flex: 1 }} height={140} />
            <Skeleton variant="rounded" sx={{ flex: 1 }} height={140} />
            <Skeleton variant="rounded" sx={{ flex: 1 }} height={140} />
          </Box>
          <Skeleton variant="rounded" height={200} />
        </Paper>
      ) : !data ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Service not found
          </Typography>
        </Paper>
      ) : (
        <>
          {activeTab === 'overview' && (
            <OverviewTab
              data={data}
              onTraceClick={handleTraceClick}
              onSignalToggle={handleSignalToggle}
              signalSaving={signalSaving}
            />
          )}

          {activeTab === 'metrics' && (
            <MetricsTab data={data} serviceId={serviceId!} range={selectedRange} />
          )}

          {activeTab === 'logs' && (
            <LogsTab data={data} serviceId={serviceId!} />
          )}

          {activeTab === 'traces' && (
            <TracesTab data={data} serviceId={serviceId!} onTraceClick={handleTraceClick} />
          )}

          {activeTab === 'dependencies' && (
            <DependenciesTab serviceId={serviceId!} />
          )}
        </>
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
