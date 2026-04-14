# Page Structure

Camp Burnt Gin is a portal-only application. There is no public marketing site. Every URL either belongs to an authenticated portal or is a pre-authentication utility page.

---

## Component Hierarchy

Every portal page is mounted through the same three-layer security wrapper before reaching the page component:

```
createBrowserRouter
└─ RouteErrorBoundary          (resets error state on navigation via pathname-keyed ErrorBoundary)
   ├─ AuthLayout               (public auth pages — no protection)
   │  └─ Page
   └─ ProtectedRoute           (checks: isLoading → isAuthenticated → mfaRequired → email_verified_at)
      └─ RoleGuard             (checks user.role against allowedRoles for the portal)
         └─ <Portal>Layout     (sidebar + topbar shell — DashboardShell + portal nav)
            └─ Page            (lazy-loaded via React.lazy + withSuspense)
```

The `RouteErrorBoundary` component wraps all routes so that a crash on one page does not prevent navigation to another page. It passes `pathname` as `resetKey` to the `ErrorBoundary`, which resets the error state on every route change.

---

## Lazy Loading with `withSuspense`

Every page component is code-split. The `withSuspense` factory in `src/core/routing/index.tsx` wraps each `React.lazy()` import:

```tsx
function withSuspense<T extends object>(Component: ComponentType<T>) {
  return function SuspenseWrapped(props: T) {
    return (
      <Suspense fallback={null}>
        <Component {...props} />
      </Suspense>
    );
  };
}
```

Key behaviors:
- Each page ships as a separate JS bundle loaded on first navigation to that route.
- The initial page load only downloads the login page bundle.
- The `fallback={null}` means the sidebar and topbar remain visible during bundle fetch; there is no spinner flash on navigation within a portal.
- Named exports are resolved with `.then(m => ({ default: m.PageName }))` in the lazy import because most page files use named exports.

---

## Demo Mode

When the app is built with `VITE_DEMO_MODE=true` (activated via `vite --mode demo`):

- The root `/` redirects directly to the dashboard for the current demo role rather than to `/login`.
- `useAuthInit` bypasses the `GET /api/user` validation and injects a synthetic demo user into Redux.
- The axios instance uses `demoAdapter`, which intercepts every request and returns mock data. No network calls are made.
- The active demo role is stored in `localStorage` under key `demo_role` and defaults to `admin`. It can be switched at runtime via `setDemoRole()`.
- Demo users contain no real PHI; they use synthetic identities with `.dev` TLD emails and IDs in the 9000-range.

---

## Public Routes (No Authentication Required)

These routes are served inside `AuthLayout`, which provides the centered card background for pre-authentication screens.

| Route | Component | Purpose |
|---|---|---|
| `/login` | `LoginPage` | Email + password login; writes `auth_token` to `sessionStorage` on success |
| `/register` | `RegisterPage` | New account creation for applicant (parent/guardian) role |
| `/mfa-verify` | `MfaVerifyPage` | Time-based one-time password verification after login when MFA is enabled |
| `/forgot-password` | `ForgotPasswordPage` | Sends a password-reset email |
| `/reset-password` | `ResetPasswordPage` | Consumes reset token from email and sets a new password |
| `/verify-email` | `VerifyEmailPage` | Handles email verification link click; `?pending=true` shows a waiting state |

### Utility Routes (No Layout)

| Route | Component | Purpose |
|---|---|---|
| `/forbidden` | `ForbiddenPage` | Shown when a user's role does not permit access to a resource |
| `*` | `NotFoundPage` | 404 catch-all for any unmatched URL |

---

## Applicant Portal

**Role required:** `applicant`
**Layout:** `ApplicantLayout`
**Route prefix:** `/applicant`

The `applicant` role is used by parents and guardians submitting camper applications. The role name in code is always `applicant`; the `/parent/*` prefix is not used.

