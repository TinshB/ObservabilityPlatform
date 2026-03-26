import { useEffect, useState, useCallback } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Typography, Box, IconButton, Divider, Switch,
  FormControlLabel, Tooltip, Alert, CircularProgress, Chip, Stack,
  Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import AddIcon from '@mui/icons-material/Add'
import InfoIcon from '@mui/icons-material/Info'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useNavigate } from 'react-router-dom'
import {
  getSlaSuggestions,
  convertToWorkflow,
  type FlowPattern,
  type SlaSuggestion,
  type ConvertToWorkflowRequest,
} from '@/services/flowAnalysisService'

interface StepRow {
  stepOrder: number
  serviceName: string
  httpMethod: string
  pathPattern: string
  label: string
}

interface Props {
  open: boolean
  onClose: () => void
  pattern: FlowPattern
  analysisId: string
}

export default function ConvertToWorkflowDialog({ open, onClose, pattern, analysisId }: Props) {
  const navigate = useNavigate()

  // Form state
  const [workflowName, setWorkflowName] = useState('')
  const [description, setDescription] = useState('')
  const [ownerTeam, setOwnerTeam] = useState('')
  const [steps, setSteps] = useState<StepRow[]>([])

  // SLA
  const [slaSuggestion, setSlaSuggestion] = useState<SlaSuggestion | null>(null)
  const [maxDurationMs, setMaxDurationMs] = useState<number>(1000)
  const [maxErrorRatePct, setMaxErrorRatePct] = useState<number>(3.0)
  const [slaEnabled, setSlaEnabled] = useState(true)

  // Monitoring
  const [enableMonitoring, setEnableMonitoring] = useState(true)

  // State
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdWorkflowId, setCreatedWorkflowId] = useState<string | null>(null)

  // ── Initialize from pattern ────────────────────────────────────────────
  useEffect(() => {
    if (!pattern) return

    // Auto-generate name
    const servicePath = pattern.steps.map((s) => s.serviceName).join(' -> ')
    setWorkflowName(servicePath.length > 200 ? servicePath.substring(0, 200) : servicePath)
    setDescription(`AI-generated from ${pattern.frequency} traces. Avg latency: ${Math.round(pattern.avgLatencyMs)}ms.`)

    // Populate steps
    setSteps(pattern.steps.map((s) => ({
      stepOrder: s.order,
      serviceName: s.serviceName,
      httpMethod: s.method || 'GET',
      pathPattern: s.path || '/',
      label: `${s.method || 'GET'} ${s.path || '/'}`,
    })))

    // Fetch SLA suggestions
    getSlaSuggestions(analysisId, pattern.patternId)
      .then((sla) => {
        setSlaSuggestion(sla)
        setMaxDurationMs(sla.suggestedMaxDurationMs)
        setMaxErrorRatePct(sla.suggestedMaxErrorRatePct)
      })
      .catch(() => {
        // Use defaults if suggestion fails
        const p95 = pattern.p95LatencyMs || pattern.avgLatencyMs
        setMaxDurationMs(Math.ceil(p95 / 100) * 100)
        setMaxErrorRatePct(Math.min(10, pattern.errorRate * 100 + 1))
      })

    // Reset state
    setSuccess(false)
    setError(null)
    setCreatedWorkflowId(null)
  }, [pattern, analysisId])

  // ── Step editing ───────────────────────────────────────────────────────
  const updateStep = (index: number, field: keyof StepRow, value: string | number) => {
    setSteps((prev) => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s,
    ))
  }

  const removeStep = (index: number) => {
    setSteps((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      return updated.map((s, i) => ({ ...s, stepOrder: i + 1 }))
    })
  }

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        stepOrder: prev.length + 1,
        serviceName: '',
        httpMethod: 'GET',
        pathPattern: '/',
        label: 'New Step',
      },
    ])
  }

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!workflowName.trim()) {
      setError('Workflow name is required')
      return
    }
    if (steps.length === 0) {
      setError('At least one step is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const request: ConvertToWorkflowRequest = {
        workflowName: workflowName.trim(),
        description: description.trim() || undefined,
        ownerTeam: ownerTeam.trim() || undefined,
        sla: slaEnabled ? { maxDurationMs, maxErrorRatePct } : undefined,
        steps: steps.map((s) => ({
          stepOrder: s.stepOrder,
          serviceName: s.serviceName,
          httpMethod: s.httpMethod,
          pathPattern: s.pathPattern,
          label: s.label,
        })),
        enableMonitoring,
      }

      const result = await convertToWorkflow(analysisId, pattern.patternId, request)
      setCreatedWorkflowId(result.workflowId)
      setSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create workflow'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }, [workflowName, description, ownerTeam, steps, slaEnabled, maxDurationMs, maxErrorRatePct, enableMonitoring, analysisId, pattern])

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={600}>
          {success ? 'Workflow Created' : 'Convert to Monitored Workflow'}
        </Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {success ? (
          /* ── Success view ─────────────────────────────────────────────── */
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>Workflow created successfully!</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {steps.length} steps created. {enableMonitoring ? 'Monitoring is active.' : 'Monitoring is deferred.'}
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={() => navigate(`/workflows/${createdWorkflowId}/dashboard`)}
              >
                View Dashboard
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate(`/workflows/${createdWorkflowId}`)}
              >
                Edit Workflow
              </Button>
              <Button variant="text" onClick={onClose}>
                Close
              </Button>
            </Stack>
          </Box>
        ) : (
          /* ── Form view ────────────────────────────────────────────────── */
          <Box>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Workflow basics */}
            <Stack spacing={2} sx={{ mb: 3 }}>
              <TextField
                label="Workflow Name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                fullWidth
                required
                size="small"
              />
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={2}
                size="small"
              />
              <TextField
                label="Owner Team"
                value={ownerTeam}
                onChange={(e) => setOwnerTeam(e.target.value)}
                size="small"
                sx={{ maxWidth: 300 }}
              />
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Steps */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                Workflow Steps ({steps.length})
              </Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addStep}>
                Add Step
              </Button>
            </Box>

            <Table size="small" sx={{ mb: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell width={40}>#</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell width={90}>Method</TableCell>
                  <TableCell>Path Pattern</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell width={40} />
                </TableRow>
              </TableHead>
              <TableBody>
                {steps.map((step, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.secondary', cursor: 'grab' }} />
                      {step.stepOrder}
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={step.serviceName}
                        onChange={(e) => updateStep(i, 'serviceName', e.target.value)}
                        size="small"
                        variant="standard"
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        value={step.httpMethod}
                        onChange={(e) => updateStep(i, 'httpMethod', e.target.value)}
                        size="small"
                        variant="standard"
                        fullWidth
                        SelectProps={{ native: true }}
                      >
                        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={step.pathPattern}
                        onChange={(e) => updateStep(i, 'pathPattern', e.target.value)}
                        size="small"
                        variant="standard"
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={step.label}
                        onChange={(e) => updateStep(i, 'label', e.target.value)}
                        size="small"
                        variant="standard"
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => removeStep(i)} disabled={steps.length <= 1}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Divider sx={{ my: 2 }} />

            {/* SLA thresholds */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                SLA Thresholds
              </Typography>
              <FormControlLabel
                control={<Switch checked={slaEnabled} onChange={(e) => setSlaEnabled(e.target.checked)} size="small" />}
                label=""
              />
              {slaSuggestion && (
                <Tooltip title={`Suggested based on ${slaSuggestion.basedOn.tracesAnalyzed} traces. P50: ${Math.round(slaSuggestion.basedOn.latencyStats.p50Ms)}ms, P95: ${Math.round(slaSuggestion.basedOn.latencyStats.p95Ms)}ms, P99: ${Math.round(slaSuggestion.basedOn.latencyStats.p99Ms)}ms, Error Rate: ${(slaSuggestion.basedOn.observedErrorRate * 100).toFixed(1)}%`}>
                  <Chip icon={<InfoIcon />} label="AI-Suggested" size="small" color="info" variant="outlined" />
                </Tooltip>
              )}
            </Box>

            {slaEnabled && (
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="Max Duration (ms)"
                  type="number"
                  value={maxDurationMs}
                  onChange={(e) => setMaxDurationMs(Number(e.target.value))}
                  size="small"
                  sx={{ width: 180 }}
                  helperText={slaSuggestion ? `P95: ${Math.round(slaSuggestion.basedOn.latencyStats.p95Ms)}ms` : ''}
                />
                <TextField
                  label="Max Error Rate (%)"
                  type="number"
                  value={maxErrorRatePct}
                  onChange={(e) => setMaxErrorRatePct(Number(e.target.value))}
                  size="small"
                  sx={{ width: 180 }}
                  inputProps={{ step: 0.1, min: 0, max: 100 }}
                  helperText={slaSuggestion ? `Observed: ${(slaSuggestion.basedOn.observedErrorRate * 100).toFixed(1)}%` : ''}
                />
              </Stack>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Monitoring */}
            <FormControlLabel
              control={
                <Switch
                  checked={enableMonitoring}
                  onChange={(e) => setEnableMonitoring(e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Enable monitoring immediately</Typography>
                  <Typography variant="caption" color="text.secondary">
                    The Trace Correlation Engine will start matching incoming traces
                  </Typography>
                </Box>
              }
            />
          </Box>
        )}
      </DialogContent>

      {!success && (
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {saving ? 'Creating...' : 'Save & Monitor'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}
