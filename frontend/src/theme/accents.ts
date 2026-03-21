/**
 * Accent color presets for the Observability Platform.
 * Each accent defines a primary color scale used by MUI's palette.
 */

export type AccentKey = 'blue' | 'teal' | 'indigo' | 'amber' | 'rose' | 'green' | 'purple' | 'cyan'

export interface AccentColors {
  main:         string
  light:        string
  dark:         string
  contrastText: string
}

export const ACCENTS: Record<AccentKey, AccentColors> = {
  blue: {
    main:         '#1976d2',
    light:        '#42a5f5',
    dark:         '#1565c0',
    contrastText: '#ffffff',
  },
  teal: {
    main:         '#00897b',
    light:        '#4db6ac',
    dark:         '#00695c',
    contrastText: '#ffffff',
  },
  indigo: {
    main:         '#3949ab',
    light:        '#5c6bc0',
    dark:         '#283593',
    contrastText: '#ffffff',
  },
  amber: {
    main:         '#ff8f00',
    light:        '#ffb300',
    dark:         '#ff6f00',
    contrastText: '#000000',
  },
  rose: {
    main:         '#e91e63',
    light:        '#f06292',
    dark:         '#c2185b',
    contrastText: '#ffffff',
  },
  green: {
    main:         '#2e7d32',
    light:        '#66bb6a',
    dark:         '#1b5e20',
    contrastText: '#ffffff',
  },
  purple: {
    main:         '#7b1fa2',
    light:        '#ba68c8',
    dark:         '#6a1b9a',
    contrastText: '#ffffff',
  },
  cyan: {
    main:         '#0097a7',
    light:        '#4dd0e1',
    dark:         '#00838f',
    contrastText: '#ffffff',
  },
}

/** Human-readable labels for the accent picker UI. */
export const ACCENT_LABELS: Record<AccentKey, string> = {
  blue:   'Blue',
  teal:   'Teal',
  indigo: 'Indigo',
  amber:  'Amber',
  rose:   'Rose',
  green:  'Green',
  purple: 'Purple',
  cyan:   'Cyan',
}
