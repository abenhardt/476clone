/**
 * index.tsx — Core routing
 *
 * Portal-only architecture. Entry point: /login.
 * / redirects to /login. No public marketing pages.
 * Every page is React.lazy() wrapped via withSuspense().
 * Protected routes use ProtectedRoute + RoleGuard + role-specific layout.
 * /role/dashboard aliases each portal root for cleaner URLs post-login.
 */

import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { DEMO_MODE, getDemoDashboardRoute } from '@/config/runtime';

import { ErrorBoundary } from '@/app/ErrorBoundary';

import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { RoleGuard } from '@/core/auth/RoleGuard';
import { ROLES } from '@/shared/constants/roles';

import { AuthLayout }       from '@/app/layouts/AuthLayout';
import { AdminLayout }      from '@/ui/layout/AdminLayout';
import { SuperAdminLayout } from '@/ui/layout/SuperAdminLayout';
import { ApplicantLayout }  from '@/ui/layout/ApplicantLayout';
import { MedicalLayout }    from '@/ui/layout/MedicalLayout';

/**
 * withSuspense — lazy-loading wrapper factory
 *
 * React.lazy() splits each page into its own JS bundle that loads on demand.
 * Suspense shows a skeleton placeholder while the bundle is downloading.
 * This keeps the initial load fast — only the login page JS loads first.
 */
function withSuspense<T extends object>(Component: ComponentType<T>) {
  return function SuspenseWrapped(props: T) {
    return (
      // null fallback: sidebar/header remain visible during bundle fetch; no spinner flash
      <Suspense fallback={null}>
        <Component {...props} />
      </Suspense>
    );
  };
}

