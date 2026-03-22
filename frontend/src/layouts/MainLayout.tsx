import React, { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Avatar,
  Menu,
  MenuItem,
  Popover,
  Tooltip,
  Collapse,
} from '@mui/material'
import ExpandLessIcon     from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon     from '@mui/icons-material/ExpandMore'
import MenuIcon            from '@mui/icons-material/Menu'
import HomeIcon            from '@mui/icons-material/Home'
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize'
import MonitorHeartIcon    from '@mui/icons-material/MonitorHeart'
import BarChartIcon        from '@mui/icons-material/BarChart'
import ArticleIcon         from '@mui/icons-material/Article'
import SpeedIcon           from '@mui/icons-material/Speed'
import AccountTreeIcon     from '@mui/icons-material/AccountTree'
import HubIcon             from '@mui/icons-material/Hub'
import NotificationsIcon   from '@mui/icons-material/Notifications'
import HistoryIcon         from '@mui/icons-material/History'
import RuleIcon            from '@mui/icons-material/Rule'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import AssessmentIcon     from '@mui/icons-material/Assessment'
import NetworkCheckIcon   from '@mui/icons-material/NetworkCheck'
import PaymentIcon        from '@mui/icons-material/Payment'
import PeopleIcon          from '@mui/icons-material/People'
import SecurityIcon        from '@mui/icons-material/Security'
import PersonIcon          from '@mui/icons-material/Person'
import LogoutIcon          from '@mui/icons-material/Logout'
import LightModeIcon       from '@mui/icons-material/LightMode'
import DarkModeIcon        from '@mui/icons-material/DarkMode'
import ContrastIcon        from '@mui/icons-material/Contrast'
import PaletteIcon         from '@mui/icons-material/Palette'
import { useAuth }         from '@/hooks/useAuth'
import GlobalSearchBar     from '@/components/common/GlobalSearchBar'
import AppBreadcrumbs, { BreadcrumbProvider } from '@/components/common/AppBreadcrumbs'
import { useRecentPages } from '@/hooks/useRecentPages'
import {
  useThemeStore,
  resolveMode,
  FONT_FAMILIES,
  SECTION_COLORS_LIGHT,
  SECTION_COLORS_DARK,
} from '@/store/themeStore'
import type { ThemeMode, FontFamilyKey, SectionColorKey } from '@/store/themeStore'
import { ACCENTS, ACCENT_LABELS } from '@/theme/accents'
import type { AccentKey } from '@/theme/accents'

const DRAWER_WIDTH = 240

// Navigation items — routes added as sprints deliver the corresponding pages
const NAV_ITEMS = [
  { label: 'Home',          icon: <HomeIcon />,           path: '/home' },
  { label: 'Dashboards', icon: <DashboardCustomizeIcon />, path: '/dashboards' },
  { label: 'APM Overview', icon: <SpeedIcon />,          path: '/apm' },
  { label: 'Services',     icon: <MonitorHeartIcon />,  path: '/services' },
  { label: 'Metrics',      icon: <BarChartIcon />,      path: '/metrics' },
  { label: 'Traces',       icon: <AccountTreeIcon />,   path: '/traces' },
  { label: 'Logs',         icon: <ArticleIcon />,       path: '/logs' },
  { label: 'Dependencies',   icon: <HubIcon />,             path: '/dependencies' },
  { label: 'Alerts',         icon: <NotificationsIcon />, path: '/alerts' },
  { label: 'SLA Rules',     icon: <RuleIcon />,            path: '/sla-rules' },
  { label: 'Workflows',     icon: <AccountTreeOutlinedIcon />, path: '/workflows' },
  { label: 'Reports',       icon: <AssessmentIcon />,          path: '/reports' },
  { label: 'Synthetic Monitoring', icon: <NetworkCheckIcon />, path: '/synthetic' },
] as const

const ADMIN_ITEMS = [
  { label: 'Users',    icon: <PeopleIcon />,   path: '/admin/users' },
  { label: 'Roles',    icon: <SecurityIcon />,  path: '/admin/roles' },
  { label: 'Billings', icon: <PaymentIcon />,   path: '/admin/billings' },
] as const

