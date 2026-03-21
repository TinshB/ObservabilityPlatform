import api from './api'
import type { ApiResponse } from '@/types'

export interface ErrorSpanInput {
  spanId: string
  serviceName: string
  operation: string
  durationMicros: number
  httpMethod?: string
  httpUrl?: string
  httpStatusCode?: number
  tags?: Record<string, string>
  errorLogs?: string[]
}

export interface ErrorDiagnosisRequest {
  traceId: string
  errorSpans: ErrorSpanInput[]
  associatedLogs?: string[]
  languageHint?: string
}

export interface ErrorFixSuggestion {
  spanId: string
  serviceName: string
  errorType: string
  diagnosis: string
  suggestedFix: string
  codeSnippet: string
  severity: string
  references: string[]
}

export interface ErrorDiagnosisResponse {
  traceId: string
  summary: string
  suggestions: ErrorFixSuggestion[]
  confidence: number
  llmModel: string
  executionTimeMs: number
}

export async function diagnoseErrors(
  request: ErrorDiagnosisRequest,
): Promise<ErrorDiagnosisResponse> {
  const { data } = await api.post<ApiResponse<ErrorDiagnosisResponse>>(
    '/ai/diagnose-errors',
    request,
  )
  return data.data
}
