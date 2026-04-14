/**
 * DashboardHeader.tsx
 *
 * Purpose: The sticky top bar rendered inside DashboardShell for all authenticated
 * dashboard layouts.
 *
 * Responsibilities:
 *   - Displays the current page title (passed in from DashboardShell).
 *   - Provides a language toggle (EN/ES) for i18n switching.
 *   - Links to the role-appropriate settings page.
 *   - Shows a notification bell with an unread-count badge; clicking it opens
 *     the NotificationPanel slide-out drawer.
 *   - Shows a user avatar button that opens a dropdown with profile, settings,
 *     and sign-out options.
 *
 * Route helpers:
 *   - getSettingsRoute() reads the URL prefix (/admin, /medical, etc.) to
 *     build the correct settings path without needing Redux or role checks.
 *   - getProfileRoute() (imported) does the same for profile links.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bell, User, LogOut, Settings } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { logout } from '@/features/auth/api/auth.api';
import { clearAuth } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { getNotifications } from '@/features/admin/api/notifications.api';
import { NotificationPanel } from '@/ui/components/NotificationPanel';
import { LanguageToggle } from '@/ui/components/LanguageToggle';
import { Avatar } from '@/ui/components/Avatar';
import { ROUTES } from '@/shared/constants/routes';
import { getPrimaryRole, getProfileRoute } from '@/shared/constants/roles';
import { useUnreadMessageCount } from '@/ui/context/MessagingCountContext';

interface DashboardHeaderProps {
  title: string;
}

/**
 * Returns the settings route for the current portal prefix.
 * e.g. /super-admin/anything → "/super-admin/settings"
 */
function getSettingsRoute(pathname: string): string {
  if (pathname.startsWith('/super-admin')) return '/super-admin/settings';
  if (pathname.startsWith('/admin')) return '/admin/settings';
  if (pathname.startsWith('/medical')) return '/medical/settings';
  return '/applicant/settings';
}

export function DashboardHeader({ title }: DashboardHeaderProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  // Controls whether the notification slide-out panel is open.
  const [notifOpen, setNotifOpen] = useState(false);
  // System notification unread count — comes from server on mount; updated by NotificationPanel callbacks.
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // Inbox message unread count from context — shared across all layouts via MessagingCountProvider.
  const { unreadMessageCount } = useUnreadMessageCount();
  // Bell badge combines both notification and message unread counts into a single indicator.
  const unreadCount = unreadNotifications + unreadMessageCount;
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Derive the correct profile and settings URLs for the logged-in user's role.
  const profileRoute = getProfileRoute(getPrimaryRole(user?.roles ?? []));
  const settingsRoute = getSettingsRoute(location.pathname);

  // Fetch the notification unread count from the server. Extracted as a callback
  // so it can be called from multiple places: on mount, on an interval, and when
  // a real-time event signals that something may have changed.
  const refreshNotificationCount = useCallback(() => {
    getNotifications()
      .then((res) => setUnreadNotifications(res.meta.unread_count))
      .catch(() => {});
  }, []);

  // Initial fetch on mount + periodic refresh every 60 s so new system
  // notifications (app approved, account security events, etc.) appear
  // without requiring a page reload.
  // Also refresh when a real-time inbox event fires — a new message may have
  // triggered a system notification on the backend at the same time.
  useEffect(() => {
    refreshNotificationCount();

    const interval = setInterval(refreshNotificationCount, 60_000);
    window.addEventListener('notification:refresh', refreshNotificationCount);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notification:refresh', refreshNotificationCount);
    };
  }, [refreshNotificationCount]);

  /**
   * Signs the user out: calls the API (ignores errors), clears Redux auth
   * state, navigates to login.
   */
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // ignore logout API errors
    }
    navigate(ROUTES.LOGIN, { replace: true });
    dispatch(clearAuth());
    toast.success(t('sidebar.signed_out'));
  };

  return (
    <>
      <header
        className="h-16 flex items-center px-6 border-b flex-shrink-0"
        style={{
          background: 'var(--dash-header-bg)',
          borderColor: 'var(--dash-sidebar-border)',
          backdropFilter: 'blur(16px) saturate(180%) brightness(106%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%) brightness(106%)',
        }}
      >
        {/* Left side: page title */}
        <div className="flex-1 flex items-center min-w-0">
          <h1
            className="text-base font-headline font-semibold truncate"
            style={{ color: 'var(--foreground)' }}
          >
            {title}
          </h1>
        </div>

        {/* Right-side controls — always grouped in a flex row */}
        <div className="flex-1 flex items-center justify-end gap-1">
          {/* Language toggle switches between English and Spanish */}
          <LanguageToggle />

          {/* Settings gear icon — navigates to the role-specific settings page */}
          <Link
            to={settingsRoute}
            className="p-2 rounded-xl transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>

          {/* Notification bell — orange dot badge appears when there are unread notifications */}
          <button
            onClick={() => setNotifOpen(true)}
            className="relative p-2 rounded-xl transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            // aria-label includes count so screen readers announce "3 unread" etc.
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {/* Orange dot — only rendered when there is at least 1 unread notification */}
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ background: 'var(--ember-orange)' }}
                aria-hidden="true"
              />
            )}
          </button>

          {/* User dropdown — opens a popover with profile, settings, and sign-out */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              {/* Avatar button: initial letter + first name on sm+ screens */}
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ml-1"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  background: 'transparent',
                }}
                aria-label="User menu"
              >
                {/* User avatar — photo if available, initials fallback */}
                <Avatar src={user?.avatar_url} name={user?.name ?? ''} size="sm" />
                {/* First name only — hidden on small screens to save space */}
                <span className="text-sm hidden sm:block">{user?.name.split(' ')[0]}</span>
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={8} asChild>
                {/* Dropdown panel */}
                <div
                  className="w-52 rounded-xl border p-1.5 z-50"
                  style={{
                    background: 'var(--popover)',
                    borderColor: 'var(--border)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  {/* User info — name + email at the top of the dropdown */}
                  <div
                    className="px-3 py-2 mb-1 border-b"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {user?.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {user?.email}
                    </p>
                  </div>

                  {/* Profile link — goes to the role-specific profile page */}
                  <DropdownMenu.Item asChild>
                    <Link
                      to={profileRoute}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors"
                      style={{ color: 'var(--foreground)' }}
                    >
                      <User className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                      Profile
                    </Link>
                  </DropdownMenu.Item>

                  {/* Settings link — same destination as the gear icon in the header */}
                  <DropdownMenu.Item asChild>
                    <Link
                      to={settingsRoute}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors"
                      style={{ color: 'var(--foreground)' }}
                    >
                      <Settings className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                      Settings
                    </Link>
                  </DropdownMenu.Item>

                  {/* Visual divider between navigation items and the destructive sign-out action */}
                  <DropdownMenu.Separator
                    className="my-1 h-px"
                    style={{ background: 'var(--border)' }}
                  />

                  {/* Sign-out button — red text to signal a potentially irreversible action */}
                  <DropdownMenu.Item asChild>
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors"
                      style={{ color: 'var(--destructive)' }}
                    >
                      <LogOut className="h-4 w-4 flex-shrink-0" />
                      {isLoggingOut ? t('sidebar.signing_out') : t('sidebar.sign_out')}
                    </button>
                  </DropdownMenu.Item>
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Notification slide-out panel — rendered outside the header so it can
          overlay the full page. onUnreadChange keeps the bell badge in sync. */}
      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onUnreadChange={setUnreadNotifications}
      />
    </>
  );
}
