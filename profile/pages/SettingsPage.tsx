/**
 * SettingsPage.tsx
 * User settings — Appearance, Account, Security, Notifications.
 * Available to all roles via /[role]/settings.
 */

import { useState, useEffect, type ReactNode, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Sun, Type, Contrast, Shield, Bell, User, Eye, EyeOff, Database, AlertTriangle, Languages, Check, X, Zap } from 'lucide-react';
import { usePasswordValidation, type PasswordRequirement } from '@/features/profile/hooks/usePasswordValidation';
import {
  applyFontScale,
  applyHighContrast,
  applyReducedMotion,
  getSavedFontScale,
  getSavedHighContrast,
  getSavedReducedMotion,
  type FontScale,
} from '@/theme/themePreferences';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreferences,
} from '@/features/admin/api/notifications.api';
import { getProfileRoute, getPrimaryRole, ADMIN_ROLES, ROLES } from '@/shared/constants/roles';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { Button } from '@/ui/components/Button';
import axiosInstance from '@/api/axios.config';
import { deleteAccount } from '@/features/profile/api/profile.api';
import { clearAuth } from '@/features/auth/store/authSlice';
import { ROUTES } from '@/shared/constants/routes';
import { useRealtime } from '@/features/realtime/RealtimeContext';

// ─── Types & schemas ──────────────────────────────────────────────────────────

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  // Mirror the backend policy: 12+ chars, mixed case, number, symbol.
  password: z.string()
    .min(12, 'Must be at least 12 characters')
    .regex(/[A-Z]/, 'Must include at least one uppercase letter')
    .regex(/[a-z]/, 'Must include at least one lowercase letter')
    .regex(/[0-9]/, 'Must include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must include at least one symbol'),
  password_confirmation: z.string(),
}).refine((d) => d.password === d.password_confirmation, {
  message: 'Passwords do not match',
  path: ['password_confirmation'],
});
type PasswordFormValues = z.infer<typeof passwordSchema>;

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'appearance' | 'account' | 'security' | 'notifications' | 'data';

