/**
 * RegisterPage.tsx
 *
 * Purpose: New-account registration form for Camp Burnt Gin.
 * Responsibilities:
 *   - Collects name, email (with a manual confirmation field), password
 *     (with a confirmation field and live criteria checklist), and terms acceptance.
 *   - Validates locally via Zod before sending to POST /api/auth/register.
 *   - On success: writes the token to Redux, navigates to the applicant dashboard.
 *
 * Why a separate "confirm email" field?
 *   Unlike passwords, browsers auto-fill email addresses, so a typo can go
 *   unnoticed. The manual confirm field catches copy-paste or autofill mismatches.
 */

import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { User, Mail, Lock, Eye, EyeOff, Check, X, ShieldCheck, AlertCircle } from 'lucide-react';

import { registerSchema, type RegisterFormValues } from '@/features/auth/schemas/auth.schema';
import { register as registerUser } from '@/features/auth/api/auth.api';
import { setUser, setToken, hydrateAuth } from '@/features/auth/store/authSlice';
import { useAppDispatch } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { isValidationError } from '@/shared/types';
import { AuthCard } from '@/features/auth/components/AuthCard';

// ─── Shared helpers ────────────────────────────────────────────────────────────

// Reusable size object so every icon is consistently 18 × 18 px.
const ICON_SIZE = { width: '1.125rem', height: '1.125rem' };

/**
 * Builds a CSS class string for text inputs.
 * Red border when there is a validation error; light gray otherwise.
 */
function inputCls(hasError: boolean, extra = '') {
  return [
    'w-full pl-11 py-3.5 rounded-xl border outline-none bg-white',
    'transition-all focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]',
    hasError ? 'border-red-400' : 'border-[#d1dce8]',
    'text-[#1e293b] placeholder:text-slate-400',
    extra,
  ].join(' ');
}

/** Accessible label element — keeps the JSX in the form section clean. */
function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="font-semibold text-[#1e293b]" style={{ fontSize: '0.9375rem' }}>
      {children}
    </label>
  );
}

/** Renders a high-contrast error badge when `message` is truthy; renders nothing otherwise. */
function FieldError({ message }: { message?: string }) {
  return message ? (
    <p
      role="alert"
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium"
      style={{ background: 'rgba(10,3,0,0.72)', color: '#fca5a5' }}
    >
      <AlertCircle style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
      {message}
    </p>
  ) : null;
}

/**
 * One row in the password-strength criteria list.
 * @param met    - whether this criterion is currently satisfied
 * @param typing - whether the user has started typing a password yet
 * @param label  - the human-readable rule text
 *
 * Before typing begins all bullets are a soft cream. Once typing starts,
 * met criteria turn bright green and unmet ones turn rose-red.
 */
