/**
 * MedicalLayout.tsx
 *
 * Purpose: Route layout wrapper for the medical portal (/medical/*).
 * Responsibilities:
 *   - Guards the route: verifies the logged-in user has the `medical`, `admin`,
 *     or `super_admin` role (admins can view medical data in this portal).
 *     If they don't, redirects them to their own dashboard.
 *   - Builds the nav item list for the medical portal and passes it to
 *     DashboardShell.
 *   - Renders <Outlet /> so React Router can inject the matched child page.
 *
 * Medical nav structure (no group labels — flat list for this smaller portal):
 *   Dashboard, Treatment Logs, Medical Records, Incidents, Follow-Ups,
 *   Visits, Announcements, Inbox, Profile, Settings
 */

import { Outlet, Navigate } from 'react-router-dom';
import { LayoutDashboard, User, Settings, Inbox, ClipboardList, Megaphone, AlertOctagon, ClipboardCheck, Stethoscope, BookOpen, BookMarked } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import { DashboardShell } from './DashboardShell';
import { ROUTES } from '@/shared/constants/routes';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import type { NavItem } from './DashboardSidebar';

export function MedicalLayout() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  // Admins and super_admins can access the medical portal in addition to dedicated medical staff.
  const hasAccess = Boolean(
    user?.roles?.some((r) => ['medical', 'admin', 'super_admin'].includes(r.name)) ||
    ['medical', 'admin', 'super_admin'].includes(user?.role ?? '')
  );

  if (!hasAccess) {
    // Send the user to the dashboard that actually matches their role.
    const role = getPrimaryRole(user?.roles ?? []);
    return <Navigate to={getDashboardRoute(role)} replace />;
  }

  // Medical portal nav — flat list (no group property) renders without section headers.
  const navItems: NavItem[] = [
    { label: t('portal_nav.dashboard'),         to: ROUTES.MEDICAL_DASHBOARD,        icon: LayoutDashboard },
    // Camp Medical Directory — Phase 12: dedicated camper lookup page
    { label: t('medical.directory.nav_label'), to: ROUTES.MEDICAL_DIRECTORY,       icon: BookMarked },
    { label: t('portal_nav.treatment_logs'),   to: '/medical/treatments',           icon: ClipboardList },
    { label: t('portal_nav.medical_records'),  to: ROUTES.MEDICAL_RECORD_TREATMENT, icon: BookOpen },
    // Incidents, Follow-Ups, and Visits were added in Phase 11.
    { label: t('portal_nav.incidents'),        to: ROUTES.MEDICAL_INCIDENTS,        icon: AlertOctagon },
    { label: t('portal_nav.follow_ups'),       to: ROUTES.MEDICAL_FOLLOW_UPS,       icon: ClipboardCheck },
    { label: t('portal_nav.visits'),           to: ROUTES.MEDICAL_VISITS,           icon: Stethoscope },
    { label: t('portal_nav.announcements'),    to: ROUTES.MEDICAL_ANNOUNCEMENTS,    icon: Megaphone },
    { label: t('portal_nav.inbox'),            to: '/medical/inbox',                icon: Inbox },
    { label: t('portal_nav.profile'),          to: '/medical/profile',              icon: User },
    { label: t('portal_nav.settings'),         to: '/medical/settings',             icon: Settings },
  ];

  return (
    // DashboardShell handles sidebar + header; Outlet renders the matched child page.
    <DashboardShell navItems={navItems} pageTitle={t('medical.dashboard.title')}>
      <Outlet />
    </DashboardShell>
  );
}
