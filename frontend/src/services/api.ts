import axios from 'axios'
import type { AxiosRequestConfig, AxiosError } from 'axios'
import type { ApiResponse } from '@/types'
import type { TokenResponse } from './authService'
import { attachTracePropagator } from '@/telemetry/propagator'
import { resolveConfig } from '@/telemetry/config'

/**
 * Configured Axios instance shared across all API service modules.
 *
 * Base URL: /api/v1  (proxied to Spring Boot gateway in development)
 *
 * Interceptors:
 *  - Request:  attaches Bearer token from Zustand auth store
 *  - Response: handles 401 with transparent token refresh + request replay
 */
const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000, // 30 s
})

// ── Request interceptor -- attach JWT ────────────────────────────────────────
api.interceptors.request.use((config) => {
  // Read directly from Zustand persist storage to avoid circular import
  const raw = localStorage.getItem('obs-auth')
  if (raw) {
    try {
      const { state } = JSON.parse(raw) as { state: { accessToken: string | null } }
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`
      }
    } catch {
      // Ignore parse errors -- request continues without auth header
    }
  }
  return config
})

// ── Response interceptor -- handle 401 with token refresh ────────────────────

/** Flag to prevent multiple concurrent refresh attempts. */
let isRefreshing = false

/** Queue of requests waiting for the token refresh to complete. */
let failedQueue: Array<{
  resolve: (token: string) => void
  reject:  (error: unknown) => void
}> = []

/**
 * Process all queued requests after a refresh attempt completes.
 *
 * @param error - If set, all queued requests are rejected with this error
 * @param token - If set, all queued requests are retried with this new token
 */
function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((pending) => {
    if (error) {
      pending.reject(error)
    } else if (token) {
      pending.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    // Only handle 401 errors that haven't already been retried
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    // Read the refresh token from persisted Zustand storage
    const raw = localStorage.getItem('obs-auth')
    let storedRefreshToken: string | null = null
    if (raw) {
      try {
        const { state } = JSON.parse(raw) as { state: { refreshToken: string | null } }
        storedRefreshToken = state?.refreshToken ?? null
      } catch {
        // Parse error -- fall through to clear state
      }
    }

    // No refresh token available -- clear auth and redirect
    if (!storedRefreshToken) {
      localStorage.removeItem('obs-auth')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // If a refresh is already in progress, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((newToken) => {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
        }
        return api(originalRequest)
      })
    }

    // Mark as retried and start refresh
    originalRequest._retry = true
    isRefreshing = true

    try {
      // Call refresh endpoint directly (not through `api`) to avoid interceptor loop
      const { data } = await axios.post<ApiResponse<TokenResponse>>(
        '/api/v1/auth/refresh',
        { refreshToken: storedRefreshToken },
        { headers: { 'Content-Type': 'application/json' } },
      )

      const newAccessToken  = data.data.accessToken
      const newRefreshToken = data.data.refreshToken

      // Update persisted Zustand state directly
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { state: Record<string, unknown> }
          parsed.state.accessToken  = newAccessToken
          parsed.state.refreshToken = newRefreshToken
          localStorage.setItem('obs-auth', JSON.stringify(parsed))
        } catch {
          // If we can't update localStorage, the refresh still succeeded
        }
      }

      // Process the queue with the new token
      processQueue(null, newAccessToken)

      // Retry the original request with the new token
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      }
      return api(originalRequest)
    } catch (refreshError) {
      // Refresh failed -- reject all queued requests and clear auth
      processQueue(refreshError, null)
      localStorage.removeItem('obs-auth')
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

// ── OTel trace-context propagation ─────────────────────────────────────────
// Injects W3C traceparent header into outgoing requests for distributed tracing.
attachTracePropagator(api, resolveConfig())

export default api
