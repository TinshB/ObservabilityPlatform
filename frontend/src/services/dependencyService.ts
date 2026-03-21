import api from './api'
import type {
  ApiResponse,
  Dependency,
  DependencyGraph,
  DependencyMetrics,
  DependencyMetricsParams,
} from '@/types'

/** Story 11.3: List dependencies for a service. */
export async function listDependencies(serviceId: string): Promise<Dependency[]> {
  const { data } = await api.get<ApiResponse<Dependency[]>>(
    `/services/${serviceId}/dependencies`,
  )
  return data.data
}

/** Story 11.3: Get dependency graph (nodes + edges) for a service. */
export async function getDependencyGraph(serviceId: string): Promise<DependencyGraph> {
  const { data } = await api.get<ApiResponse<DependencyGraph>>(
    `/services/${serviceId}/dependencies/graph`,
  )
  return data.data
}

/** Story 11.3: Get a single dependency by ID. */
export async function getDependency(dependencyId: string): Promise<Dependency> {
  const { data } = await api.get<ApiResponse<Dependency>>(
    `/dependencies/${dependencyId}`,
  )
  return data.data
}

/** Story 11.3: Extract dependencies from a specific trace. */
export async function extractFromTrace(
  traceId: string,
): Promise<{ traceId: string; dependenciesExtracted: number }> {
  const { data } = await api.post<
    ApiResponse<{ traceId: string; dependenciesExtracted: number }>
  >('/dependencies/extract-from-trace', null, { params: { traceId } })
  return data.data
}

/** Story 11.3: Extract dependencies from recent traces for a service. */
export async function extractFromRecentTraces(
  serviceId: string,
  traceLimit = 20,
): Promise<{ serviceId: string; traceLimit: number; dependenciesExtracted: number }> {
  const { data } = await api.post<
    ApiResponse<{ serviceId: string; traceLimit: number; dependenciesExtracted: number }>
  >(`/services/${serviceId}/dependencies/extract`, null, {
    params: { traceLimit },
  })
  return data.data
}

// ── Story 11.4: Dependency Metrics ────────────────────────────────────────

/** Story 11.4: Get per-dependency latency, error rate, and throughput metrics. */
export async function getDependencyMetrics(
  dependencyId: string,
  params: DependencyMetricsParams = {},
): Promise<DependencyMetrics> {
  const { data } = await api.get<ApiResponse<DependencyMetrics>>(
    `/dependencies/${dependencyId}/metrics`,
    { params },
  )
  return data.data
}

/** Story 11.4: Get metrics for all dependencies of a service. */
export async function getServiceDependencyMetrics(
  serviceId: string,
  params: DependencyMetricsParams = {},
): Promise<DependencyMetrics[]> {
  const { data } = await api.get<ApiResponse<DependencyMetrics[]>>(
    `/services/${serviceId}/dependencies/metrics`,
    { params },
  )
  return data.data
}
