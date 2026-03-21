/**
 * Register OpenTelemetry auto-instrumentations for the browser.
 *
 * Each instrumentation is conditionally enabled based on config flags.
 * All produce spans automatically — no manual code needed in app modules.
 */

import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction'
import type { TelemetryConfig } from './config'

/**
 * Registers browser auto-instrumentations. Call after `initSdk()`.
 *
 * Returns an unregister callback for cleanup.
 */
export function registerAutoInstrumentations(config: TelemetryConfig): () => void {
  const instrumentations = []

  // ── XHR (covers Axios which uses XMLHttpRequest) ──────────────────────────
  instrumentations.push(
    new XMLHttpRequestInstrumentation({
      propagateTraceHeaderCorsUrls: config.propagateTo,
    }),
  )

  // ── Fetch API ─────────────────────────────────────────────────────────────
  instrumentations.push(
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: config.propagateTo,
    }),
  )

  // ── Document Load (page load timing) ──────────────────────────────────────
  if (config.enableDocumentLoad) {
    instrumentations.push(new DocumentLoadInstrumentation())
  }

  // ── User Interaction (clicks, submits) ────────────────────────────────────
  if (config.enableUserInteraction) {
    instrumentations.push(
      new UserInteractionInstrumentation({
        eventNames: ['click', 'submit'],
      }),
    )
  }

  const registration = registerInstrumentations({ instrumentations })

  return () => registration?.()
}
