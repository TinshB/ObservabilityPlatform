import api from './api'
import type { ApiResponse, PagedResponse, Alert, AlertHistoryResponse, AlertHistoryParams } from '@/types'

/** Story 10.2: List alerts with optional filters. */
export async function listAlerts(
  params: { serviceId?: string; state?: string; severity?: string; page?: number; size?: number } = {},
): Promise<PagedResponse<Alert>> {
  const { data } = await api.get<ApiResponse<PagedResponse<Alert>>>('/alerts', { params })
  return data.data
}

/** Story 11.1: List historical alerts with time-range filters and summary stats. */
export async function listAlertHistory(
  params: AlertHistoryParams = {},
): Promise<AlertHistoryResponse> {
  const { data } = await api.get<ApiResponse<AlertHistoryResponse>>('/alerts/history', { params })
  return data.data
}

/** Story 10.2: Get a single alert by ID. */
export async function getAlert(id: string): Promise<Alert> {
  const { data } = await api.get<ApiResponse<Alert>>(`/alerts/${id}`)
  return data.data
}

/** Story 10.4: Acknowledge an alert. */
export async function acknowledgeAlert(id: string): Promise<Alert> {
  const { data } = await api.post<ApiResponse<Alert>>(`/alerts/${id}/acknowledge`)
  return data.data
}

/** Story 10.4: Manually resolve an alert. */
export async function resolveAlert(id: string): Promise<Alert> {
  const { data } = await api.post<ApiResponse<Alert>>(`/alerts/${id}/resolve`)
  return data.data
}
