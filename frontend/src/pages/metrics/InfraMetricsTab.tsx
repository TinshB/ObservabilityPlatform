import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Skeleton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadialBarChart,
  RadialBar,
} from 'recharts'
import type { InfraMetricsResponse, TimeSeries } from '@/types'
import type { MetricsParams } from '@/services/metricsService'
import * as metricsService from '@/services/metricsService'
import {
  mergeTimeSeries,
  formatTime,
  formatDateTime,
  formatBytes,
  formatCores,
  formatLatency,
  formatNumber,
  CHART_COLORS,
} from './chartUtils'

interface Props {
  serviceId: string
  serviceName: string
  params: MetricsParams
}

function GaugeCard({ title, value, maxLabel }: { title: string; value: number | null; maxLabel?: string }) {
  const pct = value != null ? Math.min(value * 100, 100) : 0
  const color = pct > 90 ? '#d32f2f' : pct > 70 ? '#ed6c02' : '#2e7d32'
  // Arc spans 270° (from 225° to -45°). Calculate the end angle for the filled portion.
  const totalAngle = 270
  const filledEndAngle = 225 - (pct / 100) * totalAngle

  return (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
        {/* Background arc (full track) */}
        <ResponsiveContainer width={140} height={140}>
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={[{ value: 100, fill: 'rgba(0,0,0,0.06)' }]}
            startAngle={225}
            endAngle={-45}
            cx="50%"
            cy="50%"
          >
            <RadialBar dataKey="value" cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Filled arc (actual value) */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center' }}>
          <ResponsiveContainer width={140} height={140}>
            <RadialBarChart
              innerRadius="70%"
              outerRadius="100%"
              data={[{ value: pct, fill: color }]}
              startAngle={225}
              endAngle={filledEndAngle}
              cx="50%"
              cy="50%"
            >
              <RadialBar dataKey="value" cornerRadius={8} />
            </RadialBarChart>
          </ResponsiveContainer>
        </Box>
      </Box>
      <Typography variant="h5" fontWeight={700} sx={{ mt: -2 }}>
        {value != null ? `${pct.toFixed(1)}%` : 'N/A'}
      </Typography>
      {maxLabel && (
        <Typography variant="caption" color="text.secondary">{maxLabel}</Typography>
      )}
    </Paper>
  )
}

function InstantCard({ title, value }: { title: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
      <Typography variant="h6" fontWeight={700}>{value}</Typography>
    </Paper>
  )
}

