// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types — mirrors the Java DTOs in observability-shared
// ─────────────────────────────────────────────────────────────────────────────

// ── API envelope ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success:   boolean
  message?:  string
  data:      T
  timestamp: string // ISO-8601
}

export interface PagedResponse<T> {
  content:       T[]
  page:          number
  size:          number
  totalElements: number
  totalPages:    number
  first:         boolean
  last:          boolean
}

export interface ErrorResponse {
  errorCode:        string
  message:          string
  path:             string
  traceId?:         string
  timestamp:        string // ISO-8601
  validationErrors?: FieldValidationError[]
}

export interface FieldValidationError {
  field:         string
  rejectedValue?: unknown
  message:       string
}

// ── Auth / Users ──────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER'

export interface User {
  id:        string
  username:  string
  email:     string
  roles:     UserRole[]
  createdAt: string // ISO-8601
}

export interface AuthTokens {
  accessToken:  string
  refreshToken: string
  expiresIn:    number // seconds
}

// ── User Management ─────────────────────────────────────────────────────────

export interface UserDetail extends User {
  active:       boolean
  authProvider: string
}

export interface Permission {
  id:       string
  resource: string
  action:   string
}

export interface Role {
  id:          string
  name:        string
  description: string
  permissions: Permission[]
}

export interface CreateUserPayload {
  username: string
  email:    string
  password: string
  roleIds?: string[]
}

export interface UpdateUserPayload {
  email?:  string
  active?: boolean
}

export interface CreateRolePayload {
  name:           string
  description?:   string
  permissionIds?: string[]
}

// ── Services / APM ───────────────────────────────────────────────────────────

export type Environment = 'dev' | 'staging' | 'production'
export type RegistrationSource = 'MANUAL' | 'AUTO_DISCOVERED'

export interface Service {
  id:                 string
  name:               string
  description?:       string
  ownerTeam:          string
  environment:        Environment
  tier?:              string
  metricsEnabled:     boolean
  logsEnabled:        boolean
  tracesEnabled:      boolean
  active:             boolean
  registrationSource: RegistrationSource
  createdAt:          string // ISO-8601
  updatedAt:          string // ISO-8601
}

export interface CreateServicePayload {
  name:         string
  description?: string
  ownerTeam?:   string
  environment?: string
  tier?:        string
}

export interface UpdateServicePayload {
  description?: string
  ownerTeam?:   string
  environment?: string
  tier?:        string
  active?:      boolean
}

export interface SignalTogglePayload {
  metricsEnabled?: boolean
  logsEnabled?:    boolean
  tracesEnabled?:  boolean
}

