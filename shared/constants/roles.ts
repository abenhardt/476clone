/**
 * roles.ts — Role name constants, types, and helper functions
 *
 * Single source of truth for every role that exists in the system.
 * Import ROLES instead of writing raw strings like 'admin' so typos are caught
 * at compile time by TypeScript.
 *
 * Exported:
 * - ROLES         — plain string constants (e.g. ROLES.ADMIN = 'admin')
 * - RoleName      — TypeScript union type of all valid role strings
 * - ROLE_LABELS   — human-readable display names for each role
 * - ADMIN_ROLES   — array of roles that have admin-level access
 * - getPrimaryRole()     — resolves the highest-privilege role from a roles array
 * - getDashboardRoute()  — returns the correct dashboard URL for a role
 * - getProfileRoute()    — returns the correct profile URL for a role
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  APPLICANT: 'applicant',
  MEDICAL: 'medical',
} as const;

// TypeScript union type derived from the ROLES values: 'super_admin' | 'admin' | 'applicant' | 'medical'
export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// Human-readable labels used in the UI (e.g. user management table, profile header)
export const ROLE_LABELS: Record<RoleName, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  applicant: 'Applicant',
  medical: 'Medical',
};

/** Roles that have admin-level access — used for conditional rendering of admin features */
export const ADMIN_ROLES: RoleName[] = [
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

/**
 * Determine a user's primary role from their roles array.
 * Always returns the highest privilege role if multiple are present.
 * Priority order: super_admin > admin > medical > applicant
 */
export function getPrimaryRole(
  roles?: { name: RoleName }[]
): RoleName | null {

  if (!roles || roles.length === 0) {
    return null;
  }

  // Check roles in descending privilege order — return the first match found
  const priority: RoleName[] = [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.MEDICAL,
    ROLES.APPLICANT,
  ];

  for (const role of priority) {
    if (roles.some((r) => r.name === role)) {
      return role;
    }
  }

  return null;
}

/**
 * Returns the dashboard URL for a given role.
 * Used after login to redirect the user to their portal home.
 */
export function getDashboardRoute(role: RoleName | null): string {

  if (!role) {
    return '/login';
  }

  const routes: Record<RoleName, string> = {
    super_admin: '/super-admin/dashboard',
    admin: '/admin/dashboard',
    medical: '/medical/dashboard',
    applicant: '/applicant/dashboard',
  };

  return routes[role];
}

/**
 * Returns the profile URL for a given role.
 * Each portal hosts its own profile page under its own URL prefix.
 */
export function getProfileRoute(role: RoleName | null): string {

  if (!role) {
    return '/login';
  }

  const routes: Record<RoleName, string> = {
    super_admin: '/super-admin/profile',
    admin: '/admin/profile',
    medical: '/medical/profile',
    applicant: '/applicant/profile',
  };

  return routes[role];
}
