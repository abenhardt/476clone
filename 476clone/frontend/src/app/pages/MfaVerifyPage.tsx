/**
 * MfaVerifyPage.tsx
 *
 * Purpose: Standalone MFA verification page — used when a user already has a
 * session token but the backend requires a fresh one-time-password (OTP) check
 * before granting full access.
 *
 * Responsibilities:
 *   - Renders six individual digit input boxes for the 6-digit TOTP code.
 *   - Supports auto-advance, backspace navigation, and paste.
 *   - Auto-submits as soon as all six digits are filled.
 *   - POSTs to POST /api/mfa/verify; on success dispatches setMfaVerified(true)
 *     and navigates to the user's role-based dashboard.
 *
 * Note: This page differs from the MFA step inside LoginPage.tsx.
 * LoginPage handles MFA inline (same URL, no separate route) for users who
 * haven't received a full token yet. This page is for users who already have
 * a partial session and need to confirm their identity mid-session.
 */

import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';

import { verifyMfa } from '@/features/auth/api/auth.api';
import { setMfaVerified } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { Button } from '@/ui/components/Button';

// Standard TOTP code length — all authenticator apps produce 6 digits.
const CODE_LENGTH = 6;

export function MfaVerifyPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  // Read the current user from Redux to determine which dashboard to navigate to after success.
  const user = useAppSelector((state) => state.auth.user);

  // One string per digit box — starts as six empty strings.
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Array of refs so we can programmatically move focus between digit boxes.
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  /**
   * Fires when a user types in a digit box.
   * Only digits are accepted. Focus advances automatically after each entry.
   * All six boxes filled → auto-submit.
   */
  const handleChange = (index: number, value: string) => {
    // Reject anything that is not a single digit or an empty string (backspace result).
    if (!/^\d?$/.test(value)) return;

    setError(null);
    const updated = [...digits];
    updated[index] = value;
    setDigits(updated);

    // Move focus to the next box after a digit is typed.
    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all six boxes are filled — saves the user from clicking Verify.
    if (updated.every((d) => d !== '') && value) {
      handleVerify(updated.join(''));
    }
  };

  /**
   * Backspace key handler: if the current box is already empty, move focus
   * one step back so the user can correct the previous digit.
   */
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Paste handler: strips non-numeric characters, fills as many boxes as
   * possible, then auto-submits if a full 6-digit code was pasted.
   */
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;

    const updated = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((char, i) => {
      updated[i] = char;
    });
    setDigits(updated);
    // Move focus to the last filled box (or the final box if all are filled).
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();

    if (pasted.length === CODE_LENGTH) {
      handleVerify(pasted);
    }
  };

  /**
   * Sends the assembled 6-digit code to the server.
   * On success: marks MFA as verified in Redux and redirects to the dashboard.
   * On failure: shows an error, clears the boxes, and refocuses the first box.
   */
  const handleVerify = async (code: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await verifyMfa(code);
      // Update Redux state so the router guards know MFA is satisfied.
      dispatch(setMfaVerified(true));
      toast.success('Identity verified.');

      // Navigate to the dashboard matching the user's primary role.
      const role = getPrimaryRole(user?.roles ?? []);
      navigate(getDashboardRoute(role), { replace: true });
    } catch (err) {
      setError((err as { message: string }).message ?? 'Invalid code. Please try again.');
      // Clear all digit boxes so the user can start fresh.
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Join the six digit strings so we have a single value for the button's disabled check.
  const code = digits.join('');

  return (
    <AuthCard
      title="Two-factor authentication"
      subtitle="Enter the 6-digit code from your authenticator app."
    >
      <div className="flex flex-col items-center gap-8">
        {/* Shield icon — signals a security checkpoint */}
        <div
          className="flex items-center justify-center w-16 h-16 rounded-2xl"
          style={{ background: 'var(--glass-icon-bg)' }}
        >
          <ShieldCheck className="h-8 w-8 text-ember-orange" />
        </div>

        {/* Six individual digit input boxes, managed as a group for accessibility */}
        <div className="flex gap-3" role="group" aria-label="One-time password input">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              aria-label={`Digit ${index + 1}`}
              className="w-12 h-14 text-center text-xl font-headline font-semibold rounded-xl border outline-none transition-all duration-300 focus:ring-2 focus:ring-ember-orange/40"
              style={{
                background: 'var(--input)',
                color: 'var(--on-image-text)',
                // Red on error; orange when filled; gray when empty.
                borderColor: error
                  ? 'var(--destructive)'
                  : digit
                  ? 'var(--ember-orange)'
                  : 'var(--on-image-border)',
              }}
            />
          ))}
        </div>

        {/* Error message — shown when the code is rejected */}
        {error && (
          <p
            role="alert"
            className="text-sm text-center"
            style={{ color: 'var(--destructive)' }}
          >
            {error}
          </p>
        )}

        {/* Verify button — disabled until all 6 boxes contain a digit */}
        <Button
          fullWidth
          loading={isSubmitting}
          disabled={code.length < CODE_LENGTH}
          onClick={() => handleVerify(code)}
        >
          Verify identity
        </Button>
      </div>
    </AuthCard>
  );
}
