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
  transactions: 'Transactions',
  traces:       'Traces',
  alerts:       'Alerts',
  history:      'History',
  'sla-rules':  'SLA Rules',
  dependencies: 'Dependencies',
  workflows:    'Workflows',
  dashboard:    'Dashboard',
  reports:      'Reports',
  synthetic:    'Synthetic Monitoring',
  'ai-insights': 'AI Insights',
  billings:     'Billings',
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
  customCrumbs: { label: string; path: string }[] | null
  setCustomCrumbs: (crumbs: { label: string; path: string }[] | null) => void
}

export const BreadcrumbContext = createContext<BreadcrumbContextType>({
  labels: new Map(),
  setLabel: () => {},
  removeLabel: () => {},
  customCrumbs: null,
  setCustomCrumbs: () => {},
})

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<Map<string, string>>(new Map())
  const [customCrumbs, setCustomCrumbs] = useState<{ label: string; path: string }[] | null>(null)

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
    () => ({ labels, setLabel, removeLabel, customCrumbs, setCustomCrumbs }),
    [labels, setLabel, removeLabel, customCrumbs],
  )

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatSegment(segment: string): string {
  // Decode URL-encoded segments (e.g. "POST%20%2Fapi%2Fusers" → "POST /api/users")
  let decoded: string
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    decoded = segment
  }

  // If the decoded value looks like an operation/path (contains / or space),
  // return as-is instead of title-casing
  if (decoded.includes('/') || decoded.includes(' ')) return decoded

  if (decoded.length > 30) return `${decoded.substring(0, 24)}…`
  return decoded
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ── Breadcrumb Component ────────────────────────────────────────────────────

export default function AppBreadcrumbs() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { labels, customCrumbs } = useContext(BreadcrumbContext)

  /**
   * Navigate to a breadcrumb target. For custom crumbs the path already
   * contains the correct query string; for auto-generated crumbs we
   * preserve current search params when navigating to a parent path.
   */
  const handleNavigate = (targetPath: string) => {
    if (customCrumbs) {
      navigate(targetPath)
      return
    }
    const isParent = pathname.startsWith(targetPath) && pathname !== targetPath
    navigate(isParent ? targetPath + search : targetPath)
  }

  const segments = pathname.split('/').filter(Boolean)

  // Hide on home page — nothing to navigate back to
  if (!customCrumbs && (segments.length === 0 || (segments.length === 1 && segments[0] === 'home'))) {
    return null
  }

  let crumbs: { label: string; path: string }[]

  if (customCrumbs) {
    crumbs = customCrumbs
  } else {
    crumbs = [{ label: 'Home', path: '/home' }]

    let cumulativePath = ''
    for (const segment of segments) {
      cumulativePath += `/${segment}`

      let decoded: string
      try { decoded = decodeURIComponent(segment) } catch { decoded = segment }

      const label =
        SEGMENT_LABELS[segment] ??
        SEGMENT_LABELS[decoded] ??
        labels.get(segment) ??
        labels.get(decoded) ??
        formatSegment(segment)
      crumbs.push({ label, path: cumulativePath })
    }
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
              onClick={() => handleNavigate(crumb.path)}
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
              onClick={() => handleNavigate(crumb.path)}
            >
              {crumb.label}
            </Link>
          )
        })}
      </Breadcrumbs>
    </Box>
  )
}
