import React, { useMemo, useSyncExternalStore } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import AppRoutes from './routes'
import { getTheme } from './theme'
import { useThemeStore, resolveMode, FONT_FAMILIES } from './store/themeStore'
import { initTelemetry, ErrorBoundaryTracer } from './telemetry'
import './index.css'

// ── Initialise OpenTelemetry before React renders ──────────────────────────
initTelemetry()

/**
 * Subscribe to OS-level color scheme changes so that "system" mode
 * reacts immediately when the user toggles their OS dark mode.
 */
function useSystemDarkMode(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', callback)
      return () => mq.removeEventListener('change', callback)
    },
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
}

function App() {
  const { mode, accent, fontFamily } = useThemeStore()

  // Force re-compute when OS preference changes (only matters when mode === 'system')
  useSystemDarkMode()

  const effectiveMode = resolveMode(mode)

  const theme = useMemo(
    () => getTheme(effectiveMode, accent, { fontFamily: FONT_FAMILIES[fontFamily]?.value }),
    [effectiveMode, accent, fontFamily],
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppRoutes />
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundaryTracer>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundaryTracer>
  </React.StrictMode>,
)