// Build a path → label lookup from all nav items for the Recent section
const NAV_LABEL_MAP = new Map<string, string>(
  [...NAV_ITEMS, ...ADMIN_ITEMS].map(({ path, label }) => [path, label]),
)

/** Derive a compact label for any pathname — used for the Recent sidebar section. */
function resolvePageLabel(pathname: string): string {
  if (NAV_LABEL_MAP.has(pathname)) return NAV_LABEL_MAP.get(pathname)!

  const segments = pathname.split('/').filter(Boolean)
  // Walk backwards to find the longest matching nav prefix
  for (let i = segments.length - 1; i >= 1; i--) {
    const prefix = '/' + segments.slice(0, i).join('/')
    if (NAV_LABEL_MAP.has(prefix)) {
      const dynamic = segments.slice(i).join(' / ')
      const formatted = dynamic.length > 18 ? dynamic.substring(0, 16) + '\u2026' : dynamic
      return `${NAV_LABEL_MAP.get(prefix)!} / ${formatted}`
    }
  }

  // Fallback: title-case the last segment
  const last = segments[segments.length - 1] || 'Page'
  return last.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light',  label: 'Light',  icon: <LightModeIcon fontSize="small" /> },
  { value: 'dark',   label: 'Dark',   icon: <DarkModeIcon fontSize="small" /> },
  { value: 'system', label: 'System', icon: <ContrastIcon fontSize="small" /> },
]

