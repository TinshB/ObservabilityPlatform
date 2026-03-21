import api from './api'
import type {
  ApiResponse,
  TraceSearchResponse,
  TraceDetailResponse,
  TraceSearchParams,
  SpanBreakupResponse,
  CorrelationResponse,
} from '@/types'

/** Story 7.2: List traces for a service with filters. */
export async function getServiceTraces(
  serviceId: string,
  params: TraceSearchParams = {},
): Promise<TraceSearchResponse> {
  const { data } = await api.get<ApiResponse<TraceSearchResponse>>(
    `/services/${serviceId}/traces`,
    { params },
  )
  return data.data
}

/** Story 7.3: List available operations (endpoints) for a service. */
export async function getServiceOperations(serviceId: string): Promise<string[]> {
  const { data } = await api.get<ApiResponse<string[]>>(
    `/services/${serviceId}/traces/operations`,
  )
  return data.data
}

/** Story 7.2: Get full trace detail by trace ID. */
export async function getTraceDetail(traceId: string): Promise<TraceDetailResponse> {
  const { data } = await api.get<ApiResponse<TraceDetailResponse>>(
    `/traces/${encodeURIComponent(traceId)}`,
  )
  return data.data
}

/** Story 8.1: Get span-level breakup for a trace. */
export async function getSpanBreakup(traceId: string): Promise<SpanBreakupResponse> {
  const { data } = await api.get<ApiResponse<SpanBreakupResponse>>(
    `/traces/${encodeURIComponent(traceId)}/span-breakup`,
  )
  return data.data
}

/** Story 9.1: Get cross-signal correlation for a trace. */
export async function getTraceCorrelation(traceId: string): Promise<CorrelationResponse> {
  const { data } = await api.get<ApiResponse<CorrelationResponse>>(
    `/traces/${encodeURIComponent(traceId)}/correlation`,
  )
  return data.data
}
