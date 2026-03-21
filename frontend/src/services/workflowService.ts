import api from './api'
import type {
  ApiResponse,
  PagedResponse,
  Workflow,
  CreateWorkflowPayload,
  UpdateWorkflowPayload,
  WorkflowStep,
  WorkflowStepPayload,
  WorkflowCorrelationRequest,
  WorkflowCorrelationSummary,
  WorkflowInstance,
  WorkflowInstanceStats,
  WorkflowStepMetricsResponse,
  LiveCorrelationResponse,
} from '@/types'

// ── Workflow CRUD ────────────────────────────────────────────────────────────

/** Story 12.1: Create a workflow. */
export async function createWorkflow(payload: CreateWorkflowPayload): Promise<Workflow> {
  const { data } = await api.post<ApiResponse<Workflow>>('/workflows', payload)
  return data.data
}

/** Story 12.1: List workflows with optional filters. */
export async function listWorkflows(
  params: { enabled?: boolean; active?: boolean; page?: number; size?: number } = {},
): Promise<PagedResponse<Workflow>> {
  const { data } = await api.get<ApiResponse<PagedResponse<Workflow>>>('/workflows', { params })
  return data.data
}

/** Story 12.1: Get a single workflow by ID. */
export async function getWorkflow(id: string): Promise<Workflow> {
  const { data } = await api.get<ApiResponse<Workflow>>(`/workflows/${id}`)
  return data.data
}

/** Story 12.1: Update a workflow. */
export async function updateWorkflow(id: string, payload: UpdateWorkflowPayload): Promise<Workflow> {
  const { data } = await api.put<ApiResponse<Workflow>>(`/workflows/${id}`, payload)
  return data.data
}

/** Story 12.1: Delete a workflow. */
export async function deleteWorkflow(id: string): Promise<void> {
  await api.delete(`/workflows/${id}`)
}

// ── Step CRUD ────────────────────────────────────────────────────────────────

/** Story 12.2: Add a step to a workflow. */
export async function createStep(workflowId: string, payload: WorkflowStepPayload): Promise<WorkflowStep> {
  const { data } = await api.post<ApiResponse<WorkflowStep>>(`/workflows/${workflowId}/steps`, payload)
  return data.data
}

/** Story 12.2: List steps for a workflow (ordered). */
export async function listSteps(workflowId: string): Promise<WorkflowStep[]> {
  const { data } = await api.get<ApiResponse<WorkflowStep[]>>(`/workflows/${workflowId}/steps`)
  return data.data
}

/** Story 12.2: Get a single step. */
export async function getStep(workflowId: string, stepId: string): Promise<WorkflowStep> {
  const { data } = await api.get<ApiResponse<WorkflowStep>>(`/workflows/${workflowId}/steps/${stepId}`)
  return data.data
}

/** Story 12.2: Update a step. */
export async function updateStep(workflowId: string, stepId: string, payload: WorkflowStepPayload): Promise<WorkflowStep> {
  const { data } = await api.put<ApiResponse<WorkflowStep>>(`/workflows/${workflowId}/steps/${stepId}`, payload)
  return data.data
}

/** Story 12.2: Delete a step. */
export async function deleteStep(workflowId: string, stepId: string): Promise<void> {
  await api.delete(`/workflows/${workflowId}/steps/${stepId}`)
}

// ── Correlation ──────────────────────────────────────────────────────────────

/** Story 12.3: Run trace-to-workflow correlation. */
export async function correlate(payload: WorkflowCorrelationRequest): Promise<WorkflowCorrelationSummary> {
  const { data } = await api.post<ApiResponse<WorkflowCorrelationSummary>>('/workflows/correlate', payload)
  return data.data
}

// ── Instances (Story 12.4) ───────────────────────────────────────────────────

/** Story 12.4: List workflow instances. */
export async function listInstances(
  workflowId: string,
  params: { status?: string; from?: string; to?: string; page?: number; size?: number } = {},
): Promise<PagedResponse<WorkflowInstance>> {
  const { data } = await api.get<ApiResponse<PagedResponse<WorkflowInstance>>>(`/workflows/${workflowId}/instances`, { params })
  return data.data
}

/** Story 12.4: Get workflow instance detail with per-step breakdown. */
export async function getInstance(workflowId: string, instanceId: string): Promise<WorkflowInstance> {
  const { data } = await api.get<ApiResponse<WorkflowInstance>>(`/workflows/${workflowId}/instances/${instanceId}`)
  return data.data
}

/** Story 12.4: Get workflow instance stats. */
export async function getInstanceStats(workflowId: string): Promise<WorkflowInstanceStats> {
  const { data } = await api.get<ApiResponse<WorkflowInstanceStats>>(`/workflows/${workflowId}/instances/stats`)
  return data.data
}

/** Live correlation — fetch traces from Jaeger, match to workflow steps, return without DB persistence. */
export async function correlateLive(
  workflowId: string,
  params?: { lookbackMinutes?: number; traceLimit?: number },
): Promise<LiveCorrelationResponse> {
  const { data } = await api.get<ApiResponse<LiveCorrelationResponse>>(`/workflows/${workflowId}/correlate/live`, { params })
  return data.data
}

/** Get live per-step metrics from Prometheus and Jaeger. */
export async function getStepMetrics(
  workflowId: string,
  params?: { rateWindow?: string },
): Promise<WorkflowStepMetricsResponse> {
  const { data } = await api.get<ApiResponse<WorkflowStepMetricsResponse>>(`/workflows/${workflowId}/steps/metrics`, { params })
  return data.data
}
