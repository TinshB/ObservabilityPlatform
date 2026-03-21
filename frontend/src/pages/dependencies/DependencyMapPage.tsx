import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Box, Typography, Paper, TextField, MenuItem, Button, Chip,
  Skeleton, Snackbar, Alert, Drawer, Divider, Tooltip,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SyncIcon   from '@mui/icons-material/Sync'
import * as d3 from 'd3'
import type { DependencyGraph, DependencyEdge, Service } from '@/types'
import { getDependencyGraph, extractFromRecentTraces } from '@/services/dependencyService'
import { getServices } from '@/services/serviceService'
import DependencyDetailPanel from './DependencyDetailPanel'

// ── Visual constants ────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  SERVICE:         '#1976d2',
  DATABASE:        '#7b1fa2',
  CLOUD_COMPONENT: '#f57c00',
  CACHE:           '#d32f2f',
}

const NODE_SHAPES: Record<string, string> = {
  SERVICE:         'circle',
  DATABASE:        'diamond',
  CLOUD_COMPONENT: 'square',
  CACHE:           'hexagon',
}

const EDGE_COLORS: Record<string, string> = {
  HTTP:     '#42a5f5',
  GRPC:     '#66bb6a',
  DATABASE: '#ab47bc',
  CLOUD:    '#ffa726',
  CACHE:    '#d32f2f',
}

const EDGE_DASH: Record<string, string> = {
  HTTP:     '',
  GRPC:     '8 4',
  DATABASE: '4 2',
  CLOUD:    '2 2',
  CACHE:    '6 3',
}

const DETAIL_DRAWER_WIDTH = 360

// ── D3 simulation types ─────────────────────────────────────────────────────

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

// ── Component ───────────────────────────────────────────────────────────────

