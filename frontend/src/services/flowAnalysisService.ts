import api from './api'
import type { ApiResponse } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface FlowAnalysisRequest {
  serviceIds: string[]
  timeRangeStart: string   // ISO 8601
  timeRangeEnd: string     // ISO 8601
  operationFilter?: string
  traceSampleLimit?: number
  includeDbCalls?: boolean
  includeExternalCalls?: boolean
}

export interface FlowAnalysisStarted {
  analysisId: string
  status: string
  estimatedDurationMs: number
  pollUrl: string
}

export interface FlowPatternStep {
  order: number
  serviceName: string
  serviceType: string
  method: string
  path: string
  avgLatencyMs: number
  errorRate: number
}

export interface FlowPatternEdge {
  source: string
  target: string
  callCount: number
  avgLatencyMs: number
  errorRate: number
  httpMethod: string
  httpPath: string
}

export interface FlowPattern {
  patternId: string
  name: string
  frequency: number
  avgLatencyMs: number
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  p99LatencyMs: number | null
  errorRate: number
  steps: FlowPatternStep[]
  edges: FlowPatternEdge[]
  sampleTraceIds: string[]
}

export interface FlowNode {
  id: string
  label: string
  type: string
  metrics: {
    totalCalls: number
    avgLatencyMs: number
    errorRate: number
  }
}

export interface FlowEdge {
  source: string
  target: string
  callCount: number
  avgLatencyMs: number
  errorRate: number
  httpMethod: string
  httpPath: string
}

export interface FlowGraph {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface FlowAnalysisResponse {
  analysisId: string
  status: string
  completedAt: string | null
  tracesAnalyzed: number
  errorMessage: string | null
  flowPatterns: FlowPattern[] | null
  graph: FlowGraph | null
}

export interface SlaSuggestion {
  suggestedMaxDurationMs: number
  suggestedMaxErrorRatePct: number
  basedOn: {
    tracesAnalyzed: number
    timeRangeStart: string
    timeRangeEnd: string
    observedErrorRate: number
    latencyStats: {
      p50Ms: number
      p95Ms: number
      p99Ms: number
      avgMs: number
    }
  }
}

export interface ConvertToWorkflowRequest {
  workflowName: string
  description?: string
  ownerTeam?: string
  sla?: {
    maxDurationMs?: number
    maxErrorRatePct?: number
  }
  steps: {
    stepOrder: number
    serviceName: string
    httpMethod: string
    pathPattern: string
    label?: string
  }[]
  enableMonitoring: boolean
  alertChannelIds?: string[]
}

export interface ConvertToWorkflowResponse {
  workflowId: string
  name: string
  stepsCreated: number
  monitoringEnabled: boolean
  sla: { maxDurationMs: number; maxErrorRatePct: number } | null
  sourceAnalysisId: string
  sourcePatternId: string
  dashboardUrl: string
  createdAt: string
}

export interface DriftResult {
  workflowId: string
  workflowName: string
  matchedPatternId: string
  changes: {
    addedSteps: { serviceName: string; method: string; path: string }[]
    removedSteps: { serviceName: string; method: string; path: string }[]
    modifiedSteps: { stepOrder: number; field: string; previousValue: string; currentValue: string }[]
  }
  severity: string
}

export interface FlowAnalysisPreset {
  id: string
  name: string
  serviceIds: string[]
  defaultTimeRangeMinutes: number
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function startFlowAnalysis(
  request: FlowAnalysisRequest,
): Promise<FlowAnalysisStarted> {
  const { data } = await api.post<ApiResponse<FlowAnalysisStarted>>(
    '/ai/flow-analysis',
    request,
  )
  return data.data
}

export async function getFlowAnalysis(
  analysisId: string,
): Promise<FlowAnalysisResponse> {
  const { data } = await api.get<ApiResponse<FlowAnalysisResponse>>(
    `/ai/flow-analysis/${analysisId}`,
  )
  return data.data
}

export async function getAnalysisHistory(): Promise<FlowAnalysisResponse[]> {
  const { data } = await api.get<ApiResponse<FlowAnalysisResponse[]>>(
    '/ai/flow-analysis/history',
  )
  return data.data
}

export async function getSlaSuggestions(
  analysisId: string,
  patternId: string,
): Promise<SlaSuggestion> {
  const { data } = await api.get<ApiResponse<SlaSuggestion>>(
    `/ai/flow-analysis/${analysisId}/patterns/${patternId}/sla-suggestions`,
  )
  return data.data
}

export async function convertToWorkflow(
  analysisId: string,
  patternId: string,
  request: ConvertToWorkflowRequest,
): Promise<ConvertToWorkflowResponse> {
  const { data } = await api.post<ApiResponse<ConvertToWorkflowResponse>>(
    `/ai/flow-analysis/${analysisId}/patterns/${patternId}/convert-to-workflow`,
    request,
  )
  return data.data
}

export async function checkDrift(
  analysisId: string,
  workflowIds: string[],
): Promise<{ drifts: DriftResult[] }> {
  const { data } = await api.post<ApiResponse<{ drifts: DriftResult[] }>>(
    `/ai/flow-analysis/${analysisId}/drift-check`,
    workflowIds,
  )
  return data.data
}

// ── Presets ──────────────────────────────────────────────────────────────────

export async function createPreset(
  request: { name: string; serviceIds: string[]; defaultTimeRangeMinutes?: number },
): Promise<FlowAnalysisPreset> {
  const { data } = await api.post<ApiResponse<FlowAnalysisPreset>>(
    '/ai/flow-analysis/presets',
    request,
  )
  return data.data
}

export async function getPresets(): Promise<FlowAnalysisPreset[]> {
  const { data } = await api.get<ApiResponse<FlowAnalysisPreset[]>>(
    '/ai/flow-analysis/presets',
  )
  return data.data
}

export async function deletePreset(presetId: string): Promise<void> {
  await api.delete(`/ai/flow-analysis/presets/${presetId}`)
}
