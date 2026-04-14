/**
 * UserManagementPage.tsx
 *
 * Purpose: Full user table for super admins — view all users, change roles,
 *          and activate or deactivate accounts.
 * Responsibilities:
 *   - Fetch paginated users with optional search + role filter
 *   - Display a data table with name, email, role dropdown, join date, and action button
 *   - Allow inline role changes via a dropdown (blocked for the current user's own row)
 *   - Show a confirmation dialog before activating or deactivating a user
 *   - Optimistically update the role in local state; re-fetch after activate/deactivate
 *
 * Plain-English: This page is like a master contacts list where the super admin
 * can change someone's job title (role) or lock/unlock their account — but
 * they can't accidentally lock themselves out by changing their own account.
 *
 * Route: /super-admin/users
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Search, ChevronLeft, ChevronRight, UserCheck, UserX, AlertTriangle, UserPlus, X, Loader2, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';

import { getUsers, updateUserRole, deactivateUser, reactivateUser, createUser } from '@/features/admin/api/admin.api';
import type { CreateUserPayload } from '@/features/admin/api/admin.api';
import { ROLE_LABELS, type RoleName } from '@/shared/constants/roles';
import { useAppSelector } from '@/store/hooks';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import type { User } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';

// All valid role values in the system — used to populate the role dropdown
const ROLES = ['applicant', 'admin', 'medical', 'super_admin'];

// Maps each role to a background/text color pair for the role pill display
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  super_admin: { bg: 'rgba(22,163,74,0.12)', text: 'var(--ember-orange)' },
  admin:       { bg: 'rgba(96,165,250,0.12)', text: 'var(--night-sky-blue)' },
  medical:     { bg: 'rgba(5,150,105,0.12)', text: 'var(--forest-green)' },
  applicant:   { bg: 'rgba(22,163,74,0.1)',  text: 'var(--ember-orange)' },
};

// Consolidated filter object — all in one state to avoid double-fetch race conditions
interface UserFilters {
  search:     string;
  roleFilter: string;
  page:       number;
}

export function UserManagementPage() {
  const { t } = useTranslation();
  // Track the logged-in user's own ID to prevent self-modification
  const currentUserId = useAppSelector((state) => state.auth.user?.id);

  const [response, setResponse] = useState<PaginatedResponse<User> | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  // Single state object for all filters + page to avoid double-fetch when multiple change
  const [filters, setFilters]   = useState<UserFilters>({ search: '', roleFilter: '', page: 1 });
  // Track which user ID is being updated for a per-row spinner
  const [updating, setUpdating]         = useState<number | null>(null);
  // The user awaiting confirm in the activate/deactivate dialog; null = dialog closed
  const [confirmUser, setConfirmUser]   = useState<User | null>(null);

  // ── Create account modal state ────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserPayload>({
    name: '', email: '', password: '', password_confirmation: '', role: 'admin',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // searchInput is the controlled input value — updates immediately for UX.
  // filters.search is the debounced API value — only changes after 300ms of inactivity.
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search setter — avoids firing an API call on every keystroke.
  function setSearch(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value, page: 1 }));
    }, 300);
  }
  const setRoleFilter = (roleFilter: string) => setFilters((f) => ({ ...f, roleFilter, page: 1 }));
  const setPage       = (page: number)       => setFilters((f) => ({ ...f, page }));

  // Stable fetch function — recreated only when the filters object changes
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getUsers({
        page:   filters.page,
        // Only pass search/role to the API if they have a value — keeps URL clean
        search: filters.search || undefined,
        role:   filters.roleFilter || undefined,
      });
      setResponse(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Re-fetch whenever the stable fetchUsers reference changes (i.e., when filters change)
  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  // Inline role change — optimistically updates the local list without a full re-fetch
  async function handleRoleChange(userId: number, role: string) {
    // Prevent super admins from accidentally changing their own role
    if (userId === currentUserId) return;
    setUpdating(userId);
    try {
      const updated = await updateUserRole(userId, role);
      // Replace the updated user object in place inside the existing response
      setResponse((prev) =>
        prev ? { ...prev, data: prev.data.map((u) => (u.id === userId ? updated : u)) } : prev
      );
      toast.success(t('superadmin.users.role_updated'));
    } catch {
      toast.error(t('common.save_error'));
    } finally {
      setUpdating(null);
    }
  }

  // Activate or deactivate a user — full re-fetch after to get fresh server state
  async function handleToggleActive(user: User) {
    setUpdating(user.id);
    try {
      // email_verified_at being set is used as the "active" indicator
      const isActive = !!user.email_verified_at;
      if (isActive) {
        await deactivateUser(user.id);
      } else {
        await reactivateUser(user.id);
      }
      // Re-fetch instead of optimistically updating — ensures accuracy for status fields
      await fetchUsers();
      toast.success(t(isActive ? 'superadmin.users.deactivated' : 'superadmin.users.activated'));
    } catch {
      toast.error(t('common.save_error'));
    } finally {
      setUpdating(null);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateErrors({});
    if (createForm.password !== createForm.password_confirmation) {
      setCreateErrors({ password_confirmation: t('create_user.error') });
      return;
    }
    setCreateLoading(true);
    try {
      await createUser(createForm);
      toast.success(t('create_user.success', { email: createForm.email }));
      setShowCreateModal(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setCreateForm({ name: '', email: '', password: '', password_confirmation: '', role: 'admin' });
      // Re-fetch user list to include the new account
      await fetchUsers();
    } catch (err: unknown) {
      // The axios interceptor normalizes errors to { message, errors } — no response.data wrapper.
      const apiError = err as { errors?: Record<string, string[]>; message?: string };
      if (apiError?.errors && Object.keys(apiError.errors).length > 0) {
        const flat: Record<string, string> = {};
        for (const [field, msgs] of Object.entries(apiError.errors)) {
          flat[field] = msgs[0];
        }
        setCreateErrors(flat);
      } else {
        toast.error(t('create_user.error'));
      }
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('superadmin.users.title')}
        </h1>
        {/* Subtitle shows total user count once the first page loads */}
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {response && t('superadmin.users.subtitle', { total: response.meta.total })}
        </p>
        </div>
        {/* Create Staff Account button — super admin only, opens modal */}
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--ember-orange)', color: '#ffffff' }}
        >
          <UserPlus className="h-4 w-4" />
          {t('create_user.title')}
        </button>
      </div>

      {/* Filter bar: text search + role dropdown */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div
          className="flex items-center gap-2 flex-1 max-w-sm rounded-lg px-3 py-2 border"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={searchInput}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('superadmin.users.search_placeholder')}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          />
        </div>
        {/* Changing role filter resets to page 1 via setRoleFilter helper */}
        <select
          value={filters.roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <option value="">{t('superadmin.users.all_roles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r} style={{ background: 'var(--card)' }}>
              {ROLE_LABELS[r as RoleName] ?? r}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeletons.Row key={i} />)}</div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading')}
          description={t('common.try_again')}
          action={{ label: t('common.retry'), onClick: fetchUsers }}
        />
      ) : !response || response.data.length === 0 ? (
        <EmptyState title={t('superadmin.users.empty_title')} description={t('superadmin.users.empty_desc')} />
      ) : (
        <>
          {/* User table */}
          <div
            className="glass-data rounded-xl overflow-hidden"
          >
            {/* Column header row */}
            <div
              className="grid grid-cols-12 px-4 py-3 text-xs font-medium uppercase tracking-wide border-b"
              style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <div className="col-span-3">{t('superadmin.users.col_name')}</div>
              <div className="col-span-3">{t('superadmin.users.col_email')}</div>
              <div className="col-span-2">{t('superadmin.users.col_role')}</div>
              <div className="col-span-2">{t('superadmin.users.col_joined')}</div>
              <div className="col-span-2 text-right">{t('superadmin.users.col_actions')}</div>
            </div>

            {response.data.map((user) => {
              // Fall back to 'applicant' colors for any role not in the ROLE_COLORS map
              const roleStyle = ROLE_COLORS[user.role] ?? ROLE_COLORS['applicant'];
              return (
                <div
                  key={user.id}
                  className="grid grid-cols-12 items-center px-4 py-3.5 border-b last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="col-span-3">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{user.name}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>{user.email}</p>
                  </div>
                  <div className="col-span-2">
                    {updating === user.id ? (
                      // Show a small spinner in the role cell while an update is in flight
                      <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: 'var(--ember-orange)', borderTopColor: 'transparent' }} />
                    ) : (
                      // Role dropdown — styled as a colored pill; disabled for the current user
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={user.id === currentUserId}
                        title={user.id === currentUserId ? t('superadmin.users.self_role_tooltip') : undefined}
                        className="text-xs px-2 py-1 rounded-full border-0 outline-none font-medium"
                        style={{
                          background: roleStyle.bg,
                          color: roleStyle.text,
                          // Visual cue that the super admin can't change their own role
                          cursor: user.id === currentUserId ? 'not-allowed' : 'pointer',
                          opacity: user.id === currentUserId ? 0.6 : 1,
                        }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r} style={{ background: 'var(--card)', color: 'var(--foreground)' }}>
                            {ROLE_LABELS[r as RoleName] ?? r}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    {user.id === currentUserId ? (
                      // "You" label replaces the activate/deactivate button for the current user
                      <span className="text-xs px-2 py-1 rounded"
                        style={{ color: 'var(--muted-foreground)', background: 'var(--glass-medium)' }}>
                        You
                      </span>
                    ) : (
                      // Activate/deactivate icon button — opens confirmation dialog first
                      <button
                        onClick={() => setConfirmUser(user)}
                        disabled={updating === user.id}
                        className="p-1.5 rounded transition-colors disabled:opacity-40"
                        title={user.email_verified_at ? t('superadmin.users.deactivate') : t('superadmin.users.activate')}
                      >
                        {/* UserX = active user (can be deactivated); UserCheck = inactive (can be activated) */}
                        {user.email_verified_at
                          ? <UserX className="h-4 w-4" style={{ color: 'var(--destructive)' }} />
                          : <UserCheck className="h-4 w-4" style={{ color: 'var(--forest-green)' }} />
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination controls — only shown when there is more than one page */}
          {response.meta.last_page > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {t('common.pagination', {
                  from: (filters.page - 1) * response.meta.per_page + 1,
                  to: Math.min(filters.page * response.meta.per_page, response.meta.total),
                  total: response.meta.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(filters.page - 1)} disabled={filters.page === 1}
                  className="p-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>
                  <ChevronLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
                </button>
                <span className="text-sm px-2" style={{ color: 'var(--foreground)' }}>
                  {filters.page} / {response.meta.last_page}
                </span>
                <button onClick={() => setPage(filters.page + 1)} disabled={filters.page === response.meta.last_page}
                  className="p-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>
                  <ChevronRight className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Create Staff Account modal ─────────────────────────────────────── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.40)' }}
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowCreateModal(false); }}
        >
          <div
            className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 id="create-user-title" className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                  {t('create_user.title')}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {t('create_user.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              >
                <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  {t('create_user.name_label')} <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                  style={{ background: 'var(--input)', borderColor: createErrors.name ? 'var(--destructive)' : 'var(--border)', color: 'var(--foreground)' }}
                />
                {createErrors.name && <p className="text-xs mt-1" style={{ color: 'var(--destructive)' }}>{createErrors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  {t('create_user.email_label')} <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                  style={{ background: 'var(--input)', borderColor: createErrors.email ? 'var(--destructive)' : 'var(--border)', color: 'var(--foreground)' }}
                />
                {createErrors.email && <p className="text-xs mt-1" style={{ color: 'var(--destructive)' }}>{createErrors.email}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  {t('create_user.role_label')} <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as CreateUserPayload['role'] }))}
                  className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <option value="admin">{t('create_user.role_admin')}</option>
                  <option value="medical">{t('create_user.role_medical')}</option>
                  <option value="super_admin">{t('create_user.role_super_admin')}</option>
                </select>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  {t('create_user.password_label')} <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 pr-10 text-sm border outline-none"
                    style={{ background: 'var(--input)', borderColor: createErrors.password ? 'var(--destructive)' : 'var(--border)', color: 'var(--foreground)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-sm"
                    style={{ color: 'var(--muted-foreground)' }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {createErrors.password && <p className="text-xs mt-1" style={{ color: 'var(--destructive)' }}>{createErrors.password}</p>}
              </div>

              {/* Password criteria — only shown once the user starts typing */}
              {createForm.password.length > 0 && (() => {
                const pw = createForm.password;
                const criteria = [
                  { label: 'At least 8 characters',         met: pw.length >= 8 },
                  { label: 'One uppercase letter (A–Z)',     met: /[A-Z]/.test(pw) },
                  { label: 'One lowercase letter (a–z)',     met: /[a-z]/.test(pw) },
                  { label: 'One number (0–9)',               met: /[0-9]/.test(pw) },
                  { label: 'One special character (!@#…)',   met: /[^A-Za-z0-9]/.test(pw) },
                ];
                return (
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1 px-1">
                    {criteria.map(({ label, met }) => (
                      <li key={label} className="flex items-center gap-1.5 text-xs">
                        <span
                          className="flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                          style={{ background: met ? 'var(--ember-orange)' : 'var(--muted)', transition: 'background 0.2s' }}
                        >
                          {met && (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M1.5 4L3.2 5.8L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        <span style={{ color: met ? 'var(--ember-orange)' : 'var(--muted-foreground)', transition: 'color 0.2s' }}>
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              })()}

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  {t('create_user.confirm_password_label')} <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={createForm.password_confirmation}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password_confirmation: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 pr-10 text-sm border outline-none"
                    style={{
                      background: 'var(--input)',
                      borderColor: createErrors.password_confirmation
                        ? 'var(--destructive)'
                        : createForm.password_confirmation.length > 0
                          ? createForm.password_confirmation === createForm.password ? 'var(--ember-orange)' : 'var(--destructive)'
                          : 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-sm"
                    style={{ color: 'var(--muted-foreground)' }}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {createForm.password_confirmation.length > 0 && !createErrors.password_confirmation && (
                  <p className="text-xs mt-1" style={{ color: createForm.password_confirmation === createForm.password ? 'var(--ember-orange)' : 'var(--destructive)' }}>
                    {createForm.password_confirmation === createForm.password ? 'Passwords match' : 'Passwords do not match'}
                  </p>
                )}
                {createErrors.password_confirmation && <p className="text-xs mt-1" style={{ color: 'var(--destructive)' }}>{createErrors.password_confirmation}</p>}
              </div>

              {/* Submit / Cancel */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateErrors({}); }}
                  className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  disabled={createLoading}
                >
                  {t('create_user.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-60"
                  style={{ background: 'var(--ember-orange)', color: '#ffffff' }}
                >
                  {createLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t('create_user.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activate/Deactivate confirmation dialog */}
      {confirmUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.40)' }}
        >
          <div
            className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div className="flex items-start gap-3 mb-4">
              {/* Icon changes color based on whether we're activating (green) or deactivating (red) */}
              <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: confirmUser.email_verified_at ? 'rgba(220,38,38,0.10)' : 'rgba(22,163,74,0.10)' }}>
                <AlertTriangle className="h-4.5 w-4.5"
                  style={{ color: confirmUser.email_verified_at ? 'var(--destructive)' : 'var(--forest-green)' }} />
              </div>
              <div>
                <p id="confirm-dialog-title" className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {/* Title adapts to deactivate vs activate context */}
                  {confirmUser.email_verified_at
                    ? t('superadmin.users.deactivate_confirm_title', { name: confirmUser.name })
                    : t('superadmin.users.activate_confirm_title',   { name: confirmUser.name })}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {confirmUser.email_verified_at
                    ? t('superadmin.users.deactivate_confirm_body')
                    : t('superadmin.users.activate_confirm_body')}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmUser(null)}
                className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {t('common.cancel')}
              </button>
              {/* Confirm button: close dialog first, then run the toggle so there's no double-click risk */}
              <button
                type="button"
                onClick={() => { const u = confirmUser; setConfirmUser(null); void handleToggleActive(u); }}
                className="px-4 py-2 text-sm rounded-lg font-medium transition-colors"
                style={{
                  background: confirmUser.email_verified_at ? 'var(--destructive)' : 'var(--forest-green)',
                  color: '#ffffff',
                }}
              >
                {confirmUser.email_verified_at ? t('superadmin.users.deactivate') : t('superadmin.users.activate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
