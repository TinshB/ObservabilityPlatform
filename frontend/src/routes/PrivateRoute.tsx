import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { useAuthStore } from '@/store'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import type { UserRole } from '@/types'

interface PrivateRouteProps {
  /** Optional roles required to access the guarded routes. */
  requiredRoles?: UserRole[]
}

/**
 * Guards application routes behind authentication and optional role checks.
 *
 * Behaviour:
 *  - Unauthenticated users are redirected to /login (original path preserved).
 *  - If the user has a token but no profile loaded yet, fetchCurrentUser is
 *    called and a loading spinner is shown until it completes.
 *  - When requiredRoles is specified, the user must hold at least one of the
 *    listed roles. Otherwise a 403 Forbidden message is shown.
 */
export default function PrivateRoute({ requiredRoles }: PrivateRouteProps) {
  const isAuthenticated  = useAuthStore((s) => s.isAuthenticated)
  const user             = useAuthStore((s) => s.user)
  const accessToken      = useAuthStore((s) => s.accessToken)
  const loading          = useAuthStore((s) => s.loading)
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser)
  const location         = useLocation()

  // If we have a token but no user profile, fetch it on mount
  useEffect(() => {
    if (isAuthenticated && accessToken && !user && !loading) {
      fetchCurrentUser()
    }
  }, [isAuthenticated, accessToken, user, loading, fetchCurrentUser])

  // Not authenticated -- redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Authenticated but still loading user profile
  if (!user || loading) {
    return <LoadingSpinner fullScreen message="Verifying session..." />
  }

  // Role-based access check
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some((role) => user.roles.includes(role))

    if (!hasRequiredRole) {
      return (
        <Box
          sx={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            minHeight:      '60vh',
            gap:            2,
            textAlign:      'center',
            px:             3,
          }}
        >
          <Typography variant="h3" fontWeight={700} color="error.main">
            403
          </Typography>
          <Typography variant="h6" color="text.primary">
            Access Denied
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You do not have the required permissions to view this page.
          </Typography>
        </Box>
      )
    }
  }

  return <Outlet />
}
