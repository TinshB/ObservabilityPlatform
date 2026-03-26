import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Box, Typography, Paper, Button, Chip, TextField, MenuItem,
  Autocomplete, Checkbox, CircularProgress, Alert, Snackbar,
  Tooltip, IconButton, LinearProgress,
  Divider, Stack,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SaveIcon from '@mui/icons-material/Save'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import DownloadIcon from '@mui/icons-material/Download'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import * as d3 from 'd3'
import type { Service } from '@/types'
import { getServices } from '@/services/serviceService'
import {
  startFlowAnalysis,
  getFlowAnalysis,
  type FlowAnalysisResponse,
  type FlowPattern,
} from '@/services/flowAnalysisService'
import PatternDetailPanel from './PatternDetailPanel'
import ConvertToWorkflowDialog from './ConvertToWorkflowDialog'

// ── Visual constants ─────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  UI:              '#0288d1',
  BACKEND:         '#1976d2',
  DATABASE:        '#7b1fa2',
  CLOUD_COMPONENT: '#f57c00',
  QUEUE:           '#00897b',
  EXTERNAL:        '#546e7a',
}

const TIME_RANGES = [
  { label: 'Last 15m', value: 15 },
  { label: 'Last 1h',  value: 60 },
  { label: 'Last 6h',  value: 360 },
  { label: 'Last 24h', value: 1440 },
  { label: 'Last 7d',  value: 10080 },
]

