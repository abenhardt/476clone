/**
 * RoleGuard.tsx — Role-based access control gate
 *
 * Sits inside ProtectedRoute (auth is already confirmed) and adds a second check:
 * "Does this user's role allow them into this section of the app?"
 *
 * If the user doesn't have an allowed role, they're either shown a custom fallback
 * component or redirected to /forbidden (default).
 *
 * Special rule: super_admin automatically inherits all admin permissions.
 * So passing allowedRoles={['admin']} will also let super_admin users through.
 *
 * Usage in routing:
 *   <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}>
 *     <Outlet />
 *   </RoleGuard>
 */

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { RoleName } from '@/shared/constants/roles';

interface RoleGuardProps {
  children: ReactNode;
  // The roles that are permitted to access the wrapped content
  allowedRoles: RoleName[];
  // Optional: render this instead of redirecting when access is denied
  fallback?: ReactNode;
  // Where to send the user when access is denied (defaults to /forbidden)
  redirectTo?: string;
}

export function RoleGuard({
  children,
  allowedRoles,
  fallback,
  redirectTo = '/forbidden',
}: RoleGuardProps) {
  const user = useAppSelector((state) => state.auth.user);
  // Read from normalized roles[] first; fall back to role string only (never the object)
  const roleName = user?.roles?.[0]?.name ?? (typeof user?.role === 'string' ? user.role : undefined);

  // No user at all — ProtectedRoute should have caught this, redirect to login.
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // User is authenticated but role data is missing or malformed — send to /forbidden.
  // Sending to /login here would create a redirect loop: ProtectedRoute passes the user
  // through (isAuthenticated=true), then RoleGuard sends them to /login, then
  // ProtectedRoute passes them through again, etc.
  if (!roleName) {
    return <Navigate to="/forbidden" replace />;
  }

  // super_admin inherits admin permissions — they can access the admin portal too
  const effectiveRoles = roleName === 'super_admin' ? ['super_admin', 'admin'] : [roleName];

  // Check if any of the user's effective roles appear in the allowed list
  const hasAccess = allowedRoles.some((role) =>
    effectiveRoles.includes(role as 'super_admin' | 'admin')
  );

  // Access denied — show fallback content or redirect
  if (!hasAccess) {
    return fallback ? <>{fallback}</> : <Navigate to={redirectTo} replace />;
  }

  // Access granted — render children wrapped in a React Fragment
  return <>{children}</>;
}