export default function InfraMetricsTab({ serviceId, serviceName, params }: Props) {
  const [data, setData] = useState<InfraMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedInstance, setSelectedInstance] = useState<string>('__all__')

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await metricsService.getInfraMetrics(serviceId, params)
      setData(resp)
      setSelectedInstance('__all__')
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to load infra metrics'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [serviceId, params.range]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  // ── Extract instance names from CPU-by-instance series ──────────────────────
  const instanceNames = useMemo(() => {
    if (!data?.processCpuByInstance) return []
    const names = data.processCpuByInstance
      .map((s) => s.labels?.instance ?? s.name)
      .filter(Boolean)
    return Array.from(new Set(names))
  }, [data])

  // ── Filter by-instance series ──────────────────────────────────────────────
  const filterByInstance = useCallback(
    (seriesList: TimeSeries[]): TimeSeries[] => {
      if (selectedInstance === '__all__' || !seriesList.length) return seriesList
      return seriesList.filter(
        (s) => (s.labels?.instance ?? s.name) === selectedInstance,
      )
    },
    [selectedInstance],
  )

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={6} md={3} key={i}>
              <Skeleton variant="rounded" height={200} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={300} />
        <Skeleton variant="rounded" height={300} />
      </Box>
    )
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
  }

  if (!data) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No infrastructure metrics available. Ensure OTel/Micrometer JVM instrumentation is enabled for {serviceName}.
        </Typography>
      </Paper>
    )
  }

  const current = data.current

  // ── Heap utilization ratio ─────────────────────────────────────────────────
  const heapUtilisation =
    current?.memoryUsageBytes != null && current?.jvmMemoryHeapMaxBytes != null && current.jvmMemoryHeapMaxBytes > 0
      ? current.memoryUsageBytes / current.jvmMemoryHeapMaxBytes
      : null

  // ── Instance-filtered series ───────────────────────────────────────────────
  const filteredCpuByInstance = filterByInstance(data.processCpuByInstance ?? [])
  const filteredHeapByInstance = filterByInstance(data.jvmMemoryHeapByInstance ?? [])

  // ── Prepare chart data ─────────────────────────────────────────────────────
  const cpuProcessSeries = selectedInstance === '__all__'
    ? data.processCpuUsage
    : filteredCpuByInstance.length > 0 ? filteredCpuByInstance[0] : null

  const cpuData = mergeTimeSeries(
    [cpuProcessSeries, data.systemCpuUsage],
    ['Process CPU (cores)', 'System CPU (ratio)'],
  )

  const heapUsedSource = selectedInstance === '__all__'
    ? data.jvmMemoryHeapUsed
    : filteredHeapByInstance.length > 0 ? filteredHeapByInstance[0] : null

  const heapData = mergeTimeSeries(
    [heapUsedSource, data.jvmMemoryHeapCommitted, data.jvmMemoryHeapMax],
    ['Heap Used', 'Heap Committed', 'Heap Max'],
  )

  const nonHeapRssData = mergeTimeSeries(
    [data.jvmMemoryNonHeapUsed, data.processResidentMemory],
    ['Non-Heap Used', 'Process RSS'],
  )

  const threadsData = mergeTimeSeries(
    [data.jvmThreadsLive, data.jvmThreadsDaemon],
    ['Live Threads', 'Daemon Threads'],
  )

  const classesData = mergeTimeSeries(
    [data.jvmClassesLoaded],
    ['Loaded Classes'],
  )

  const gcData = mergeTimeSeries(
    [data.gcPauseTime, data.gcPauseCount],
    ['Pause Time', 'Pause Count'],
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Instance selector ─────────────────────────────────────────── */}
      {instanceNames.length > 1 && (
        <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">Filter by instance:</Typography>
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel>Instance</InputLabel>
            <Select value={selectedInstance} label="Instance" onChange={(e) => setSelectedInstance(e.target.value)}>
              <MenuItem value="__all__">All Instances (Aggregated)</MenuItem>
              {instanceNames.map((name) => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>
      )}

      {/* ── Row 1: Gauges + instant values ────────────────────────────── */}
      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <InstantCard title="Process CPU" value={formatCores(current?.cpuUsageCores)} />
        </Grid>
        <Grid item xs={6} md={3}>
          <GaugeCard title="System CPU" value={current?.systemCpuUtilisation ?? null} />
        </Grid>
        <Grid item xs={6} md={3}>
          <GaugeCard
            title="Heap Utilization"
            value={heapUtilisation}
            maxLabel={current?.jvmMemoryHeapMaxBytes != null ? `Max: ${formatBytes(current.jvmMemoryHeapMaxBytes)}` : undefined}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <InstantCard
            title="Live Threads"
            value={current?.jvmThreadsLive != null ? formatNumber(current.jvmThreadsLive) : 'N/A'}
          />
        </Grid>
      </Grid>

      {/* ── Row 2: Additional instant values ──────────────────────────── */}
      <Grid container spacing={2}>
        <Grid item xs={6} md={4}>
          <InstantCard title="Heap Used" value={formatBytes(current?.memoryUsageBytes)} />
        </Grid>
        <Grid item xs={6} md={4}>
          <InstantCard title="Non-Heap Used" value={formatBytes(current?.jvmMemoryNonHeapUsedBytes)} />
        </Grid>
        <Grid item xs={6} md={4}>
          <InstantCard
            title="Loaded Classes"
            value={current?.jvmClassesLoaded != null ? formatNumber(current.jvmClassesLoaded) : 'N/A'}
          />
        </Grid>
      </Grid>

      {/* ── Process CPU Usage (Cores) ─────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Process CPU Usage (Cores)
        </Typography>
        {cpuData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={cpuData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis
                yAxisId="left"
                domain={[0, 'auto']}
                tickFormatter={(v) => formatCores(v)}
                tick={{ fontSize: 12 }}
                stroke="rgba(0,0,0,0.3)"
                width={70}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 1]}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 12 }}
                stroke="rgba(0,0,0,0.3)"
                width={50}
              />
              <Tooltip
                labelFormatter={(label) => formatDateTime(label as number)}
                formatter={(value: unknown, name: unknown) => {
                  const v = value as number
                  const n = name as string
                  if (n.includes('ratio')) return [`${(v * 100).toFixed(1)}%`, n]
                  return [formatCores(v), n]
                }}
              />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="Process CPU (cores)" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.15} strokeWidth={2} />
              <Area yAxisId="right" type="monotone" dataKey="System CPU (ratio)" stroke={CHART_COLORS[1]} fill="none" strokeWidth={2} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No CPU data available.
          </Typography>
        )}
      </Paper>

      {/* ── JVM Heap Memory ───────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          JVM Heap Memory
        </Typography>
        {heapData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={heapData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis domain={[0, 'auto']} tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip
                labelFormatter={(label) => formatDateTime(label as number)}
                formatter={(value: unknown, name: unknown) => [formatBytes(value as number), name as string]}
              />
              <Legend />
              <Area type="monotone" dataKey="Heap Used" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.2} strokeWidth={2} />
              <Area type="monotone" dataKey="Heap Committed" stroke={CHART_COLORS[3]} fill="none" strokeWidth={1.5} />
              <Area type="monotone" dataKey="Heap Max" stroke={CHART_COLORS[2]} fill="none" strokeWidth={1.5} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No JVM heap memory data available.
          </Typography>
        )}
      </Paper>

      {/* ── Non-Heap & Process RSS ────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Non-Heap Memory &amp; Process RSS
        </Typography>
        {nonHeapRssData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={nonHeapRssData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis domain={[0, 'auto']} tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={70} />
              <Tooltip
                labelFormatter={(label) => formatDateTime(label as number)}
                formatter={(value: unknown, name: unknown) => [formatBytes(value as number), name as string]}
              />
              <Legend />
              <Line type="monotone" dataKey="Non-Heap Used" stroke={CHART_COLORS[4]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Process RSS" stroke={CHART_COLORS[5]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No non-heap memory data available.
          </Typography>
        )}
      </Paper>

      {/* ── JVM Threads ───────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          JVM Threads
        </Typography>
        {threadsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={threadsData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={50} />
              <Tooltip
                labelFormatter={(label) => formatDateTime(label as number)}
                formatter={(value: unknown, name: unknown) => [`${(value as number).toFixed(0)}`, name as string]}
              />
              <Legend />
              <Line type="monotone" dataKey="Live Threads" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Daemon Threads" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No JVM thread data available. This metric requires Micrometer JVM instrumentation.
          </Typography>
        )}
      </Paper>

      {/* ── JVM Loaded Classes ────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          JVM Loaded Classes
        </Typography>
        {classesData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={classesData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" width={60} />
              <Tooltip
                labelFormatter={(label) => formatDateTime(label as number)}
                formatter={(value: unknown, name: unknown) => [`${(value as number).toFixed(0)}`, name as string]}
              />
              <Legend />
              <Area type="monotone" dataKey="Loaded Classes" stroke={CHART_COLORS[7]} fill={CHART_COLORS[7]} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No JVM class loading data available. This metric requires Micrometer JVM instrumentation.
          </Typography>
        )}
      </Paper>

      {/* ── JVM GC ────────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          JVM GC Pause Time
        </Typography>
        {gcData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={gcData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 12 }} stroke="rgba(0,0,0,0.3)" />
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => formatLatency(v)}
                tick={{ fontSize: 12 }}
                stroke="rgba(0,0,0,0.3)"
                width={70}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                stroke="rgba(0,0,0,0.3)"
                width={50}
              />
              <Tooltip
                labelFormatter={(label) => formatDateTime(label as number)}
                formatter={(value: unknown, name: unknown) => {
                  const v = value as number
                  const n = name as string
                  if (n === 'Pause Time') return [formatLatency(v), n]
                  return [`${v.toFixed(1)}/s`, n]
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="Pause Time" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="Pause Count" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No JVM GC data available. This metric is only present for JVM-based services with GC instrumentation enabled.
          </Typography>
        )}
      </Paper>
    </Box>
  )
}
