/**
 * runtime.ts — Runtime mode configuration (SINGLE SOURCE OF TRUTH)
 *
 * This is the ONLY module that directly reads:
 *   - import.meta.env.VITE_DEMO_MODE
 *   - localStorage('demo_role')
 *
 * No other file may read these env variables or localStorage keys for
 * demo-role / runtime logic directly. Import from this module instead.
 *
 * ACTIVATION:
 *   vite --mode demo       (uses .env.demo, sets VITE_DEMO_MODE=true)
 *   VITE_DEMO_MODE=true    (inline env override)
 *
 * REVERTING:
 *   Remove VITE_DEMO_MODE or set it to anything other than 'true'.
 *   All demo-mode branches are gated by isDemoMode — zero cost in prod builds.
 *
 * HIPAA NOTE:
 *   All demo users contain NO real PHI. They are synthetic identities used
 *   only to satisfy the frontend auth state shape. No real data is exposed.
 */

import type { User, Role } from '@/shared/types';
import type { RoleName } from '@/shared/constants/roles';
import { getDashboardRoute } from '@/shared/constants/roles';

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

/**
 * True when the app is running in demo mode (VITE_DEMO_MODE=true).
 * Evaluated at build time — tree-shaken away in non-demo production builds.
 * This is a module-level constant; demo mode cannot be toggled at runtime.
 */
export const isDemoMode: boolean = import.meta.env.VITE_DEMO_MODE === 'true';

// Backwards-compat alias — matches the existing DEMO_MODE export used throughout
// the codebase. New code should prefer isDemoMode.
export const DEMO_MODE = isDemoMode;

// ---------------------------------------------------------------------------
// Demo role management
// ---------------------------------------------------------------------------

const DEMO_ROLE_KEY = 'demo_role';
const DEFAULT_DEMO_ROLE: RoleName = 'admin';

const VALID_DEMO_ROLES: RoleName[] = ['super_admin', 'admin', 'applicant', 'medical'];

/**
 * Returns the currently active demo role, read from localStorage.
 * This is a function (not a constant) because the role can change at runtime
 * via setDemoRole(). Call it fresh each time you need the current value.
 *
 * Returns 'admin' as a safe default if no role is stored or the stored value
 * is not a valid demo role.
 */
export function currentDemoRole(): RoleName {
  if (!isDemoMode) return DEFAULT_DEMO_ROLE;
  const stored = localStorage.getItem(DEMO_ROLE_KEY) as RoleName | null;
  if (stored && VALID_DEMO_ROLES.includes(stored)) return stored;
  return DEFAULT_DEMO_ROLE;
}

/**
 * Persists a new demo role to localStorage.
 * After calling this, getDemoUser() will return the new role's user object.
 */
export function setDemoRole(role: RoleName): void {
  localStorage.setItem(DEMO_ROLE_KEY, role);
}

/**
 * Returns the dashboard URL for the current demo role.
 * Useful for the initial root redirect and for DemoRoleSwitcher navigation.
 */
export function getDemoDashboardRoute(): string {
  return getDashboardRoute(currentDemoRole());
}

// ---------------------------------------------------------------------------
// Demo user definitions
// ---------------------------------------------------------------------------

/** Shared non-PHI fields common to all demo users */
const DEMO_USER_BASE = {
  preferred_name: 'Demo',
  email_verified_at: '2026-01-01T00:00:00.000Z',
  phone: null,
  avatar_path: null,
  avatar_url: null,
  address_line_1: null,
  address_line_2: null,
  city: null,
  state: null,
  postal_code: null,
  country: null,
  mfa_enabled: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
} as const;

function makeRole(id: number, name: RoleName, display_name: string): Role {
  return { id, name, display_name };
}

/**
 * Typed map of demo users — one per supported role.
 * Each user mirrors the real User shape so existing guards, hooks, and
 * role-dependent components behave naturally without any special casing.
 *
 * IDs are in the 9000-range and emails use .dev TLD to prevent any
 * accidental confusion with real accounts.
 */
export const DEMO_USERS: Record<RoleName, User> = {
  super_admin: {
    ...DEMO_USER_BASE,
    id: 9001,
    name: 'Demo Super Admin',
    email: 'demo-superadmin@campburntgin.dev',
    role: 'super_admin',
    roles: [makeRole(1, 'super_admin', 'Super Administrator')],
  },
  admin: {
    ...DEMO_USER_BASE,
    id: 9002,
    name: 'Demo Admin',
    email: 'demo-admin@campburntgin.dev',
    role: 'admin',
    roles: [makeRole(2, 'admin', 'Administrator')],
  },
  applicant: {
    ...DEMO_USER_BASE,
    id: 9003,
    name: 'Demo Applicant',
    email: 'demo-applicant@campburntgin.dev',
    role: 'applicant',
    roles: [makeRole(4, 'applicant', 'Applicant')],
  },
  medical: {
    ...DEMO_USER_BASE,
    id: 9004,
    name: 'Demo Medical Provider',
    email: 'demo-medical@campburntgin.dev',
    role: 'medical',
    roles: [makeRole(3, 'medical', 'Medical Provider')],
  },
};

/**
 * Returns the demo User object for the currently active demo role.
 * Reads localStorage synchronously — safe to call at app startup and at
 * runtime after setDemoRole() has been called.
 */
export function getDemoUser(): User {
  return DEMO_USERS[currentDemoRole()];
}

/**
 * Backwards-compat export matching the DEMO_USER constant in demoMode.ts.
 * Evaluated at module load time — reflects the stored role at app startup.
 * For runtime role switching, use getDemoUser() directly.
 */
export const DEMO_USER: User = getDemoUser();
