# Routing Architecture

## Overview

The frontend uses React Router v7 with `createBrowserRouter` (HTML5 `BrowserRouter` — History API, no hash URLs). The router is instantiated once in `src/core/routing/index.tsx` and exported as `router`, which is passed to `<RouterProvider>` at the application root.

---

## Route Declaration Pattern

All routes are declared as a static configuration object. There are no imperative `addRoute` calls and no dynamic route registration.

### Lazy Imports

Every page component is lazy-loaded via `React.lazy()`. A small factory function, `withSuspense`, wraps each lazy component in a `<Suspense>` boundary:

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

const AdminDashboardPage = withSuspense(
  lazy(() =>
    import('@/features/admin/pages/AdminDashboardPage').then(m => ({
      default: m.AdminDashboardPage,
    }))
  )
);
```

The `.then(m => ({ default: m.PageName }))` step is required because page files use named exports, not default exports. The `Suspense fallback={null}` means the portal shell (sidebar and topbar) stays visible during bundle download, with no spinner introduced on in-portal navigation.

---

## Route Tree Structure

The top-level route has no `path` — it renders a `RouteErrorBoundary` wrapper that resets the `ErrorBoundary` on every navigation by passing `useLocation().pathname` as `resetKey`. All other routes are children of this wrapper.

```
<RouteErrorBoundary>                    no path — ErrorBoundary only
  /                                     → Navigate to /login (or demo dashboard)
  /forbidden                            ForbiddenPage
  *                                     NotFoundPage

  AuthLayout                            no path — layout wrapper
    /login
    /register
    /mfa-verify
    /forgot-password
    /reset-password
    /verify-email

  ProtectedRoute                        no path — auth check
    RoleGuard [applicant]
      ApplicantLayout
        /applicant → /applicant/dashboard
        /applicant/dashboard
        /applicant/applications
        /applicant/applications/start
        /applicant/applications/new
        /applicant/applications/:id
        /applicant/documents
        /applicant/forms
        /applicant/announcements
        /applicant/calendar
        /applicant/inbox
        /applicant/profile
        /applicant/settings

  ProtectedRoute
    RoleGuard [admin, super_admin]
      AdminLayout
        /admin → /admin/dashboard
        /admin/dashboard
        /admin/applications
        /admin/applications/:id
        /admin/applications/:id/edit
        /admin/families
        /admin/families/:userId
        /admin/campers
        /admin/campers/:id
        /admin/sessions
        /admin/sessions/archived
        /admin/sessions/:id
        /admin/reports
        /admin/announcements
        /admin/calendar
        /admin/documents
        /admin/deadlines
        /admin/form-builder
        /admin/form-builder/:formId
        /admin/inbox
        /admin/profile
        /admin/settings

  ProtectedRoute
    RoleGuard [medical]
      MedicalLayout
        /medical → /medical/dashboard
        /medical/dashboard
        /medical/directory
        /medical/records/:camperId
        /medical/records/:camperId/treatments
        /medical/records/:camperId/documents
        /medical/records/:camperId/incidents
        /medical/records/:camperId/visits
        /medical/records/:camperId/emergency
        /medical/treatments
        /medical/record-treatment
        /medical/incidents
        /medical/follow-ups
        /medical/visits
        /medical/announcements
        /medical/inbox
        /medical/profile
        /medical/settings

  ProtectedRoute
    RoleGuard [super_admin]
      SuperAdminLayout
        /super-admin → /super-admin/dashboard
        /super-admin/dashboard
        /super-admin/users
        /super-admin/audit
        /super-admin/form-builder
        /super-admin/form-builder/:formId
        /super-admin/applications
        /super-admin/applications/:id
        /super-admin/applications/:id/edit
        /super-admin/families
        /super-admin/families/:userId
        /super-admin/campers
        /super-admin/campers/:id
        /super-admin/sessions
        /super-admin/sessions/archived
        /super-admin/sessions/:id
        /super-admin/reports
        /super-admin/announcements
        /super-admin/calendar
        /super-admin/documents
        /super-admin/inbox
        /super-admin/profile
        /super-admin/settings
