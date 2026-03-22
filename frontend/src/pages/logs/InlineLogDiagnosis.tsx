import { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import type { LogEntry } from '@/types'
import {
  diagnoseErrors,
  type ErrorDiagnosisResponse,
} from '@/services/aiService'

interface Props {
  entry: LogEntry
}

export default function InlineLogDiagnosis({ entry }: Props) {
  const [result, setResult] = useState<ErrorDiagnosisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDiagnose = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await diagnoseErrors({
        traceId: entry.traceId || 'log-diagnosis',
        errorSpans: [{
          spanId: entry.spanId || '',
          serviceName: entry.serviceName || 'unknown',
          operation: 'error log',
          durationMicros: 0,
          errorLogs: [`[${entry.severity}] ${entry.body || ''}`],
        }],
        associatedLogs: [],
        languageHint: 'java',
      })
      setResult(response)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Diagnosis failed')
    } finally {
      setLoading(false)
    }
  }, [entry])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Divider sx={{ mb: 1.5 }} />

      {!result && !loading && !error && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<AutoFixHighIcon />}
          onClick={(e) => { e.stopPropagation(); handleDiagnose() }}
          sx={{ textTransform: 'none' }}
        >
          AI Diagnose
        </Button>
      )}

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">Analyzing error...</Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ fontSize: '0.8rem' }}>
          {error}
        </Alert>
      )}

      {result && (
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AutoFixHighIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography variant="caption" fontWeight={700} color="primary.main">
              AI Diagnosis
            </Typography>
            {result.confidence > 0 && (
              <Chip
                label={`${(result.confidence * 100).toFixed(0)}%`}
                size="small"
                color={result.confidence >= 0.7 ? 'success' : result.confidence >= 0.4 ? 'warning' : 'default'}
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 18 }}
              />
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button
              size="small"
              variant="text"
              onClick={(e) => { e.stopPropagation(); handleDiagnose() }}
              disabled={loading}
              sx={{ fontSize: '0.7rem', minWidth: 0, px: 1 }}
            >
              Re-analyze
            </Button>
          </Box>

          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
            {result.summary}
          </Typography>

          {result.suggestions.map((s, i) => (
            <Box key={i} sx={{ mb: i < result.suggestions.length - 1 ? 1.5 : 0 }}>
              <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                <Chip
                  label={s.severity}
                  size="small"
                  color={s.severity === 'CRITICAL' ? 'error' : s.severity === 'WARNING' ? 'warning' : 'info'}
                  sx={{ fontSize: '0.65rem', height: 18, fontWeight: 600 }}
                />
                <Chip
                  label={s.errorType}
                  size="small"
                  variant="outlined"
                  sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.65rem', height: 18 }}
                />
              </Box>

              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Diagnosis
              </Typography>
              <Typography variant="body2" fontSize="0.8rem" sx={{ mb: 0.5 }}>
                {s.diagnosis}
              </Typography>

              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block' }}>
                Suggested Fix
              </Typography>
              <Typography variant="body2" fontSize="0.8rem" sx={{ mb: 0.5 }}>
                {s.suggestedFix}
              </Typography>

              {s.codeSnippet && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                      Code Example
                    </Typography>
                    <Tooltip title="Copy code">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleCopy(s.codeSnippet) }}>
                        <ContentCopyIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box
                    sx={{
                      p: 1,
                      mb: 0.5,
                      borderRadius: 1,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.900',
                      color: 'grey.100',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.75rem',
                      lineHeight: 1.4,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 150,
                    }}
                  >
                    {s.codeSnippet}
                  </Box>
                </>
              )}

              {s.references.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, mt: 0.5 }}>
                  {s.references.map((ref, ri) => (
                    <Box key={ri} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <OpenInNewIcon sx={{ fontSize: 11, color: 'primary.main' }} />
                      <Typography
                        variant="caption"
                        component="a"
                        href={ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        sx={{ color: 'primary.main', textDecoration: 'none', fontSize: '0.7rem', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {ref}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ))}

          {result.llmModel && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: '0.65rem' }}>
              Model: {result.llmModel}
            </Typography>
          )}
        </Paper>
      )}
    </Box>
  )
}
