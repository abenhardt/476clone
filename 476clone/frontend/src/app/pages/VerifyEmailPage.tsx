/**
 * VerifyEmailPage.tsx
 *
 * Purpose: Handles the email verification link that is sent to a new user's inbox.
 * Responsibilities:
 *   - On mount, reads `id`, `hash`, `expires`, and `signature` from the URL
 *     query string and POSTs them to POST /api/auth/email/verify.
 *   - Shows a spinner while verifying, a success screen on pass, or an error
 *     screen with a "Resend" button on failure.
 *   - Supports resending the verification email via POST /api/auth/email/resend.
 *
 * Why useRef(hasRun)?
 *   React's StrictMode runs effects twice in development to help catch bugs.
 *   The ref guards against sending the verify request twice — which would fail
 *   on the second attempt because the one-time hash is already consumed.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { verifyEmail, resendVerificationEmail } from '@/features/auth/api/auth.api';
import { ROUTES } from '@/shared/constants/routes';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { Button } from '@/ui/components/Button';

// Represents every possible state the verification flow can be in.
// 'pending' = just registered, waiting for the user to check their inbox.
type VerifyState = 'verifying' | 'success' | 'error' | 'resent' | 'pending';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [state, setState]       = useState<VerifyState>('verifying');
  const [resending, setResending] = useState(false);
  // Guard prevents the verification API call from firing twice in React StrictMode.
  const hasRun = useRef(false);

  useEffect(() => {
    // Skip if this effect has already run once.
    if (hasRun.current) return;
    hasRun.current = true;

    // ?pending=true means the user just registered — skip the verify request and
    // show the "check your inbox" screen with a resend button.
    if (searchParams.get('pending') === 'true') {
      setState('pending');
      return;
    }

    // Pull all four required params from the URL.
    const id        = searchParams.get('id')        ?? '';
    const hash      = searchParams.get('hash')      ?? '';
    const expires   = searchParams.get('expires')   ?? '';
    const signature = searchParams.get('signature') ?? '';

    // If any param is missing the URL is malformed — skip the API call and show the error screen.
    if (!id || !hash || !expires || !signature) {
      setState('error');
      return;
    }

    // Send all four params to the server; it verifies the HMAC signature internally.
    verifyEmail({ id, hash, expires, signature })
      .then(() => setState('success'))
      .catch(() => setState('error'));
  }, [searchParams]);

  /** Requests a fresh verification email for the currently logged-in user. */
  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      setState('resent');
      toast.success('Verification email sent. Check your inbox.');
    } catch {
      toast.error('Could not resend verification email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  /**
   * Picks the correct UI block to render based on the current `state`.
   */
  const renderContent = () => {
    switch (state) {
      // ── Spinner while the API request is in flight ──
      case 'verifying':
        return (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="h-10 w-10 text-ember-orange animate-spin" />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Verifying your email address…
            </p>
          </div>
        );

      // ── Success: email is now verified ──
      case 'success':
        return (
          <div className="flex flex-col items-center gap-5 py-4">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl"
              style={{ background: 'var(--glass-icon-bg)' }}
            >
              <CheckCircle className="h-8 w-8 text-ember-orange" />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              Your email has been verified. You can now access all features of your account.
            </p>
            {/* Direct the user straight to the login page to get started */}
            <Link to={ROUTES.LOGIN}>
              <Button>Continue to sign in</Button>
            </Link>
          </div>
        );

      // ── Resent: a new verification email was sent ──
      case 'resent':
        return (
          <div className="flex flex-col items-center gap-5 py-4">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl"
              style={{ background: 'var(--glass-icon-bg)' }}
            >
              <Mail className="h-8 w-8 text-ember-orange" />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              A new verification link has been sent to your email address.
            </p>
          </div>
        );

      // ── Pending: just registered, waiting for user to check inbox ──
      case 'pending':
        return (
          <div className="flex flex-col items-center gap-5 py-4">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl"
              style={{ background: 'var(--glass-icon-bg)' }}
            >
              <Mail className="h-8 w-8 text-ember-orange" />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              We sent a verification link to your email address. Click the link to activate your account, then sign in.
            </p>
            <Button onClick={handleResend} loading={resending} variant="secondary">
              Resend verification email
            </Button>
            <Link to={ROUTES.LOGIN} className="text-sm text-ember-orange hover:underline">
              Back to sign in
            </Link>
          </div>
        );

      // ── Error: link is invalid, expired, or URL params were missing ──
      case 'error':
        return (
          <div className="flex flex-col items-center gap-5 py-4">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl"
              // Red tint background signals danger/failure.
              style={{ background: 'rgba(220,38,38,0.08)' }}
            >
              <XCircle className="h-8 w-8" style={{ color: '#dc2626' }} />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              This verification link is invalid or has expired. Request a new one below.
            </p>
            {/* Resend button — loading state prevents double-clicks */}
            <Button onClick={handleResend} loading={resending} variant="secondary">
              Resend verification email
            </Button>
          </div>
        );
    }
  };

  return (
    <AuthCard
      title="Verify your email"
      subtitle="Confirming your email address keeps your account secure."
      footer={
        <Link
          to={ROUTES.LOGIN}
          className="inline-flex items-center gap-1.5 text-ember-orange hover:underline font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      }
    >
      {/* Delegates rendering to renderContent() so each state has its own block */}
      {renderContent()}
    </AuthCard>
  );
}
