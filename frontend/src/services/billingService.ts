import api from './api'
import type {
  ApiResponse,
  ElasticsearchStorageResponse,
  PrometheusStorageResponse,
  JaegerStorageResponse,
  StorageSummaryResponse,
  LicenceTier,
  CreateLicenceTierPayload,
  UpdateLicenceTierPayload,
  LicenceCostSummaryResponse,
  BillingTrendResponse,
} from '@/types'

/**
 * US-BILL-001 — Fetch Elasticsearch storage details with cost breakdown.
 */
export async function getElasticsearchStorage(): Promise<ElasticsearchStorageResponse> {
  const { data } = await api.get<ApiResponse<ElasticsearchStorageResponse>>(
    '/billing/storage/elasticsearch',
  )
  return data.data
}

/**
 * US-BILL-002 — Fetch Prometheus storage details with cost breakdown.
 */
export async function getPrometheusStorage(): Promise<PrometheusStorageResponse> {
  const { data } = await api.get<ApiResponse<PrometheusStorageResponse>>(
    '/billing/storage/prometheus',
  )
  return data.data
}

/**
 * US-BILL-003 — Fetch Jaeger trace storage details with cost breakdown.
 */
export async function getJaegerStorage(): Promise<JaegerStorageResponse> {
  const { data } = await api.get<ApiResponse<JaegerStorageResponse>>(
    '/billing/storage/jaeger',
  )
  return data.data
}

/**
 * US-BILL-004 — Fetch unified storage cost summary across all backends.
 */
export async function getStorageSummary(): Promise<StorageSummaryResponse> {
  const { data } = await api.get<ApiResponse<StorageSummaryResponse>>(
    '/billing/storage',
  )
  return data.data
}

// ── Licence Tiers (US-BILL-009) ─────────────────────────────────────────────

export async function getLicenceTiers(): Promise<LicenceTier[]> {
  const { data } = await api.get<ApiResponse<LicenceTier[]>>(
    '/billing/licences/tiers',
  )
  return data.data
}

export async function createLicenceTier(payload: CreateLicenceTierPayload): Promise<LicenceTier> {
  const { data } = await api.post<ApiResponse<LicenceTier>>(
    '/billing/licences/tiers',
    payload,
  )
  return data.data
}

export async function updateLicenceTier(id: string, payload: UpdateLicenceTierPayload): Promise<LicenceTier> {
  const { data } = await api.put<ApiResponse<LicenceTier>>(
    `/billing/licences/tiers/${id}`,
    payload,
  )
  return data.data
}

export async function deleteLicenceTier(id: string): Promise<void> {
  await api.delete(`/billing/licences/tiers/${id}`)
}

/**
 * US-BILL-010 — Fetch licence cost summary with user counts per tier.
 */
export async function getLicenceCostSummary(): Promise<LicenceCostSummaryResponse> {
  const { data } = await api.get<ApiResponse<LicenceCostSummaryResponse>>(
    '/billing/licences',
  )
  return data.data
}

// ── Billing Trends (US-BILL-012) ────────────────────────────────────────────

/**
 * US-BILL-012 — Fetch monthly billing trend data with optional date range.
 */
export async function getBillingTrends(
  startDate?: string,
  endDate?: string,
): Promise<BillingTrendResponse> {
  const params: Record<string, string> = {}
  if (startDate) params.startDate = startDate
  if (endDate) params.endDate = endDate

  const { data } = await api.get<ApiResponse<BillingTrendResponse>>(
    '/billing/trends',
    { params },
  )
  return data.data
}
