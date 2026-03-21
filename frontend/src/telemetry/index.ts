/**
 * OpenTelemetry Automatic Instrumentation — public entry point.
 *
 * Pluggable in any React application:
 *
 *   import { initTelemetry } from './telemetry'
 *   const shutdown = initTelemetry()   // call before ReactDOM.createRoot()
 *
 * Configuration via argument or VITE_OTEL_* environment variables.
 */

import type { TelemetryConfig } from './config'
import { resolveConfig } from './config'
import { initSdk } from './sdk'
import { registerAutoInstrumentations } from './instrumentations'
import { startWebVitalsCollection } from './web-vitals'

export type { TelemetryConfig } from './config'
export { getTracer } from './sdk'
export { attachTracePropagator } from './propagator'
export { RouteTracer } from './react/RouteTracer'
export { ErrorBoundaryTracer } from './react/ErrorBoundaryTracer'

/**
 * Initialise OpenTelemetry instrumentation for the browser.
 *
 * Call once before `ReactDOM.createRoot()`. Returns a shutdown function
 * that flushes pending spans and tears down the provider.
 *
 * @param userConfig - Optional overrides (merged over env vars and defaults)
 */
export function initTelemetry(userConfig?: Partial<TelemetryConfig>): () => void {
  const config = resolveConfig(userConfig)

  if (!config.enabled) {
    return () => {} // no-op when disabled
  }

  // 1. Core SDK — TracerProvider + OTLP exporter
  const shutdownSdk = initSdk(config)

  // 2. Auto-instrumentations — XHR, Fetch, document-load, user-interaction
  const unregister = registerAutoInstrumentations(config)

  // 3. Web Vitals collection
  if (config.enableWebVitals) {
    startWebVitalsCollection(config)
  }

  // Combined shutdown
  return () => {
    unregister()
    shutdownSdk()
  }
}