```

---

## ProtectedRoute

**File:** `src/core/auth/ProtectedRoute.tsx`

`ProtectedRoute` is a layout route — it has no `path` and renders `<Outlet />` on success. It wraps every portal route tree. Checks are evaluated in order; the first failure short-circuits and no further checks run.

| Order | Condition | Outcome |
|---|---|---|
| 1 | `isLoading === true` | Render `<FullPageLoader />` — auth is being hydrated from `sessionStorage` on page refresh |
| 2 | `isAuthenticated === false` | `<Navigate to="/login" state={{ from: location.pathname }} replace />` — preserves the intended destination for post-login redirect |
| 3 | `mfaRequired && !mfaVerified` | `<Navigate to="/mfa-verify" replace />` |
| 4 | `user.email_verified_at` is null | `<Navigate to="/verify-email?pending=true" replace />` |
| — | All checks pass | `<Outlet />` — renders the matched child route |

The `state.from` preserved in check 2 allows `LoginPage` to redirect the user back to the page they were trying to reach after a successful login.

---

## RoleGuard

**File:** `src/core/auth/RoleGuard.tsx`

`RoleGuard` sits inside `ProtectedRoute` (auth is already confirmed). It checks whether the authenticated user's role permits entry into the wrapped portal.

```tsx
<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}>
  <Outlet />
</RoleGuard>
```

**Role resolution order:** `user.roles[0].name` (normalized roles array) → `user.role` (string fallback). If neither is present, the user is sent to `/forbidden` (not `/login`, to avoid a redirect loop where `ProtectedRoute` keeps passing an authenticated user through).

**`super_admin` role expansion:** When the authenticated user has role `super_admin`, `RoleGuard` expands their effective roles to `['super_admin', 'admin']`. This means a `super_admin` passes any guard that lists `admin` in `allowedRoles`, giving them access to the admin portal under the `/admin` prefix without duplicating guards.

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `allowedRoles` | `RoleName[]` | required | Roles that may enter |
| `fallback` | `ReactNode` | — | Render instead of redirecting on denial |
| `redirectTo` | `string` | `/forbidden` | Redirect target on denial |

---

## Layout Nesting

Layouts wrap page content with the persistent shell (sidebar, topbar). They are declared as pathless layout routes using `<Outlet />` to render the matched child page.

| Layout | Portal | Provides |
|---|---|---|
| `AuthLayout` | Pre-auth | Centered card background for login/register screens |
| `ApplicantLayout` | Applicant | Applicant sidebar nav and topbar |
| `AdminLayout` | Admin | Admin sidebar nav and topbar; "Families" nav item |
| `SuperAdminLayout` | Super-admin | Super-admin sidebar nav and topbar; user management and audit nav items |
| `MedicalLayout` | Medical | Medical sidebar nav and topbar |

All authenticated layouts render inside `DashboardShell`, which provides the `pageIn` CSS keyframe animation applied to an inner `<div key={location.pathname}>`, producing a fade-in transition on each navigation.

---

## Route Constants

**File:** `src/shared/constants/routes.ts`

All URL strings are defined as named constants in the `ROUTES` object. No component hard-codes a URL string. Functions are used for parameterized routes.

```ts
// Static path
navigate(ROUTES.ADMIN_APPLICATIONS)          // '/admin/applications'

