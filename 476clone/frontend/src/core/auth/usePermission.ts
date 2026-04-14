/**
 * usePermission.ts — Permission checking hook
 *
 * A React hook that gives any component easy access to permission checks
 * for the currently logged-in user.
 *
 * It reads the user's role from Redux, looks up that role's permissions in the
 * ROLE_PERMISSIONS map, and returns three helper functions:
 *
 * - hasPermission(perm)       → true if the user has this one specific permission
 * - hasAnyPermission(perms[]) → true if the user has at least one from the list
 * - hasAllPermissions(perms[])→ true only if the user has every permission in the list
 *
 * Usage example:
 *   const { hasPermission } = usePermission();
 *   if (hasPermission(PERMISSIONS.MANAGE_USERS)) { ... }
 */

import { useAppSelector } from '@/store/hooks';
import { ROLE_PERMISSIONS, Permission } from './permissionMap';
import { RoleName } from '@/shared/constants/roles';

export function usePermission() {
  const user = useAppSelector((state) => state.auth.user);
  // Prefer the plain role string; fall back to the first entry in the roles array
  const roleName = user?.role ?? user?.roles?.[0]?.name;

  // Look up the permission list for this role — empty array if role is unknown
  const permissions = roleName && roleName in ROLE_PERMISSIONS
    ? ROLE_PERMISSIONS[roleName as RoleName]
    : [];

  // Check for a single specific permission
  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  // Check if at least one permission from a list is granted (OR logic)
  const hasAnyPermission = (perms: Permission[]): boolean => {
    return perms.some((p) => permissions.includes(p));
  };

  // Check if every permission in a list is granted (AND logic)
  const hasAllPermissions = (perms: Permission[]): boolean => {
    return perms.every((p) => permissions.includes(p));
  };

  return {
    // The full resolved permissions array (useful for conditional rendering loops)
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
