/**
 * OpenTelemetry configuration — types, defaults, and environment variable reader.
 *
 * Pluggable: consumers override via `initTelemetry({ ... })`.
 * Environment-aware: reads VITE_OTEL_* variables at build time.
 */

export interface TelemetryConfig {
  /** Service name reported in every span. */
  serviceName: string
  /** OTLP/HTTP collector endpoint (e.g. http://localhost:4318). */
  collectorUrl: string
  /** Master kill-switch — disables all instrumentation when false. */
  enabled: boolean
  /** Sampling ratio 0.0–1.0 (1.0 = capture everything). */
  samplingRatio: number
  /** URL patterns to propagate W3C traceparent header to. */
  propagateTo: RegExp[]
  /** Collect Core Web Vitals (LCP, FCP, CLS, INP, TTFB). */
  enableWebVitals: boolean
  /** Instrument user interactions (clicks, submits). */
  enableUserInteraction: boolean
  /** Instrument document/page load timing. */
  enableDocumentLoad: boolean
}

const DEFAULTS: TelemetryConfig = {
  serviceName: 'obs-frontend',
  collectorUrl: 'http://localhost:4318',
  enabled: true,
  samplingRatio: 1.0,
  propagateTo: [/^\/api/],
  enableWebVitals: true,
  enableUserInteraction: true,
  enableDocumentLoad: true,
}

/**
 * Merge user config → env vars → defaults.
 * User config takes highest precedence.
 */
export function resolveConfig(user?: Partial<TelemetryConfig>): TelemetryConfig {
  const env = readEnv()
  return { ...DEFAULTS, ...env, ...user }
}

function readEnv(): Partial<TelemetryConfig> {
  const partial: Partial<TelemetryConfig> = {}

  const enabled = import.meta.env.VITE_OTEL_ENABLED
  if (enabled !== undefined) {
    partial.enabled = enabled !== 'false' && enabled !== '0'
  }

  const url = import.meta.env.VITE_OTEL_COLLECTOR_URL
  if (url) partial.collectorUrl = url

  const name = import.meta.env.VITE_OTEL_SERVICE_NAME
  if (name) partial.serviceName = name

  const ratio = import.meta.env.VITE_OTEL_SAMPLE_RATIO
  if (ratio) {
    const parsed = parseFloat(ratio)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      partial.samplingRatio = parsed
    }
  }

  return partial
}
