import { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Collapse,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import type { SpanDetail, LogEntry } from '@/types'
import {
  diagnoseErrors,
  type ErrorDiagnosisResponse,
  type ErrorFixSuggestion,
  type ErrorSpanInput,
} from '@/services/aiService'

interface Props {
  traceId: string
  spans: SpanDetail[]
  traceLogs: LogEntry[]
}

function severityColor(s: string): 'error' | 'warning' | 'info' | 'default' {
  if (s === 'CRITICAL') return 'error'
  if (s === 'WARNING') return 'warning'
  if (s === 'INFO') return 'info'
  return 'default'
}

function SuggestionCard({ suggestion }: { suggestion: ErrorFixSuggestion }) {
  const [expanded, setExpanded] = useState(true)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        borderLeft: '4px solid',
        borderLeftColor: suggestion.severity === 'CRITICAL' ? 'error.main'
          : suggestion.severity === 'WARNING' ? 'warning.main' : 'info.main',
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setExpanded((p) => !p)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <IconButton size="small" sx={{ p: 0 }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
        <Chip
          label={suggestion.severity}
          size="small"
          color={severityColor(suggestion.severity)}
          sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
        />
        <Chip
          label={suggestion.errorType}
          size="small"
          variant="outlined"
          sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem', height: 20 }}
        />
        <Typography variant="body2" fontWeight={600} noWrap sx={{ flexGrow: 1 }}>
          {suggestion.serviceName}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}
        >
          {suggestion.spanId ? `${suggestion.spanId.substring(0, 12)}...` : ''}
        </Typography>
      </Box>

      {/* Body */}
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          {/* Diagnosis */}
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Diagnosis
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
            {suggestion.diagnosis}
          </Typography>

          {/* Suggested Fix */}
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Suggested Fix
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
            {suggestion.suggestedFix}
          </Typography>

          {/* Code Snippet */}
          {suggestion.codeSnippet && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Code Example
                </Typography>
                <Tooltip title="Copy code">
                  <IconButton size="small" onClick={() => handleCopy(suggestion.codeSnippet)}>
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                sx={{
                  p: 1.5,
                  mb: 2,
                  borderRadius: 1,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.900',
                  color: 'grey.100',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.78rem',
                  lineHeight: 1.5,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {suggestion.codeSnippet}
              </Box>
            </>
          )}

          {/* References */}
          {suggestion.references.length > 0 && (
            <>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                References
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {suggestion.references.map((ref, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <OpenInNewIcon sx={{ fontSize: 12, color: 'primary.main' }} />
                    <Typography
                      variant="caption"
                      component="a"
                      href={ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'none',
                        wordBreak: 'break-all',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {ref}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  )
}

export default function AiSuggestionsPanel({ traceId, spans, traceLogs }: Props) {
  const [result, setResult] = useState<ErrorDiagnosisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errorSpans = spans.filter((s) => s.hasError)

  const handleDiagnose = useCallback(async () => {
    if (errorSpans.length === 0) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const errorSpanInputs: ErrorSpanInput[] = errorSpans.map((s) => {
        // Collect error log messages from span logs
        const errorLogs: string[] = s.logs
          .map((log) => {
            const entries = Object.entries(log.fields)
            return entries.map(([k, v]) => `${k}: ${v}`).join(', ')
          })
          .filter(Boolean)

        return {
          spanId: s.spanId,
          serviceName: s.serviceName,
          operation: s.operationName,
          durationMicros: s.durationMicros,
          httpMethod: s.httpMethod || undefined,
          httpUrl: s.httpUrl || undefined,
          httpStatusCode: s.httpStatusCode || undefined,
          tags: s.tags,
          errorLogs,
        }
      })

      // Gather associated log messages from ES
      const associatedLogs = traceLogs
        .filter((l) => l.severity === 'ERROR' || l.severity === 'FATAL' || l.severity === 'WARN')
        .slice(0, 30)
        .map((l) => `[${l.severity}] ${l.serviceName || ''}: ${l.body || ''}`)

      const response = await diagnoseErrors({
        traceId,
        errorSpans: errorSpanInputs,
        associatedLogs,
        languageHint: 'java',
      })

      setResult(response)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to diagnose errors'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [traceId, errorSpans, traceLogs])

  if (errorSpans.length === 0) return null

  return (
    <Paper variant="outlined" sx={{ mt: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderBottom: result || loading ? '1px solid' : 'none',
          borderColor: 'divider',
        }}
      >
        <AutoFixHighIcon color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            AI Error Diagnosis
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {errorSpans.length} error span{errorSpans.length !== 1 ? 's' : ''} detected
          </Typography>
        </Box>

        {result && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
            <Chip
              label={`${(result.confidence * 100).toFixed(0)}% confidence`}
              size="small"
              color={result.confidence >= 0.7 ? 'success' : result.confidence >= 0.4 ? 'warning' : 'default'}
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
            <Typography variant="caption" color="text.secondary">
              {result.executionTimeMs ? `${(result.executionTimeMs / 1000).toFixed(1)}s` : ''}
            </Typography>
          </Box>
        )}

        <Button
          variant={result ? 'outlined' : 'contained'}
          size="small"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
          onClick={handleDiagnose}
          disabled={loading}
        >
          {loading ? 'Analyzing...' : result ? 'Re-analyze' : 'Diagnose Errors'}
        </Button>
      </Box>

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mx: 2, my: 1.5 }}>
          {error}
        </Alert>
      )}

      {/* Results */}
      {result && (
        <Box sx={{ p: 2 }}>
          {/* Summary */}
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              mb: 2,
              bgcolor: 'primary.50',
              borderColor: 'primary.200',
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              {result.summary}
            </Typography>
            {result.llmModel && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Model: {result.llmModel}
              </Typography>
            )}
          </Paper>

          {/* Suggestion cards */}
          {result.suggestions.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {result.suggestions.map((s, i) => (
                <SuggestionCard key={`${s.spanId}-${i}`} suggestion={s} />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No specific fix suggestions returned.
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  )
}