| Route | Component File | Purpose | Key Data Loaded |
|---|---|---|---|
| `/applicant` | — | Immediate redirect to `/applicant/dashboard` | — |
| `/applicant/dashboard` | `ApplicantDashboardPage` | Summary of active applications, upcoming sessions, and recent activity | Applications list, session data |
| `/applicant/applications` | `ApplicantApplicationsPage` | List of all submitted and draft applications | Paginated applications |
| `/applicant/applications/start` | `ApplicationStartPage` | Entry point for starting a new application; shows New / Continue Draft / Re-apply cards | Draft from `localStorage` key `cbg_app_draft`; past applications for re-apply flow |
| `/applicant/applications/new` | `ApplicationFormPage` | 10-section interactive digital application form (English or Spanish via i18n) | Session list for camp session selection; prefill from `location.state` for re-apply |
| `/applicant/applications/:id` | `ApplicantApplicationDetailPage` | Read-only view of a submitted application; shows Application Checklist (digital form + medical upload status) | Single application by ID; associated documents |
| `/applicant/documents` | `ApplicantDocumentsPage` | Document library showing all files the applicant has uploaded | Document list |
| `/applicant/forms` | `ApplicantOfficialFormsPage` | Official forms hub: digital form completion status + medical form download/upload | Form templates; applications; documents |
| `/applicant/announcements` | `ParentAnnouncementsPage` | Camp announcements published by admins | Announcements list |
| `/applicant/calendar` | `ParentCalendarPage` | Calendar view of camp sessions and deadlines | Calendar events |
| `/applicant/inbox` | `InboxPage` (shared) | Two-panel threaded messaging with camp staff | Conversations and messages |
| `/applicant/profile` | `ProfilePage` (shared) | Account profile — name, contact details, avatar | Authenticated user record |
| `/applicant/settings` | `SettingsPage` (shared) | Accessibility settings: font scale, high contrast, reduced motion; notification preferences | User settings |

---

## Admin Portal

**Role required:** `admin` or `super_admin`
**Layout:** `AdminLayout`
**Route prefix:** `/admin`

`super_admin` users have access to the admin portal because `RoleGuard` expands their effective roles to `['super_admin', 'admin']`. When a super admin navigates to `/admin/*` routes they use the `AdminLayout`, not the `SuperAdminLayout`.

| Route | Component File | Purpose | Key Data Loaded |
|---|---|---|---|
| `/admin` | — | Redirect to `/admin/dashboard` | — |
| `/admin/dashboard` | `AdminDashboardPage` | Overview of active sessions, pending applications, and alerts | Dashboard metrics |
| `/admin/applications` | `AdminApplicationsPage` | Paginated, filterable list of all applications across all sessions | Applications with session filter |
| `/admin/applications/:id` | `ApplicationReviewPage` | Full application review with section-based inline editing; status controls; document management | Single application; camper; emergency contacts; behavioral profile; documents |
| `/admin/applications/:id/edit` | `AdminApplicationEditPage` | Dedicated edit view for an application | Application detail |
| `/admin/families` | `AdminFamiliesPage` | Families index — top level of the 3-level family IA | Paginated family list |
| `/admin/families/:userId` | `AdminFamilyWorkspacePage` | Family workspace — all campers and applications for one guardian account | Family members; applications |
| `/admin/campers` | `AdminCampersPage` | Camper directory with session filter | Paginated campers |
| `/admin/campers/:id` | `CamperDetailPage` | Full camper profile: applications, active status, risk flags | Single camper; applications; medical risk summary |
| `/admin/sessions` | `AdminSessionsPage` | Active camp sessions list; create/edit/delete; capacity management | Sessions with enrolled counts |
| `/admin/sessions/archived` | `ArchivedSessionsPage` | Archived sessions with restore action | Archived sessions |
| `/admin/sessions/:id` | `SessionDetailPage` | Session dashboard: enrolled campers, waitlist, capacity gauge | Single session; enrolled campers; waitlist |
| `/admin/reports` | `AdminReportsPage` | Export reports: applications by status (including waitlisted), camper demographics | — |
| `/admin/announcements` | `AdminAnnouncementsPage` | Create and manage camp announcements | Announcements list |
| `/admin/calendar` | `AdminCalendarPage` | Calendar of sessions and administrative deadlines | Calendar events |
| `/admin/documents` | `AdminDocumentsPage` | System-wide document library | Documents list |
| `/admin/deadlines` | `AdminDeadlinesPage` | Application and enrollment deadlines management | Deadlines list |
| `/admin/form-builder` | `FormDashboardPage` (shared) | Form builder dashboard — lists all dynamic application form definitions | Form definitions |
| `/admin/form-builder/:formId` | `FormEditorPage` (shared) | Visual editor for a single form's sections and fields | Form definition by ID |
| `/admin/inbox` | `InboxPage` (shared) | Admin messaging inbox — threads with applicants and medical staff | Conversations |
| `/admin/profile` | `ProfilePage` (shared) | Admin user profile | Authenticated user record |
| `/admin/settings` | `SettingsPage` (shared) | Accessibility and notification settings | User settings |

---

## Super-Admin Portal

**Role required:** `super_admin` only
**Layout:** `SuperAdminLayout`
**Route prefix:** `/super-admin`

