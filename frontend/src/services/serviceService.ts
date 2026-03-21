import api from './api'
import type { ApiResponse, PagedResponse, Service, ServiceFilters } from '@/types'

export interface ServiceListParams {
  page?: number
  size?: number
  search?: string
  environment?: string
  team?: string
  tier?: string
  active?: boolean
}

export async function getServices(params: ServiceListParams = {}): Promise<PagedResponse<Service>> {
  const { data } = await api.get<ApiResponse<PagedResponse<Service>>>(
    '/services', { params },
  )
  return data.data
}

export async function getServiceById(id: string): Promise<Service> {
  const { data } = await api.get<ApiResponse<Service>>(`/services/${id}`)
  return data.data
}

export async function createService(payload: {
  name: string; description?: string; ownerTeam?: string; environment?: string; tier?: string
}): Promise<Service> {
  const { data } = await api.post<ApiResponse<Service>>('/services', payload)
  return data.data
}

export async function updateService(id: string, payload: {
  description?: string; ownerTeam?: string; environment?: string; tier?: string; active?: boolean
}): Promise<Service> {
  const { data } = await api.put<ApiResponse<Service>>(`/services/${id}`, payload)
  return data.data
}

export async function deactivateService(id: string): Promise<void> {
  await api.delete<ApiResponse<void>>(`/services/${id}`)
}

export async function toggleSignals(id: string, payload: {
  metricsEnabled?: boolean; logsEnabled?: boolean; tracesEnabled?: boolean
}): Promise<Service> {
  const { data } = await api.patch<ApiResponse<Service>>(`/services/${id}/signals`, payload)
  return data.data
}

export async function getFilterOptions(): Promise<ServiceFilters> {
  const { data } = await api.get<ApiResponse<ServiceFilters>>('/services/filters')
  return data.data
}
