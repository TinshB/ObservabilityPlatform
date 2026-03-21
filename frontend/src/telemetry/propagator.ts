/**
 * Axios trace-context propagator.
 *
 * Injects W3C `traceparent` header into outgoing requests so backend
 * services can join the same distributed trace.
 *
 * Only propagates to URLs matching the configured `propagateTo` patterns
 * to avoid leaking trace IDs to third-party services.
 */

import { context, propagation } from '@opentelemetry/api'
import type { AxiosInstance } from 'axios'
import type { TelemetryConfig } from './config'

/**
 * Attach a request interceptor to the given Axios instance that injects
 * the W3C traceparent header from the current OTel context.
 *
 * Returns the interceptor ID for removal if needed.
 */
export function attachTracePropagator(
  axiosInstance: AxiosInstance,
  config: TelemetryConfig,
): number {
  return axiosInstance.interceptors.request.use((reqConfig) => {
    const url = reqConfig.url ?? ''

    // Only propagate to matching URLs
    const shouldPropagate = config.propagateTo.some((pattern) => pattern.test(url))
    if (!shouldPropagate) return reqConfig

    // Inject trace context headers into the request
    const carrier: Record<string, string> = {}
    propagation.inject(context.active(), carrier)

    // Merge propagation headers (traceparent, tracestate) into request
    for (const [key, value] of Object.entries(carrier)) {
      reqConfig.headers.set(key, value)
    }

    return reqConfig
  })
}
