import api from './api'
import type { ApiResponse, ServiceDeepDiveResponse, ApmOverviewResponse } from '@/types'

/** Story 8.2: Get service deep dive by ID. */
export async function getServiceDeepDive(
  serviceId: string,
  params: { range?: string; start?: string; end?: string } = {},
): Promise<ServiceDeepDiveResponse> {
  const { data } = await api.get<ApiResponse<ServiceDeepDiveResponse>>(
    `/services/${serviceId}/deep-dive`,
    { params },
  )
  return data.data
}

/** Get service deep dive by name. */
export async function getServiceDeepDiveByName(
  serviceName: string,
  params: { range?: string; start?: string; end?: string } = {},
): Promise<ServiceDeepDiveResponse> {
  const { data } = await api.get<ApiResponse<ServiceDeepDiveResponse>>(
    `/services/by-name/${encodeURIComponent(serviceName)}/deep-dive`,
    { params },
  )
  return data.data
}

/** Story 8.3: Get platform-wide APM overview. */
export async function getApmOverview(
  params: { range?: string; start?: string; end?: string } = {},
): Promise<ApmOverviewResponse> {
  const { data } = await api.get<ApiResponse<ApmOverviewResponse>>(
    '/apm/overview',
    { params },
  )
  return data.data
}
