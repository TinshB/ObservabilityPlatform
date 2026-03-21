import { createTheme, responsiveFontSizes } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { getLightPalette } from './palette'
import { getDarkPalette } from './darkPalette'
import { ACCENTS } from './accents'
import type { AccentKey } from './accents'

export interface ThemeOptions {
  fontFamily?: string
}

/**
 * Build a fully-configured MUI theme for the given mode, accent, and options.
 */
export function getTheme(mode: 'light' | 'dark', accent: AccentKey, options?: ThemeOptions): Theme {
  const accentColors = ACCENTS[accent]
  const palette = mode === 'dark'
    ? getDarkPalette(accentColors)
    : getLightPalette(accentColors)

  const isDark = mode === 'dark'
  const fontFamily = options?.fontFamily || 'Inter, Roboto, Helvetica, Arial, sans-serif'

  const baseTheme = createTheme({
    palette,

    typography: {
      fontFamily,
      h1: { fontSize: '2.125rem', fontWeight: 700, lineHeight: 1.2 },
      h2: { fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.25 },
      h3: { fontSize: '1.5rem',   fontWeight: 600, lineHeight: 1.3 },
      h4: { fontSize: '1.25rem',  fontWeight: 600, lineHeight: 1.35 },
      h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
      h6: { fontSize: '1rem',     fontWeight: 600, lineHeight: 1.5 },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 500 },
      body2: { fontSize: '0.875rem' },
      caption: {
        fontSize:   '0.75rem',
        fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
      },
    },

    shape: { borderRadius: 8 },

    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600 },
        },
        defaultProps: {
          disableElevation: true,
        },
      },

      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)'
              : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
            border: isDark
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid rgba(0,0,0,0.06)',
          },
        },
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          outlined: {
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
          },
        },
      },

      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#131920' : '#f5f7fa',
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            fontSize: '0.8125rem',
            color: isDark ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.60)',
            // Sticky header — cells need their own background so content
            // doesn't bleed through when the table scrolls.
            position: 'sticky' as const,
            top: 0,
            zIndex: 2,
            backgroundColor: isDark ? '#131920' : '#f5f7fa',
          },
        },
      },

      MuiTableBody: {
        styleOverrides: {
          root: {
            // Alternating row backgrounds (striped)
            '& .MuiTableRow-root:nth-of-type(odd)': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            },
            // Subtle hover highlighting (overrides stripe on hover)
            '& .MuiTableRow-root:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500 },
        },
      },

      MuiTooltip: {
        defaultProps: { arrow: true },
      },

      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? '#0a0e14' : '#f5f7fa',
          },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: isDark
            ? { backgroundColor: '#131920', borderColor: 'rgba(255,255,255,0.08)' }
            : {},
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: isDark
            ? { backgroundColor: '#0d1117 !important' }
            : {},
        },
      },
    },
  })

  return responsiveFontSizes(baseTheme)
}

// Default export kept for backwards-compat (Storybook etc.)
const theme = getTheme('light', 'blue')
export default theme
