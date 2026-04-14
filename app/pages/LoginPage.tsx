/**
 * LoginPage.tsx
 *
 * Purpose: The main sign-in page for Camp Burnt Gin.
 * Responsibilities:
 *   - Phase 1: Collects email + password, sends to POST /api/auth/login.
 *   - Phase 2: If the server says MFA is required, switches to a 6-box
 *     one-time-code entry form and re-submits with the code.
 *   - On success: saves the token in localStorage, hydrates Redux auth
 *     state, and navigates the user to their role-specific dashboard.
 *
 * Why two phases in one page?
 *   The URL stays the same (/login) for both steps, which keeps the browser
 *   history clean and prevents back-button weirdness during MFA entry.
 */

import { useRef, useState, useMemo, useCallback, type KeyboardEvent, type ClipboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowLeft, AlertCircle } from 'lucide-react';

import { loginSchema, type LoginFormValues } from '@/features/auth/schemas/auth.schema';
import { login } from '@/features/auth/api/auth.api';
import { setUser, setToken, hydrateAuth } from '@/features/auth/store/authSlice';
import { useAppDispatch } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { getPrimaryRole, getDashboardRoute } from '@/shared/constants/roles';
import type { User } from '@/shared/types';
import { isValidationError, isLockoutError, isRateLimitError } from '@/shared/types';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/features/auth/components/AuthCard';
import '@/assets/styles/auth-animations.css';

// How many individual digit boxes the MFA input renders (always 6 for TOTP codes).
const CODE_LENGTH = 6;