// ─── Utility pages ────────────────────────────────────────────────────────────
// .then(m => ({ default: m.PageName })) is needed because these files use named exports
const NotFoundPage  = withSuspense(lazy(() => import('@/app/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage }))));
const ForbiddenPage = withSuspense(lazy(() => import('@/app/pages/ForbiddenPage').then(m => ({ default: m.ForbiddenPage }))));

// ─── Auth pages ───────────────────────────────────────────────────────────────
const LoginPage          = withSuspense(lazy(() => import('@/app/pages/LoginPage').then(m => ({ default: m.LoginPage }))));
const RegisterPage       = withSuspense(lazy(() => import('@/app/pages/RegisterPage').then(m => ({ default: m.RegisterPage }))));
const MfaVerifyPage      = withSuspense(lazy(() => import('@/app/pages/MfaVerifyPage').then(m => ({ default: m.MfaVerifyPage }))));
const ForgotPasswordPage = withSuspense(lazy(() => import('@/app/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage }))));
const ResetPasswordPage  = withSuspense(lazy(() => import('@/app/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage }))));
const VerifyEmailPage    = withSuspense(lazy(() => import('@/app/pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage }))));

// ─── Applicant pages ──────────────────────────────────────────────────────────
// The "applicant" role is what parents/guardians use to submit camper applications
const ApplicantDocumentsPage       = withSuspense(lazy(() => import('@/features/parent/pages/ApplicantDocumentsPage').then(m => ({ default: m.ApplicantDocumentsPage }))));
const ApplicantDashboardPage       = withSuspense(lazy(() => import('@/features/parent/pages/ApplicantDashboardPage').then(m => ({ default: m.ApplicantDashboardPage }))));
const ApplicantApplicationsPage    = withSuspense(lazy(() => import('@/features/parent/pages/ApplicantApplicationsPage').then(m => ({ default: m.ApplicantApplicationsPage }))));
const ApplicationFormPage          = withSuspense(lazy(() => import('@/features/parent/pages/ApplicationFormPage').then(m => ({ default: m.ApplicationFormPage }))));
const ApplicationStartPage         = withSuspense(lazy(() => import('@/features/parent/pages/ApplicationStartPage').then(m => ({ default: m.ApplicationStartPage }))));
const ApplicantApplicationDetailPage = withSuspense(lazy(() => import('@/features/parent/pages/ApplicantApplicationDetailPage').then(m => ({ default: m.ApplicantApplicationDetailPage }))));
const ApplicantOfficialFormsPage   = withSuspense(lazy(() => import('@/features/parent/pages/ApplicantOfficialFormsPage').then(m => ({ default: m.ApplicantOfficialFormsPage }))));
const ParentCalendarPage           = withSuspense(lazy(() => import('@/features/parent/pages/ParentCalendarPage').then(m => ({ default: m.ParentCalendarPage }))));
const ParentAnnouncementsPage      = withSuspense(lazy(() => import('@/features/parent/pages/ParentAnnouncementsPage').then(m => ({ default: m.ParentAnnouncementsPage }))));

// ─── Admin pages ──────────────────────────────────────────────────────────────
const AdminDashboardPage         = withSuspense(lazy(() => import('@/features/admin/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage }))));
const AdminApplicationsPage      = withSuspense(lazy(() => import('@/features/admin/pages/AdminApplicationsPage').then(m => ({ default: m.AdminApplicationsPage }))));
const ApplicationReviewPage      = withSuspense(lazy(() => import('@/features/admin/pages/ApplicationReviewPage').then(m => ({ default: m.ApplicationReviewPage }))));
// Family management — 3-level IA: Families index → Family workspace → Camper/Application detail
const AdminFamiliesPage          = withSuspense(lazy(() => import('@/features/admin/pages/AdminFamiliesPage').then(m => ({ default: m.AdminFamiliesPage }))));
const AdminFamilyWorkspacePage   = withSuspense(lazy(() => import('@/features/admin/pages/AdminFamilyWorkspacePage').then(m => ({ default: m.AdminFamilyWorkspacePage }))));
const AdminCampersPage           = withSuspense(lazy(() => import('@/features/admin/pages/AdminCampersPage').then(m => ({ default: m.AdminCampersPage }))));
const CamperDetailPage           = withSuspense(lazy(() => import('@/features/admin/pages/CamperDetailPage').then(m => ({ default: m.CamperDetailPage }))));
const CamperRiskPage             = withSuspense(lazy(() => import('@/features/admin/pages/CamperRiskPage').then(m => ({ default: m.CamperRiskPage }))));
const AdminSessionsPage          = withSuspense(lazy(() => import('@/features/admin/pages/AdminSessionsPage').then(m => ({ default: m.AdminSessionsPage }))));
const ArchivedSessionsPage       = withSuspense(lazy(() => import('@/features/admin/pages/ArchivedSessionsPage').then(m => ({ default: m.ArchivedSessionsPage }))));
const AdminApplicationEditPage   = withSuspense(lazy(() => import('@/features/admin/pages/AdminApplicationEditPage').then(m => ({ default: m.AdminApplicationEditPage }))));
const SessionDetailPage          = withSuspense(lazy(() => import('@/features/admin/pages/SessionDetailPage').then(m => ({ default: m.SessionDetailPage }))));
const AdminReportsPage           = withSuspense(lazy(() => import('@/features/admin/pages/AdminReportsPage').then(m => ({ default: m.AdminReportsPage }))));
const AdminAnnouncementsPage     = withSuspense(lazy(() => import('@/features/admin/pages/AdminAnnouncementsPage').then(m => ({ default: m.AdminAnnouncementsPage }))));
const AdminCalendarPage          = withSuspense(lazy(() => import('@/features/admin/pages/AdminCalendarPage').then(m => ({ default: m.AdminCalendarPage }))));
const AdminDocumentsPage         = withSuspense(lazy(() => import('@/features/admin/pages/AdminDocumentsPage').then(m => ({ default: m.AdminDocumentsPage }))));
const AdminDeadlinesPage         = withSuspense(lazy(() => import('@/features/admin/pages/AdminDeadlinesPage').then(m => ({ default: m.AdminDeadlinesPage }))));

// ─── Medical pages ────────────────────────────────────────────────────────────
// Medical staff have their own portal with HIPAA-protected camper health data
const MedicalDashboardPage     = withSuspense(lazy(() => import('@/features/medical/pages/MedicalDashboardPage').then(m => ({ default: m.MedicalDashboardPage }))));
const CampMedicalDirectoryPage = withSuspense(lazy(() => import('@/features/medical/pages/CampMedicalDirectoryPage').then(m => ({ default: m.CampMedicalDirectoryPage }))));
const MedicalRecordPage        = withSuspense(lazy(() => import('@/features/medical/pages/MedicalRecordPage').then(m => ({ default: m.MedicalRecordPage }))));
const MedicalTreatmentLogPage      = withSuspense(lazy(() => import('@/features/medical/pages/MedicalTreatmentLogPage').then(m => ({ default: m.MedicalTreatmentLogPage }))));
const MedicalRecordTreatmentPage   = withSuspense(lazy(() => import('@/features/medical/pages/MedicalRecordTreatmentPage').then(m => ({ default: m.MedicalRecordTreatmentPage }))));
const MedicalDocumentsPage     = withSuspense(lazy(() => import('@/features/medical/pages/MedicalDocumentsPage').then(m => ({ default: m.MedicalDocumentsPage }))));
const MedicalIncidentsPage     = withSuspense(lazy(() => import('@/features/medical/pages/MedicalIncidentsPage').then(m => ({ default: m.MedicalIncidentsPage }))));
const MedicalFollowUpsPage     = withSuspense(lazy(() => import('@/features/medical/pages/MedicalFollowUpsPage').then(m => ({ default: m.MedicalFollowUpsPage }))));
const MedicalVisitsPage        = withSuspense(lazy(() => import('@/features/medical/pages/MedicalVisitsPage').then(m => ({ default: m.MedicalVisitsPage }))));
const MedicalEmergencyViewPage  = withSuspense(lazy(() => import('@/features/medical/pages/MedicalEmergencyViewPage').then(m => ({ default: m.MedicalEmergencyViewPage }))));
// MedicalCamperRiskPage replaced by CamperRiskPage — medical portal now uses the full risk UI

// ─── Super admin pages ────────────────────────────────────────────────────────
// Super admins get all admin pages plus user management, audit logs, and form builder
const SuperAdminDashboardPage = withSuspense(lazy(() => import('@/features/superadmin/pages/SuperAdminDashboardPage').then(m => ({ default: m.SuperAdminDashboardPage }))));
const UserManagementPage      = withSuspense(lazy(() => import('@/features/superadmin/pages/UserManagementPage').then(m => ({ default: m.UserManagementPage }))));
const AuditLogPage            = withSuspense(lazy(() => import('@/features/superadmin/pages/AuditLogPage').then(m => ({ default: m.AuditLogPage }))));
const FormDashboardPage = withSuspense(lazy(() => import('@/features/superadmin/pages/FormDashboardPage').then(m => ({ default: m.FormDashboardPage }))));
const FormEditorPage    = withSuspense(lazy(() => import('@/features/superadmin/pages/FormEditorPage').then(m => ({ default: m.FormEditorPage }))));

// ─── Shared pages ─────────────────────────────────────────────────────────────
// These pages are reused across multiple portals (each portal mounts them under its own prefix)
const InboxPage    = withSuspense(lazy(() => import('@/features/messaging/pages/InboxPage').then(m => ({ default: m.InboxPage }))));
const ProfilePage  = withSuspense(lazy(() => import('@/features/profile/pages/ProfilePage').then(m => ({ default: m.ProfilePage }))));
const SettingsPage = withSuspense(lazy(() => import('@/features/profile/pages/SettingsPage').then(m => ({ default: m.SettingsPage }))));

/**
 * RouteErrorBoundary — route-aware error boundary wrapper.
 *
 * Lives inside the router so it can call useLocation(). Passes the current
 * pathname as resetKey to ErrorBoundary, which resets the error state on
 * navigation so the new page renders normally instead of staying crashed.
 */
// eslint-disable-next-line react-refresh/only-export-components
function RouteErrorBoundary() {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>;
}

/**
 * createBrowserRouter builds the route tree.
 *
 * The nesting pattern used here is:
 *   ProtectedRoute (checks auth)
 *     └─ RoleGuard (checks role)
 *          └─ Layout (sidebar + topbar shell)
 *               └─ Page components
 *
 * Outlet is a placeholder that renders the matched child route inside its parent.
 */
export const router = createBrowserRouter([
  {
    // Root layout: wraps every route in a route-aware ErrorBoundary that
    // resets on navigation. No path — just an Outlet that renders children.
    element: <RouteErrorBoundary />,
    children: [

  // Root → login redirect (demo mode skips login and goes straight to admin dashboard)
  // In demo mode, redirect to the dashboard for the currently active demo role
  // (reads localStorage at router creation time — stable for the session).
  { path: '/', element: <Navigate to={DEMO_MODE ? getDemoDashboardRoute() : '/login'} replace /> },

  // Utility pages — standalone (no layout, no auth required)
  { path: '/forbidden', element: <ForbiddenPage /> },
  { path: '*',          element: <NotFoundPage /> },

  // ─── Auth routes (unauthenticated) ─────────────────────────────────────────
  // AuthLayout provides the centered card background for login/register screens
  {
    element: <AuthLayout />,
    children: [
      { path: '/login',            element: <LoginPage /> },
      { path: '/register',         element: <RegisterPage /> },
      { path: '/mfa-verify',       element: <MfaVerifyPage /> },
      { path: '/forgot-password',  element: <ForgotPasswordPage /> },
      { path: '/reset-password',   element: <ResetPasswordPage /> },
      { path: '/verify-email',     element: <VerifyEmailPage /> },
    ],
  },

  // ─── Applicant portal ──────────────────────────────────────────────────────
  // Layer 1: ProtectedRoute — redirects to /login if not authenticated
  // Layer 2: RoleGuard — only the 'applicant' role can enter
  // Layer 3: ApplicantLayout — renders the applicant sidebar and topbar shell
  {
    element: <ProtectedRoute />,
    children: [{
      element: <RoleGuard allowedRoles={[ROLES.APPLICANT]}><Outlet /></RoleGuard>,
      children: [{
        element: <ApplicantLayout />,
        children: [
          // /applicant with no sub-path redirects immediately to /applicant/dashboard
          { path: '/applicant',                     element: <Navigate to="/applicant/dashboard" replace /> },
          { path: '/applicant/dashboard',           element: <ApplicantDashboardPage /> },
          { path: '/applicant/applications',        element: <ApplicantApplicationsPage /> },
          { path: '/applicant/applications/start',  element: <ApplicationStartPage /> },
          { path: '/applicant/applications/new',    element: <ApplicationFormPage /> },
          // :id is a URL parameter — React Router fills it in from the actual URL
          { path: '/applicant/applications/:id',    element: <ApplicantApplicationDetailPage /> },
          { path: '/applicant/documents',           element: <ApplicantDocumentsPage /> },
          { path: '/applicant/forms',               element: <ApplicantOfficialFormsPage /> },
          { path: '/applicant/announcements',       element: <ParentAnnouncementsPage /> },
          { path: '/applicant/calendar',            element: <ParentCalendarPage /> },
          { path: '/applicant/inbox',               element: <InboxPage /> },
          { path: '/applicant/profile',             element: <ProfilePage /> },
          { path: '/applicant/settings',            element: <SettingsPage /> },
        ],
      }],
    }],
  },

  // ─── Admin portal ──────────────────────────────────────────────────────────
  // super_admin is also allowed here because RoleGuard grants them admin access
  {
    element: <ProtectedRoute />,
    children: [{
      element: <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}><Outlet /></RoleGuard>,
      children: [{
        element: <AdminLayout />,
        children: [
          { path: '/admin',                     element: <Navigate to="/admin/dashboard" replace /> },
          { path: '/admin/dashboard',           element: <AdminDashboardPage /> },
          { path: '/admin/applications',        element: <AdminApplicationsPage /> },
          { path: '/admin/applications/:id',      element: <ApplicationReviewPage /> },
          { path: '/admin/applications/:id/edit', element: <AdminApplicationEditPage /> },
          // Family management — 3-level IA
          { path: '/admin/families',            element: <AdminFamiliesPage /> },
          { path: '/admin/families/:userId',    element: <AdminFamilyWorkspacePage /> },
          { path: '/admin/campers',             element: <AdminCampersPage /> },
          { path: '/admin/campers/:id',         element: <CamperDetailPage /> },
          { path: '/admin/campers/:id/risk',    element: <CamperRiskPage /> },
          { path: '/admin/sessions',            element: <AdminSessionsPage /> },
          { path: '/admin/sessions/archived',   element: <ArchivedSessionsPage /> },
          { path: '/admin/sessions/:id',        element: <SessionDetailPage /> },
          { path: '/admin/reports',             element: <AdminReportsPage /> },
          { path: '/admin/announcements',       element: <AdminAnnouncementsPage /> },
          { path: '/admin/calendar',            element: <AdminCalendarPage /> },
          { path: '/admin/documents',           element: <AdminDocumentsPage /> },
          { path: '/admin/deadlines',           element: <AdminDeadlinesPage /> },
          // Form Builder is super_admin-only governance tooling. The parent RoleGuard
          // allows admin + super_admin into this portal, so these routes add a second
          // RoleGuard to restrict form-builder access to super_admin exclusively.
          { path: '/admin/form-builder',        element: <RoleGuard allowedRoles={[ROLES.SUPER_ADMIN]}><FormDashboardPage /></RoleGuard> },
          { path: '/admin/form-builder/:formId', element: <RoleGuard allowedRoles={[ROLES.SUPER_ADMIN]}><FormEditorPage /></RoleGuard> },
          { path: '/admin/inbox',               element: <InboxPage /> },
          { path: '/admin/profile',             element: <ProfilePage /> },
          { path: '/admin/settings',            element: <SettingsPage /> },
        ],
      }],
    }],
  },

  // ─── Medical portal ────────────────────────────────────────────────────────
  // Only users with the 'medical' role can access these HIPAA-protected routes
  {
    element: <ProtectedRoute />,
    children: [{
      element: <RoleGuard allowedRoles={[ROLES.MEDICAL]}><Outlet /></RoleGuard>,
      children: [{
        element: <MedicalLayout />,
        children: [
          { path: '/medical',                                      element: <Navigate to="/medical/dashboard" replace /> },
          { path: '/medical/dashboard',                          element: <MedicalDashboardPage /> },
          // Phase 12: dedicated camper medical directory
          { path: '/medical/directory',                          element: <CampMedicalDirectoryPage /> },
          // :camperId scopes the medical record to a specific camper
          { path: '/medical/records/:camperId',                  element: <MedicalRecordPage /> },
          { path: '/medical/records/:camperId/treatments',       element: <MedicalTreatmentLogPage /> },
          { path: '/medical/records/:camperId/documents',        element: <MedicalDocumentsPage /> },
          // Global (non-camper-scoped) treatment and incident views
          { path: '/medical/treatments',                         element: <MedicalTreatmentLogPage /> },
          { path: '/medical/record-treatment',                   element: <MedicalRecordTreatmentPage /> },
          { path: '/medical/incidents',                          element: <MedicalIncidentsPage /> },
          { path: '/medical/follow-ups',                         element: <MedicalFollowUpsPage /> },
          { path: '/medical/visits',                             element: <MedicalVisitsPage /> },
          // Camper-scoped incident and visit views (filtered by camperId)
          { path: '/medical/records/:camperId/incidents',        element: <MedicalIncidentsPage /> },
          { path: '/medical/records/:camperId/visits',           element: <MedicalVisitsPage /> },
          // Emergency view shows critical info for a specific camper at a glance
          { path: '/medical/records/:camperId/emergency',        element: <MedicalEmergencyViewPage /> },
          { path: '/medical/records/:id/risk',                  element: <CamperRiskPage /> },
          { path: '/medical/announcements',                      element: <ParentAnnouncementsPage /> },
          { path: '/medical/inbox',                              element: <InboxPage /> },
          { path: '/medical/profile',                            element: <ProfilePage /> },
          { path: '/medical/settings',                           element: <SettingsPage /> },
        ],
      }],
    }],
  },

  // ─── Super admin portal ────────────────────────────────────────────────────
  // Exclusive to super_admin — includes governance tools not available to admin
  {
    element: <ProtectedRoute />,
    children: [{
      element: <RoleGuard allowedRoles={[ROLES.SUPER_ADMIN]}><Outlet /></RoleGuard>,
      children: [{
        element: <SuperAdminLayout />,
        children: [
          { path: '/super-admin',                      element: <Navigate to="/super-admin/dashboard" replace /> },
          { path: '/super-admin/dashboard',            element: <SuperAdminDashboardPage /> },
          // Governance-only pages (not available in the regular admin portal)
          { path: '/super-admin/users',                element: <UserManagementPage /> },
          { path: '/super-admin/audit',                element: <AuditLogPage /> },
          // Form Builder — multi-screen workflow
          { path: '/super-admin/form-builder',          element: <FormDashboardPage /> },
          { path: '/super-admin/form-builder/:formId', element: <FormEditorPage /> },
          // Shared admin pages also mounted under super-admin prefix
          { path: '/super-admin/applications',         element: <AdminApplicationsPage /> },
          { path: '/super-admin/applications/:id',          element: <ApplicationReviewPage /> },
          { path: '/super-admin/applications/:id/edit',      element: <AdminApplicationEditPage /> },
          // Family management — 3-level IA (mirrored from admin portal)
          { path: '/super-admin/families',             element: <AdminFamiliesPage /> },
          { path: '/super-admin/families/:userId',     element: <AdminFamilyWorkspacePage /> },
          { path: '/super-admin/campers',              element: <AdminCampersPage /> },
          { path: '/super-admin/campers/:id',          element: <CamperDetailPage /> },
          { path: '/super-admin/campers/:id/risk',     element: <CamperRiskPage /> },
          { path: '/super-admin/sessions',             element: <AdminSessionsPage /> },
          { path: '/super-admin/sessions/archived',    element: <ArchivedSessionsPage /> },
          { path: '/super-admin/sessions/:id',         element: <SessionDetailPage /> },
          { path: '/super-admin/reports',              element: <AdminReportsPage /> },
          { path: '/super-admin/announcements',        element: <AdminAnnouncementsPage /> },
          { path: '/super-admin/calendar',             element: <AdminCalendarPage /> },
          { path: '/super-admin/deadlines',            element: <AdminDeadlinesPage /> },
          { path: '/super-admin/documents',            element: <AdminDocumentsPage /> },
          { path: '/super-admin/inbox',                element: <InboxPage /> },
          { path: '/super-admin/profile',              element: <ProfilePage /> },
          { path: '/super-admin/settings',             element: <SettingsPage /> },
        ],
      }],
    }],
  },

    ], // end RouteErrorBoundary children
  },   // end RouteErrorBoundary route
]);