export default function MainLayout() {
  const theme     = useTheme()
  const isMobile  = useMediaQuery(theme.breakpoints.down('md'))
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout, hasAnyRole } = useAuth()
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null)

  // Theme controls
  const { mode, accent, fontFamily, sectionColor, setMode, setAccent, setFontFamily, setSectionColor } = useThemeStore()
  const [themeAnchor, setThemeAnchor] = useState<null | HTMLElement>(null)
  const effectiveMode = resolveMode(mode)
  const sectionPresets = effectiveMode === 'dark' ? SECTION_COLORS_DARK : SECTION_COLORS_LIGHT
  const activeSectionPreset = sectionPresets[sectionColor]

  // Recent pages
  const { recentPages, recordVisit } = useRecentPages()
  const [recentOpen, setRecentOpen] = useState(false)
  const prevPathRef = useRef('')

  useEffect(() => {
    const path = location.pathname
    // Skip /home (always reachable) and avoid re-recording on re-renders
    if (path !== '/home' && path !== prevPathRef.current) {
      recordVisit(path, resolvePageLabel(path))
    }
    prevPathRef.current = path
  }, [location.pathname, recordVisit])

  const handleDrawerToggle = () => setMobileOpen((prev) => !prev)

  const isAdmin = hasAnyRole(['ADMIN', 'SUPER_ADMIN'])

  const modeIcon = effectiveMode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />

  const navItemButton = (label: string, icon: React.ReactNode, path: string) => (
    <ListItem key={path} disablePadding>
      <ListItemButton
        selected={location.pathname === path || (path !== '/home' && location.pathname.startsWith(path + '/'))}
        onClick={() => {
          navigate(path)
          if (isMobile) setMobileOpen(false)
        }}
        sx={{
          mx: 1, borderRadius: 1,
          '&.Mui-selected': {
            backgroundColor: effectiveMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'primary.50',
            color:           'primary.main',
            '& .MuiListItemIcon-root': { color: 'primary.main' },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
        <ListItemText primary={label} primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }} />
      </ListItemButton>
    </ListItem>
  )

  const drawerContent = (
    <Box>
      {!isMobile && <Toolbar />}

      {/* ── Recent pages (collapsible) ────────────────────────────── */}
      {recentPages.length > 0 && (
        <>
          <Box
            sx={{
              px: 1, pt: isMobile ? 2 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Typography variant="overline" color="text.secondary"
              sx={{ px: 1, display: 'block', letterSpacing: 1 }}>
              Recent
            </Typography>
            <IconButton
              size="small"
              onClick={() => setRecentOpen(prev => !prev)}
              aria-label={recentOpen ? 'Collapse recent pages' : 'Expand recent pages'}
              sx={{ mr: 1, color: 'text.secondary' }}
            >
              {recentOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={recentOpen} timeout="auto" unmountOnExit>
            <List dense>
              {recentPages.map(({ path, label }) => (
                <ListItem key={path} disablePadding>
                  <ListItemButton
                    selected={location.pathname === path}
                    onClick={() => {
                      navigate(path)
                      if (isMobile) setMobileOpen(false)
                    }}
                    sx={{
                      mx: 1, borderRadius: 1,
                      '&.Mui-selected': {
                        backgroundColor: effectiveMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'primary.50',
                        color:           'primary.main',
                        '& .MuiListItemIcon-root': { color: 'primary.main' },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <HistoryIcon sx={{ fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={label}
                      primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 400, noWrap: true }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Collapse>
          <Divider sx={{ my: 1 }} />
        </>
      )}

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <Box sx={{ px: 1, pt: recentPages.length > 0 ? 0 : (isMobile ? 2 : 1) }}>
        <Typography variant="overline" color="text.secondary"
          sx={{ px: 1, display: 'block', letterSpacing: 1 }}>
          Navigation
        </Typography>
      </Box>

      <List dense>
        {NAV_ITEMS.map(({ label, icon, path }) => navItemButton(label, icon, path))}
      </List>

      {isAdmin && (
        <>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ px: 1 }}>
            <Typography variant="overline" color="text.secondary"
              sx={{ px: 1, display: 'block', letterSpacing: 1 }}>
              Administration
            </Typography>
          </Box>
          <List dense>
            {ADMIN_ITEMS.map(({ label, icon, path }) => navItemButton(label, icon, path))}
          </List>
        </>
      )}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Top AppBar ─────────────────────────────────────────────── */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: activeSectionPreset.header.bg || 'primary.dark',
          color: activeSectionPreset.header.text,
        }}
        elevation={0}
      >
        <Toolbar>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, cursor: 'pointer' }}
            onClick={() => navigate('/home')}>
            <img src="/system_insights_logo.png" alt="System Insights" style={{ height: 72, width: 'auto' }} />
            <Typography variant="h6" noWrap fontWeight={700}>
              System Insights
            </Typography>
          </Box>

          {/* Story 9.5: Global Search */}
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <GlobalSearchBar />
          </Box>

          {/* Theme toggle */}
          <Tooltip title="Theme settings">
            <IconButton color="inherit" onClick={(e) => setThemeAnchor(e.currentTarget)} sx={{ mr: 0.5 }}>
              {modeIcon}
            </IconButton>
          </Tooltip>

          {/* Theme popover */}
          <Popover
            open={Boolean(themeAnchor)}
            anchorEl={themeAnchor}
            onClose={() => setThemeAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { p: 2, width: 280, maxHeight: '80vh', overflowY: 'auto' } } }}
          >
            {/* Mode selector */}
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
              Mode
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
              {MODE_OPTIONS.map((opt) => (
                <Box
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  sx={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 0.3, py: 0.8, borderRadius: 1, cursor: 'pointer',
                    border: '2px solid',
                    borderColor: mode === opt.value ? 'primary.main' : 'divider',
                    backgroundColor: mode === opt.value
                      ? (effectiveMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'primary.50')
                      : 'transparent',
                    '&:hover': { borderColor: 'primary.light' },
                    transition: 'all 0.15s ease',
                  }}
                >
                  {opt.icon}
                  <Typography variant="caption" fontSize="0.65rem" fontWeight={mode === opt.value ? 700 : 400}>
                    {opt.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Accent color picker */}
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
              Accent Color
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {(Object.keys(ACCENTS) as AccentKey[]).map((key) => (
                <Tooltip key={key} title={ACCENT_LABELS[key]}>
                  <Box
                    onClick={() => setAccent(key)}
                    sx={{
                      width: 28, height: 28, borderRadius: '50%',
                      backgroundColor: ACCENTS[key].main, cursor: 'pointer',
                      border: '3px solid',
                      borderColor: accent === key ? 'text.primary' : 'transparent',
                      outline: accent === key ? `2px solid ${ACCENTS[key].main}` : 'none',
                      outlineOffset: 2,
                      '&:hover': { transform: 'scale(1.15)' },
                      transition: 'all 0.15s ease',
                    }}
                  />
                </Tooltip>
              ))}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Font family picker */}
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
              Font Family
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
              {(Object.keys(FONT_FAMILIES) as FontFamilyKey[]).map((key) => (
                <Box
                  key={key}
                  onClick={() => setFontFamily(key)}
                  sx={{
                    px: 1.5, py: 0.7, borderRadius: 1, cursor: 'pointer',
                    border: '2px solid',
                    borderColor: fontFamily === key ? 'primary.main' : 'divider',
                    backgroundColor: fontFamily === key
                      ? (effectiveMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'primary.50')
                      : 'transparent',
                    '&:hover': { borderColor: 'primary.light' },
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={fontFamily === key ? 600 : 400}
                    sx={{ fontFamily: FONT_FAMILIES[key].value }}
                  >
                    {FONT_FAMILIES[key].label}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Section color picker */}
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
              Section Colors
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontSize: '0.65rem' }}>
              Sidebar & header color scheme
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {(Object.keys(sectionPresets) as SectionColorKey[]).map((key) => {
                const preset = sectionPresets[key]
                const sidebarBg = preset.sidebar.bg || theme.palette.primary.main
                const headerBg = preset.header.bg || theme.palette.primary.dark
                return (
                  <Box
                    key={key}
                    onClick={() => setSectionColor(key)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      px: 1.5, py: 0.7, borderRadius: 1, cursor: 'pointer',
                      border: '2px solid',
                      borderColor: sectionColor === key ? 'primary.main' : 'divider',
                      backgroundColor: sectionColor === key
                        ? (effectiveMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'primary.50')
                        : 'transparent',
                      '&:hover': { borderColor: 'primary.light' },
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Color preview swatches */}
                    <Box sx={{ display: 'flex', gap: 0.3, flexShrink: 0 }}>
                      <Box sx={{ width: 16, height: 16, borderRadius: 0.5, backgroundColor: headerBg, border: '1px solid rgba(128,128,128,0.3)' }} />
                      <Box sx={{ width: 16, height: 16, borderRadius: 0.5, backgroundColor: sidebarBg, border: '1px solid rgba(128,128,128,0.3)' }} />
                    </Box>
                    <Typography variant="body2" fontWeight={sectionColor === key ? 600 : 400}>
                      {preset.label}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          </Popover>

          {/* User menu */}
          {user && (
            <>
              <Typography variant="body2" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
                {user.username}
              </Typography>
              <IconButton color="inherit" onClick={(e) => setUserMenuAnchor(e.currentTarget)}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light', fontSize: '0.875rem' }}>
                  {user.username.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
              <Menu anchorEl={userMenuAnchor} open={Boolean(userMenuAnchor)}
                onClose={() => setUserMenuAnchor(null)}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
                <MenuItem onClick={() => { setUserMenuAnchor(null); navigate('/profile') }}>
                  <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                  Profile
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { setUserMenuAnchor(null); logout() }}>
                  <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                  Logout
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              ...(activeSectionPreset.sidebar.bg ? {
                backgroundColor: activeSectionPreset.sidebar.bg,
                color: activeSectionPreset.sidebar.text,
              } : {}),
            },
          }}
        >
          {drawerContent}
        </Drawer>

        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width:      DRAWER_WIDTH,
              boxSizing:  'border-box',
              borderRight: `1px solid ${theme.palette.divider}`,
              ...(activeSectionPreset.sidebar.bg ? {
                backgroundColor: activeSectionPreset.sidebar.bg,
                color: activeSectionPreset.sidebar.text,
              } : {}),
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* ── Main content ───────────────────────────────────────────── */}
      <Box
        component="main"
        sx={{
          flexGrow:        1,
          p:               3,
          mt:              '64px',
          width:           { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          backgroundColor: 'background.default',
          minHeight:       'calc(100vh - 64px)',
        }}
      >
        <BreadcrumbProvider>
          <AppBreadcrumbs />
          <Outlet />
        </BreadcrumbProvider>
      </Box>
    </Box>
  )
}
