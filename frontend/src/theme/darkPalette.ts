import type { PaletteOptions } from '@mui/material'
import type { AccentColors } from './accents'

/**
 * Dark-mode palette for the Observability Platform.
 * Accepts an accent color to use as primary.
 */
export function getDarkPalette(accent: AccentColors): PaletteOptions {
  return {
    mode: 'dark',

    primary: {
      main:         accent.main,
      light:        accent.light,
      dark:         accent.dark,
      contrastText: accent.contrastText,
    },

    secondary: {
      main:         '#ce93d8',
      light:        '#e1bee7',
      dark:         '#ab47bc',
      contrastText: '#000000',
    },

    error: {
      main:  '#f44336',
      light: '#e57373',
      dark:  '#d32f2f',
    },

    warning: {
      main:  '#ffa726',
      light: '#ffb74d',
      dark:  '#f57c00',
    },

    info: {
      main:  '#29b6f6',
      light: '#4fc3f7',
      dark:  '#0288d1',
    },

    success: {
      main:  '#66bb6a',
      light: '#81c784',
      dark:  '#388e3c',
    },

    background: {
      default: '#0a0e14',
      paper:   '#131920',
    },

    text: {
      primary:   'rgba(255, 255, 255, 0.92)',
      secondary: 'rgba(255, 255, 255, 0.60)',
      disabled:  'rgba(255, 255, 255, 0.38)',
    },

    divider: 'rgba(255, 255, 255, 0.10)',
  }
}
