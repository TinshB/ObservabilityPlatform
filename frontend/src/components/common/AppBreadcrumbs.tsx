import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Breadcrumbs, Link, Typography, Box } from '@mui/material'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import HomeIcon from '@mui/icons-material/Home'

// ── Static label map ────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<string, string> = {
  home:         'Home',
  dashboards:   'Dashboards',
  apm:          'APM Overview',
  services:     'Services',
  metrics:      'Metrics',
  logs:         'Logs',
  traces:       'Traces',
  alerts:       'Alerts',
  history:      'History',
  'sla-rules':  'SLA Rules',
  dependencies: 'Dependencies',
  workflows:    'Workflows',
  dashboard:    'Dashboard',
  reports:      'Reports',
  synthetic:    'Synthetic Monitoring',
  admin:        'Administration',
  users:        'Users',
  roles:        'Roles',
  profile:      'Profile',
}

// ── Breadcrumb Context ──────────────────────────────────────────────────────

interface BreadcrumbContextType {
  labels: Map<string, string>
  setLabel: (key: string, label: string) => void
  removeLabel: (key: string) => void
}

export const BreadcrumbContext = createContext<BreadcrumbContextType>({
  labels: new Map(),
  setLabel: () => {},
  removeLabel: () => {},
})

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<Map<string, string>>(new Map())

  const setLabel = useCallback((key: string, label: string) => {
    setLabels(prev => {
      if (prev.get(key) === label) return prev
      const next = new Map(prev)
      next.set(key, label)
      return next
    })
  }, [])

  const removeLabel = useCallback((key: string) => {
    setLabels(prev => {
      if (!prev.has(key)) return prev
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ labels, setLabel, removeLabel }),
    [labels, setLabel, removeLabel],
  )

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatSegment(segment: string): string {
  if (segment.length > 20) return `${segment.substring(0, 12)}…`
  return segment
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ── Breadcrumb Component ────────────────────────────────────────────────────

export default function AppBreadcrumbs() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { labels } = useContext(BreadcrumbContext)

  const segments = pathname.split('/').filter(Boolean)

  // Hide on home page — nothing to navigate back to
  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'home')) {
    return null
  }

  const crumbs: { label: string; path: string }[] = [
    { label: 'Home', path: '/home' },
  ]

  let cumulativePath = ''
  for (const segment of segments) {
    cumulativePath += `/${segment}`
    const label =
      SEGMENT_LABELS[segment] ??
      labels.get(segment) ??
      formatSegment(segment)
    crumbs.push({ label, path: cumulativePath })
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Breadcrumbs
        separator={<NavigateNextIcon sx={{ fontSize: 16 }} />}
        aria-label="breadcrumb"
      >
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1

          if (isLast) {
            return (
              <Typography
                key={crumb.path}
                color="text.primary"
                variant="body2"
                fontWeight={600}
              >
                {crumb.label}
              </Typography>
            )
          }

          return index === 0 ? (
            <Link
              key={crumb.path}
              component="button"
              underline="hover"
              color="inherit"
              variant="body2"
              onClick={() => navigate(crumb.path)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <HomeIcon sx={{ fontSize: 16 }} />
              {crumb.label}
            </Link>
          ) : (
            <Link
              key={crumb.path}
              component="button"
              underline="hover"
              color="inherit"
              variant="body2"
              onClick={() => navigate(crumb.path)}
            >
              {crumb.label}
            </Link>
          )
        })}
      </Breadcrumbs>
    </Box>
  )
}
