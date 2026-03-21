import api from './api'
import type { ApiResponse, LogSearchResponse, LogSearchParams, LogEnrichmentValidationResponse } from '@/types'

export async function searchLogs(params: LogSearchParams = {}): Promise<LogSearchResponse> {
  const { data } = await api.get<ApiResponse<LogSearchResponse>>(
    '/logs',
    { params },
  )
  return data.data
}

/** Story 7.4: Validate log enrichment (traceId, spanId, service.name coverage). */
export async function validateLogEnrichment(
  serviceId: string,
  params: { range?: string; start?: string; end?: string } = {},
): Promise<LogEnrichmentValidationResponse> {
  const { data } = await api.get<ApiResponse<LogEnrichmentValidationResponse>>(
    `/services/${serviceId}/logs/enrichment-validation`,
    { params },
  )
  return data.data
}

/** Story 7.1: Retrieve all logs correlated with a distributed trace. */
export async function getLogsByTraceId(
  traceId: string,
  params: { page?: number; size?: number } = {},
): Promise<LogSearchResponse> {
  const { data } = await api.get<ApiResponse<LogSearchResponse>>(
    `/logs/trace/${encodeURIComponent(traceId)}`,
    { params },
  )
  return data.data
}