/* ── Camp taglines — one is picked randomly on page mount ────────────────── */
const TAGLINES = [
  'The forest is calling.',
  'Where adventures begin.',
  'Ready for another summer?',
  'Leave the ordinary behind.',
  'Every trail leads somewhere wonderful.',
  'A place to grow, explore, and belong.',
  'Summer starts here.',
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Builds the CSS class string for text inputs.
 * @param hasError  - turns the border red when true
 * @param extra     - any additional Tailwind classes to append
 */
function inputCls(hasError: boolean, extra = '') {
  return [
    'w-full pl-11 py-3.5 rounded-xl border outline-none',
    'transition-all',
    hasError ? 'border-red-400' : 'border-[#9b5f26]/55',
    extra,
  ].join(' ');
}

export function LoginPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  // ── Delight state ─────────────────────────────────────────────────────────

  // One tagline picked at random on mount; stable across re-renders.
  const tagline = useMemo(
    () => TAGLINES[Math.floor(Math.random() * TAGLINES.length)],
    [],
  );

  // Momentary shake animation triggered on auth errors.
  const [shaking, setShaking] = useState(false);
  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }, []);

  // ── Phase 1 local state ────────────────────────────────────────────────────

  // Controls whether the password field shows plain text or dots.
  const [showPassword,   setShowPassword]   = useState(false);
  // When the account is locked out, we display a countdown and disable submit.
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // ── Phase 2: MFA state ─────────────────────────────────────────────────────
  // Credentials are stored in a ref (in memory only) — never written to Redux,
  // localStorage, or sessionStorage — so they disappear if the tab closes.
  const mfaCredentials  = useRef<{ email: string; password: string } | null>(null);
  // Array of refs so we can programmatically focus each individual digit box.
  const inputRefs       = useRef<(HTMLInputElement | null)[]>([]);
  const [mfaStep,       setMfaStep]         = useState(false);
  const [mfaDigits,     setMfaDigits]       = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [mfaError,      setMfaError]        = useState<string | null>(null);
  const [mfaSubmitting, setMfaSubmitting]   = useState(false);

  // react-hook-form wired to the Zod schema — handles validation automatically.
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  // ── Phase 1: Credentials submit ─────────────────────────────────────────────

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const response = await login(values);

      // Server says the user has MFA enabled — switch to digit-entry view.
      if (response.mfa_required) {
        // Keep credentials in memory so Phase 2 can include them in the second call.
        mfaCredentials.current = { email: values.email, password: values.password };
        setMfaStep(true);
        setMfaDigits(Array(CODE_LENGTH).fill(''));
        setMfaError(null);
        // Small delay so the DOM has time to render before we steal focus.
        setTimeout(() => inputRefs.current[0]?.focus(), 120);
        return;
      }

      // Normal login (no MFA) — write token and user to storage + Redux.
      const { user, token } = response.data!;
      // localStorage persists across page refreshes and tabs.
      sessionStorage.setItem('auth_token', token);
      dispatch(setToken({ token }));
      dispatch(setUser(user));
      // hydrateAuth syncs the Redux slice with the token in localStorage.
      dispatch(hydrateAuth());
      // Unverified accounts cannot access protected API routes — send them to verify first.
      if (!(user as User).email_verified_at) {
        navigate('/verify-email?pending=true', { replace: true });
        return;
      }
      toast.success(`Welcome back, ${user.name.split(' ')[0]}.`);
      // Send the user to the dashboard that matches their primary role.
      const role = getPrimaryRole((user as User).roles ?? []);
      if (role) navigate(getDashboardRoute(role));

    } catch (error) {
      // Account temporarily locked (too many failed attempts).
      if (isLockoutError(error)) {
        setLockoutSeconds(error.retryAfter);
        toast.error(`Account locked. Try again in ${error.retryAfter} seconds.`);
        return;
      }
      // Generic rate-limit (IP-level throttle, not account lockout).
      if (isRateLimitError(error)) {
        toast.error(`Too many attempts. Please wait ${error.retryAfter} seconds.`);
        return;
      }
      // Field-level validation errors from the server — map them to the form.
      if (isValidationError(error)) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          setError(field as keyof LoginFormValues, { message: messages[0] });
        });
        triggerShake();
        return;
      }
      triggerShake();
      toast.error((error as { message: string }).message ?? 'Login failed. Please try again.');
    }
  };

  // ── Phase 2: MFA digit input handlers ───────────────────────────────────────

  /**
   * Called whenever a user types in one of the six digit boxes.
   * Only allows a single numeric digit; auto-advances to the next box;
   * auto-submits when all six boxes are filled.
   */
  const handleMfaChange = (index: number, value: string) => {
    // Reject anything that is not a single digit (or empty, for deletion).
    if (!/^\d?$/.test(value)) return;
    setMfaError(null);
    const updated = [...mfaDigits];
    updated[index] = value;
    setMfaDigits(updated);
    // Move focus forward after a digit is entered.
    if (value && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    // All six boxes filled — auto-verify without requiring a button click.
    if (updated.every((d) => d !== '') && value) void handleMfaVerify(updated.join(''));
  };

  /**
   * Handles Backspace key: if the current box is already empty, jump
   * focus back to the previous box so the user can fix a mistake easily.
   */
  const handleMfaKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !mfaDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Handles paste events — strips non-digits, fills all boxes at once,
   * and auto-submits if a complete 6-digit code was pasted.
   */
  const handleMfaPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const updated = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((char, i) => { updated[i] = char; });
    setMfaDigits(updated);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
    if (pasted.length === CODE_LENGTH) void handleMfaVerify(pasted);
  };

  /**
   * Sends the full 6-digit code back to the server along with the original
   * email/password (Phase 2 login call). On success, clears credentials from
   * memory and navigates to the user's dashboard.
   */
  const handleMfaVerify = async (code: string) => {
    if (!mfaCredentials.current) return;
    setMfaSubmitting(true);
    setMfaError(null);
    try {
      const response = await login({ ...mfaCredentials.current, mfa_code: code });
      const { user, token } = response.data!;
      // Wipe credentials from memory immediately after a successful verification.
      mfaCredentials.current = null;
      sessionStorage.setItem('auth_token', token);
      dispatch(setToken({ token }));
      dispatch(setUser(user));
      dispatch(hydrateAuth());
      if (!(user as User).email_verified_at) {
        navigate('/verify-email?pending=true', { replace: true });
        return;
      }
      toast.success(`Welcome back, ${user.name.split(' ')[0]}.`);
      const mfaRole = getPrimaryRole((user as User).roles ?? []);
      if (mfaRole) navigate(getDashboardRoute(mfaRole));
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Invalid code. Please try again.';
      setMfaError(msg);
      triggerShake();
      // Clear the digit boxes and refocus the first one for a fresh attempt.
      setMfaDigits(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 60);
    } finally {
      setMfaSubmitting(false);
    }
  };

  // Join the six individual digit strings into one code string for the button.
  const mfaCode = mfaDigits.join('');

  // ── Render ───────────────────────────────────────────────────────────────────

  // Phase 2 UI: render only the MFA digit entry, not the email/password form.
  if (mfaStep) {
    return (
      <div className={shaking ? 'auth-shake' : undefined}>
      <AuthCard
        title={t('auth.mfa.title')}
        subtitle={t('auth.mfa.description')}
      >
        <div className="flex flex-col items-center gap-8">
          {/* Shield icon to make the MFA step feel trustworthy */}
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{ background: 'rgba(22,101,52,0.08)' }}
          >
            <ShieldCheck className="h-8 w-8" style={{ color: '#166534' }} />
          </div>

          {/* Six individual digit boxes; each is linked via inputRefs for focus management */}
          <div className="flex gap-3" role="group" aria-label="MFA code">
            {mfaDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleMfaChange(index, e.target.value)}
                onKeyDown={(e) => handleMfaKeyDown(index, e)}
                onPaste={handleMfaPaste}
                aria-label={`Digit ${index + 1}`}
                className="w-12 h-14 text-center text-xl font-semibold rounded-xl border outline-none transition-all duration-200 focus:ring-2 focus:ring-[#166534]/30"
                style={{
                  background: 'rgba(255,249,228,0.94)',
                  color: '#2c1608',
                  borderColor: mfaError ? '#f87171' : digit ? '#166534' : 'rgba(155,95,38,0.55)',
                  fontSize: '1.375rem',
                  boxShadow: 'inset 0 1px 4px rgba(65,32,7,0.18)',
                }}
              />
            ))}
          </div>

          {/* Error message */}
          {mfaError && (
            <p
              role="alert"
              className="flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium"
              style={{ background: 'rgba(10,3,0,0.72)', color: '#fca5a5' }}
            >
              <AlertCircle style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
              {mfaError}
            </p>
          )}

          {/* Submit button — disabled until all 6 boxes are filled */}
          <button
            type="button"
            disabled={mfaCode.length < CODE_LENGTH || mfaSubmitting}
            onClick={() => void handleMfaVerify(mfaCode)}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#1e3a6e', fontSize: '1rem' }}
          >
            {mfaSubmitting ? t('common.loading') : t('auth.mfa.submit')}
          </button>

          {/* "Back" link — clears in-memory credentials and returns to Phase 1 */}
          <button
            type="button"
            onClick={() => { setMfaStep(false); mfaCredentials.current = null; setMfaDigits(Array(CODE_LENGTH).fill('')); }}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('auth.mfa.back_to_login')}
          </button>
        </div>
      </AuthCard>
      </div>
    );
  }

  // Phase 1 UI: the standard email + password login form.
  return (
    <div className={shaking ? 'auth-shake' : undefined}>
    <AuthCard
      title={t('auth.login.title')}
      subtitle={<>{getGreeting()}.<br />{tagline}</>}
      footer={
        <p>
          {t('auth.login.no_account')}{' '}
          <Link to={ROUTES.REGISTER} className="text-green-700 font-semibold hover:underline">
            {t('auth.login.create_account')}
          </Link>
        </p>
      }
    >
      {/* noValidate disables browser-native validation so our Zod schema is always in control */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

        {/* ── Email field ── */}
        <div className="flex flex-col gap-2">
          <label htmlFor="login-email" className="font-semibold text-[#1e293b]" style={{ fontSize: '0.9375rem' }}>
            {t('auth.login.email_label')}
          </label>
          <div className="relative">
            {/* Icon is positioned absolutely inside the input wrapper, pointer-events-none so it doesn't interfere with typing */}
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 pointer-events-none" style={{ width: '1.125rem', height: '1.125rem' }} />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder={t('auth.login.email_placeholder')}
              aria-invalid={errors.email ? 'true' : 'false'}
              className={inputCls(!!errors.email, 'pr-4')}
              style={{ fontSize: '0.9375rem' }}
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p role="alert" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium" style={{ background: 'rgba(10,3,0,0.72)', color: '#fca5a5' }}>
              <AlertCircle style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* ── Password field ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="font-semibold text-[#1e293b]" style={{ fontSize: '0.9375rem' }}>
              {t('auth.login.password_label')}
            </label>
            {/* Forgot password link lives next to the label for easy discovery */}
            <Link
              to={ROUTES.FORGOT_PASSWORD}
              className="font-semibold transition-colors hover:opacity-80"
              style={{ color: '#fbbf24', fontSize: '0.875rem' }}
            >
              {t('auth.login.forgot_password')}
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={{ width: '1.125rem', height: '1.125rem' }} />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder={t('auth.login.password_placeholder')}
              aria-invalid={errors.password ? 'true' : 'false'}
              className={inputCls(!!errors.password, 'pr-12')}
              style={{ fontSize: '0.9375rem' }}
              {...register('password')}
            />
            {/* Eye icon toggles visibility; aria-label updates to match current state */}
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
              style={{ transform: 'translateY(-50%)' }}
              aria-label={showPassword ? t('auth.login.hide_password') : t('auth.login.show_password')}
            >
              {showPassword ? <EyeOff style={{ width: '1.125rem', height: '1.125rem' }} /> : <Eye style={{ width: '1.125rem', height: '1.125rem' }} />}
            </button>
          </div>
          {errors.password && (
            <p role="alert" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium" style={{ background: 'rgba(10,3,0,0.72)', color: '#fca5a5' }}>
              <AlertCircle style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* ── Lockout alert — only visible after too many failed attempts ── */}
        {lockoutSeconds > 0 && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
            style={{ fontSize: '0.9375rem' }}
            role="alert"
          >
            Account temporarily locked. Please wait {lockoutSeconds} seconds before trying again.
          </div>
        )}

        {/* ── Submit button — disabled during submission or lockout ── */}
        <button
          type="submit"
          disabled={isSubmitting || lockoutSeconds > 0}
          className={`w-full mt-1 py-3.5 rounded-xl font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${isSubmitting ? 'animate-pulse' : 'transition-opacity'}`}
          style={{ background: '#166534', fontSize: '1rem' }}
        >
          {isSubmitting ? t('common.loading') : t('auth.login.submit')}
        </button>

        {/* ── HIPAA compliance notice — reassures users their data is protected ── */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <ShieldCheck className="flex-shrink-0 text-slate-400" style={{ width: '1rem', height: '1rem' }} />
          <p className="text-center text-slate-400" style={{ fontSize: '0.8125rem' }}>
            {t('auth.hipaa_notice')}
          </p>
        </div>

      </form>
    </AuthCard>
    </div>
  );
}
