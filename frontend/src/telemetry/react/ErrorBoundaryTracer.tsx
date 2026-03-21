/**
 * ErrorBoundaryTracer — Error boundary that records exceptions as OTel spans.
 *
 * Also installs global handlers for uncaught errors and unhandled promise
 * rejections, so nothing slips through.
 *
 * Usage:
 *   <ErrorBoundaryTracer fallback={<ErrorPage />}>
 *     <App />
 *   </ErrorBoundaryTracer>
 */

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { getTracer } from '../sdk'
import { SpanStatusCode } from '@opentelemetry/api'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundaryTracer extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordError(error, {
      'error.source': 'react_error_boundary',
      'error.component_stack': info.componentStack ?? '',
    })
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError)
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError)
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  private handleWindowError = (event: ErrorEvent) => {
    recordError(event.error ?? new Error(event.message), {
      'error.source': 'window_onerror',
      'error.filename': event.filename ?? '',
      'error.lineno': event.lineno ?? 0,
      'error.colno': event.colno ?? 0,
    })
  }

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason))

    recordError(error, {
      'error.source': 'unhandled_rejection',
    })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultFallback />
    }
    return this.props.children
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function recordError(
  error: Error,
  attributes: Record<string, string | number> = {},
) {
  const tracer = getTracer('error-tracker')
  const span = tracer.startSpan('unhandled_error')

  span.setAttributes({
    'exception.type': error.name,
    'exception.message': error.message,
    'exception.stacktrace': error.stack ?? '',
    ...attributes,
  })

  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
  span.recordException(error)
  span.end()
}

function DefaultFallback() {
  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <h2>Something went wrong</h2>
      <p>An unexpected error occurred. Please refresh the page.</p>
      <button onClick={() => window.location.reload()}>Refresh</button>
    </div>
  )
}
