/**
 * AuthorityGuard.tsx — Fine-grained permission gate
 *
 * While RoleGuard controls access at the route/portal level ("can this role enter
 * the admin section?"), AuthorityGuard controls access at the UI element level
 * ("can this user see this specific button or panel?").
 *
 * It checks the current user's permissions via usePermission() and conditionally
 * renders its children. If access is denied, it renders `fallback` (default: nothing).
 *
 * The `mode` prop controls how multiple permissions are evaluated:
 * - 'any' (default): user needs at least ONE of the listed permissions
 * - 'all': user must have ALL of the listed permissions
 *
 * Usage example:
 *   <AuthorityGuard requires={PERMISSIONS.MANAGE_USERS}>
 *     <DeleteUserButton />
 *   </AuthorityGuard>
 */

import { ReactNode } from 'react';
import { usePermission } from './usePermission';
import { Permission } from './permissionMap';

interface AuthorityGuardProps {
  children: ReactNode;
  // A single permission string or an array of permission strings to check
  requires: Permission | Permission[];
  // 'any': pass if user has at least one | 'all': pass only if user has every one
  mode?: 'any' | 'all';
  // What to show when access is denied (null = render nothing)
  fallback?: ReactNode;
}

export function AuthorityGuard({
  children,
  requires,
  mode = 'any',
  fallback = null,
}: AuthorityGuardProps) {
  const { hasAnyPermission, hasAllPermissions } = usePermission();

  // Normalize to array so both single and multi-permission cases share the same logic
  const perms = Array.isArray(requires) ? requires : [requires];

  // Evaluate based on mode
  const hasAccess = mode === 'all' ? hasAllPermissions(perms) : hasAnyPermission(perms);

  // No access — render fallback (or nothing if fallback is null)
  if (!hasAccess) {
    return <>{fallback}</>;
  }

  // Access granted — render the protected content
  return <>{children}</>;
}