// ── D3 types ─────────────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  type: string
  metrics: { totalCalls: number; avgLatencyMs: number; errorRate: number }
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  callCount: number
  avgLatencyMs: number
  errorRate: number
  httpMethod: string
  httpPath: string
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FlowDiagramTab() {
  const svgRef = useRef<SVGSVGElement>(null)

  // Service data
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [selectedServices, setSelectedServices] = useState<Service[]>([])

  // Analysis config
  const [timeRange, setTimeRange] = useState(60)
  const [traceSampleLimit, setTraceSampleLimit] = useState(1000)

  // Analysis state
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<FlowAnalysisResponse | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)

  // Pattern selection
  const [selectedPattern, setSelectedPattern] = useState<FlowPattern | null>(null)
  const [highlightedPattern, setHighlightedPattern] = useState<string | null>(null)

  // UI state
  const [fullscreen, setFullscreen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [patternToConvert, setPatternToConvert] = useState<FlowPattern | null>(null)

  // ── Load services on mount ───────────────────────────────────────────────
  useEffect(() => {
    setLoadingServices(true)
    getServices({ size: 200, active: true })
      .then((res) => setServices(res.content || []))
      .catch(() => setSnackbar({ message: 'Failed to load services', severity: 'error' }))
      .finally(() => setLoadingServices(false))
  }, [])

  // ── Start analysis ───────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (selectedServices.length < 1) {
      setSnackbar({ message: 'Select at least one service', severity: 'error' })
      return
    }
    setAnalyzing(true)
    setProgress(0)
    setAnalysisResult(null)
    setSelectedPattern(null)

    try {
      const now = new Date()
      const start = new Date(now.getTime() - timeRange * 60 * 1000)

      const started = await startFlowAnalysis({
        serviceIds: selectedServices.map((s) => s.id),
        timeRangeStart: start.toISOString(),
        timeRangeEnd: now.toISOString(),
        traceSampleLimit,
      })

      setAnalysisId(started.analysisId)

      // Poll for results
      const estimatedMs = started.estimatedDurationMs || 15000
      const pollInterval = 2000
      let elapsed = 0

      const poll = setInterval(async () => {
        elapsed += pollInterval
        setProgress(Math.min(95, (elapsed / estimatedMs) * 100))

        try {
          const result = await getFlowAnalysis(started.analysisId)
          if (result.status === 'COMPLETED') {
            clearInterval(poll)
            setAnalysisResult(result)
            setAnalyzing(false)
            setProgress(100)
            setSnackbar({
              message: `Analysis complete: ${result.tracesAnalyzed} traces, ${result.flowPatterns?.length || 0} patterns found`,
              severity: 'success',
            })
          } else if (result.status === 'FAILED') {
            clearInterval(poll)
            setAnalyzing(false)
            setProgress(0)
            setSnackbar({
              message: result.errorMessage || 'Analysis failed',
              severity: 'error',
            })
          }
        } catch {
          // keep polling
        }
      }, pollInterval)

      // Timeout after 60s
      setTimeout(() => {
        clearInterval(poll)
        if (analyzing) {
          setAnalyzing(false)
          setSnackbar({ message: 'Analysis timed out. Try reducing the time range or trace limit.', severity: 'error' })
        }
      }, 60000)

    } catch (err: unknown) {
      setAnalyzing(false)
      const msg = err instanceof Error ? err.message : 'Failed to start analysis'
      setSnackbar({ message: msg, severity: 'error' })
    }
  }, [selectedServices, timeRange, traceSampleLimit, analyzing])

  // ── Render D3 diagram ────────────────────────────────────────────────────
  useEffect(() => {
    if (!analysisResult?.graph || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const container = svgRef.current.parentElement
    const width = container?.clientWidth || 900
    const height = fullscreen ? window.innerHeight - 100 : 500

    svg.attr('width', width).attr('height', height)

    const g = svg.append('g')

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999')

    const { nodes: rawNodes, edges: rawEdges } = analysisResult.graph

    // Build simulation data
    const simNodes: SimNode[] = rawNodes.map((n) => ({ ...n }))
    const nodeById = new Map(simNodes.map((n) => [n.id, n]))

    const simLinks: SimLink[] = rawEdges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        callCount: e.callCount,
        avgLatencyMs: e.avgLatencyMs,
        errorRate: e.errorRate,
        httpMethod: e.httpMethod || '',
        httpPath: e.httpPath || '',
      }))

    // Force simulation
    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance(180))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50))

    // Max callCount for edge thickness scaling
    const maxCalls = Math.max(1, ...simLinks.map((l) => l.callCount))

    // Edges
    const link = g.append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', (d) => {
        if (highlightedPattern) {
          const patternEdges = analysisResult.flowPatterns
            ?.find((p) => p.patternId === highlightedPattern)?.edges || []
          const isInPattern = patternEdges.some(
            (pe) => pe.source === ((d.source as SimNode).id || d.source)
                  && pe.target === ((d.target as SimNode).id || d.target),
          )
          return isInPattern ? edgeColor(d.errorRate) : '#e0e0e0'
        }
        return edgeColor(d.errorRate)
      })
      .attr('stroke-width', (d) => 1.5 + (d.callCount / maxCalls) * 4)
      .attr('stroke-opacity', () => highlightedPattern ? 1 : 0.7)
      .attr('marker-end', 'url(#arrowhead)')

    // Edge labels
    const edgeLabel = g.append('g')
      .selectAll('text')
      .data(simLinks)
      .join('text')
      .attr('font-size', 10)
      .attr('fill', '#666')
      .attr('text-anchor', 'middle')
      .text((d) => `${d.callCount} calls | ${Math.round(d.avgLatencyMs)}ms`)

    // Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .call(d3.drag<SVGGElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null; d.fy = null
        }) as any)

    // Node circles
    node.append('circle')
      .attr('r', 22)
      .attr('fill', (d) => NODE_COLORS[d.type] || '#1976d2')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', (d) => {
        if (!highlightedPattern) return 1
        const patternSteps = analysisResult.flowPatterns
          ?.find((p) => p.patternId === highlightedPattern)?.steps || []
        return patternSteps.some((s) => s.serviceName === d.id) ? 1 : 0.2
      })

    // Health dot
    node.append('circle')
      .attr('r', 5)
      .attr('cx', 16)
      .attr('cy', -16)
      .attr('fill', (d) => d.metrics.errorRate > 0.05 ? '#f44336'
        : d.metrics.errorRate > 0.01 ? '#ff9800' : '#4caf50')

    // Node labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 36)
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .attr('fill', 'currentColor')
      .text((d) => d.label.length > 20 ? d.label.substring(0, 18) + '...' : d.label)

    // Node type label
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('font-size', 10)
      .attr('fill', '#fff')
      .attr('font-weight', 700)
      .text((d) => d.type.substring(0, 2))

    // Tooltip on hover
    node.append('title')
      .text((d) => `${d.label} (${d.type})\nCalls: ${d.metrics.totalCalls}\nAvg Latency: ${Math.round(d.metrics.avgLatencyMs)}ms\nError Rate: ${(d.metrics.errorRate * 100).toFixed(1)}%`)

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      edgeLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 6)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    // Fit to screen
    simulation.on('end', () => {
      const bounds = (g.node() as SVGGElement)?.getBBox()
      if (bounds) {
        const scale = Math.min(
          width / (bounds.width + 100),
          height / (bounds.height + 100),
          1.5,
        )
        const tx = width / 2 - (bounds.x + bounds.width / 2) * scale
        const ty = height / 2 - (bounds.y + bounds.height / 2) * scale
        svg.transition().duration(500).call(
          zoom.transform,
          d3.zoomIdentity.translate(tx, ty).scale(scale),
        )
      }
    })

    return () => { simulation.stop() }
  }, [analysisResult, fullscreen, highlightedPattern])

  // ── Export diagram ───────────────────────────────────────────────────────
  const handleExport = useCallback((format: 'png' | 'svg') => {
    if (!svgRef.current) return
    const svgEl = svgRef.current
    const svgData = new XMLSerializer().serializeToString(svgEl)

    if (format === 'svg') {
      const blob = new Blob([svgData], { type: 'image/svg+xml' })
      downloadBlob(blob, 'flow-diagram.svg')
      return
    }

    // PNG
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, 'flow-diagram.png')
      })
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }, [])

  // ── Convert pattern to workflow ──────────────────────────────────────────
  const handleConvertClick = (pattern: FlowPattern) => {
    setPatternToConvert(pattern)
    setConvertDialogOpen(true)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* ── Configuration Panel ──────────────────────────────────────────── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle2" fontWeight={600}>
            Select Services for Analysis
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Autocomplete
              multiple
              sx={{ flex: 1, minWidth: 350 }}
              options={services}
              loading={loadingServices}
              disableCloseOnSelect
              getOptionLabel={(o) => o.name}
              value={selectedServices}
              onChange={(_, v) => {
                if (v.length <= 20) setSelectedServices(v)
                else setSnackbar({ message: 'Maximum 20 services allowed', severity: 'error' })
              }}
              renderOption={(props, option, { selected }) => (
                <li {...props} key={option.id}>
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                    checkedIcon={<CheckBoxIcon fontSize="small" />}
                    style={{ marginRight: 8 }}
                    checked={selected}
                  />
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.environment || 'default'} &middot; {option.tier || '—'}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Services"
                  placeholder="Search and select services..."
                  size="small"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index })
                  return (
                    <Chip
                      key={key}
                      label={option.name}
                      size="small"
                      {...tagProps}
                    />
                  )
                })
              }
            />

            <TextField
              select
              label="Time Range"
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              size="small"
              sx={{ minWidth: 140 }}
            >
              {TIME_RANGES.map((r) => (
                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Trace Limit"
              type="number"
              value={traceSampleLimit}
              onChange={(e) => setTraceSampleLimit(Math.max(100, Math.min(5000, Number(e.target.value))))}
              size="small"
              sx={{ width: 120 }}
              inputProps={{ min: 100, max: 5000 }}
            />

            <Button
              variant="contained"
              startIcon={analyzing ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleAnalyze}
              disabled={analyzing || selectedServices.length < 1}
              sx={{ height: 40 }}
            >
              {analyzing ? 'Analyzing...' : 'Analyze'}
            </Button>
          </Box>

          {selectedServices.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              Select at least one service to start analysis
            </Typography>
          )}
        </Stack>
      </Paper>

      {/* ── Progress ─────────────────────────────────────────────────────── */}
      {analyzing && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            Analyzing traces{selectedServices.length === 1 ? ` for ${selectedServices[0].name}` : ` across ${selectedServices.length} services`}...
          </Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {Math.round(progress)}% complete
          </Typography>
        </Paper>
      )}

      {/* ── Diagram + Patterns ───────────────────────────────────────────── */}
      {analysisResult?.status === 'COMPLETED' && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* Left: Diagram */}
          <Paper
            sx={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              height: fullscreen ? 'calc(100vh - 100px)' : 500,
            }}
          >
            {/* Toolbar */}
            <Box sx={{
              position: 'absolute', top: 8, right: 8, zIndex: 10,
              display: 'flex', gap: 0.5, bgcolor: 'background.paper',
              borderRadius: 1, p: 0.5, boxShadow: 1,
            }}>
              <Tooltip title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                <IconButton size="small" onClick={() => setFullscreen(!fullscreen)}>
                  {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Export as PNG">
                <IconButton size="small" onClick={() => handleExport('png')}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export as SVG">
                <IconButton size="small" onClick={() => handleExport('svg')}>
                  <SaveIcon />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Legend */}
            <Box sx={{
              position: 'absolute', bottom: 8, left: 8, zIndex: 10,
              bgcolor: 'background.paper', borderRadius: 1, p: 1, boxShadow: 1,
              display: 'flex', gap: 1.5, flexWrap: 'wrap',
            }}>
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
                  <Typography variant="caption">{type}</Typography>
                </Box>
              ))}
              <Divider orientation="vertical" flexItem />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 14, height: 3, bgcolor: '#4caf50' }} />
                <Typography variant="caption">&lt;1% err</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 14, height: 3, bgcolor: '#ff9800' }} />
                <Typography variant="caption">1-5% err</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 14, height: 3, bgcolor: '#f44336' }} />
                <Typography variant="caption">&gt;5% err</Typography>
              </Box>
            </Box>

            <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
          </Paper>

          {/* Right: Pattern list */}
          <Paper sx={{ width: 340, maxHeight: fullscreen ? 'calc(100vh - 100px)' : 500, overflow: 'auto', p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Discovered Flow Patterns ({analysisResult.flowPatterns?.length || 0})
            </Typography>

            {analysisResult.flowPatterns?.map((pattern) => (
              <Paper
                key={pattern.patternId}
                variant="outlined"
                sx={{
                  p: 1.5, mb: 1, cursor: 'pointer',
                  borderColor: highlightedPattern === pattern.patternId ? 'primary.main' : 'divider',
                  borderWidth: highlightedPattern === pattern.patternId ? 2 : 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => {
                  setSelectedPattern(pattern)
                  setHighlightedPattern(
                    highlightedPattern === pattern.patternId ? null : pattern.patternId,
                  )
                }}
              >
                <Typography variant="body2" fontWeight={600} noWrap>
                  {pattern.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip label={`${pattern.frequency} traces`} size="small" variant="outlined" />
                  <Chip
                    label={`${Math.round(pattern.avgLatencyMs)}ms avg`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`${(pattern.errorRate * 100).toFixed(1)}% err`}
                    size="small"
                    variant="outlined"
                    color={pattern.errorRate > 0.05 ? 'error' : pattern.errorRate > 0.01 ? 'warning' : 'success'}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(e) => { e.stopPropagation(); setSelectedPattern(pattern) }}
                  >
                    Details
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AccountTreeIcon />}
                    onClick={(e) => { e.stopPropagation(); handleConvertClick(pattern) }}
                  >
                    To Workflow
                  </Button>
                </Box>
              </Paper>
            ))}
          </Paper>
        </Box>
      )}

      {/* ── Pattern Detail Drawer ────────────────────────────────────────── */}
      <PatternDetailPanel
        pattern={selectedPattern}
        onClose={() => setSelectedPattern(null)}
        onConvert={handleConvertClick}
      />

      {/* ── Convert to Workflow Dialog ───────────────────────────────────── */}
      {patternToConvert && analysisId && (
        <ConvertToWorkflowDialog
          open={convertDialogOpen}
          onClose={() => { setConvertDialogOpen(false); setPatternToConvert(null) }}
          pattern={patternToConvert}
          analysisId={analysisId}
        />
      )}

      {/* ── Snackbar ─────────────────────────────────────────────────────── */}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={6000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} variant="filled">
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function edgeColor(errorRate: number): string {
  if (errorRate > 0.05) return '#f44336'
  if (errorRate > 0.01) return '#ff9800'
  return '#4caf50'
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
