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
import type { LogEntry } from '@/types'
import {
  diagnoseErrors,
  type ErrorDiagnosisResponse,
  type ErrorFixSuggestion,
  type ErrorSpanInput,
} from '@/services/aiService'

interface Props {
  entries: LogEntry[]
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
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Diagnosis
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
            {suggestion.diagnosis}
          </Typography>

          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Suggested Fix
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
            {suggestion.suggestedFix}
          </Typography>

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

export default function LogDiagnosisPanel({ entries }: Props) {
  const [result, setResult] = useState<ErrorDiagnosisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errorLogs = entries.filter((e) => e.severity === 'ERROR' || e.severity === 'FATAL')

  const handleDiagnose = useCallback(async () => {
    if (errorLogs.length === 0) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Group error logs by service and build pseudo error spans
      const byService = new Map<string, LogEntry[]>()
      for (const log of errorLogs) {
        const svc = log.serviceName || 'unknown'
        if (!byService.has(svc)) byService.set(svc, [])
        byService.get(svc)!.push(log)
      }

      const errorSpans: ErrorSpanInput[] = Array.from(byService.entries()).map(([svc, logs]) => ({
        spanId: logs[0]?.spanId || '',
        serviceName: svc,
        operation: `${logs.length} error log(s)`,
        durationMicros: 0,
        errorLogs: logs.slice(0, 20).map((l) => `[${l.severity}] ${l.body || ''}`),
      }))

      const associatedLogs = entries
        .filter((l) => l.severity === 'WARN')
        .slice(0, 20)
        .map((l) => `[WARN] ${l.serviceName || ''}: ${l.body || ''}`)

      const traceId = errorLogs.find((l) => l.traceId)?.traceId || 'log-diagnosis'

      const response = await diagnoseErrors({
        traceId,
        errorSpans,
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
  }, [entries, errorLogs])

  if (errorLogs.length === 0) return null

  return (
    <Paper variant="outlined" sx={{ mt: 2 }}>
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
            AI Log Diagnosis
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {errorLogs.length} error log{errorLogs.length !== 1 ? 's' : ''} in current results
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

      {error && (
        <Alert severity="error" sx={{ mx: 2, my: 1.5 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Box sx={{ p: 2 }}>
          <Paper
            variant="outlined"
            sx={{ p: 1.5, mb: 2, bgcolor: 'primary.50', borderColor: 'primary.200' }}
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