The super-admin portal mirrors all admin pages under the `/super-admin` prefix and adds three governance-only pages not available in the regular admin portal.

**Governance-only pages (super-admin exclusive):**

| Route | Component File | Purpose | Key Data Loaded |
|---|---|---|---|
| `/super-admin/dashboard` | `SuperAdminDashboardPage` | Super-admin overview including governance metrics | System-wide stats |
| `/super-admin/users` | `UserManagementPage` | User account management; create staff accounts; assign roles | All user accounts |
| `/super-admin/audit` | `AuditLogPage` | Full audit log of every action in the system (HIPAA requirement) | Paginated audit entries |

**Pages mirrored from the admin portal** (same components, different URL prefix):

`/super-admin/applications`, `/super-admin/applications/:id`, `/super-admin/applications/:id/edit`, `/super-admin/families`, `/super-admin/families/:userId`, `/super-admin/campers`, `/super-admin/campers/:id`, `/super-admin/sessions`, `/super-admin/sessions/archived`, `/super-admin/sessions/:id`, `/super-admin/reports`, `/super-admin/announcements`, `/super-admin/calendar`, `/super-admin/documents`, `/super-admin/form-builder`, `/super-admin/form-builder/:formId`, `/super-admin/inbox`, `/super-admin/profile`, `/super-admin/settings`

---

## Medical Portal

**Role required:** `medical`
**Layout:** `MedicalLayout`
**Route prefix:** `/medical`

All routes in this portal handle HIPAA-protected PHI. Medical records are never loaded in list/index endpoints; PHI is only accessed on detail pages scoped to a specific camper.

| Route | Component File | Purpose | Key Data Loaded |
|---|---|---|---|
| `/medical` | — | Redirect to `/medical/dashboard` | — |
| `/medical/dashboard` | `MedicalDashboardPage` | Medical staff overview: alerts, active campers, follow-up queue | Dashboard metrics |
| `/medical/directory` | `CampMedicalDirectoryPage` | Directory of all enrolled campers with medical records | Camper list (no PHI in list rows) |
| `/medical/records/:camperId` | `MedicalRecordPage` | Full medical record for one camper | Single camper medical record (PHI) |
| `/medical/records/:camperId/treatments` | `MedicalTreatmentLogPage` | Treatment log scoped to a specific camper | Camper treatments |
| `/medical/records/:camperId/documents` | `MedicalDocumentsPage` | Medical documents scoped to a specific camper | Camper documents |
| `/medical/records/:camperId/incidents` | `MedicalIncidentsPage` | Incidents scoped to a specific camper | Camper incidents |
| `/medical/records/:camperId/visits` | `MedicalVisitsPage` | Visit log scoped to a specific camper | Camper visits |
| `/medical/records/:camperId/emergency` | `MedicalEmergencyViewPage` | At-a-glance emergency summary: allergies, medications, risk flags, emergency contacts | Camper emergency data (PHI) |
| `/medical/treatments` | `MedicalTreatmentLogPage` | Global treatment log across all campers | All treatments |
| `/medical/record-treatment` | `MedicalRecordTreatmentPage` | Form to record a new treatment event | — |
| `/medical/incidents` | `MedicalIncidentsPage` | Global incidents log across all campers | All incidents |
| `/medical/follow-ups` | `MedicalFollowUpsPage` | Outstanding medical follow-up items | Follow-up list |
| `/medical/visits` | `MedicalVisitsPage` | Global visit log across all campers | All visits |
| `/medical/announcements` | `ParentAnnouncementsPage` (shared) | Camp-wide announcements relevant to medical staff | Announcements |
| `/medical/inbox` | `InboxPage` (shared) | Medical provider messaging; can compose to admins only | Conversations |
| `/medical/profile` | `ProfilePage` (shared) | Medical provider profile | Authenticated user record |
| `/medical/settings` | `SettingsPage` (shared) | Accessibility and notification settings | User settings |

---

## Shared Pages

Three page components are mounted under every portal prefix rather than having separate implementations per portal:

| Component | Mounted At |
|---|---|
| `InboxPage` | `/applicant/inbox`, `/admin/inbox`, `/super-admin/inbox`, `/medical/inbox` |
| `ProfilePage` | `/applicant/profile`, `/admin/profile`, `/super-admin/profile`, `/medical/profile` |
| `SettingsPage` | `/applicant/settings`, `/admin/settings`, `/super-admin/settings`, `/medical/settings` |

The shared pages are context-aware through the authenticated user object in Redux; they do not need the URL prefix to determine which data to load.
