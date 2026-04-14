/**
 * SuperAdminLayout.tsx
 *
 * Purpose: Route layout wrapper for the super_admin portal (/super-admin/*).
 * Responsibilities:
 *   - Guards the route: verifies the logged-in user has the `super_admin` role.
 *     If they don't, redirects them to their own dashboard.
 *   - Builds TWO nav item arrays:
 *       1. navItems   — main scrollable nav (same sections as AdminLayout plus more).
 *       2. systemNavItems — pinned at the very bottom of the sidebar so User
 *          Management, Audit Log, Form Templates, and Settings are always visible.
 *   - Renders <Outlet /> so React Router can inject the matched child page.
 *
 * Why pinned bottom items?
 *   Super admins need quick access to User Management and Audit Log regardless
 *   of how many items the main nav contains or how tall the viewport is.
 *   The DashboardSidebar renders them outside the scrollable nav so they never
 *   scroll out of view.
 */

import { Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Home,
  Shield,
  ScrollText,
  FileText,
  CalendarDays,
  Clock,
  BarChart3,
  MessageSquare,
  FolderOpen,
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

export function SuperAdminLayout() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  // Consume from shared context — no independent fetch, no duplicate event listeners.
  const { unreadMessageCount } = useUnreadMessageCount();

  // Accept both the normalized roles array and the legacy flat role string.
  const hasAccess = Boolean(
    user?.roles?.some((r) => r.name === 'super_admin') ||
    user?.role === 'super_admin'
  );

  if (!hasAccess) {
    // Redirect to /forbidden rather than getDashboardRoute(role).
    // Same fix as AdminLayout — the old pattern silently routed stale-role
    // users into the applicant portal when role resolved to 'applicant'.
    return <Navigate to="/forbidden" replace />;
  }

  // All nav items in one flat array — grouped by translated section label.
  const gPrimary = t('portal_nav.group_primary');
  const gComm    = t('portal_nav.group_communication');
  const gOps     = t('portal_nav.group_operations');
  const navItems: NavItem[] = [
    // PRIMARY — core operational pages
    { group: gPrimary, label: t('portal_nav.dashboard'),          to: ROUTES.SUPER_ADMIN_DASHBOARD,    icon: LayoutDashboard },
    { group: gPrimary, label: t('portal_nav.applications'),       to: '/super-admin/applications',     icon: FileText },
    { group: gPrimary, label: t('portal_nav.families'),           to: '/super-admin/families',         icon: Home },
    { group: gPrimary, label: t('portal_nav.camper_directory'),   to: '/super-admin/campers',          icon: Shield },
    { group: gPrimary, label: t('portal_nav.sessions_camps'),     to: '/super-admin/sessions',         icon: CalendarDays },
    // COMMUNICATION
    { group: gComm,   label: t('portal_nav.inbox'),              to: '/super-admin/inbox',            icon: MessageSquare, badge: unreadMessageCount > 0 ? unreadMessageCount : undefined },
    { group: gComm,   label: t('portal_nav.announcements'),      to: '/super-admin/announcements',    icon: Megaphone },
    { group: gComm,   label: t('portal_nav.documents'),          to: '/super-admin/documents',        icon: FolderOpen },
    // OPERATIONS
    { group: gOps,    label: t('portal_nav.calendar'),           to: '/super-admin/calendar',         icon: CalendarDays },
    { group: gOps,    label: t('portal_nav.deadlines'),          to: '/admin/deadlines',              icon: Clock },
    { group: gOps,    label: t('portal_nav.reports'),            to: '/super-admin/reports',          icon: BarChart3 },
    // SYSTEM items are intentionally absent here — they live in systemNavItems below,
    // pinned permanently at the bottom of the sidebar so they can never scroll out of view.
  ];

  // Pinned at the bottom of the sidebar outside the scroll container — always visible.
  // DashboardSidebar renders these via pinnedBottomItems with a hard "SYSTEM" header.
  // CRITICAL: These must NEVER be moved back into navItems. User Management and Audit
  // Log are HIPAA-required governance features; they must be accessible at all times.
  const systemNavItems: NavItem[] = [
    { label: t('portal_nav.users_permissions'),  to: ROUTES.SUPER_ADMIN_USERS,        icon: Users },
    { label: t('portal_nav.audit_log'),          to: ROUTES.SUPER_ADMIN_AUDIT,        icon: ScrollText },
    { label: t('portal_nav.form_builder'),       to: ROUTES.SUPER_ADMIN_FORM_BUILDER, icon: Layout },
    { label: t('portal_nav.my_profile'),         to: '/super-admin/profile',          icon: User },
    { label: t('portal_nav.settings'),           to: '/super-admin/settings',         icon: Settings },
  ];

  return (
    <SessionWorkspaceProvider>
      {/* SessionSelectorModal renders via portal; visibility driven by context state */}
      <SessionSelectorModal />
      <DashboardShell navItems={navItems} pinnedBottomItems={systemNavItems} pageTitle={t('superadmin.dashboard.eyebrow')}>
        <Outlet />
      </DashboardShell>
    </SessionWorkspaceProvider>
  );
}
