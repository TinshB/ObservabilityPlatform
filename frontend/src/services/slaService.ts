import api from './api'
import type {
  ApiResponse,
  PagedResponse,
  SlaRule,
  CreateSlaRulePayload,
  UpdateSlaRulePayload,
} from '@/types'

/** Story 10.1: Create an SLA rule. */
export async function createRule(payload: CreateSlaRulePayload): Promise<SlaRule> {
  const { data } = await api.post<ApiResponse<SlaRule>>('/sla-rules', payload)
  return data.data
}

/** Story 10.1: List SLA rules with optional filters. */
export async function listRules(
  params: { serviceId?: string; enabled?: boolean; page?: number; size?: number } = {},
): Promise<PagedResponse<SlaRule>> {
  const { data } = await api.get<ApiResponse<PagedResponse<SlaRule>>>('/sla-rules', { params })
  return data.data
}

/** Story 10.1: Get a single SLA rule by ID. */
export async function getRule(id: string): Promise<SlaRule> {
  const { data } = await api.get<ApiResponse<SlaRule>>(`/sla-rules/${id}`)
  return data.data
}

/** Story 10.1: Update an SLA rule. */
export async function updateRule(id: string, payload: UpdateSlaRulePayload): Promise<SlaRule> {
  const { data } = await api.put<ApiResponse<SlaRule>>(`/sla-rules/${id}`, payload)
  return data.data
}

/** Story 10.1: Delete an SLA rule. */
export async function deleteRule(id: string): Promise<void> {
  await api.delete(`/sla-rules/${id}`)
}
