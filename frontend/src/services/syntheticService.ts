import api from './api'
import type {
  ApiResponse,
  PagedResponse,
  SyntheticCheck,
  CreateSyntheticCheckPayload,
  UpdateSyntheticCheckPayload,
  SyntheticResult,
} from '@/types'

// ── Synthetic Checks ────────────────────────────────────────────────────────

/** Story 14.5: Create a synthetic check. */
export async function createCheck(payload: CreateSyntheticCheckPayload): Promise<SyntheticCheck> {
  const { data } = await api.post<ApiResponse<SyntheticCheck>>('/synthetic-checks', payload)
  return data.data
}

/** Story 14.5: List synthetic checks with optional filters. */
export async function listChecks(
  params: { active?: boolean; serviceName?: string; page?: number; size?: number } = {},
): Promise<PagedResponse<SyntheticCheck>> {
  const { data } = await api.get<ApiResponse<PagedResponse<SyntheticCheck>>>('/synthetic-checks', { params })
  return data.data
}

/** Story 14.5: Get a single check by ID. */
export async function getCheck(id: string): Promise<SyntheticCheck> {
  const { data } = await api.get<ApiResponse<SyntheticCheck>>(`/synthetic-checks/${id}`)
  return data.data
}

/** Story 14.5: Update a synthetic check. */
export async function updateCheck(id: string, payload: UpdateSyntheticCheckPayload): Promise<SyntheticCheck> {
  const { data } = await api.put<ApiResponse<SyntheticCheck>>(`/synthetic-checks/${id}`, payload)
  return data.data
}

/** Story 14.5: Delete a synthetic check. */
export async function deleteCheck(id: string): Promise<void> {
  await api.delete(`/synthetic-checks/${id}`)
}

// ── Probe Results ───────────────────────────────────────────────────────────

/** Story 14.8: Get paginated probe results for a check. */
export async function getResults(
  checkId: string,
  params: { page?: number; size?: number } = {},
): Promise<PagedResponse<SyntheticResult>> {
  const { data } = await api.get<ApiResponse<PagedResponse<SyntheticResult>>>(
    `/synthetic-checks/${checkId}/results`, { params })
  return data.data
}

/** Story 14.8: Get the 10 most recent probe results for a check. */
export async function getRecentResults(checkId: string): Promise<SyntheticResult[]> {
  const { data } = await api.get<ApiResponse<SyntheticResult[]>>(
    `/synthetic-checks/${checkId}/results/recent`)
  return data.data
}
