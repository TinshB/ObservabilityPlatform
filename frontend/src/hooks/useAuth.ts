import { useCallback } from 'react'
import { useAuthStore } from '@/store'
import type { UserRole } from '@/types'

/**
 * Convenience hook -- exposes auth state and actions to components.
 *
 * Provides:
 *  - Reactive auth state (isAuthenticated, user, loading, error)
 *  - login / logout actions that call the async store methods
 *  - Role-checking utilities (hasRole, hasAnyRole)
 */
export function useAuth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user            = useAuthStore((s) => s.user)
  const loading         = useAuthStore((s) => s.loading)
  const error           = useAuthStore((s) => s.error)
  const loginAsync      = useAuthStore((s) => s.loginAsync)
  const logoutAsync     = useAuthStore((s) => s.logoutAsync)
  const refreshTokenFn  = useAuthStore((s) => s.refreshTokenAsync)
  const clearErrorFn    = useAuthStore((s) => s.clearError)

  /**
   * Authenticate with username and password.
   */
  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      await loginAsync(username, password)
    },
    [loginAsync],
  )

  /**
   * Log the user out on both client and server.
   */
  const logout = useCallback(async (): Promise<void> => {
    await logoutAsync()
  }, [logoutAsync])

  /**
   * Silently refresh the access token.
   */
  const refreshToken = useCallback(async (): Promise<void> => {
    await refreshTokenFn()
  }, [refreshTokenFn])

  /**
   * Clear the current auth error.
   */
  const clearError = useCallback((): void => {
    clearErrorFn()
  }, [clearErrorFn])

  /**
   * Check whether the authenticated user has a specific role.
   */
  const hasRole = useCallback(
    (role: UserRole): boolean => {
      return user?.roles.includes(role) ?? false
    },
    [user],
  )

  /**
   * Check whether the authenticated user has at least one of the given roles.
   */
  const hasAnyRole = useCallback(
    (roles: UserRole[]): boolean => {
      return roles.some((role) => (user?.roles.includes(role)) ?? false)
    },
    [user],
  )

  return {
    isAuthenticated,
    user,
    loading,
    error,
    login,
    logout,
    refreshToken,
    clearError,
    hasRole,
    hasAnyRole,
  }
}