export default function DependencyMapPage() {
  const svgRef = useRef<SVGSVGElement>(null)

  // Data
  const [services, setServices]     = useState<Service[]>([])
  const [graph, setGraph]           = useState<DependencyGraph | null>(null)
  const [loading, setLoading]       = useState(false)
  const [extracting, setExtracting] = useState(false)

  // Filters
  const [selectedService, setSelectedService] = useState('')

  // Detail drawer
  const [selectedEdge, setSelectedEdge] = useState<DependencyEdge | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' },
  )

  // Load services
  useEffect(() => {
    getServices({ size: 200, active: true })
      .then(r => setServices(r.content))
      .catch(() => {})
  }, [])

  const fetchGraph = useCallback(async () => {
    if (!selectedService) return
    setLoading(true)
    try {
      const data = await getDependencyGraph(selectedService)
      setGraph(data)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load dependency graph', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [selectedService])

  useEffect(() => { fetchGraph() }, [fetchGraph])

  const handleExtract = async () => {
    if (!selectedService) return
    setExtracting(true)
    try {
      const result = await extractFromRecentTraces(selectedService, 50)
      setSnackbar({
        open: true,
        message: `Extracted ${result.dependenciesExtracted} dependencies from recent traces`,
        severity: 'success',
      })
      fetchGraph()
    } catch {
      setSnackbar({ open: true, message: 'Failed to extract dependencies', severity: 'error' })
    } finally {
      setExtracting(false)
    }
  }

  // ── D3 force-directed graph ──────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !graph) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const container = svgRef.current.parentElement
    const width  = container?.clientWidth ?? 800
    const height = container?.clientHeight ?? 600

    svg.attr('width', width).attr('height', height)

    // Prepare data (clone to avoid D3 mutating originals)
    const nodes: SimNode[] = graph.nodes.map(n => ({ ...n }))
    const links: SimLink[] = graph.edges.map(e => ({
      ...e,
      source: e.source,
      target: e.target,
    }))

    // Arrow markers per edge type
    const defs = svg.append('defs')
    Object.entries(EDGE_COLORS).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 28)
        .attr('refY', 0)
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
    })

    // Zoom
    const g = svg.append('g')
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => g.attr('transform', event.transform)),
    )

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(160))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40))

    // Draw links
    const link = g.append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', d => EDGE_COLORS[d.dependencyType] ?? '#999')
      .attr('stroke-width', d => Math.max(1.5, Math.min(5, Math.log2(d.callCount1h + 1))))
      .attr('stroke-dasharray', d => EDGE_DASH[d.dependencyType] ?? '')
      .attr('marker-end', d => `url(#arrow-${d.dependencyType})`)
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => {
        const edge: DependencyEdge = {
          id: d.id,
          source: typeof d.source === 'object' ? (d.source as SimNode).id : String(d.source),
          target: typeof d.target === 'object' ? (d.target as SimNode).id : String(d.target),
          dependencyType: d.dependencyType as DependencyEdge['dependencyType'],
          callCount1h: d.callCount1h,
          errorCount1h: d.errorCount1h,
          avgLatencyMs1h: d.avgLatencyMs1h,
        }
        setSelectedEdge(edge)
      })

    // Link labels (call count)
    const linkLabel = g.append('g')
      .selectAll<SVGTextElement, SimLink>('text')
      .data(links)
      .join('text')
      .attr('font-size', 10)
      .attr('fill', '#666')
      .attr('text-anchor', 'middle')
      .text(d => d.callCount1h > 0 ? `${d.callCount1h} calls` : '')

    // Draw nodes
    const node = g.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )

    // Node shapes
    node.each(function (d) {
      const el = d3.select(this)
      const color = NODE_COLORS[d.nodeType] ?? '#999'
      const shape = NODE_SHAPES[d.nodeType] ?? 'circle'

      if (shape === 'diamond') {
        el.append('polygon')
          .attr('points', '0,-18 18,0 0,18 -18,0')
          .attr('fill', color)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
      } else if (shape === 'hexagon') {
        const r = 18
        const hex = [0, 1, 2, 3, 4, 5].map(i => {
          const angle = (Math.PI / 3) * i - Math.PI / 6
          return `${r * Math.cos(angle)},${r * Math.sin(angle)}`
        }).join(' ')
        el.append('polygon')
          .attr('points', hex)
          .attr('fill', color)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
      } else if (shape === 'square') {
        el.append('rect')
          .attr('x', -14).attr('y', -14)
          .attr('width', 28).attr('height', 28)
          .attr('rx', 4)
          .attr('fill', color)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
      } else {
        el.append('circle')
          .attr('r', 18)
          .attr('fill', color)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
      }

      // Label
      el.append('text')
        .attr('dy', 30)
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('font-weight', 600)
        .attr('fill', '#333')
        .text(d.label.length > 20 ? d.label.slice(0, 18) + '…' : d.label)
    })

    // Tick
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

  // ── Render ────────────────────────────────────────────────────────────────

  const serviceName = services.find(s => s.id === selectedService)?.name

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Dependency Map</Typography>
          <Typography variant="body2" color="text.secondary">
            Interactive service topology — click edges for metrics detail
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Extract dependencies from recent traces">
            <span>
              <Button variant="outlined" startIcon={<SyncIcon />}
                onClick={handleExtract} disabled={!selectedService || extracting}>
                {extracting ? 'Extracting…' : 'Extract'}
              </Button>
            </span>
          </Tooltip>
          <Button variant="outlined" startIcon={<RefreshIcon />}
            onClick={fetchGraph} disabled={!selectedService}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* ── Service selector ────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField label="Service" select value={selectedService} sx={{ minWidth: 240 }}
          onChange={(e) => { setSelectedService(e.target.value); setSelectedEdge(null) }}>
          <MenuItem value="" disabled>Select a service</MenuItem>
          {services.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
        </TextField>

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <Chip key={type} size="small" label={type.replace('_', ' ')}
              sx={{ backgroundColor: color, color: '#fff', fontSize: '0.75rem' }} />
          ))}
          <Divider orientation="vertical" flexItem />
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <Chip key={type} size="small" variant="outlined" label={type}
              sx={{ borderColor: color, color, fontSize: '0.75rem' }} />
          ))}
        </Box>
      </Box>

      {/* ── Graph canvas ────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{
        position: 'relative',
        height: 'calc(100vh - 280px)',
        minHeight: 400,
        overflow: 'hidden',
        backgroundColor: '#fafafa',
      }}>
        {!selectedService ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Select a service to view its dependency graph</Typography>
          </Box>
        ) : loading ? (
          <Box sx={{ p: 4 }}>
            <Skeleton variant="rectangular" height={400} />
          </Box>
        ) : graph && graph.nodes.length === 0 ? (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Typography color="text.secondary">
              No dependencies found for {serviceName ?? 'this service'}.
            </Typography>
            <Button variant="contained" size="small" startIcon={<SyncIcon />}
              onClick={handleExtract} disabled={extracting}>
              Extract from Traces
            </Button>
          </Box>
        ) : (
          <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
        )}
      </Paper>

      {/* ── Story 11.7: Dependency Detail Panel ──────────────── */}
      <Drawer
        anchor="right"
        open={!!selectedEdge}
        onClose={() => setSelectedEdge(null)}
        sx={{ '& .MuiDrawer-paper': { width: DETAIL_DRAWER_WIDTH, p: 3, overflowY: 'auto' } }}
      >
        {selectedEdge && (
          <DependencyDetailPanel edge={selectedEdge} onClose={() => setSelectedEdge(null)} />
        )}
      </Drawer>

      {/* ── Snackbar ────────────────────────────────────────────── */}
      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
