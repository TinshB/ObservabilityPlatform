import React from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'

interface LoadingSpinnerProps {
  /** When true, the spinner covers the entire viewport with a fixed overlay. */
  fullScreen?: boolean
  /** Optional descriptive text rendered beneath the spinner. */
  message?: string
  /** CircularProgress size in pixels. Defaults to 40. */
  size?: number
}

/**
 * Platform-wide loading indicator.
 *
 * Usage:
 * ```tsx
 * // Route-level suspense fallback
 * <Suspense fallback={<LoadingSpinner fullScreen message="Loading…" />}>
 *
 * // Inline within a card or panel
 * {loading && <LoadingSpinner message="Fetching metrics…" />}
 * ```
 */
export default function LoadingSpinner({
  fullScreen = false,
  message,
  size = 40,
}: LoadingSpinnerProps) {
  return (
    <Box
      role="status"
      aria-label={message ?? 'Loading'}
      sx={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            2,
        ...(fullScreen
          ? {
              position:        'fixed',
              inset:           0,
              backgroundColor: 'background.default',
              zIndex:          9999,
            }
          : { p: 4 }),
      }}
    >
      <CircularProgress size={size} aria-hidden="true" />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  )
}
