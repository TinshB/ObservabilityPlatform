import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AccentKey } from '@/theme/accents'

// ─────────────────────────────────────────────────────────────────────────────
// Theme store
// Manages theme mode, accent color, font family, and section colors.
// Persisted to localStorage so the choice survives page refreshes.
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system'

export type FontFamilyKey = 'inter' | 'roboto' | 'poppins' | 'nunito' | 'sourceCodePro' | 'system'

export const FONT_FAMILIES: Record<FontFamilyKey, { label: string; value: string }> = {
  inter:         { label: 'Inter',           value: 'Inter, Roboto, Helvetica, Arial, sans-serif' },
  roboto:        { label: 'Roboto',          value: 'Roboto, Helvetica, Arial, sans-serif' },
  poppins:       { label: 'Poppins',         value: 'Poppins, Roboto, Helvetica, Arial, sans-serif' },
  nunito:        { label: 'Nunito',          value: 'Nunito, Roboto, Helvetica, Arial, sans-serif' },
  sourceCodePro: { label: 'Source Code Pro', value: 'Source Code Pro, JetBrains Mono, Consolas, monospace' },
  system:        { label: 'System Default',  value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
}

export type SectionColorKey = 'default' | 'dark' | 'primary' | 'neutral' | 'charcoal'

export interface SectionColorPreset {
  label: string
  sidebar: { bg: string; text: string }
  header:  { bg: string; text: string }
}

export const SECTION_COLORS_LIGHT: Record<SectionColorKey, SectionColorPreset> = {
  default:  { label: 'Default',   sidebar: { bg: '#ffffff', text: 'rgba(0,0,0,0.87)' },   header: { bg: '', text: '#ffffff' } },
  dark:     { label: 'Dark',      sidebar: { bg: '#1e1e2f', text: '#ffffff' },              header: { bg: '#1a1a2e', text: '#ffffff' } },
  primary:  { label: 'Primary',   sidebar: { bg: '', text: '#ffffff' },                     header: { bg: '', text: '#ffffff' } },
  neutral:  { label: 'Neutral',   sidebar: { bg: '#f0f2f5', text: 'rgba(0,0,0,0.87)' },   header: { bg: '#37474f', text: '#ffffff' } },
  charcoal: { label: 'Charcoal',  sidebar: { bg: '#263238', text: '#eceff1' },              header: { bg: '#1b2631', text: '#ffffff' } },
}

export const SECTION_COLORS_DARK: Record<SectionColorKey, SectionColorPreset> = {
  default:  { label: 'Default',   sidebar: { bg: '#131920', text: 'rgba(255,255,255,0.92)' }, header: { bg: '', text: '#ffffff' } },
  dark:     { label: 'Darker',    sidebar: { bg: '#0a0a0a', text: 'rgba(255,255,255,0.92)' }, header: { bg: '#050505', text: '#ffffff' } },
  primary:  { label: 'Primary',   sidebar: { bg: '', text: '#ffffff' },                       header: { bg: '', text: '#ffffff' } },
  neutral:  { label: 'Neutral',   sidebar: { bg: '#1a1a2e', text: 'rgba(255,255,255,0.92)' }, header: { bg: '#16213e', text: '#ffffff' } },
  charcoal: { label: 'Midnight',  sidebar: { bg: '#0d1117', text: '#c9d1d9' },                header: { bg: '#161b22', text: '#ffffff' } },
}

interface ThemeState {
  mode:         ThemeMode
  accent:       AccentKey
  fontFamily:   FontFamilyKey
  sectionColor: SectionColorKey

  setMode:         (mode: ThemeMode) => void
  setAccent:       (accent: AccentKey) => void
  setFontFamily:   (fontFamily: FontFamilyKey) => void
  setSectionColor: (sectionColor: SectionColorKey) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode:         'system',
      accent:       'blue',
      fontFamily:   'inter',
      sectionColor: 'default',

      setMode:         (mode)         => set({ mode }),
      setAccent:       (accent)       => set({ accent }),
      setFontFamily:   (fontFamily)   => set({ fontFamily }),
      setSectionColor: (sectionColor) => set({ sectionColor }),
    }),
    { name: 'obs-theme' },
  ),
)

/**
 * Resolve the effective mode ('light' | 'dark') from the stored preference.
 * When 'system', reads the OS media query.
 */
export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}
