import { useMemo } from 'react'
import { Box, Typography, Paper, Skeleton } from '@mui/material'
import type { WorkflowInstance, WorkflowStep } from '@/types'

// ── Colours ──────────────────────────────────────────────────────────────────

const CLR = {
  PASS:     '#546e7a',
  COMPLETE: '#2e7d32',
  PROGRESS: '#1976d2',
  FAILED:   '#d32f2f',
  LINK:     '#90a4ae',
} as const

// ── Per-node metrics ─────────────────────────────────────────────────────────

interface NodeMetrics {
  label: string
  reached: number
  passedThrough: number
  completedHere: number
  inProgressHere: number
  failedHere: number
}

// ── SVG layout ───────────────────────────────────────────────────────────────

const SVG_W  = 960
const SVG_H  = 320
const PAD_T  = 50
const PAD_B  = 70
const PAD_L  = 40
const PAD_R  = 40
const BAR_W  = 18
const CHART_H = SVG_H - PAD_T - PAD_B

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  instances: WorkflowInstance[]
  steps: WorkflowStep[]
  loading: boolean
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WorkflowSankeyChart({ instances, steps, loading }: Props) {

  /* ---------- compute per-step metrics ---------- */

  const nodes = useMemo<NodeMetrics[]>(() => {
    if (!instances.length || !steps.length) return []

    const total    = instances.length
    const numSteps = steps.length
    const result: NodeMetrics[] = []

    // Entry node – represents all instances before the first step
    const zero = instances.filter(i => i.matchedSteps === 0)
    result.push({
      label:          'All Instances',
      reached:        total,
      passedThrough:  total - zero.length,
      completedHere:  zero.filter(i => i.status === 'COMPLETE').length,
      inProgressHere: zero.filter(i => i.status === 'IN_PROGRESS').length,
      failedHere:     zero.filter(i => i.status === 'FAILED').length,
    })

    // One node per workflow step
    for (let idx = 0; idx < numSteps; idx++) {
      const sn       = idx + 1
      const reached  = instances.filter(i => i.matchedSteps >= sn).length
      const failedH  = instances.filter(i => i.matchedSteps === sn && i.status === 'FAILED').length
      const inProgH  = instances.filter(i => i.matchedSteps === sn && i.status === 'IN_PROGRESS').length
      const compH    = instances.filter(i => i.matchedSteps === sn && i.status === 'COMPLETE').length
      const passThru = sn < numSteps
        ? instances.filter(i => i.matchedSteps > sn).length
        : 0

      result.push({
        label:          steps[idx].label || steps[idx].serviceName || `Step ${sn}`,
        reached,
        passedThrough:  passThru,
        completedHere:  compH,
        inProgressHere: inProgH,
        failedHere:     failedH,
      })
    }

    return result
  }, [instances, steps])

  /* ---------- loading ---------- */

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Workflow Step Flow
        </Typography>
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} />
      </Paper>
    )
  }

  /* ---------- empty ---------- */

  if (!nodes.length) {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Workflow Step Flow
        </Typography>
        <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No instance data to visualise
          </Typography>
        </Box>
      </Paper>
    )
  }

  /* ---------- layout math ---------- */

  const total    = nodes[0].reached
  const maxBarH  = CHART_H * 0.88
  const scale    = total > 0 ? maxBarH / total : 0
  const usableW  = SVG_W - PAD_L - PAD_R
  const gap      = nodes.length > 1 ? usableW / (nodes.length - 1) : usableW

  /** cubic-bezier band between two vertical edges */
  const band = (
    x1: number, y1t: number, y1b: number,
    x2: number, y2t: number, y2b: number,
  ) => {
    const cx = (x1 + x2) / 2
    return [
      `M${x1},${y1t}`,
      `C${cx},${y1t} ${cx},${y2t} ${x2},${y2t}`,
      `L${x2},${y2b}`,
      `C${cx},${y2b} ${cx},${y1b} ${x1},${y1b}`,
      'Z',
    ].join(' ')
  }

  /* ---------- build SVG ---------- */

  const svgLinks:  React.ReactElement[] = []
  const svgBars:   React.ReactElement[] = []
  const svgLabels: React.ReactElement[] = []

  // small exit paths for drop-offs
  const svgExits: React.ReactElement[] = []

  for (let i = 0; i < nodes.length; i++) {
    const n  = nodes[i]
    const x  = PAD_L + i * gap
    const barH = n.reached * scale

    // --- node bar segments (top→bottom: pass, complete, inProgress, failed) ---
    const segs: { count: number; h: number; color: string; tip: string }[] = [
      { count: n.passedThrough,  h: n.passedThrough * scale,  color: CLR.PASS,     tip: `Continuing: ${n.passedThrough}` },
      { count: n.completedHere,  h: n.completedHere * scale,  color: CLR.COMPLETE,  tip: `Complete: ${n.completedHere}` },
      { count: n.inProgressHere, h: n.inProgressHere * scale, color: CLR.PROGRESS, tip: `In Progress: ${n.inProgressHere}` },
      { count: n.failedHere,     h: n.failedHere * scale,     color: CLR.FAILED,   tip: `Failed: ${n.failedHere}` },
    ]

    let sy = PAD_T
    for (const seg of segs) {
      if (seg.h < 0.5) { sy += seg.h; continue }
      svgBars.push(
        <rect
          key={`b${i}-${seg.color}`}
          x={x - BAR_W / 2} y={sy}
          width={BAR_W} height={Math.max(seg.h, 1)}
          fill={seg.color} rx={3}
        >
          <title>{seg.tip}</title>
        </rect>,
      )
      sy += seg.h
    }

    // --- exit flow curves for drop-offs (complete / inProgress / failed) ---
    const dropOffs: { count: number; color: string }[] = [
      { count: n.completedHere,  color: CLR.COMPLETE },
      { count: n.inProgressHere, color: CLR.PROGRESS },
      { count: n.failedHere,     color: CLR.FAILED },
    ]

    let exitY = PAD_T + n.passedThrough * scale
    for (const d of dropOffs) {
      if (d.count < 1) { exitY += d.count * scale; continue }
      const h = d.count * scale
      if (h < 2) { exitY += h; continue }

      // small curved exit flowing to the right and downward
      const x1 = x + BAR_W / 2
      const x2 = x + BAR_W / 2 + gap * 0.25
      const yShift = 18
      svgExits.push(
        <path
          key={`exit${i}-${d.color}`}
          d={band(x1, exitY, exitY + h, x2, exitY + yShift, exitY + h + yShift)}
          fill={d.color}
          opacity={0.18}
        />,
      )
      exitY += h
    }

    // --- main flow link to next node ---
    if (i < nodes.length - 1 && n.passedThrough > 0) {
      const nx = PAD_L + (i + 1) * gap
      const h  = n.passedThrough * scale
      svgLinks.push(
        <path
          key={`f${i}`}
          d={band(x + BAR_W / 2, PAD_T, PAD_T + h, nx - BAR_W / 2, PAD_T, PAD_T + h)}
          fill={CLR.LINK} opacity={0.18}
        />,
      )
    }

    // --- text labels ---
    const pct = total > 0 ? Math.round((n.reached / total) * 100) : 0

    svgLabels.push(
      <g key={`t${i}`}>
        {/* percentage */}
        <text x={x} y={PAD_T - 22} textAnchor="middle" fontSize={10} fill="#999">
          {pct}%
        </text>
        {/* count */}
        <text x={x} y={PAD_T - 7} textAnchor="middle" fontSize={13} fontWeight={700} fill="currentColor">
          {n.reached}
        </text>
        {/* step label */}
        <text x={x} y={PAD_T + barH + 16} textAnchor="middle" fontSize={10} fontWeight={600} fill="currentColor">
          {n.label.length > 14 ? `${n.label.slice(0, 13)}…` : n.label}
        </text>
        {/* compact breakdown */}
        {(n.completedHere > 0 || n.failedHere > 0 || n.inProgressHere > 0) && (
          <text x={x} y={PAD_T + barH + 32} textAnchor="middle" fontSize={9}>
            {n.completedHere > 0 && (
              <tspan fill={CLR.COMPLETE}>
                {'✓'}{n.completedHere}({Math.round((n.completedHere / total) * 100)}%){' '}
              </tspan>
            )}
            {n.failedHere > 0 && (
              <tspan fill={CLR.FAILED}>
                {'✗'}{n.failedHere}({Math.round((n.failedHere / total) * 100)}%){' '}
              </tspan>
            )}
            {n.inProgressHere > 0 && (
              <tspan fill={CLR.PROGRESS}>
                {'◷'}{n.inProgressHere}({Math.round((n.inProgressHere / total) * 100)}%)
              </tspan>
            )}
          </text>
        )}
      </g>,
    )
  }

  /* ---------- render ---------- */

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Workflow Step Flow</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {[
            { label: 'Passing',     color: CLR.PASS },
            { label: 'Complete',    color: CLR.COMPLETE },
            { label: 'In Progress', color: CLR.PROGRESS },
            { label: 'Failed',      color: CLR.FAILED },
          ].map(l => (
            <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: l.color }} />
              <Typography variant="caption" color="text.secondary">{l.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ minWidth: 500, display: 'block' }}
        >
          {svgLinks}
          {svgExits}
          {svgBars}
          {svgLabels}
        </svg>
      </Box>
    </Paper>
  )
}
