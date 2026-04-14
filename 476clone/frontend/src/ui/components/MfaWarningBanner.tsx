/**
 * MfaWarningBanner
 *
 * Non-intrusive banner shown to any authenticated user whose account has
 * mfa_enabled = false. Encourages MFA enrollment without blocking access.
 *
 * Behaviour:
 *  - Reads mfa_enabled from Redux auth state — disappears immediately when
 *    MFA is enabled elsewhere (e.g. ProfilePage updates Redux via patchUser).
 *  - Dismissible for the current browser session via sessionStorage.
 *    The banner reappears on the next session to maintain security awareness.
 *  - "Enable MFA" navigates to the correct portal profile page.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { getUserRole, ROLES } from '@/shared/types/user.types';

const SESSION_KEY = 'mfa_banner_dismissed';

function getProfilePath(role: ReturnType<typeof getUserRole>): string {
  switch (role) {
    case ROLES.SUPER_ADMIN: return '/super-admin/profile';
    case ROLES.MEDICAL:     return '/medical/profile';
    case ROLES.ADMIN:       return '/admin/profile';
    default:                return '/applicant/profile';
  }
}

export function MfaWarningBanner() {
  const user = useAppSelector((state) => state.auth.user);
  const navigate = useNavigate();

  // Respect session-level dismiss — check once on mount.
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === '1'
  );

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setDismissed(true);
  }, []);

  const handleEnable = useCallback(() => {
    const role = user ? getUserRole(user) : undefined;
    navigate(getProfilePath(role), { state: { mfaSetupRequired: true } });
  }, [user, navigate]);

  // Hide when: no user, MFA already enabled, or dismissed this session.
  if (!user || user.mfa_enabled || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-3 px-4 py-2.5 text-sm"
      style={{
        background: 'rgba(217,119,6,0.08)',
        borderBottom: '1px solid rgba(217,119,6,0.20)',
        color: 'var(--foreground)',
      }}
    >
      {/* Icon */}
      <ShieldAlert
        className="h-4 w-4 flex-shrink-0"
        style={{ color: '#d97706' }}
        aria-hidden="true"
      />

      {/* Message */}
      <span className="flex-1 text-xs" style={{ color: 'var(--foreground)' }}>
        <span className="font-medium" style={{ color: '#b45309' }}>
          Security Notice:{' '}
        </span>
        Multi-Factor Authentication is not enabled on your account.
      </span>

      {/* Enable MFA */}
      <button
        type="button"
        onClick={handleEnable}
        className="text-xs font-semibold px-2.5 py-1 rounded-md transition-colors flex-shrink-0"
        style={{
          background: 'rgba(217,119,6,0.12)',
          color: '#b45309',
          border: '1px solid rgba(217,119,6,0.25)',
        }}
        onMouseEnter={(e) => { (e.currentTarget.style.background = 'rgba(217,119,6,0.22)'); }}
        onMouseLeave={(e) => { (e.currentTarget.style.background = 'rgba(217,119,6,0.12)'); }}
      >
        Enable MFA
      </button>

      {/* Dismiss */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss MFA warning"
        className="p-1 rounded transition-colors flex-shrink-0"
        style={{ color: 'var(--muted-foreground)' }}
        onMouseEnter={(e) => { (e.currentTarget.style.color = 'var(--foreground)'); }}
        onMouseLeave={(e) => { (e.currentTarget.style.color = 'var(--muted-foreground)'); }}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
