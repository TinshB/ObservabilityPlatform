import api from './api'
import type {
  ApiResponse,
  TraceSearchResponse,
  TraceDetailResponse,
  TraceSearchParams,
  TransactionSearchParams,
  TransactionListResponse,
  SpanBreakupResponse,
  CorrelationResponse,
} from '@/types'
import { formatTransaction } from '@/utils/traceUtils'

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

/**
 * Aggregate traces into unique transactions for the transaction list view.
 * Groups by operation key (httpMethod + httpRoute/httpUrl) and computes
 * per-transaction error rate, RPS, and slowest time.
 */
export async function getServiceTransactions(
  serviceId: string,
  params: TransactionSearchParams = {},
): Promise<TransactionListResponse> {
  const searchParams: TraceSearchParams = { limit: 1000 }
  if (params.range) searchParams.range = params.range
  if (params.start) searchParams.start = params.start
  if (params.end)   searchParams.end   = params.end

  const result = await getServiceTraces(serviceId, searchParams)

  // Determine time window for RPS calculation
  let rangeSeconds = 3600 // fallback 1h
  if (params.start && params.end) {
    rangeSeconds = Math.max(1, (new Date(params.end).getTime() - new Date(params.start).getTime()) / 1000)
  } else if (params.range) {
    const rangeMap: Record<string, number> = {
      LAST_15M: 900, LAST_1H: 3600, LAST_3H: 10800, LAST_6H: 21600,
      LAST_12H: 43200, LAST_24H: 86400, LAST_3D: 259200, LAST_7D: 604800, LAST_30D: 2592000,
    }
    rangeSeconds = rangeMap[params.range] ?? 3600
  }

  // No rootService filter needed — Jaeger already returns only traces where
  // the selected service participates, and the backend extracts HTTP info
  // from the queried service's spans (not just the root span).

  // Group traces by operation key
  const selectedService = params.serviceName ?? ''
  const groups = new Map<string, typeof result.traces>()
  for (const trace of result.traces) {
    const key = formatTransaction(trace)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(trace)
  }

  const transactions = Array.from(groups.entries()).map(([txn, traces]) => {
    const errorTraces = traces.filter(t => t.errorCount > 0).length
    return {
      serviceName:           selectedService || traces[0]?.rootService || 'unknown',
      transaction:           txn,
      errorRate:             traces.length > 0 ? (errorTraces / traces.length) * 100 : 0,
      requestsPerSecond:     traces.length / rangeSeconds,
      slowestDurationMicros: Math.max(...traces.map(t => t.durationMicros)),
      traceCount:            traces.length,
    }
  })

  // Sort by trace count descending (most active transactions first)
  transactions.sort((a, b) => b.traceCount - a.traceCount)

  return { transactions, total: transactions.length }
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
