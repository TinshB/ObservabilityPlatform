import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { User } from '@/types'
import * as authService from '@/services/authService'

// ─────────────────────────────────────────────────────────────────────────────
// Auth store
// Manages authentication state, tokens, and async auth operations.
// ─────────────────────────────────────────────────────────────────────────────

interface AuthState {
  /** Whether the user is currently authenticated. */
  isAuthenticated: boolean
  /** The authenticated user's profile, or null when logged out. */
  user:            User | null
  /** JWT access token used for API requests. */
  accessToken:     string | null
  /** Refresh token used to obtain new access tokens. */
  refreshToken:    string | null
  /** True while an async auth operation is in flight. */
  loading:         boolean
  /** Human-readable error from the last failed auth operation. */
  error:           string | null

  // ── Synchronous actions ──────────────────────────────────────────────────

  /** Set auth state directly (used by token refresh interceptor). */
  login:  (user: User, accessToken: string, refreshToken: string) => void
  /** Clear all auth state. */
  logout: () => void
  /** Clear the current error message. */
  clearError: () => void

  // ── Async actions ────────────────────────────────────────────────────────

  /**
   * Authenticate with username and password.
   * On success, fetches the current user profile and updates state.
   */
  loginAsync: (username: string, password: string) => Promise<void>

  /**
   * Silently refresh the access token using the stored refresh token.
   */
  refreshTokenAsync: () => Promise<void>

  /**
   * Log the user out on both client and server.
   */
  logoutAsync: () => Promise<void>

  /**
   * Fetch the authenticated user's profile from the server.
   */
  fetchCurrentUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        isAuthenticated: false,
        user:            null,
        accessToken:     null,
        refreshToken:    null,
        loading:         false,
        error:           null,

        // ── Synchronous ────────────────────────────────────────────────────

        login: (user, accessToken, refreshToken) =>
          set(
            {
              isAuthenticated: true,
              user,
              accessToken,
              refreshToken,
              error: null,
            },
            false,
            'auth/login',
          ),

        logout: () =>
          set(
            {
              isAuthenticated: false,
              user:            null,
              accessToken:     null,
              refreshToken:    null,
              loading:         false,
              error:           null,
            },
            false,
            'auth/logout',
          ),

        clearError: () =>
          set({ error: null }, false, 'auth/clearError'),

        // ── Async ──────────────────────────────────────────────────────────

        loginAsync: async (username, password) => {
          set({ loading: true, error: null }, false, 'auth/loginAsync:start')
          try {
            const tokens = await authService.login(username, password)
            set(
              {
                isAuthenticated: true,
                accessToken:     tokens.accessToken,
                refreshToken:    tokens.refreshToken,
              },
              false,
              'auth/loginAsync:tokens',
            )

            const user = await authService.getCurrentUser()
            set(
              { user, loading: false },
              false,
              'auth/loginAsync:user',
            )
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : 'Login failed. Please try again.'
            set(
              {
                isAuthenticated: false,
                user:            null,
                accessToken:     null,
                refreshToken:    null,
                loading:         false,
                error:           message,
              },
              false,
              'auth/loginAsync:error',
            )
            throw err
          }
        },

        refreshTokenAsync: async () => {
          const currentRefreshToken = get().refreshToken
          if (!currentRefreshToken) {
            get().logout()
            return
          }

          try {
            const tokens = await authService.refreshToken(currentRefreshToken)
            set(
              {
                accessToken:  tokens.accessToken,
                refreshToken: tokens.refreshToken,
              },
              false,
              'auth/refreshTokenAsync:success',
            )
          } catch {
            get().logout()
          }
        },

        logoutAsync: async () => {
          try {
            await authService.logout()
          } catch {
            // Server-side logout failure is non-critical — clear local state regardless
          } finally {
            get().logout()
          }
        },

        fetchCurrentUser: async () => {
          set({ loading: true }, false, 'auth/fetchCurrentUser:start')
          try {
            const user = await authService.getCurrentUser()
            set(
              { user, loading: false },
              false,
              'auth/fetchCurrentUser:success',
            )
          } catch {
            set({ loading: false }, false, 'auth/fetchCurrentUser:error')
          }
        },
      }),
      {
        name: 'obs-auth',
        partialize: (state) => ({
          isAuthenticated: state.isAuthenticated,
          user:            state.user,
          accessToken:     state.accessToken,
          refreshToken:    state.refreshToken,
        }),
      },
    ),
    { name: 'AuthStore' },
  ),
)
