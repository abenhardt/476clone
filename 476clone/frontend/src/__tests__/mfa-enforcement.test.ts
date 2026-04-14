/**
 * mfa-enforcement.test.ts
 *
 * MFA enforcement source-structure regression tests.
 *
 * These tests verify that the MFA enrollment gate is wired at both the
 * backend middleware level and the frontend ProtectedRoute level.  They
 * catch regressions where:
 *   - The MFA check is accidentally removed from ProtectedRoute
 *   - The mfa_setup_required flag is dropped from the axios error handler
 *   - The auth:mfa-setup-required event dispatch is removed
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve(__dirname, '..');

function read(relPath: string): string {
  return readFileSync(resolve(SRC, relPath), 'utf-8');
}

describe('ProtectedRoute — MFA enrollment gate', () => {
  const src = read('core/auth/ProtectedRoute.tsx');

  test('imports getUserRole and ROLES from user.types', () => {
    expect(src).toContain("getUserRole");
    expect(src).toContain("ROLES");
  });

  test('checks mfa_enabled on the authenticated user', () => {
    expect(src).toContain('mfa_enabled');
  });

  test('gates admin role on MFA enrollment', () => {
    expect(src).toContain('ROLES.ADMIN');
  });

  test('gates super_admin role on MFA enrollment', () => {
    expect(src).toContain('ROLES.SUPER_ADMIN');
  });

  test('gates medical role on MFA enrollment', () => {
    expect(src).toContain('ROLES.MEDICAL');
  });

  test('redirects to profile page with mfaSetupRequired state', () => {
    expect(src).toContain('mfaSetupRequired: true');
  });

  test('avoids redirect loop — checks pathname before redirecting', () => {
    // Guards against infinite redirect when the user is already on profile
    expect(src).toContain('startsWith(profilePath)');
  });
});

describe('axios interceptor — mfa_setup_required propagation', () => {
  const src = read('api/axios.config.ts');

  test('recognises mfa_setup_required in 403 response body', () => {
    expect(src).toContain('mfa_setup_required');
  });

  test('dispatches auth:mfa-setup-required event to the window', () => {
    expect(src).toContain("'auth:mfa-setup-required'");
  });

  test('rejects with mfaSetupRequired flag so callers can surface targeted message', () => {
    expect(src).toContain('mfaSetupRequired: true');
  });
});

describe('ProfilePage — MFA setup required banner', () => {
  const src = read('features/profile/pages/ProfilePage.tsx');

  test('reads mfaSetupRequired from router location state', () => {
    expect(src).toContain('mfaSetupRequired');
  });

  test('conditionally renders the MFA setup required warning banner', () => {
    expect(src).toContain('mfaSetupRequired &&');
  });

  test('imports useLocation for router state access', () => {
    expect(src).toContain('useLocation');
  });
});

describe('Backend middleware — EnsureMfaEnrolled wiring', () => {
  // Verify the middleware source exists and contains the expected patterns.
  // This is a build-time (source) check, not a runtime check — the integration
  // tests in MfaEnrollmentEnforcementTest.php cover the runtime behaviour.
  const middlewarePath = resolve(
    __dirname,
    '../../../backend/camp-burnt-gin-api/app/Http/Middleware/EnsureMfaEnrolled.php'
  );
  const src = readFileSync(middlewarePath, 'utf-8');

  test('blocks admin users without mfa_enabled', () => {
    expect(src).toContain('isAdmin()');
    expect(src).toContain('mfa_enabled');
  });

  test('blocks medical providers without mfa_enabled', () => {
    expect(src).toContain('isMedicalProvider()');
  });

  test('returns mfa_setup_required flag in response body', () => {
    expect(src).toContain("'mfa_setup_required'");
  });

  test('returns HTTP 403 Forbidden (not 401)', () => {
    expect(src).toContain('HTTP_FORBIDDEN');
  });
});
