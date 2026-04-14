/**
 * MfaRequiredModal
 *
 * Shown when a user without MFA attempts a sensitive/PHI action and the
 * backend returns 403 with mfa_setup_required: true.
 *
 * Trigger:  axios interceptor dispatches `auth:mfa-setup-required` CustomEvent.
 * Dismiss:  "Cancel" button or clicking the backdrop.
 * Action:   "Enable MFA" navigates to the user's portal profile page.
 *
 * This component listens for the event and manages its own open/close state.
 * Mount it once at the DashboardShell level so it is available everywhere.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { getUserRole, ROLES } from '@/shared/types/user.types';
import { Button } from '@/ui/components/Button';

const MFA_EVENT = 'auth:mfa-setup-required';

function getProfilePath(role: ReturnType<typeof getUserRole>): string {
  switch (role) {
    case ROLES.SUPER_ADMIN: return '/super-admin/profile';
    case ROLES.MEDICAL:     return '/medical/profile';
    case ROLES.ADMIN:       return '/admin/profile';
    default:                return '/applicant/profile';
  }
}

export function MfaRequiredModal() {
  const user = useAppSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Listen for the global event dispatched by the axios 403 interceptor.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(MFA_EVENT, handler);
    return () => window.removeEventListener(MFA_EVENT, handler);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  // Close on Escape key — handled via effect to avoid putting handlers on non-interactive elements
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  const handleEnable = useCallback(() => {
    setOpen(false);
    const role = user ? getUserRole(user) : undefined;
    navigate(getProfilePath(role), { state: { mfaSetupRequired: true } });
  }, [user, navigate]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — native button for click-away-to-dismiss (no lint issues) */}
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-[49] w-full h-full cursor-default"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={handleClose}
      />

      {/* Dialog container — pointer-events-none lets backdrop button receive clicks */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mfa-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        {/* Panel */}
        <div
          className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl pointer-events-auto"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {/* Close */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1 rounded-lg transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <X className="h-4 w-4" />
          </button>

          {/* Icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(217,119,6,0.10)' }}
          >
            <ShieldAlert className="h-5 w-5" style={{ color: '#d97706' }} aria-hidden="true" />
          </div>

          {/* Content */}
          <h2
            id="mfa-modal-title"
            className="text-base font-semibold mb-2"
            style={{ color: 'var(--foreground)' }}
          >
            Multi-Factor Authentication Required
          </h2>
          <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>
            This action involves sensitive data and requires MFA to be enabled on
            your account. Enable MFA to continue.
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleEnable} className="flex-1">
              Enable MFA
            </Button>
            <Button variant="secondary" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
