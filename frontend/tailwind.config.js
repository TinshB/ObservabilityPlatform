/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  // Let MUI's ThemeProvider control dark mode via class on <html>.
  darkMode: 'class',

  // Disable Tailwind's CSS reset (preflight) to prevent conflicts with MUI's CssBaseline.
  // MUI manages its own baseline styles; running both resets causes visual regressions.
  corePlugins: {
    preflight: false,
  },

  // Scope Tailwind utilities under #root so they win over MUI defaults when both apply.
  important: '#root',

  theme: {
    extend: {
      colors: {
        // Mirror MUI primary palette for use in Tailwind utilities (e.g., bg-primary-700)
        primary: {
          50:  '#e3f2fd',
          100: '#bbdefb',
          200: '#90caf9',
          300: '#64b5f6',
          400: '#42a5f5',
          500: '#2196f3',
          600: '#1e88e5',
          700: '#1976d2',
          800: '#1565c0',
          900: '#0d47a1',
        },
        // Semantic status colours used across metric/alert UI
        success: '#2e7d32',
        warning: '#ed6c02',
        error:   '#d32f2f',
        info:    '#0288d1',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      spacing: {
        // Common sidebar width
        sidebar: '240px',
        // Top app-bar height
        appbar: '64px',
      },
    },
  },
  plugins: [],
}
