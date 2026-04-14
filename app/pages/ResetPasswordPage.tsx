/**
 * ResetPasswordPage.tsx
 *
 * Purpose: Lets users set a new password after clicking the reset link in their email.
 * Responsibilities:
 *   - Reads `token` and `email` from the URL search params (e.g. ?token=abc&email=user@x.com).
 *   - If either param is missing the link is invalid — shows an error with a
 *     link back to the Forgot Password page.
 *   - On valid submit: POSTs to POST /api/auth/reset-password with token + email + new passwords.
 *   - On success: navigates to the login page.
 *
 * The token is a short-lived Laravel signed URL parameter — it expires after
 * a configurable window (default 60 minutes).
 */

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/features/auth/schemas/auth.schema';
import { resetPassword } from '@/features/auth/api/auth.api';
import { ROUTES } from '@/shared/constants/routes';
import { isValidationError } from '@/shared/types';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { Button } from '@/ui/components/Button';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  // useSearchParams gives us read access to the URL query string (?token=...&email=...).
  const [searchParams] = useSearchParams();
  // Extract the two required URL parameters; fall back to empty string if missing.
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  // Separate visibility toggles for each password field.
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Tracks whether the reset completed successfully — shows a dedicated success card.
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // Guard: if the URL is missing params the reset link is broken — show an error card.
  if (!token || !email) {
    return (
      <AuthCard
        title={t('auth_extra.invalid_link')}
        subtitle={t('auth_extra.invalid_link_body')}
        footer={
          <Link to={ROUTES.FORGOT_PASSWORD} className="text-ember-orange hover:underline">
            Request a new reset link
          </Link>
        }
      >
        {/* Empty div required because AuthCard always expects a children prop */}
        <div />
      </AuthCard>
    );
  }

  // Success: show a confirmation card instead of the form.
  if (success) {
    return (
      <AuthCard
        title={t('auth_extra.reset_success_title')}
        subtitle={t('auth_extra.reset_success_body')}
        footer={
          <Link to={ROUTES.LOGIN} className="text-ember-orange hover:underline">
            {t('auth_extra.reset_success_cta')}
          </Link>
        }
      >
        <div />
      </AuthCard>
    );
  }

  const onSubmit = async (values: ResetPasswordFormValues) => {
    try {
      // Include token and email from the URL — the server needs them to validate the request.
      await resetPassword({ ...values, token, email });
      setSuccess(true);
    } catch (error) {
      // Map field-level server errors (e.g. "token has expired") back onto the form.
      if (isValidationError(error)) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          setError(field as keyof ResetPasswordFormValues, { message: messages[0] });
        });
        return;
      }
      toast.error(
        (error as { message: string }).message ?? 'Failed to reset password. Please try again.'
      );
    }
  };

  return (
    <AuthCard
      title={t('auth_extra.reset_password_title')}
      subtitle={t('auth_extra.reset_password_requirements')}
      footer={
        <Link to={ROUTES.LOGIN} className="text-ember-orange hover:underline">
          {t('auth_extra.back_to_login')}
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

        {/* ── New password field ── */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium" style={{ color: 'var(--on-image-text)' }}>
            {t('auth_extra.reset_password_label')}
          </label>
          <div className="relative">
            <input
              id="password"
              // Swap input type to reveal/hide the password based on toggle state.
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="w-full rounded-lg px-4 py-3 pr-12 text-sm outline-none border transition-all duration-300 focus:ring-2 focus:ring-ember-orange/40"
              style={{
                background: 'var(--input)',
                color: 'var(--on-image-text)',
                // Red border on validation error; normal border otherwise.
                borderColor: errors.password ? 'var(--destructive)' : 'var(--on-image-border)',
              }}
              {...register('password')}
            />
            {/* Eye toggle button */}
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: 'var(--on-image-muted)' }}
              aria-label={showPassword ? t('auth_extra.hide_password') : t('auth_extra.show_password')}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p role="alert" className="text-xs" style={{ color: 'var(--destructive)' }}>
              {errors.password.message}
            </p>
          )}
        </div>

        {/* ── Confirm new password field ── */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password_confirmation" className="text-sm font-medium" style={{ color: 'var(--on-image-text)' }}>
            {t('auth_extra.reset_confirm_label')}
          </label>
          <div className="relative">
            <input
              id="password_confirmation"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              className="w-full rounded-lg px-4 py-3 pr-12 text-sm outline-none border transition-all duration-300 focus:ring-2 focus:ring-ember-orange/40"
              style={{
                background: 'var(--input)',
                color: 'var(--on-image-text)',
                borderColor: errors.password_confirmation ? 'var(--destructive)' : 'var(--on-image-border)',
              }}
              {...register('password_confirmation')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: 'var(--on-image-muted)' }}
              aria-label={showConfirm ? t('auth_extra.hide_password') : t('auth_extra.show_password')}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password_confirmation && (
            <p role="alert" className="text-xs" style={{ color: 'var(--destructive)' }}>
              {errors.password_confirmation.message}
            </p>
          )}
        </div>

        {/* className="mt-2" gives a little breathing room above the button */}
        <Button type="submit" fullWidth loading={isSubmitting} className="mt-2">
          {t('auth_extra.reset_submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
