/**
 * AdminLayout.tsx
 *
 * Purpose: Route layout wrapper for the admin portal (/admin/*).
 * Responsibilities:
 *   - Guards the route: verifies the logged-in user has the `admin` or
 *     `super_admin` role. If they don't, redirects them to their own dashboard
 *     instead of showing a dead-end Forbidden page.
 *   - Builds the nav item list for this portal and passes it to DashboardShell.
 *   - Renders <Outlet /> so React Router can inject the matched child page.
 *
 * Why check both `roles` array and flat `role` string?
 *   The Redux auth state may have been set by older code that stored a flat
 *   `role` string. Checking both prevents a logged-in admin from being
 *   accidentally redirected out due to stale state shape.
 */

import { Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Home,
  FileText,
  FolderOpen,
  CalendarDays,
  Clock,
  BarChart3,
  MessageSquare,
  Settings,
  Megaphone,
  Layout,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import type { NavItem } from './DashboardSidebar';
import { SessionWorkspaceProvider } from '@/features/sessions/context/SessionWorkspaceContext';
import { SessionSelectorModal } from '@/features/sessions/components/SessionSelectorModal';
import { useUnreadMessageCount } from '@/ui/context/MessagingCountContext';

export function AdminLayout() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  // Consume from shared context — no independent fetch, no duplicate event listeners.
  const { unreadMessageCount } = useUnreadMessageCount();

  // Accept both normalized roles array and legacy flat role string.
  const hasAccess = Boolean(
    user?.roles?.some((r) => ['admin', 'super_admin'].includes(r.name)) ||
    ['admin', 'super_admin'].includes(user?.role ?? '')
  );

  if (!hasAccess) {
    // Redirect to /forbidden rather than getDashboardRoute(role).
    // The old pattern was the root cause of "admin portal turns into applicant
    // portal": if Redux role resolved to 'applicant' (stale state or cross-tab
    // contamination), the admin was silently routed into the applicant portal.
    return <Navigate to="/forbidden" replace />;
  }

  // Nav items are defined here (inside the component) so they are translated
  // on every render, picking up any language change from i18next immediately.
  const gPrimary = t('portal_nav.group_primary');
  const gComm    = t('portal_nav.group_communication');
  const gOps     = t('portal_nav.group_operations');
  const gSystem  = t('portal_nav.group_system');
  const navItems: NavItem[] = [
    // PRIMARY — core operational pages
    { group: gPrimary, label: t('portal_nav.dashboard'),        to: ROUTES.ADMIN_DASHBOARD,     icon: LayoutDashboard },
    { group: gPrimary, label: t('portal_nav.applications'),     to: ROUTES.ADMIN_APPLICATIONS,  icon: FileText },
    { group: gPrimary, label: t('portal_nav.families'),         to: ROUTES.ADMIN_FAMILIES,      icon: Home },
    { group: gPrimary, label: t('portal_nav.camper_directory'), to: ROUTES.ADMIN_CAMPERS,       icon: Users },
    { group: gPrimary, label: t('portal_nav.sessions_camps'),   to: ROUTES.ADMIN_SESSIONS,      icon: CalendarDays },
    // COMMUNICATION
    { group: gComm,   label: t('portal_nav.inbox'),            to: '/admin/inbox',             icon: MessageSquare, badge: unreadMessageCount > 0 ? unreadMessageCount : undefined },
    { group: gComm,   label: t('portal_nav.announcements'),    to: ROUTES.ADMIN_ANNOUNCEMENTS, icon: Megaphone },
    { group: gComm,   label: t('portal_nav.documents'),        to: ROUTES.ADMIN_DOCUMENTS,     icon: FolderOpen },
    // OPERATIONS
    { group: gOps,    label: t('portal_nav.calendar'),         to: ROUTES.ADMIN_CALENDAR,      icon: CalendarDays },
    { group: gOps,    label: t('portal_nav.deadlines'),        to: ROUTES.ADMIN_DEADLINES,     icon: Clock },
    { group: gOps,    label: t('portal_nav.reports'),          to: ROUTES.ADMIN_REPORTS,       icon: BarChart3 },
    // SYSTEM — governance & configuration
    { group: gSystem, label: t('portal_nav.form_builder'),     to: ROUTES.ADMIN_FORM_BUILDER,  icon: Layout },
    { group: gSystem, label: t('portal_nav.my_profile'),       to: '/admin/profile',           icon: User },
    { group: gSystem, label: t('portal_nav.settings'),         to: '/admin/settings',          icon: Settings },
  ];

  return (
    <SessionWorkspaceProvider>
      {/* SessionSelectorModal renders via portal; visibility driven by context state */}
      <SessionSelectorModal />
      <DashboardShell navItems={navItems} pageTitle={t('portal_nav.dashboard')}>
        <Outlet />
      </DashboardShell>
    </SessionWorkspaceProvider>
  );
}
