import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Box, Paper, Typography, useTheme, useMediaQuery } from '@mui/material'
import SpeedIcon           from '@mui/icons-material/Speed'
import AccountTreeIcon     from '@mui/icons-material/AccountTree'
import ArticleIcon         from '@mui/icons-material/Article'
import NotificationsIcon   from '@mui/icons-material/Notifications'
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize'
import AutoFixHighIcon     from '@mui/icons-material/AutoFixHigh'
import QueryStatsIcon      from '@mui/icons-material/QueryStats'
import HubIcon             from '@mui/icons-material/Hub'

// ── Feature data ────────────────────────────────────────────────────────────

interface Feature {
  icon: React.ReactNode
  title: string
  description: string
  color: string
}

const FEATURES: Feature[] = [
  {
    icon: <SpeedIcon sx={{ fontSize: 36 }} />,
    title: 'Real-Time APM',
    description: 'Monitor application performance with P50/P95/P99 latency, error rates, and throughput — all in real time.',
    color: '#1976d2',
  },
  {
    icon: <AccountTreeIcon sx={{ fontSize: 36 }} />,
    title: 'Distributed Tracing',
    description: 'Follow requests across microservices with span breakup, waterfall views, and automatic service maps.',
    color: '#9c27b0',
  },
  {
    icon: <ArticleIcon sx={{ fontSize: 36 }} />,
    title: 'Log Explorer',
    description: 'Search, filter, and correlate logs by service, severity, and trace context with full-text search.',
    color: '#2e7d32',
  },
  {
    icon: <NotificationsIcon sx={{ fontSize: 36 }} />,
    title: 'Alerting & SLA Rules',
    description: 'Define SLA thresholds, get notified via Email, SMS, or MS Teams before users are impacted.',
    color: '#ed6c02',
  },
  {
    icon: <DashboardCustomizeIcon sx={{ fontSize: 36 }} />,
    title: 'Custom Dashboards',
    description: 'Build drag-and-drop dashboards with metric charts, log panels, and trace summaries.',
    color: '#0288d1',
  },
  {
    icon: <AutoFixHighIcon sx={{ fontSize: 36 }} />,
    title: 'AI-Powered Insights',
    description: 'Automatic anomaly detection, root cause analysis, and error diagnosis powered by LLMs.',
    color: '#c62828',
  },
  {
    icon: <QueryStatsIcon sx={{ fontSize: 36 }} />,
    title: 'Query & DB Metrics',
    description: 'Track slow queries, database latency, and operation-level breakdowns across all data stores.',
    color: '#00838f',
  },
  {
    icon: <HubIcon sx={{ fontSize: 36 }} />,
    title: 'Service Dependencies',
    description: 'Auto-discovered dependency graphs showing call counts, error rates, and latency between services.',
    color: '#6a1b9a',
  },
]

// Show 3 features at a time, auto-rotate
const VISIBLE_COUNT = 3
const ROTATE_INTERVAL = 4000

// ── Feature Card ────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        p: 2.5,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        transition: 'transform 0.3s, background-color 0.3s',
        '&:hover': {
          transform: 'translateY(-2px)',
          backgroundColor: 'rgba(255,255,255,0.12)',
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          width: 56,
          height: 56,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: feature.color,
          color: '#fff',
          boxShadow: `0 4px 14px ${feature.color}66`,
        }}
      >
        {feature.icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#fff', mb: 0.25 }}>
          {feature.title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
          {feature.description}
        </Typography>
      </Box>
    </Box>
  )
}

// ── Auth Layout ─────────────────────────────────────────────────────────────

export default function AuthLayout() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [startIndex, setStartIndex] = useState(0)

  // Auto-rotate features
  useEffect(() => {
    const timer = setInterval(() => {
      setStartIndex((prev) => (prev + VISIBLE_COUNT) % FEATURES.length)
    }, ROTATE_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  const visibleFeatures = Array.from({ length: VISIBLE_COUNT }, (_, i) =>
    FEATURES[(startIndex + i) % FEATURES.length],
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Left Panel — Product Showcase ──────────────────────────────── */}
      {!isMobile && (
        <Box
          sx={{
            flex: '1 1 60%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: { md: 6, lg: 8 },
            background: 'linear-gradient(135deg, #0d1b2a 0%, #1b2a4a 50%, #162447 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle background grid pattern */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: 0.04,
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
              pointerEvents: 'none',
            }}
          />

          {/* Branding */}
          <Box sx={{ position: 'relative', zIndex: 1, mb: 5 }}>
            <Typography
              variant="h3"
              fontWeight={800}
              sx={{
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #60a5fa)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                mb: 1.5,
              }}
            >
              System Insights
            </Typography>
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 400, maxWidth: 520, lineHeight: 1.6 }}>
              Unified observability platform for metrics, traces, and logs.
              Everything you need to monitor, debug, and optimize your applications.
            </Typography>
          </Box>

          {/* Stats bar */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              gap: 4,
              mb: 5,
            }}
          >
            {[
              { value: '3', label: 'Signals' },
              { value: '< 1s', label: 'Latency' },
              { value: '100%', label: 'Open Standards' },
              { value: 'AI', label: 'Powered' },
            ].map((stat) => (
              <Box key={stat.label}>
                <Typography variant="h5" fontWeight={800} sx={{ color: '#60a5fa' }}>
                  {stat.value}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {stat.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Feature cards — rotating */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {visibleFeatures.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </Box>

          {/* Dot indicators */}
          <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', gap: 1, mt: 3 }}>
            {Array.from({ length: Math.ceil(FEATURES.length / VISIBLE_COUNT) }).map((_, i) => (
              <Box
                key={i}
                onClick={() => setStartIndex(i * VISIBLE_COUNT)}
                sx={{
                  width: i * VISIBLE_COUNT === startIndex ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i * VISIBLE_COUNT === startIndex ? '#60a5fa' : 'rgba(255,255,255,0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* ── Right Panel — Login Form ──────────────────────────────────── */}
      <Box
        sx={{
          flex: isMobile ? '1 1 100%' : '0 0 440px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
          px: { xs: 3, sm: 4 },
          py: 4,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 380 }}>
          {/* Branding (shown on mobile only since left panel is hidden) */}
          {isMobile && (
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography variant="h5" fontWeight={700} color="primary.dark">
                System Insights
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Unified visibility into your applications
              </Typography>
            </Box>
          )}

          {/* Desktop: small tagline above form */}
          {!isMobile && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" fontWeight={700} color="text.primary">
                Welcome back
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Sign in to your observability platform
              </Typography>
            </Box>
          )}

          <Paper sx={{ p: 4 }} variant="outlined">
            <Outlet />
          </Paper>

          <Typography variant="caption" color="text.disabled" sx={{ mt: 3, textAlign: 'center', display: 'block' }}>
            Built on OpenTelemetry, Jaeger, Prometheus & Elasticsearch
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
