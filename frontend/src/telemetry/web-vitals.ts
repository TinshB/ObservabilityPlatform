/**
 * Core Web Vitals collection → backend ingestion + OTel spans.
 *
 * Uses Google's `web-vitals` library to capture LCP, FCP, CLS, INP, TTFB.
 * Each measurement is:
 *   1. POSTed to /api/v1/web-vitals (backend records as Micrometer histogram → Prometheus)
 *   2. Emitted as an OTel span (for trace-level visibility)
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import type { Metric } from 'web-vitals'
import { getTracer } from './sdk'
import type { TelemetryConfig } from './config'

let serviceName = 'obs-frontend'

/**
 * Start collecting Core Web Vitals.
 */
export function startWebVitalsCollection(config: TelemetryConfig): void {
  serviceName = config.serviceName
  onLCP(reportMetric)
  onFCP(reportMetric)
  onCLS(reportMetric)
  onINP(reportMetric)
  onTTFB(reportMetric)
}

function reportMetric(metric: Metric): void {
  // 1. POST to backend for Prometheus histogram ingestion
  sendToBackend(metric)

  // 2. Also emit as OTel span for trace visibility
  emitSpan(metric)
}

function sendToBackend(metric: Metric): void {
  const payload = JSON.stringify({
    serviceName,
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType ?? 'unknown',
  })

  // Use sendBeacon for reliability (survives page unload)
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' })
    navigator.sendBeacon('/api/v1/web-vitals', blob)
  } else {
    // Fallback to fetch (fire-and-forget)
    fetch('/api/v1/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => { /* ignore — best effort */ })
  }
}

function emitSpan(metric: Metric): void {
  const tracer = getTracer('web-vitals')
  const span = tracer.startSpan(`web-vital.${metric.name}`)

  span.setAttributes({
    'web_vital.name': metric.name,
    'web_vital.id': metric.id,
    'web_vital.value': metric.value,
    'web_vital.rating': metric.rating,
    'web_vital.delta': metric.delta,
    'web_vital.navigation_type': metric.navigationType ?? 'unknown',
  })

  if (metric.entries.length > 0) {
    span.setAttribute('web_vital.entries_count', metric.entries.length)
  }

  span.end()
}
