import api from './api'
import type { ApiResponse, PagedResponse } from '@/types'
import type {
  Dashboard,
  CreateDashboardPayload,
  UpdateDashboardPayload,
  BatchWidgetResolveRequest,
  BatchWidgetResolveResponse,
  TemplateVariableOptionsResponse,
} from '@/types/dashboard'

// ── Dashboard CRUD ───────────────────────────────────────────────────────

export async function createDashboard(
  payload: CreateDashboardPayload,
): Promise<Dashboard> {
  const { data } = await api.post<ApiResponse<Dashboard>>('/dashboards', payload)
  return data.data
}

export async function listDashboards(params: {
  ownerId?: string
  isTemplate?: boolean
  search?: string
  page?: number
  size?: number
}): Promise<PagedResponse<Dashboard>> {
  const { data } = await api.get<ApiResponse<PagedResponse<Dashboard>>>('/dashboards', { params })
  return data.data
}

export async function listTemplates(): Promise<Dashboard[]> {
  const { data } = await api.get<ApiResponse<Dashboard[]>>('/dashboards/templates')
  return data.data
}

export async function getDashboard(id: string): Promise<Dashboard> {
  const { data } = await api.get<ApiResponse<Dashboard>>(`/dashboards/${id}`)
  return data.data
}

export async function updateDashboard(
  id: string,
  payload: UpdateDashboardPayload,
): Promise<Dashboard> {
  const { data } = await api.put<ApiResponse<Dashboard>>(`/dashboards/${id}`, payload)
  return data.data
}

export async function deleteDashboard(id: string): Promise<void> {
  await api.delete(`/dashboards/${id}`)
}

export async function cloneDashboard(id: string, ownerId: string, name?: string): Promise<Dashboard> {
  const params: Record<string, string> = { ownerId }
  if (name) params.name = name
  const { data } = await api.post<ApiResponse<Dashboard>>(
    `/dashboards/${id}/clone`,
    null,
    { params },
  )
  return data.data
}

// ── Widget Data Resolution ───────────────────────────────────────────────

export async function resolveWidgets(
  request: BatchWidgetResolveRequest,
): Promise<BatchWidgetResolveResponse> {
  const { data } = await api.post<ApiResponse<BatchWidgetResolveResponse>>(
    '/dashboards/widgets/resolve',
    request,
  )
  return data.data
}

// ── Template Variables ───────────────────────────────────────────────────

export async function getVariableOptions(
  type: string,
): Promise<TemplateVariableOptionsResponse> {
  const { data } = await api.get<ApiResponse<TemplateVariableOptionsResponse>>(
    '/dashboards/variables/options',
    { params: { type } },
  )
  return data.data
}
