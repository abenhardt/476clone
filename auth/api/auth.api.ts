/**
 * auth.api.ts — Authentication API calls
 *
 * This module owns every HTTP request related to authentication:
 * login, register, logout, password reset, MFA, and email verification.
 *
 * Key responsibility: role normalization.
 * The backend may return a user's role as a string, an object, or inside a `roles`
 * array. The frontend RBAC system always expects a plain string in `user.role` and
 * a normalized `roles` array. The `normalizeUser()` function handles all variants.
 *
 * It also maps the legacy backend value "parent" → "applicant" so the frontend
 * never has to deal with the old name.
 */

import axiosInstance from '@/api/axios.config';
import type {
  AuthResponse,
  MFASetupResponse,
  MFAVerifyResponse,
  User,
  Role,
  RoleName,
  ApiResponse,
} from '@/shared/types';

/**
 * normalizeUser — Normalize role names so frontend RBAC always receives valid values.
 *
 * Backend may return:
 * - role object  (e.g. { id: 1, name: 'admin' })
 * - role string  (e.g. 'admin')
 * - roles array  (e.g. [{ id: 1, name: 'admin' }])
 *
 * This function guarantees:
 *   user.role  → plain string RoleName
 *   user.roles → Role[]
 */
function normalizeUser(user: User & { role?: Role | string }): User {
  let roleName: RoleName | null = null;

  // Case 1: role is a full Role object — extract the name property
  if (typeof user.role === 'object' && user.role !== null) {
    roleName = (user.role as Role).name as RoleName;
  // Case 2: role is already a plain string
  } else if (typeof user.role === 'string') {
    roleName = user.role as RoleName;
  // Case 3: role info is only in the roles array — take the first entry
  } else if (user.roles?.length) {
    roleName = user.roles[0].name as RoleName;
  }

  // Guard against a legacy migration scenario where 'parent' may appear instead of 'applicant'.
  // The DB now stores 'applicant'; this mapping is a defensive fallback only.
  // Cast to string for comparison since 'parent' is not in the RoleName union.
  if ((roleName as string) === 'parent') {
    roleName = 'applicant';
  }

  // Build a normalized roles array so RBAC hooks always have a consistent shape.
  // Prefer the ID from the role object (Case 1 / login response), fall back to
  // the roles array (Case 3 / getAuthenticatedUser response), then 0 as sentinel.
  const roleObjectId =
    typeof user.role === 'object' && user.role !== null
      ? (user.role as Role).id
      : undefined;
  const roles: Role[] = roleName
    ? [{ id: roleObjectId ?? user.roles?.[0]?.id ?? 0, name: roleName, display_name: roleName }]
    : [];

  return {
    ...user,
    role: roleName as RoleName,
    roles,
  };
}

// ---------------------------------------------------------------------------
// Request payload type definitions
// ---------------------------------------------------------------------------

export interface LoginPayload {
  email: string;
  password: string;
  // Optional: provided when the user is completing MFA as part of login
  mfa_code?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  // Confirmation must match password — validated on the backend
  password_confirmation: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  // One-time reset token sent to the user's email
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

/** POST /api/auth/login — Authenticate and receive a Bearer token */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await axiosInstance.post<AuthResponse>(
    '/auth/login',
    payload
  );

  // Normalize the user object before storing it in Redux
  if (data.data?.user) {
    data.data.user = normalizeUser(data.data.user);
  }

  return data;
}

/** POST /api/auth/register — Create a new applicant account */
export async function register(
  payload: RegisterPayload
): Promise<AuthResponse> {
  const { data } = await axiosInstance.post<AuthResponse>(
    '/auth/register',
    payload
  );

  if (data.data?.user) {
    data.data.user = normalizeUser(data.data.user);
  }

  return data;
}

/** POST /api/logout — Invalidate the token on the server and clear session storage */
export async function logout(): Promise<void> {
  await axiosInstance.post('/logout');
  // Remove the persisted token from the browser so the next page load is clean
  sessionStorage.removeItem('auth_token');
}

/** POST /api/auth/forgot-password — Send a password reset email */
export async function forgotPassword(
  payload: ForgotPasswordPayload
): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.post<ApiResponse<null>>(
    '/auth/forgot-password',
    payload
  );
  return data;
}

/** POST /api/auth/reset-password — Set a new password using the emailed token */
export async function resetPassword(
  payload: ResetPasswordPayload
): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.post<ApiResponse<null>>(
    '/auth/reset-password',
    payload
  );
  return data;
}

/** GET /api/user — Fetch the currently authenticated user (used on page refresh) */
export async function getAuthenticatedUser(): Promise<User> {
  const { data } = await axiosInstance.get<ApiResponse<User>>('/user');
  // Always run through normalizeUser so role shape is consistent
  return normalizeUser(data.data);
}

// ---------------------------------------------------------------------------
// MFA endpoints
// ---------------------------------------------------------------------------

/** POST /api/mfa/setup — Generate a TOTP secret and QR code for the user to scan */
export async function setupMfa(): Promise<MFASetupResponse> {
  const { data } = await axiosInstance.post<MFASetupResponse>('/mfa/setup');
  return data;
}

/** POST /api/mfa/verify — Validate a TOTP code and mark MFA as verified for the session */
export async function verifyMfa(code: string): Promise<MFAVerifyResponse> {
  const { data } = await axiosInstance.post<MFAVerifyResponse>('/mfa/verify', {
    code,
  });
  return data;
}

/** POST /api/mfa/disable — Turn off MFA for the authenticated user */
export async function disableMfa(): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.post<ApiResponse<null>>('/mfa/disable');
  return data;
}

/**
 * POST /api/mfa/step-up — Verify identity before a sensitive action.
 *
 * Submits a current TOTP code. On success the backend records a 15-minute
 * cache grant that EnsureMfaStepUp middleware accepts. The frontend should
 * retry the originally blocked request after this call resolves.
 */
export async function verifyMfaStepUp(code: string): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.post<ApiResponse<null>>('/mfa/step-up', { code });
  return data;
}

// ---------------------------------------------------------------------------
// Email verification endpoints
// ---------------------------------------------------------------------------

export interface VerifyEmailPayload {
  // These four values come from the verification link the backend emails the user
  id: string;
  hash: string;
  expires: string;
  signature: string;
}

/** POST /api/auth/email/verify — Confirm the user's email address */
export async function verifyEmail(
  payload: VerifyEmailPayload
): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.post<ApiResponse<null>>(
    '/auth/email/verify',
    payload
  );
  return data;
}

/** POST /api/auth/email/resend — Resend the verification email */
export async function resendVerificationEmail(): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.post<ApiResponse<null>>(
    '/auth/email/resend'
  );
  return data;
}
