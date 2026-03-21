/**
 * RouteTracer — React Router v6 integration.
 *
 * Creates a span for each route navigation, recording path, navigation type,
 * and duration. Wraps its children (typically <Outlet />) and listens to
 * location changes.
 *
 * Usage:
 *   <RouteTracer>
 *     <Outlet />
 *   </RouteTracer>
 */

import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { getTracer } from '../sdk'
import type { Span } from '@opentelemetry/api'

interface RouteTracerProps {
  children: React.ReactNode
}

export function RouteTracer({ children }: RouteTracerProps) {
  const location = useLocation()
  const navType = useNavigationType()
  const spanRef = useRef<Span | null>(null)

  useEffect(() => {
    // End the previous route span
    if (spanRef.current) {
      spanRef.current.end()
      spanRef.current = null
    }

    // Start a new span for this route
    const tracer = getTracer('router')
    const span = tracer.startSpan(`navigate ${location.pathname}`)

    span.setAttributes({
      'http.route': location.pathname,
      'navigation.type': navType,
      'navigation.search': location.search || undefined,
      'navigation.hash': location.hash || undefined,
    })

    spanRef.current = span

    // End span on unmount (covers final route)
    return () => {
      if (spanRef.current) {
        spanRef.current.end()
        spanRef.current = null
      }
    }
  }, [location.pathname, location.search, navType])

  return <>{children}</>
}
