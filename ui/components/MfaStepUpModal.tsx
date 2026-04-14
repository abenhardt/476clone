/**
 * MfaStepUpModal
 *
 * Shown when a sensitive or destructive action is blocked because the user's
 * step-up MFA grant has expired or was never issued for this session.
 *
 * Trigger:  The axios interceptor dispatches `auth:mfa-step-up-required` when
 *           it receives a 403 with mfa_step_up_required: true from the backend.
 *           The interceptor also queues the blocked request behind a promise;
 *           this modal resolves that promise on success, causing the original
 *           request to retry automatically.
 *
 * Success:  User enters a valid TOTP code → POST /api/mfa/step-up succeeds →
 *           completeStepUp() resolves the queued promise → blocked request retries.
 *
 * Cancel:   User dismisses the modal → cancelStepUp() rejects the queued promise →
 *           the caller receives { mfaStepUpCancelled: true }.
 *
 * Mount this once at DashboardShell level so it is available in every portal.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, X, Loader2 } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { setMfaStepUpVerifiedAt } from '@/features/auth/store/authSlice';
import { verifyMfaStepUp } from '@/features/auth/api/auth.api';
import { completeStepUp, cancelStepUp } from '@/api/axios.config';
import { Button } from '@/ui/components/Button';

const STEP_UP_EVENT = 'auth:mfa-step-up-required';

export function MfaStepUpModal() {
  const dispatch = useAppDispatch();

  const [open, setOpen]       = useState(false);
  const [code, setCode]       = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Open when the axios interceptor fires the event
  useEffect(() => {
    const handler = () => {
      setCode('');
      setError(null);
      setOpen(true);
    };
    window.addEventListener(STEP_UP_EVENT, handler);
    return () => window.removeEventListener(STEP_UP_EVENT, handler);
  }, []);

  // Focus the input as soon as the modal appears
  useEffect(() => {
    if (open) {
      // Small delay so the DOM is visible before focus
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  const handleCancel = useCallback(() => {
    setOpen(false);
    setCode('');
    setError(null);
    cancelStepUp();
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, handleCancel]);

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) {
      setError('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verifyMfaStepUp(code);

      // Record the verification time locally so the UI can reflect "recently verified"
      dispatch(setMfaStepUpVerifiedAt(Date.now()));

      setOpen(false);
      setCode('');

      // Resolve the queued promise — the blocked request will now retry
      completeStepUp();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Invalid code. Please try again.';
      setError(message);
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }, [code, dispatch]);

  // Allow Enter key to submit from the input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !loading) handleVerify();
    },
    [handleVerify, loading]
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cancel step-up verification"
        className="fixed inset-0 z-[49] w-full h-full cursor-default"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-up-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl pointer-events-auto"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {/* Close */}
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Cancel"
            className="absolute top-4 right-4 p-1 rounded-lg transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <X className="h-4 w-4" />
          </button>

          {/* Icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(22,101,52,0.10)' }}
          >
            <ShieldCheck className="h-5 w-5" style={{ color: '#166534' }} aria-hidden="true" />
          </div>

          {/* Heading */}
          <h2
            id="step-up-modal-title"
            className="text-base font-semibold mb-1"
            style={{ color: 'var(--foreground)' }}
          >
            Verify Your Identity
          </h2>
          <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>
            This action requires recent MFA verification. Enter the 6-digit code
            from your authenticator app to continue.
          </p>

          {/* TOTP input */}
          <label
            htmlFor="step-up-code"
            className="block text-xs font-medium mb-1.5"
            style={{ color: 'var(--foreground)' }}
          >
            Authenticator code
          </label>
          <input
            ref={inputRef}
            id="step-up-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              // Allow digits only
              setCode(e.target.value.replace(/\D/g, ''));
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="000000"
            className="w-full rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-center mb-1"
            style={{
              background: 'var(--input)',
              border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
              color: 'var(--foreground)',
              outline: 'none',
            }}
            disabled={loading}
          />

          {/* Inline error */}
          {error && (
            <p className="text-xs mb-4" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}
          {!error && <div className="mb-4" />}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="flex-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </span>
              ) : (
                'Verify'
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
