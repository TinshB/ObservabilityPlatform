/**
 * Core OTel SDK initialisation — TracerProvider, BatchSpanProcessor, OTLP exporter.
 *
 * Call `initSdk(config)` once at app startup. Returns a `shutdown` callback
 * that flushes remaining spans and tears down the provider.
 */

import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import {
  BatchSpanProcessor,
  AlwaysOnSampler,
  AlwaysOffSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions'
import { trace } from '@opentelemetry/api'
import type { TelemetryConfig } from './config'

let provider: WebTracerProvider | null = null

export function initSdk(config: TelemetryConfig): () => void {
  if (provider) return () => {} // already initialised

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: import.meta.env.MODE ?? 'development',
    'service.version': import.meta.env.VITE_APP_VERSION ?? '0.0.0',
  })

  const exporter = new OTLPTraceExporter({
    url: `${config.collectorUrl}/v1/traces`,
  })

  provider = new WebTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(exporter)],
    sampler: createSampler(config.samplingRatio),
  })

  // Register with default StackContextManager (no Zone.js needed for React)
  provider.register()

  return () => {
    provider?.shutdown()
    provider = null
  }
}

/**
 * Get a tracer from the globally registered provider.
 */
export function getTracer(name = 'obs-frontend') {
  return trace.getTracer(name)
}

// ── Internal ──────────────────────────────────────────────────────────────────

function createSampler(ratio: number) {
  if (ratio >= 1) return new AlwaysOnSampler()
  if (ratio <= 0) return new AlwaysOffSampler()
  return new TraceIdRatioBasedSampler(ratio)
}
