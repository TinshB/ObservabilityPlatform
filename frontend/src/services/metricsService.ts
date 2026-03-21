import api from './api'
import type {
  ApiResponse,
  ServiceMetricsResponse,
  ApiMetricsResponse,
  InfraMetricsResponse,
  UiMetricsResponse,
  QueryMetricsResponse,
  LogMetricsResponse,
  TimeRangePreset,
} from '@/types'

export interface MetricsParams {
  range?: string
  start?: string
  end?: string
  step?: number
  rateWindow?: string
}

export async function getServiceMetrics(
  serviceId: string,
  params: MetricsParams = {},
): Promise<ServiceMetricsResponse> {
  const { data } = await api.get<ApiResponse<ServiceMetricsResponse>>(
    `/services/${serviceId}/metrics`,
    { params },
  )
  return data.data
}

export async function getApiMetrics(
  serviceId: string,
  params: MetricsParams = {},
): Promise<ApiMetricsResponse> {
  const { data } = await api.get<ApiResponse<ApiMetricsResponse>>(
    `/services/${serviceId}/metrics/api`,
    { params },
  )
  return data.data
}

export async function getInfraMetrics(
  serviceId: string,
  params: MetricsParams = {},
): Promise<InfraMetricsResponse> {
  const { data } = await api.get<ApiResponse<InfraMetricsResponse>>(
    `/services/${serviceId}/metrics/infra`,
    { params },
  )
  return data.data
}

export async function getUiMetrics(
  serviceId: string,
  params: MetricsParams = {},
): Promise<UiMetricsResponse> {
  const { data } = await api.get<ApiResponse<UiMetricsResponse>>(
    `/services/${serviceId}/metrics/ui`,
    { params },
  )
  return data.data
}

export async function getQueryMetrics(
  serviceId: string,
  params: MetricsParams = {},
): Promise<QueryMetricsResponse> {
  const { data } = await api.get<ApiResponse<QueryMetricsResponse>>(
    `/services/${serviceId}/metrics/query`,
    { params },
  )
  return data.data
}

export async function getLogMetrics(
  serviceId: string,
  params: MetricsParams = {},
): Promise<LogMetricsResponse> {
  const { data } = await api.get<ApiResponse<LogMetricsResponse>>(
    `/services/${serviceId}/metrics/logs`,
    { params },
  )
  return data.data
}

export async function getTimeRangePresets(): Promise<TimeRangePreset[]> {
  const { data } = await api.get<ApiResponse<TimeRangePreset[]>>(
    '/metrics/time-ranges',
  )
  return data.data
}