const FONT_SCALES: { id: FontScale; label: string; size: string }[] = [
  { id: 'small',   label: 'Small',      size: '14px' },
  { id: 'default', label: 'Default',    size: '16px' },
  { id: 'large',   label: 'Large',      size: '18px' },
  { id: 'xlarge',  label: 'Extra Large',size: '20px' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  application_updates: true,
  announcements: true,
  messages: true,
  deadlines: true,
  in_app_message_notifications: true,
};

export function SettingsPage() {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { refreshNotificationPrefs } = useRealtime();
  const primaryRole = getPrimaryRole(user?.roles ?? []);
  const isStaffRole = ADMIN_ROLES.includes(primaryRole!);
  const isMedicalRole = primaryRole === ROLES.MEDICAL;
  const canSelfDelete = primaryRole === ROLES.APPLICANT;
  const [activeTab, setActiveTab] = useState<Tab>('appearance');
  const { t, i18n } = useTranslation();
  const [fontScale, setFontScaleState] = useState<FontScale>(getSavedFontScale);
  const [highContrast, setHighContrastState] = useState(getSavedHighContrast);
  const [reducedMotion, setReducedMotionState] = useState(getSavedReducedMotion);

  // Build tabs inside the component so labels re-render when language changes.
  const tabs: { id: Tab; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { id: 'appearance',    label: t('settings_page.tab_appearance'),    icon: Sun },
    { id: 'account',       label: t('settings_page.tab_account'),       icon: User },
    { id: 'security',      label: t('settings_page.tab_security'),      icon: Shield },
    { id: 'notifications', label: t('settings_page.tab_notifications'), icon: Bell },
    { id: 'data',          label: t('settings_page.tab_data'),          icon: Database },
  ];
  // Derive current language from the hook — reactive, re-renders when language changes.
  const currentLanguage = i18n.language?.slice(0, 2) || 'en';
  // All registered languages, derived from the i18n config (same source as LanguageToggle).
  const availableLanguages = Object.keys(i18n.options.resources ?? {});
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIF_PREFS);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [savingNotif, setSavingNotif] = useState<keyof NotificationPreferences | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePw, setShowDeletePw] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

  const watchedPassword     = watch('password', '');
  const watchedConfirmation = watch('password_confirmation', '');

  const handleFontScale = (scale: FontScale) => {
    setFontScaleState(scale);
    applyFontScale(scale);
    toast.success(`Font size set to ${scale}.`);
  };

  const handleHighContrast = (val: boolean) => {
    setHighContrastState(val);
    applyHighContrast(val);
    toast.success(val ? 'High contrast enabled.' : 'High contrast disabled.');
  };

  const handleReducedMotion = (val: boolean) => {
    setReducedMotionState(val);
    applyReducedMotion(val);
    toast.success(val ? 'Reduced motion enabled.' : 'Reduced motion disabled.');
  };

  const handleLanguageChange = (lang: string) => {
    void i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
    toast.success(lang === 'es' ? 'Idioma cambiado a Español.' : 'Language set to English.');
  };

  // Load notification preferences eagerly on mount so they are ready before
  // the user opens the notifications tab — avoids a race condition where an
  // in-flight load would overwrite an optimistic toggle update.
  useEffect(() => {
    if (notifLoaded || notifLoading) return;
    setNotifLoading(true);
    getNotificationPreferences()
      .then((prefs) => {
        setNotifPrefs(prefs);
        setNotifLoaded(true);
      })
      .catch(() => {
        setNotifLoaded(true); // use defaults on failure
      })
      .finally(() => {
        setNotifLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNotifToggle = async (key: keyof NotificationPreferences, value: boolean) => {
    // Ignore if this specific key is already saving — prevents duplicate in-flight requests.
    if (savingNotif === key) return;

    setSavingNotif(key);
    const prev = notifPrefs;
    setNotifPrefs((current) => ({ ...current, [key]: value })); // optimistic update
    try {
      const updated = await updateNotificationPreference(key, value);
      setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...updated });
      // Sync the RealtimeContext ref immediately so the in-app toast gate
      // reflects the new preference without requiring a page reload.
      refreshNotificationPrefs();
      toast.success('Preference saved.');
    } catch {
      setNotifPrefs(prev); // revert on error
      toast.error('Failed to save preference. Please try again.');
    } finally {
      setSavingNotif(null);
    }
  };

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    setSavingPw(true);
    try {
      await axiosInstance.put('/profile/password', values);
      toast.success('Password updated successfully.');
      reset();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? 'Failed to update password.');
    } finally {
      setSavingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error('Please enter your password to confirm account deletion.');
      return;
    }
    setDeletingAccount(true);
    try {
      await deleteAccount(deletePassword);
      // Clear sessionStorage token explicitly before clearing Redux state.
      // The backend already revoked all tokens; this prevents a stale token
      // from lingering in storage even though it would be rejected by the API.
      sessionStorage.removeItem('auth_token');
      dispatch(clearAuth());
      // Navigate explicitly rather than relying on ProtectedRoute's redirect,
      // so the user lands on the login page immediately with a clean URL.
      navigate(ROUTES.LOGIN, { replace: true });
      toast.success('Your account has been permanently deleted.');
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? 'Failed to delete account. Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h2
          className="font-headline font-semibold text-2xl mb-1"
          style={{ color: 'var(--foreground)' }}
        >
          Settings
        </h2>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '1rem' }}>
          Manage your preferences, appearance, and security settings.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Tab list */}
        <nav className="flex sm:flex-col gap-1 sm:w-44 flex-shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                style={{
                  background: isActive ? 'var(--dash-nav-active-bg)' : 'transparent',
                  color: isActive ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                  borderLeft: isActive ? '2px solid var(--ember-orange)' : '2px solid transparent',
                }}
                aria-selected={isActive}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {/* ── APPEARANCE ──────────────────────────────────────────────── */}
          {activeTab === 'appearance' && (
            <div className="flex flex-col gap-6">

              {/* Font scaling */}
              <SettingsCard
                icon={Type}
                title="Font Size"
                description="Adjust text size for better readability."
              >
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {FONT_SCALES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleFontScale(s.id)}
                      className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all"
                      style={{
                        background: fontScale === s.id ? 'var(--dash-nav-active-bg)' : 'transparent',
                        borderColor: fontScale === s.id ? 'var(--ember-orange)' : 'var(--border)',
                        color: fontScale === s.id ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                      }}
                    >
                      <span style={{ fontSize: s.size, lineHeight: 1 }}>Aa</span>
                      <span className="text-xs">{s.label}</span>
                    </button>
                  ))}
                </div>
              </SettingsCard>

              {/* High contrast */}
              <SettingsCard
                icon={Contrast}
                title="High Contrast"
                description="Increase contrast for better visibility."
              >
                <ToggleSwitch
                  checked={highContrast}
                  onChange={handleHighContrast}
                  label="Enable high contrast mode"
                />
              </SettingsCard>

              {/* Reduced motion */}
              <SettingsCard
                icon={Zap}
                title="Reduce Motion"
                description="Minimize animations and transitions throughout the app."
              >
                <ToggleSwitch
                  checked={reducedMotion}
                  onChange={handleReducedMotion}
                  label="Enable reduced motion"
                />
              </SettingsCard>

              {/* Language — options derived from registered i18n resources */}
              <SettingsCard
                icon={Languages}
                title="Language"
                description="Choose the display language for the application."
              >
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {availableLanguages.map((code) => {
                    const meta: Record<string, { native: string; label: string }> = {
                      en: { native: 'English', label: 'English' },
                      es: { native: 'Español', label: 'Spanish' },
                    };
                    const display = meta[code] ?? { native: code.toUpperCase(), label: code.toUpperCase() };
                    const isActive = currentLanguage === code;
                    return (
                      <button
                        key={code}
                        onClick={() => handleLanguageChange(code)}
                        className="flex flex-col items-center gap-0.5 py-3 px-2 rounded-xl border text-sm font-medium transition-all"
                        style={{
                          background: isActive ? 'var(--dash-nav-active-bg)' : 'transparent',
                          borderColor: isActive ? 'var(--ember-orange)' : 'var(--border)',
                          color: isActive ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                        }}
                      >
                        <span className="font-semibold">{display.native}</span>
                        <span className="text-xs opacity-70">{display.label}</span>
                      </button>
                    );
                  })}
                </div>
              </SettingsCard>

            </div>
          )}

          {/* ── ACCOUNT ─────────────────────────────────────────────────── */}
          {activeTab === 'account' && (
            <div className="flex flex-col gap-6">
              <div
                className="rounded-2xl border p-6"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                  Account Information
                </h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Name</p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{user?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Email</p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{user?.email ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Role</p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {user?.roles?.map((r) => r.name).join(', ') ?? '—'}
                    </p>
                  </div>
                </div>
                <p className="text-xs mt-4" style={{ color: 'var(--muted-foreground)' }}>
                  To update your name or email, go to{' '}
                  <Link
                    to={getProfileRoute(getPrimaryRole(user?.roles ?? []))}
                    className="hover:underline"
                    style={{ color: 'var(--ember-orange)' }}
                  >
                    Profile
                  </Link>.
                </p>
              </div>
            </div>
          )}

          {/* ── SECURITY ────────────────────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="flex flex-col gap-6">
              <div
                className="rounded-2xl border p-6"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                  Change Password
                </h3>
                <form onSubmit={handleSubmit(onPasswordSubmit)} className="flex flex-col gap-4">
                  {/* Current password */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="settings-current-password" className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        id="settings-current-password"
                        type={showCurrent ? 'text' : 'password'}
                        className="w-full rounded-lg px-4 py-3 pr-10 text-sm border outline-none transition-all focus:ring-2 focus:ring-ember-orange/30"
                        style={{
                          background: 'var(--input)',
                          color: 'var(--foreground)',
                          borderColor: errors.current_password ? 'var(--destructive)' : 'var(--border)',
                        }}
                        {...register('current_password')}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--muted-foreground)' }}
                        onClick={() => setShowCurrent(v => !v)}
                      >
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.current_password && (
                      <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                        {errors.current_password.message}
                      </p>
                    )}
                  </div>

                  {/* New password + live requirements checklist */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="settings-new-password" className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="settings-new-password"
                        type={showNew ? 'text' : 'password'}
                        autoComplete="new-password"
                        className="w-full rounded-lg px-4 py-3 pr-10 text-sm border outline-none transition-all focus:ring-2 focus:ring-ember-orange/30"
                        style={{
                          background: 'var(--input)',
                          color: 'var(--foreground)',
                          borderColor: 'var(--border)',
                        }}
                        {...register('password')}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--muted-foreground)' }}
                        onClick={() => setShowNew(v => !v)}
                        aria-label={showNew ? 'Hide new password' : 'Show new password'}
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordRequirementsDisplay password={watchedPassword} />
                  </div>

                  {/* Confirm new password + live match indicator */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="settings-confirm-password" className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        id="settings-confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        className="w-full rounded-lg px-4 py-3 pr-10 text-sm border outline-none transition-all focus:ring-2 focus:ring-ember-orange/30"
                        style={{
                          background: 'var(--input)',
                          color: 'var(--foreground)',
                          borderColor: 'var(--border)',
                        }}
                        {...register('password_confirmation')}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--muted-foreground)' }}
                        onClick={() => setShowConfirm(v => !v)}
                        aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordMatchIndicator password={watchedPassword} confirmation={watchedConfirmation} />
                  </div>

                  <Button type="submit" variant="primary" loading={savingPw} className="self-start mt-2">
                    Update Password
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* ── DATA & ACCOUNT ──────────────────────────────────────────── */}
          {activeTab === 'data' && (
            <div className="flex flex-col gap-6">

              {/* Admin/super-admin accounts cannot self-delete. */}
              {isStaffRole && (
                <div
                  className="rounded-2xl border p-6"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                    Data &amp; Account
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Account management for staff accounts is handled by a super-admin.
                    Contact your system administrator if you need to make changes to your account.
                  </p>
                </div>
              )}

              {/* Medical provider accounts cannot self-delete. */}
              {isMedicalRole && (
                <div
                  className="rounded-2xl border p-6"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                    Data &amp; Account
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Medical provider account deletion must be handled by a system administrator.
                    Contact your administrator for assistance.
                  </p>
                </div>
              )}

              {/* Account deletion — only available to applicants (parent/guardian role). */}
              {canSelfDelete && (
              <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'rgba(239,68,68,0.25)' }}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--destructive)' }}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--destructive)' }}>Delete Account</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      Permanently delete your account and erase your personal information. Your application history and your
                      children&apos;s records are retained for camp compliance purposes. All active sessions are revoked
                      immediately. This action is permanent and cannot be undone.
                    </p>
                  </div>
                </div>

                {!showDeleteConfirm ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete my account
                  </Button>
                ) : (
                  <div className="flex flex-col gap-3 pt-1">
                    <p className="text-xs font-medium" style={{ color: 'var(--destructive)' }}>
                      Enter your password to permanently delete your account:
                    </p>
                    <div className="relative w-64">
                      <input
                        type={showDeletePw ? 'text' : 'password'}
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Your password"
                        className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm border outline-none"
                        style={{ background: 'var(--input)', borderColor: 'rgba(239,68,68,0.4)', color: 'var(--foreground)' }}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--muted-foreground)' }}
                        onClick={() => setShowDeletePw((v) => !v)}
                        aria-label={showDeletePw ? 'Hide password' : 'Show password'}
                      >
                        {showDeletePw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        loading={deletingAccount}
                        disabled={!deletePassword || deletingAccount}
                        onClick={handleDeleteAccount}
                      >
                        Permanently delete account
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              )}

            </div>
          )}

          {/* ── NOTIFICATIONS ────────────────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div
              className="rounded-2xl border p-6"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                Notifications
              </h3>
              <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
                Control email alerts and in-app popups. Email settings apply to your registered address.
              </p>

              {notifLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-10 rounded-lg animate-pulse"
                      style={{ background: 'var(--border)' }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-0">
                  {(
                    [
                      { key: 'in_app_message_notifications' as keyof NotificationPreferences, label: 'In-app message notifications', description: 'Show a popup when a new message arrives while you are logged in' },
                      { key: 'application_updates'          as keyof NotificationPreferences, label: 'Application status updates (email)', description: 'Email when an application is submitted, approved, or rejected' },
                      { key: 'announcements'                as keyof NotificationPreferences, label: 'New announcements (email)',          description: 'Email when camp staff post a new announcement' },
                      { key: 'messages'                     as keyof NotificationPreferences, label: 'New messages in inbox (email)',      description: 'Email when you receive a new message or are added to a conversation' },
                      { key: 'deadlines'                    as keyof NotificationPreferences, label: 'Upcoming deadline reminders (email)', description: 'Email reminders about application and document deadlines' },
                    ] satisfies { key: keyof NotificationPreferences; label: string; description: string }[]
                  ).map((pref) => (
                    <div
                      key={pref.key}
                      className="flex items-center justify-between py-3.5 border-b last:border-b-0"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div className="flex flex-col gap-0.5 pr-4">
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          {pref.label}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {pref.description}
                        </span>
                      </div>
                      <ToggleSwitch
                        checked={notifPrefs[pref.key]}
                        onChange={(val) => handleNotifToggle(pref.key, val)}
                        label={pref.label}
                        hideLabel
                        disabled={savingNotif === pref.key}
                      />
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs mt-4" style={{ color: 'var(--muted-foreground)' }}>
                Preferences are saved to your account and apply across all devices.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start gap-3 mb-1">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── PasswordRequirementsDisplay ──────────────────────────────────────────────
//
// Shows each password requirement with a live ✓/✗ indicator as the user types.
// Neutral state (all gray) when the field is empty — no red until the user starts.

function PasswordRequirementsDisplay({ password }: { password: string }) {
  const { requirements } = usePasswordValidation(password);
  const hasInput = password.length > 0;

  return (
    <ul
      className="flex flex-col gap-1 mt-1.5"
      aria-label="Password requirements"
      aria-live="polite"
    >
      {requirements.map((req: PasswordRequirement) => {
        const state: 'neutral' | 'met' | 'unmet' = !hasInput ? 'neutral' : req.met ? 'met' : 'unmet';
        const color =
          state === 'met'   ? '#16a34a' :
          state === 'unmet' ? 'var(--destructive)' :
                              'var(--muted-foreground)';

        return (
          <li
            key={req.label}
            className="flex items-center gap-1.5 text-xs"
            style={{ color, transition: 'color 0.15s ease' }}
          >
            {state === 'met' ? (
              <Check className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            ) : (
              <X className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            )}
            <span>{req.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ─── PasswordMatchIndicator ───────────────────────────────────────────────────
//
// Displays a live match status below the confirm password field.
// Renders nothing when the confirm field is empty.

function PasswordMatchIndicator({ password, confirmation }: { password: string; confirmation: string }) {
  if (!confirmation) return null;
  const matches = password === confirmation;
  return (
    <p
      className="flex items-center gap-1 text-xs mt-0.5"
      style={{
        color: matches ? '#16a34a' : 'var(--destructive)',
        transition: 'color 0.15s ease',
      }}
      aria-live="polite"
    >
      {matches
        ? <Check className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        : <X    className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      }
      {matches ? 'Passwords match' : 'Passwords do not match'}
    </p>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  hideLabel = false,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  hideLabel?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 mt-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      {!hideLabel && (
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>{label}</span>
      )}
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          aria-label={label}
          disabled={disabled}
        />
        <div
          role="presentation"
          className="w-10 h-6 rounded-full transition-colors duration-300"
          style={{
            background: checked ? 'var(--ember-orange)' : 'var(--border)',
          }}
        />
        <div
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300"
          style={{ transform: `translateX(${checked ? '18px' : '2px'})` }}
        />
      </div>
    </label>
  );
}