export interface ServiceFilters {
  environments: string[]
  teams:        string[]
  tiers:        string[]
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export interface MetricDataPoint {
  timestamp: number // Unix epoch seconds
  value:     number
}

export interface TimeSeries {
  name:       string
  labels:     Record<string, string>
  dataPoints: MetricDataPoint[]
}

export interface InstantMetrics {
  latencyP50:  number | null
  latencyP95:  number | null
  latencyP99:  number | null
  errorRate:   number | null
  requestRate: number | null
}

export interface ServiceMetricsResponse {
  serviceName: string
  latencyP50:  TimeSeries | null
  latencyP95:  TimeSeries | null
  latencyP99:  TimeSeries | null
  errorRate:   TimeSeries | null
  requestRate: TimeSeries | null
  current:     InstantMetrics | null
}

export interface StatusCodeGroup {
  httpRoute:    string
  statusCode:   string
  requestCount: number
}

export interface ApiMetricsResponse {
  serviceName:            string
  latencyP50ByRoute:      TimeSeries[]
  latencyP95ByRoute:      TimeSeries[]
  latencyP99ByRoute:      TimeSeries[]
  throughputByRoute:       TimeSeries[]
  statusCodeDistribution:  StatusCodeGroup[]
}

export interface InstantInfraMetrics {
  cpuUsageCores:              number | null
  systemCpuUtilisation:       number | null
  memoryUsageBytes:           number | null
  jvmMemoryHeapMaxBytes:      number | null
  jvmMemoryNonHeapUsedBytes:  number | null
  processResidentMemoryBytes: number | null
  jvmThreadsLive:             number | null
  jvmClassesLoaded:           number | null
  gcPauseSeconds:             number | null
}

export interface InfraMetricsResponse {
  serviceName:               string
  processCpuUsage:           TimeSeries | null
  systemCpuUsage:            TimeSeries | null
  processCpuByInstance:      TimeSeries[]
  jvmMemoryHeapUsed:         TimeSeries | null
  jvmMemoryHeapCommitted:    TimeSeries | null
  jvmMemoryHeapMax:          TimeSeries | null
  jvmMemoryNonHeapUsed:      TimeSeries | null
  jvmMemoryNonHeapCommitted: TimeSeries | null
  processResidentMemory:     TimeSeries | null
  jvmMemoryHeapByInstance:   TimeSeries[]
  jvmThreadsLive:            TimeSeries | null
  jvmThreadsDaemon:          TimeSeries | null
  jvmClassesLoaded:          TimeSeries | null
  gcPauseTime:               TimeSeries | null
  gcPauseCount:              TimeSeries | null
  current:                   InstantInfraMetrics | null
}

export interface TimeRangePreset {
  key:             string
  label:           string
  durationSeconds: number
  stepSeconds:     number
  rateWindow:      string
}

// ── Story 6.1: UI (Web Vitals) Metrics ──────────────────────────────────────

export type CwvStatus = 'good' | 'needs-improvement' | 'poor' | 'unknown'

export interface InstantWebVitals {
  fcpP75:    number | null
  lcpP75:    number | null
  clsP75:    number | null
  ttiP75:    number | null
  fcpStatus: CwvStatus
  lcpStatus: CwvStatus
  clsStatus: CwvStatus
  ttiStatus: CwvStatus
}

export interface UiMetricsResponse {
  serviceName: string
  fcpP50: TimeSeries | null
  fcpP75: TimeSeries | null
  fcpP95: TimeSeries | null
  lcpP50: TimeSeries | null
  lcpP75: TimeSeries | null
  lcpP95: TimeSeries | null
  clsP50: TimeSeries | null
  clsP75: TimeSeries | null
  clsP95: TimeSeries | null
  ttiP50: TimeSeries | null
  ttiP75: TimeSeries | null
  ttiP95: TimeSeries | null
  current: InstantWebVitals | null
}

// ── Story 6.2: Query Metrics ────────────────────────────────────────────────

export interface QuerySummary {
  operation:   string
  collection:  string
  avgExecTime: number | null
  p95ExecTime: number | null
  callCount:   number | null
  slowQuery:   boolean
}

export interface InstantQueryMetrics {
  avgLatency:     number | null
  p95Latency:     number | null
  queryRate:      number | null
  slowQueryCount: number | null
}

export interface QueryMetricsResponse {
  serviceName:        string
  queries:            QuerySummary[]
  avgLatency:         TimeSeries | null
  p95Latency:         TimeSeries | null
  queryRate:          TimeSeries | null
  latencyByOperation: TimeSeries[]
  current:            InstantQueryMetrics | null
}

// ── Story 6.3: Log Metrics ──────────────────────────────────────────────────

export interface LogPattern {
  pattern:      string
  level:        string
  count:        number
  percentage:   number
  trend:        string
  trendSeries?: MetricDataPoint[]
}

export interface InstantLogMetrics {
  totalVolume:      number | null
  errorVolume:      number | null
  errorRatio:       number | null
  distinctPatterns: number | null
}

export interface LogMetricsResponse {
  serviceName:  string
  volumeByLevel: TimeSeries[]
  totalVolume:   TimeSeries | null
  errorRatio:    TimeSeries | null
  topPatterns:   LogPattern[]
  current:       InstantLogMetrics | null
}

// ── Story 6.8: Log Explorer ─────────────────────────────────────────────────

export type LogSeverity = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

export interface LogEntry {
  timestamp:   string // ISO-8601
  severity:    LogSeverity
  serviceName: string | null
  body:        string | null
  traceId:     string | null
  spanId:      string | null
  attributes:  Record<string, string>
}

export interface LogSearchResponse {
  totalHits:  number
  page:       number
  size:       number
  totalPages: number
  entries:    LogEntry[]
}

export interface LogSearchParams {
  serviceId?: string
  severity?:  string[]   // sent as repeated query params
  q?:         string     // full-text search
  traceId?:   string     // Story 7.1: trace-level log correlation
  range?:     string     // preset key
  start?:     string     // ISO-8601
  end?:       string     // ISO-8601
  page?:      number
  size?:      number
}

// ── Story 7.4: Log Enrichment Validation ────────────────────────────────────

export interface FieldValidation {
  field:        string
  presentCount: number
  missingCount: number
  coverageRate: number // 0.0–1.0
}

export interface SampleMissingLog {
  timestamp:      string
  severity:       string
  body:           string | null
  hasTraceId:     boolean
  hasSpanId:      boolean
  hasServiceName: boolean
}

export interface LogEnrichmentValidationResponse {
  serviceName:    string
  totalLogs:      number
  traceId:        FieldValidation
  spanId:         FieldValidation
  serviceName_:   FieldValidation
  healthScore:    number  // 0.0–1.0
  healthy:        boolean
  samplesMissing: SampleMissingLog[]
}

// ── Story 7.2: Traces ───────────────────────────────────────────────────────

export interface TraceSummary {
  traceId:       string
  rootService:   string
  rootOperation: string
  startTime:     string   // ISO-8601
  durationMicros: number  // microseconds
  spanCount:     number
  errorCount:    number
  services:      string[]
}

export interface TraceSearchResponse {
  traces: TraceSummary[]
  total:  number
  limit:  number
}

export interface SpanLog {
  timestamp: number // microseconds since epoch
  fields:    Record<string, string>
}

export interface SpanDetail {
  spanId:         string
  parentSpanId:   string | null
  operationName:  string
  serviceName:    string
  startTime:      number  // microseconds since epoch
  durationMicros: number
  hasError:       boolean
  httpStatusCode: number | null
  httpMethod:     string | null
  httpUrl:        string | null
  tags:           Record<string, string>
  logs:           SpanLog[]
}

export interface TraceDetailResponse {
  traceId:       string
  durationMicros: number
  startTime:     string   // ISO-8601
  spanCount:     number
  errorCount:    number
  services:      string[]
  spans:         SpanDetail[]
}

export interface TraceSearchParams {
  operation?:   string  // Story 7.3: API-level filter (HTTP route / operation name)
  range?:       string
  start?:       string
  end?:         string
  minDuration?: string  // e.g. "100ms", "1s"
  maxDuration?: string
  limit?:       number
  tags?:        string  // JSON format
}

// ── Story 8.1: Span Breakup ──────────────────────────────────────────────────

export interface OperationBreakup {
  operationName:      string
  serviceName:        string
  spanCount:          number
  errorCount:         number
  totalDurationMicros: number
  selfTimeMicros:     number
  avgDurationMicros:  number
  maxDurationMicros:  number
  minDurationMicros:  number
  percentOfTrace:     number
}

export interface SpanBreakupResponse {
  traceId:            string
  traceDurationMicros: number
  totalSpans:         number
  serviceCount:       number
  operations:         OperationBreakup[]
}

// ── Story 8.2: Service Deep Dive ─────────────────────────────────────────────

export interface DeepDiveKeyMetrics {
  latencyP50:  number | null
  latencyP95:  number | null
  latencyP99:  number | null
  errorRate:   number | null
  requestRate: number | null
}

export interface DeepDiveErrorTrace {
  traceId:       string
  rootOperation: string
  startTime:     string
  durationMicros: number
  errorCount:    number
  spanCount:     number
}

export interface DeepDiveLogSummary {
  totalLogs:       number
  errorLogs:       number
  errorRatio:      number | null
  enrichmentScore: number | null
}

export interface DeepDiveTraceSummary {
  traceCount:       number
  errorTraceCount:  number
  avgDurationMicros: number
}

export interface ServiceDeepDiveResponse {
  serviceId:       string
  serviceName:     string
  environment:     string
  ownerTeam:       string
  tier:            string | null
  metricsEnabled:  boolean
  logsEnabled:     boolean
  tracesEnabled:   boolean
  healthScore:     number
  healthStatus:    string
  keyMetrics:      DeepDiveKeyMetrics | null
  recentErrors:    DeepDiveErrorTrace[]
  logSummary:      DeepDiveLogSummary | null
  traceSummary:    DeepDiveTraceSummary | null
}

// ── Story 8.3: APM Overview ──────────────────────────────────────────────────

export interface ApmServiceHealthSummary {
  serviceId:   string
  serviceName: string
  environment: string
  ownerTeam:   string
  tier:        string | null
  healthScore: number
  healthStatus: string
  latencyP95:  number | null
  errorRate:   number | null
  requestRate: number | null
}

export interface ApmOverviewResponse {
  totalServices:      number
  healthDistribution: Record<string, number>
  signalCounts:       { metricsEnabled: number; logsEnabled: number; tracesEnabled: number }
  topUnhealthy:       ApmServiceHealthSummary[]
  services:           ApmServiceHealthSummary[]
}

// ── Story 9.1: Cross-Signal Correlation ──────────────────────────────────

export interface MetricsSnapshot {
  serviceName:  string
  latencyP50:   number | null
  latencyP95:   number | null
  latencyP99:   number | null
  errorRate:    number | null
  requestRate:  number | null
}

export interface CorrelationResponse {
  trace:           TraceDetailResponse
  metricsSnapshot: MetricsSnapshot | null
  relatedLogs:     LogSearchResponse | null
}

// ── Sprint 10: SLA Rules & Alerts ────────────────────────────────────────

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO'
export type AlertState    = 'OK' | 'PENDING' | 'FIRING' | 'RESOLVED'
export type SignalType    = 'METRICS' | 'LOGS'
export type SlaOperator   = 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NEQ'
export type ChannelType   = 'EMAIL' | 'SMS' | 'MS_TEAMS'

export interface ChannelSummary {
  id:          string
  name:        string
  channelType: ChannelType
}

export type AlertGroupKey = 'service' | 'service+severity' | 'service+signal' | 'none'

export interface SlaRule {
  id:                string
  serviceId:         string
  serviceName:       string
  name:              string
  description?:      string
  signalType:        SignalType
  metricName?:       string
  logCondition?:     string
  operator:          SlaOperator
  threshold:         number
  evaluationWindow:  string
  pendingPeriods:    number
  severity:          AlertSeverity
  enabled:           boolean
  groupKey:          AlertGroupKey
  suppressionWindow: string
  channels:          ChannelSummary[]
  createdAt:         string
  updatedAt:         string
}

export interface CreateSlaRulePayload {
  serviceId:         string
  name:              string
  description?:      string
  signalType:        SignalType
  metricName?:       string
  logCondition?:     string
  operator:          SlaOperator
  threshold:         number
  evaluationWindow?: string
  pendingPeriods?:   number
  severity?:         AlertSeverity
  groupKey?:         AlertGroupKey
  suppressionWindow?: string
  channelIds?:       string[]
}

export interface UpdateSlaRulePayload {
  name?:              string
  description?:       string
  signalType?:        SignalType
  metricName?:        string
  logCondition?:      string
  operator?:          SlaOperator
  threshold?:         number
  evaluationWindow?:  string
  pendingPeriods?:    number
  severity?:          AlertSeverity
  enabled?:           boolean
  groupKey?:          AlertGroupKey
  suppressionWindow?: string
  channelIds?:        string[]
}

export interface Alert {
  id:              string
  slaRuleId:       string
  slaRuleName:     string
  serviceId:       string
  serviceName:     string
  state:           AlertState
  severity:        AlertSeverity
  message?:        string
  evaluatedValue?: number
  firedAt?:        string
  resolvedAt?:     string
  acknowledgedAt?: string
  acknowledgedBy?: string
  createdAt:       string
  updatedAt:       string
}

// ── Story 11.1: Alert History ────────────────────────────────────────────────

export interface AlertHistoryResponse {
  alerts:      PagedResponse<Alert>
  stateCounts: Record<string, number>
  totalAlerts: number
}

export interface AlertHistoryParams {
  serviceId?: string
  state?:     string
  severity?:  string
  start?:     string  // ISO-8601
  end?:       string  // ISO-8601
  page?:      number
  size?:      number
}

// ── Story 10.6: Alert Channels ──────────────────────────────────────────────

export interface AlertChannel {
  id:          string
  name:        string
  channelType: ChannelType
  config:      string
  enabled:     boolean
  createdAt:   string
  updatedAt:   string
}

export interface CreateAlertChannelPayload {
  name:        string
  channelType: ChannelType
  config:      string
}

export interface UpdateAlertChannelPayload {
  name?:        string
  channelType?: ChannelType
  config?:      string
  enabled?:     boolean
}

// ── Story 11.3: Service Dependencies ──────────────────────────────────────

export type DependencyType = 'HTTP' | 'GRPC' | 'DATABASE' | 'CLOUD' | 'CACHE'
export type TargetType     = 'SERVICE' | 'DATABASE' | 'CLOUD_COMPONENT' | 'CACHE'

export interface Dependency {
  id:                string
  sourceServiceId:   string
  sourceServiceName: string
  targetServiceName: string
  dependencyType:    DependencyType
  dbSystem?:         string
  targetType:        TargetType
  displayName?:      string
  lastSeenAt?:       string  // ISO-8601
  callCount1h:       number
  errorCount1h:      number
  avgLatencyMs1h:    number
  active:            boolean
  createdAt:         string
  updatedAt:         string
}

export interface DependencyNode {
  id:         string
  label:      string
  nodeType:   TargetType | 'SERVICE'
  serviceId?: string
}

export interface DependencyEdge {
  id:             string
  source:         string
  target:         string
  dependencyType: DependencyType
  callCount1h:    number
  errorCount1h:   number
  avgLatencyMs1h: number
}

export interface DependencyGraph {
  nodes: DependencyNode[]
  edges: DependencyEdge[]
}

// ── Story 11.4: Dependency Metrics ────────────────────────────────────────

export interface InstantDependencyMetrics {
  latencyP50:    number | null
  latencyP95:    number | null
  latencyP99:    number | null
  errorRate:     number | null
  throughput:    number | null
  callCount1h:   number
  errorCount1h:  number
  avgLatencyMs1h: number
}

export interface DependencyMetrics {
  dependencyId:      string
  sourceServiceName: string
  targetServiceName: string
  dependencyType:    DependencyType
  latencyP50:        TimeSeries | null
  latencyP95:        TimeSeries | null
  latencyP99:        TimeSeries | null
  errorRate:         TimeSeries | null
  throughput:        TimeSeries | null
  current:           InstantDependencyMetrics | null
}

export interface DependencyMetricsParams {
  stepSeconds?: number
  rateWindow?:  string
  start?:       string  // ISO-8601
  end?:         string  // ISO-8601
}

// ── Story 12.1–12.5: Business Workflow Mapping ──────────────────────────────

export type WorkflowInstanceStatus = 'IN_PROGRESS' | 'COMPLETE' | 'FAILED'

export interface Workflow {
  id:               string
  name:             string
  description?:     string
  ownerTeam?:       string
  maxDurationMs?:   number
  maxErrorRatePct?: number
  enabled:          boolean
  active:           boolean
  stepCount:        number
  createdAt:        string
  updatedAt:        string
}

export interface CreateWorkflowPayload {
  name:             string
  description?:     string
  ownerTeam?:       string
  maxDurationMs?:   number
  maxErrorRatePct?: number
}

export interface UpdateWorkflowPayload {
  name?:             string
  description?:      string
  ownerTeam?:        string
  maxDurationMs?:    number
  maxErrorRatePct?:  number
  enabled?:          boolean
  active?:           boolean
}

export interface WorkflowStep {
  id:           string
  workflowId:   string
  stepOrder:    number
  serviceName:  string
  httpMethod:   string
  pathPattern:  string
  label?:       string
  createdAt:    string
  updatedAt:    string
}

export interface WorkflowStepPayload {
  stepOrder:   number
  serviceName: string
  httpMethod:  string
  pathPattern: string
  label?:      string
}

export interface WorkflowCorrelationRequest {
  workflowId?:      string
  lookbackMinutes?: number
  traceLimit?:      number
}

export interface WorkflowCorrelationSummary {
  workflowsProcessed: number
  tracesAnalyzed:     number
  instancesCreated:   number
  instancesUpdated:   number
}

export interface WorkflowInstanceStepDetail {
  id:            string
  stepId:        string
  stepOrder:     number
  label?:        string
  spanId:        string
  serviceName:   string
  operationName?: string
  durationMs?:   number
  httpStatus?:   number
  error:         boolean
  startedAt?:    string
}

export interface WorkflowInstance {
  id:              string
  workflowId:      string
  workflowName:    string
  traceId:         string
  status:          WorkflowInstanceStatus
  startedAt?:      string
  completedAt?:    string
  totalDurationMs?: number
  error:           boolean
  matchedSteps:    number
  totalSteps:      number
  steps?:          WorkflowInstanceStepDetail[]
  createdAt:       string
  updatedAt:       string
}

export interface WorkflowInstanceStats {
  workflowId:      string
  workflowName:    string
  totalInstances:  number
  completeCount:   number
  inProgressCount: number
  failedCount:     number
  successRatePct:  number
  avgDurationMs:   number
  minDurationMs:   number
  maxDurationMs:   number
}

export interface WorkflowStepMetrics {
  stepId:           string
  stepOrder:        number
  label?:           string
  serviceName:      string
  httpMethod:       string
  pathPattern:      string
  requestRate:      number | null
  errorRate:        number | null
  latencyP50:       number | null
  latencyP95:       number | null
  latencyP99:       number | null
  recentTraceCount: number | null
  recentErrorCount: number | null
}

export interface WorkflowStepMetricsResponse {
  workflowId:   string
  workflowName: string
  steps:        WorkflowStepMetrics[]
}

export interface LiveCorrelationResponse {
  stats:     WorkflowInstanceStats
  instances: WorkflowInstance[]
}

// ── Sprint 13: Custom Dashboards ──────────────────────────────────────────

export * from './dashboard'

// ── Sprint 14: Reports ──────────────────────────────────────────────────────

export type ReportType   = 'KPI' | 'PERFORMANCE'
export type ReportStatus = 'QUEUED' | 'GENERATING' | 'COMPLETED' | 'FAILED'
export type ReportFormat = 'PDF'
export type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface Report {
  id:             string
  name:           string
  reportType:     ReportType
  reportFormat:   ReportFormat
  status:         ReportStatus
  requestedBy:    string
  serviceId?:     string
  serviceName?:   string
  timeRangeStart: string  // ISO-8601
  timeRangeEnd:   string  // ISO-8601
  fileSizeBytes?: number
  errorMessage?:  string
  createdAt:      string  // ISO-8601
  completedAt?:   string  // ISO-8601
}

export interface GenerateReportPayload {
  name:           string
  reportType:     ReportType
  serviceId?:     string
  serviceName?:   string
  timeRangeStart: string  // ISO-8601
  timeRangeEnd:   string  // ISO-8601
}

export interface ReportSchedule {
  id:             string
  name:           string
  reportType:     ReportType
  frequency:      ScheduleFrequency
  cronExpression: string
  recipients:     string[]
  serviceId?:     string
  serviceName?:   string
  active:         boolean
  createdBy:      string
  lastRunAt?:     string  // ISO-8601
  nextRunAt?:     string  // ISO-8601
  createdAt:      string  // ISO-8601
}

export interface CreateReportSchedulePayload {
  name:        string
  reportType:  ReportType
  frequency:   ScheduleFrequency
  recipients:  string[]
  serviceId?:  string
  serviceName?: string
}

export interface UpdateReportSchedulePayload {
  name?:       string
  frequency?:  ScheduleFrequency
  recipients?: string[]
  active?:     boolean
}

// ── Sprint 14: Synthetic Monitoring ─────────────────────────────────────────

export interface SyntheticCheck {
  id:                   string
  name:                 string
  serviceId?:           string
  serviceName?:         string
  url:                  string
  httpMethod:           string
  requestHeaders?:      Record<string, string>
  requestBody?:         string
  scheduleCron:         string
  timeoutMs:            number
  expectedStatusCode?:  number
  expectedBodyContains?: string
  maxLatencyMs?:        number
  slaRuleId?:           string
  active:               boolean
  createdBy:            string
  createdAt:            string
  updatedAt:            string
}

export interface CreateSyntheticCheckPayload {
  name:                 string
  serviceId?:           string
  serviceName?:         string
  url:                  string
  httpMethod:           string
  requestHeaders?:      Record<string, string>
  requestBody?:         string
  scheduleCron:         string
  timeoutMs:            number
  expectedStatusCode?:  number
  expectedBodyContains?: string
  maxLatencyMs?:        number
  slaRuleId?:           string
}

export interface UpdateSyntheticCheckPayload {
  name?:                 string
  url?:                  string
  httpMethod?:           string
  requestHeaders?:       Record<string, string>
  requestBody?:          string
  scheduleCron?:         string
  timeoutMs?:            number
  expectedStatusCode?:   number
  expectedBodyContains?: string
  maxLatencyMs?:         number
  slaRuleId?:            string
  active?:               boolean
}

export interface SyntheticResult {
  id:                string
  checkId:           string
  checkName?:        string
  statusCode?:       number
  latencyMs?:        number
  success:           boolean
  statusCodeMatch?:  boolean
  bodyMatch?:        boolean
  latencyMatch?:     boolean
  errorMessage?:     string
  responseBodySnippet?: string
  executedAt:        string
}
