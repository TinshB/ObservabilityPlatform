import api from './api'
import type {
  ApiResponse,
  PagedResponse,
  Report,
  GenerateReportPayload,
  ReportType,
  ReportStatus,
  ReportSchedule,
  CreateReportSchedulePayload,
  UpdateReportSchedulePayload,
} from '@/types'

// ── Reports ─────────────────────────────────────────────────────────────────

/** Story 14.7: Trigger async report generation. */
export async function generateReport(payload: GenerateReportPayload): Promise<Report> {
  const { data } = await api.post<ApiResponse<Report>>('/reports/generate', payload)
  return data.data
}

/** Story 14.7: List reports with optional filters. */
export async function listReports(
  params: {
    reportType?: ReportType
    status?: ReportStatus
    requestedBy?: string
    page?: number
    size?: number
  } = {},
): Promise<PagedResponse<Report>> {
  const { data } = await api.get<ApiResponse<PagedResponse<Report>>>('/reports', { params })
  return data.data
}

/** Story 14.7: Get a single report by ID. */
export async function getReport(id: string): Promise<Report> {
  const { data } = await api.get<ApiResponse<Report>>(`/reports/${id}`)
  return data.data
}

/** Story 14.7: Download a completed report PDF. Returns a Blob. */
export async function downloadReport(id: string): Promise<Blob> {
  const { data } = await api.get<Blob>(`/reports/${id}/download`, {
    responseType: 'blob',
  })
  return data
}

/** Story 14.7: Delete a report. */
export async function deleteReport(id: string): Promise<void> {
  await api.delete(`/reports/${id}`)
}

// ── Report Schedules ────────────────────────────────────────────────────────

/** Story 14.7: Create a report email delivery schedule. */
export async function createSchedule(payload: CreateReportSchedulePayload): Promise<ReportSchedule> {
  const { data } = await api.post<ApiResponse<ReportSchedule>>('/report-schedules', payload)
  return data.data
}

/** Story 14.7: List all report schedules. */
export async function listSchedules(
  params: { page?: number; size?: number } = {},
): Promise<PagedResponse<ReportSchedule>> {
  const { data } = await api.get<ApiResponse<PagedResponse<ReportSchedule>>>('/report-schedules', { params })
  return data.data
}

/** Story 14.7: Get a schedule by ID. */
export async function getSchedule(id: string): Promise<ReportSchedule> {
  const { data } = await api.get<ApiResponse<ReportSchedule>>(`/report-schedules/${id}`)
  return data.data
}

/** Story 14.7: Update a report schedule. */
export async function updateSchedule(id: string, payload: UpdateReportSchedulePayload): Promise<ReportSchedule> {
  const { data } = await api.put<ApiResponse<ReportSchedule>>(`/report-schedules/${id}`, payload)
  return data.data
}

/** Story 14.7: Delete a report schedule. */
export async function deleteSchedule(id: string): Promise<void> {
  await api.delete(`/report-schedules/${id}`)
}