// Dynamic path — function returns the full URL with the ID interpolated
navigate(ROUTES.ADMIN_CAMPER_DETAIL(camperId))  // '/admin/campers/42'
```

### Public / Marketing (reserved, not routed in current build)

| Constant | Path |
|---|---|
| `HOME` | `/` |
| `ABOUT` | `/about` |
| `PROGRAMS` | `/programs` |
| `CAMPERS` | `/campers` |
| `APPLY` | `/apply` |
| `STORIES` | `/testimonials` |
| `GET_INVOLVED` | `/get-involved` |
| `VIRTUAL_PROGRAM` | `/virtual-program` |

### Auth

| Constant | Path |
|---|---|
| `LOGIN` | `/login` |
| `REGISTER` | `/register` |
| `MFA_VERIFY` | `/mfa-verify` |
| `FORGOT_PASSWORD` | `/forgot-password` |
| `RESET_PASSWORD` | `/reset-password` |

### Applicant Portal

| Constant | Path |
|---|---|
| `PARENT_DASHBOARD` | `/applicant/dashboard` |
| `PARENT_APPLICATIONS` | `/applicant/applications` |
| `PARENT_APPLICATION_START` | `/applicant/applications/start` |
| `PARENT_APPLICATION_NEW` | `/applicant/applications/new` |
| `PARENT_APPLICATION_DETAIL(id)` | `/applicant/applications/:id` |
| `PARENT_DOCUMENTS` | `/applicant/documents` |
| `PARENT_FORMS` | `/applicant/forms` |
| `PARENT_CALENDAR` | `/applicant/calendar` |
| `PARENT_ANNOUNCEMENTS` | `/applicant/announcements` |

### Admin Portal

| Constant | Path |
|---|---|
| `ADMIN_DASHBOARD` | `/admin/dashboard` |
| `ADMIN_FAMILIES` | `/admin/families` |
| `ADMIN_FAMILY_DETAIL(userId)` | `/admin/families/:userId` |
| `ADMIN_CAMPERS` | `/admin/campers` |
| `ADMIN_CAMPER_DETAIL(id)` | `/admin/campers/:id` |
| `ADMIN_APPLICATIONS` | `/admin/applications` |
| `ADMIN_APPLICATION_DETAIL(id)` | `/admin/applications/:id` |
| `ADMIN_APPLICATION_EDIT(id)` | `/admin/applications/:id/edit` |
| `ADMIN_SESSIONS` | `/admin/sessions` |
| `ADMIN_ARCHIVED_SESSIONS` | `/admin/sessions/archived` |
| `ADMIN_SESSION_DETAIL(id)` | `/admin/sessions/:id` |
| `ADMIN_REPORTS` | `/admin/reports` |
| `ADMIN_ANNOUNCEMENTS` | `/admin/announcements` |
| `ADMIN_CALENDAR` | `/admin/calendar` |
| `ADMIN_DOCUMENTS` | `/admin/documents` |
| `ADMIN_DEADLINES` | `/admin/deadlines` |
| `ADMIN_FORM_BUILDER` | `/admin/form-builder` |
| `ADMIN_FORM_STRUCTURE(formId)` | `/admin/form-builder/:formId` |
| `ADMIN_SECTION_EDITOR(formId, sectionId)` | `/admin/form-builder/:formId/sections/:sectionId` |

### Medical Portal

| Constant | Path |
|---|---|
| `MEDICAL_DASHBOARD` | `/medical/dashboard` |
| `MEDICAL_RECORDS` | `/medical/records` |
| `MEDICAL_RECORD_DETAIL(id)` | `/medical/records/:id` |
| `MEDICAL_TREATMENT_LOGS` | `/medical/treatments` |
| `MEDICAL_ANNOUNCEMENTS` | `/medical/announcements` |
| `MEDICAL_RECORD_TREATMENTS(id)` | `/medical/records/:id/treatments` |
| `MEDICAL_RECORD_DOCUMENTS(id)` | `/medical/records/:id/documents` |
| `MEDICAL_INCIDENTS` | `/medical/incidents` |
| `MEDICAL_FOLLOW_UPS` | `/medical/follow-ups` |
| `MEDICAL_VISITS` | `/medical/visits` |
| `MEDICAL_RECORD_EMERGENCY(id)` | `/medical/records/:id/emergency` |
| `MEDICAL_RECORD_INCIDENTS(id)` | `/medical/records/:id/incidents` |
| `MEDICAL_RECORD_VISITS(id)` | `/medical/records/:id/visits` |
| `MEDICAL_RECORD_TREATMENT` | `/medical/record-treatment` |
| `MEDICAL_DIRECTORY` | `/medical/directory` |

### Super-Admin Portal

| Constant | Path |
|---|---|
| `SUPER_ADMIN_DASHBOARD` | `/super-admin/dashboard` |
| `SUPER_ADMIN_USERS` | `/super-admin/users` |
| `SUPER_ADMIN_AUDIT` | `/super-admin/audit` |
| `SUPER_ADMIN_FORM_BUILDER` | `/super-admin/form-builder` |
| `SUPER_ADMIN_FORM_STRUCTURE(formId)` | `/super-admin/form-builder/:formId` |
| `SUPER_ADMIN_SECTION_EDITOR(formId, sectionId)` | `/super-admin/form-builder/:formId/sections/:sectionId` |
| `SUPER_ADMIN_APPLICATION_EDIT(id)` | `/super-admin/applications/:id/edit` |

### Error Pages

| Constant | Path |
|---|---|
| `FORBIDDEN` | `/forbidden` |
| `NOT_FOUND` | `*` |

---

## Programmatic Navigation

Components navigate using the `useNavigate` hook from React Router. The convention is always to pass a `ROUTES` constant rather than a string literal:

```tsx
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/shared/constants/routes';

const navigate = useNavigate();

// Static route
navigate(ROUTES.ADMIN_APPLICATIONS);

// Dynamic route
navigate(ROUTES.ADMIN_CAMPER_DETAIL(camper.id));

// Navigate with state (re-apply prefill, post-login redirect)
navigate(ROUTES.PARENT_APPLICATION_NEW, { state: { prefill: { ... } } });
navigate(ROUTES.LOGIN, { state: { from: location.pathname } });
```

The `<Link>` component is used for navigation that should be rendered as an anchor element (e.g., sidebar nav items). `useNavigate` is used for conditional or programmatic navigation following a form submission or an API response.

---

## Applicant Portal Prefix Note

The role that parents and guardians hold is named `applicant` in the database and throughout the codebase. Accordingly, all applicant portal routes use the `/applicant` prefix. The prefix `/parent` is not used anywhere in the router or in `routes.ts`. The `ROUTES` constants for this portal are prefixed with `PARENT_` for historical naming reasons, but all resolved paths begin with `/applicant/`.
