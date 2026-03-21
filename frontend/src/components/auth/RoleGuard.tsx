import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

interface RoleGuardProps {
  /** Roles that grant access to the guarded content. User must have at least one. */
  requiredRoles: UserRole[]
  /** Content rendered when the user holds a required role. */
  children: React.ReactNode
  /** Optional fallback rendered when the user lacks the required roles. */
  fallback?: React.ReactNode
}

/**
 * Conditionally renders children based on the authenticated user's roles.
 *
 * If the user holds at least one of the `requiredRoles`, the children are
 * rendered. Otherwise the optional `fallback` is shown (or nothing).
 *
 * @example
 * ```tsx
 * <RoleGuard requiredRoles={['ADMIN']}>
 *   <AdminPanel />
 * </RoleGuard>
 *
 * <RoleGuard requiredRoles={['ADMIN', 'OPERATOR']} fallback={<ReadOnlyView />}>
 *   <EditableView />
 * </RoleGuard>
 * ```
 */
export default function RoleGuard({
  requiredRoles,
  children,
  fallback = null,
}: RoleGuardProps) {
  const { hasAnyRole } = useAuth()

  if (hasAnyRole(requiredRoles)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
