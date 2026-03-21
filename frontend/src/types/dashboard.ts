import type { TimeSeries } from './index'

// ── Widget Types ──────────────────────────────────────────────────────────

export type WidgetType = 'TIME_SERIES' | 'BAR' | 'PIE' | 'TABLE' | 'GAUGE' | 'STAT'

export type DataSourceType = 'PROMETHEUS' | 'ELASTICSEARCH' | 'JAEGER' | 'POSTGRESQL'

export interface GridPos {
  x: number
  y: number
  w: number
  h: number
}

export interface WidgetDataSource {
  type: DataSourceType
  query: string
  params?: Record<string, string>
}

export interface WidgetOptions {
  unit?: string
  legend?: boolean
  stacked?: boolean
  thresholds?: number[]
  colorScheme?: string
}

export interface Widget {
  id: string
  title: string
  type: WidgetType
  gridPos: GridPos
  dataSource: WidgetDataSource
  options: WidgetOptions
}

// ── Template Variables ──────────────────────────────────────────────────

export type VariableType = 'SERVICE' | 'ENVIRONMENT' | 'TIME_RANGE'

export interface TemplateVariable {
  name: string
  label: string
  type: VariableType
  defaultValue: string | null
  currentValue: string | null
}

export interface VariableOption {
  value: string
  label: string
}

export interface TemplateVariableOptionsResponse {
  type: string
  options: VariableOption[]
}

// ── Dashboard Layout ──────────────────────────────────────────────────────

export interface DashboardLayout {
  widgets: Widget[]
  variables: TemplateVariable[]
}

// ── Dashboard CRUD ──────────────────────────────────────────────────────

export interface Dashboard {
  id: string
  name: string
  description: string | null
  ownerId: string | null
  isTemplate: boolean
  tags: string | null
  layout: string // JSON string of DashboardLayout
  widgetCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateDashboardPayload {
  name: string
  description?: string
  ownerId?: string
  isTemplate?: boolean
  tags?: string
  layout?: string
}

export interface UpdateDashboardPayload {
  name?: string
  description?: string
  isTemplate?: boolean
  tags?: string
  layout?: string
}

// ── Widget Data Resolution ──────────────────────────────────────────────

export interface WidgetDataRequest {
  widgetId: string
  dataSourceType: DataSourceType
  query: string
  params?: Record<string, string>
  start?: string
  end?: string
  stepSeconds?: number
}

export interface BatchWidgetResolveRequest {
  widgets: WidgetDataRequest[]
  variables: Record<string, string>
}

export interface WidgetDataResponse {
  widgetId: string
  timeSeries: TimeSeries[]
  rawData: unknown
  error: string | null
}

export interface BatchWidgetResolveResponse {
  results: WidgetDataResponse[]
}
