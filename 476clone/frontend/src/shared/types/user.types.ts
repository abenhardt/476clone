/**
 * user.types.ts
 * Core user, role, and authentication type definitions.
 * Mirrors the Laravel backend's User model and Sanctum auth responses.
 */

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  PARENT: 'applicant',
  MEDICAL: 'medical',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface Role {
  id: number;
  name: RoleName;
  display_name: string;
}

export interface User {
  id: number;
  name: string;
  preferred_name?: string | null;
  email: string;
  email_verified_at: string | null;
  phone?: string | null;
  avatar_path?: string | null;
  avatar_url?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  mfa_enabled: boolean;
  roles: Role[];
  /** Convenience: primary role name string (first role, or derived from roles array) */
  role?: string;
  created_at: string;
  updated_at: string;
}

export interface UserEmergencyContact {
  id: number;
  user_id: number;
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

/** Get the primary role name from a User object */
export function getUserRole(user: User): RoleName | undefined {
  if (user.role) return user.role as RoleName;
  return user.roles?.[0]?.name;
}

// ---------------------------------------------------------------------------
// Auth responses
// ---------------------------------------------------------------------------

/**
 * Login success: { success, message, data: { user, token } }
 * MFA challenge: { success, message, mfa_required: true }  ← no data object
 */
export interface AuthResponse {
  success: boolean;
  message: string;
  /** Present only when backend requires MFA before issuing a token. */
  mfa_required?: boolean;
  /** Absent on MFA challenge responses. */
  data?: {
    user: User;
    token: string;
  };
}

export interface MFASetupResponse {
  message: string;
  data: {
    secret: string;
    qr_code: string; // base64 data URI
  };
}

export interface MFAVerifyResponse {
  message: string;
  data: {
    verified: boolean;
  };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface ProfilePrefill {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}