function CriterionRow({ met, typing, label }: { met: boolean; typing: boolean; label: string }) {
  return (
    <li
      className="flex items-center gap-1.5"
      style={{
        fontSize: '0.875rem',
        color: typing ? (met ? '#4ade80' : '#fca5a5') : 'rgba(232,200,160,0.80)',
      }}
    >
      {typing
        ? met
          ? <Check style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0, color: '#4ade80' }} />
          : <X style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0, color: '#fca5a5' }} />
        : <span style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.55 }}>•</span>
      }
      {label}
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Individual visibility toggles for each password field.
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  // Tracks whether the user has checked the terms-and-conditions checkbox.
  const [acceptTerms,  setAcceptTerms]  = useState(false);
  // If the user hits "Create Account" without checking terms, show a local error.
  const [termsError,   setTermsError]   = useState(false);

  // The "confirm email" field is uncontrolled by react-hook-form because the
  // server only receives one email value; we compare both fields manually.
  const [confirmEmail,      setConfirmEmail]      = useState('');
  const [confirmEmailError, setConfirmEmailError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  // Watch live values to power the criteria checklist and match indicator.
  const password        = watch('password')              ?? '';
  const email           = watch('email')                 ?? '';
  const confirmPassword = watch('password_confirmation') ?? '';

  // Password strength criteria — evaluated in real time as the user types.
  const criteria = {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /[0-9]/.test(password),
    special:   /[!@#$%^&*(),.?":{}|<>_\-=+[\]\\;'`~]/.test(password),
  };

  // Determine whether the confirmation password matches, or if the user hasn't typed yet.
  const confirmMatchState =
    confirmPassword.length > 0
      ? password === confirmPassword ? 'match' : 'no-match'
      : null;

  const onSubmit = async (values: RegisterFormValues) => {
    // Email confirmation is handled outside react-hook-form, so validate it here.
    if (email !== confirmEmail) {
      setConfirmEmailError('Email addresses do not match');
      return;
    }
    setConfirmEmailError('');

    // Terms must be accepted before we can create the account.
    if (!acceptTerms) {
      setTermsError(true);
      return;
    }
    setTermsError(false);

    try {
      const response = await registerUser(values);
      const { user, token } = response.data!;
      // Persist the token so useAuthInit can restore the session on page refresh.
      sessionStorage.setItem('auth_token', token);
      dispatch(setToken({ token }));
      dispatch(setUser(user));
      // hydrateAuth ensures the Axios interceptor picks up the new token.
      dispatch(hydrateAuth());
      toast.success('Account created! Please check your email to verify your address.');
      // Route to the pending-verification screen — dashboard requires a verified email.
      navigate('/verify-email?pending=true', { replace: true });
    } catch (error) {
      // Map server-side field errors back onto the form fields.
      if (isValidationError(error)) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          setError(field as keyof RegisterFormValues, { message: messages[0] });
        });
        return;
      }
      toast.error(
        (error as { message: string }).message ?? 'Registration failed. Please try again.'
      );
    }
  };

  // Used to switch the criteria list from neutral to green/gray feedback mode.
  const isTyping = password.length > 0;

  return (
    <AuthCard
      title="Create Your Account"
      subtitle="Join our secure online system to apply and manage your camper's information."
      accentBar
      maxWidth="md"
      footer={
        <p>
          Already have an account?{' '}
          <Link to={ROUTES.LOGIN} className="text-green-700 font-semibold hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      {/* noValidate prevents browser pop-up bubbles — Zod handles all validation */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

        {/* ── Full Name ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="reg-name">Full Name</FieldLabel>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={ICON_SIZE} />
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              aria-invalid={errors.name ? 'true' : 'false'}
              className={inputCls(!!errors.name, 'pr-4')}
              style={{ fontSize: '0.9375rem' }}
              {...register('name')}
            />
          </div>
          <FieldError message={errors.name?.message} />
        </div>

        {/* ── Email Address — registered with react-hook-form so Zod validates it ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="reg-email">Email Address</FieldLabel>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={ICON_SIZE} />
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="your.email@example.com"
              aria-invalid={errors.email ? 'true' : 'false'}
              className={inputCls(!!errors.email, 'pr-4')}
              style={{ fontSize: '0.9375rem' }}
              {...register('email')}
            />
          </div>
          <FieldError message={errors.email?.message} />
        </div>

        {/* ── Confirm Email — controlled locally; compared to the main email on submit ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="reg-email-confirm">Confirm Email Address</FieldLabel>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={ICON_SIZE} />
            <input
              id="reg-email-confirm"
              type="email"
              autoComplete="email"
              placeholder="Confirm your email"
              value={confirmEmail}
              onChange={(e) => {
                setConfirmEmail(e.target.value);
                // Clear the error as soon as the user starts correcting their input.
                if (confirmEmailError) setConfirmEmailError('');
              }}
              className={inputCls(!!confirmEmailError, 'pr-4')}
              style={{ fontSize: '0.9375rem' }}
            />
          </div>
          <FieldError message={confirmEmailError} />
        </div>

        {/* ── Password with live strength feedback ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="reg-password">Password</FieldLabel>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={ICON_SIZE} />
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a secure password"
              aria-invalid={errors.password ? 'true' : 'false'}
              className={inputCls(!!errors.password, 'pr-12')}
              style={{ fontSize: '0.9375rem' }}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword
                ? <EyeOff style={ICON_SIZE} />
                : <Eye style={ICON_SIZE} />
              }
            </button>
          </div>

          {/* Criteria checklist — always visible so the user knows the rules up front */}
          <div style={{ background: 'rgba(10,3,0,0.65)', borderRadius: '10px', padding: '10px 14px' }}>
            <ul className="flex flex-col gap-1.5">
              <CriterionRow met={criteria.length}    typing={isTyping} label="Must be 8–64 characters" />
              <CriterionRow met={criteria.uppercase} typing={isTyping} label="Must include 1 uppercase letter (A–Z)" />
              <CriterionRow met={criteria.lowercase} typing={isTyping} label="Must include 1 lowercase letter (a–z)" />
              <CriterionRow met={criteria.number}    typing={isTyping} label="Must include 1 number (0–9)" />
              <CriterionRow met={criteria.special}   typing={isTyping} label="Must include 1 special character (@, #, $, %, !, ?)" />
            </ul>
          </div>
          <FieldError message={errors.password?.message} />
        </div>

        {/* ── Confirm Password with live match indicator ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="reg-confirm">Confirm Password</FieldLabel>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={ICON_SIZE} />
            <input
              id="reg-confirm"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              aria-invalid={errors.password_confirmation ? 'true' : 'false'}
              className={inputCls(
                !!errors.password_confirmation || confirmMatchState === 'no-match',
                'pr-12'
              )}
              style={{ fontSize: '0.9375rem' }}
              {...register('password_confirmation')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff style={ICON_SIZE} /> : <Eye style={ICON_SIZE} />}
            </button>
          </div>

          {/* "Passwords match" / "do not match" indicator */}
          {confirmMatchState && (
            <p
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium"
              style={{
                background: 'rgba(10,3,0,0.72)',
                color: confirmMatchState === 'match' ? '#4ade80' : '#fca5a5',
              }}
            >
              {confirmMatchState === 'match'
                ? <><Check style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} /> Passwords match</>
                : <><X style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} /> Passwords do not match</>
              }
            </p>
          )}
          <FieldError message={errors.password_confirmation?.message} />
        </div>

        {/* ── Terms and Conditions checkbox ── */}
        <div className="flex flex-col gap-1.5">
          <div style={{ background: 'rgba(10,3,0,0.65)', borderRadius: '10px', padding: '10px 14px' }}>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                // Dismiss the terms error as soon as the user checks the box.
                if (e.target.checked) setTermsError(false);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded cursor-pointer"
            />
            <span className="leading-relaxed" style={{ fontSize: '0.9375rem', color: 'rgba(232,200,160,0.90)' }}>
              I agree to the{' '}
              <span className="font-semibold hover:underline cursor-pointer" style={{ color: '#fbbf24' }}>Terms of Use</span>
              {' '}and{' '}
              <span className="font-semibold hover:underline cursor-pointer" style={{ color: '#fbbf24' }}>Privacy Policy</span>.
            </span>
          </label>
          </div>
          {termsError && (
            <p
              role="alert"
              className="flex items-center gap-1.5 ml-7 rounded-lg px-2.5 py-1.5 text-sm font-medium"
              style={{ background: 'rgba(10,3,0,0.72)', color: '#fca5a5' }}
            >
              <AlertCircle style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
              You must agree to continue.
            </p>
          )}
        </div>

        {/* ── Submit button ── */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-1 py-3.5 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#166534', fontSize: '1rem' }}
        >
          {isSubmitting ? 'Creating account…' : 'Create Account'}
        </button>

        {/* ── HIPAA notice ── */}
        <div className="flex items-start justify-center gap-2 pt-0.5">
          <ShieldCheck className="flex-shrink-0 mt-0.5 text-slate-400" style={{ width: '1rem', height: '1rem' }} />
          <p className="text-center text-slate-400" style={{ fontSize: '0.8125rem' }}>
            Your account is protected under HIPAA and SC DPH data privacy standards.
          </p>
        </div>

        {/* ── Copyright line ── */}
        <p className="text-center text-slate-400" style={{ fontSize: '0.75rem' }}>
          © {new Date().getFullYear()} Camp Burnt Gin – South Carolina Department of Health
        </p>

      </form>
    </AuthCard>
  );
}
