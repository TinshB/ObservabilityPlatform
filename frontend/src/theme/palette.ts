import type { PaletteOptions } from '@mui/material'
import type { AccentColors } from './accents'

/**
 * Light-mode palette for the Observability Platform.
 * Accepts an accent color to use as primary.
 *
 * Design intent:
 * - Primary accent — navigation, CTAs, active states
 * - Neutral backgrounds (#f5f7fa / #ffffff) — maximise data density readability
 * - Semantic alert colours mirror industry conventions (red=critical, amber=warning, green=ok)
 */
export function getLightPalette(accent: AccentColors): PaletteOptions {
  return {
    mode: 'light',

    primary: {
      main:         accent.main,
      light:        accent.light,
      dark:         accent.dark,
      contrastText: accent.contrastText,
    },

    secondary: {
      main:         '#7b1fa2',
      light:        '#ba68c8',
      dark:         '#6a1b9a',
      contrastText: '#ffffff',
    },

    error: {
      main:  '#d32f2f',
      light: '#ef5350',
      dark:  '#c62828',
    },

    warning: {
      main:  '#ed6c02',
      light: '#ff9800',
      dark:  '#e65100',
    },

    info: {
      main:  '#0288d1',
      light: '#03a9f4',
      dark:  '#01579b',
    },

    success: {
      main:  '#2e7d32',
      light: '#4caf50',
      dark:  '#1b5e20',
    },

    background: {
      default: '#f5f7fa',
      paper:   '#ffffff',
    },

    text: {
      primary:   'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.60)',
      disabled:  'rgba(0, 0, 0, 0.38)',
    },

    divider: 'rgba(0, 0, 0, 0.08)',
  }
}
