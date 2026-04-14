# UI/UX Behavior Reference

**Version:** 1.0
**Last Updated:** March 2026
**Scope:** All four portals — applicant, admin, medical, super-admin

---

## Table of Contents

1. [Navigation Model](#1-navigation-model)
2. [Page Transitions](#2-page-transitions)
3. [Status Badge System](#3-status-badge-system)
4. [Form Interaction Patterns](#4-form-interaction-patterns)
5. [Error Handling UX](#5-error-handling-ux)
6. [Language Switching](#6-language-switching)
7. [Dashboard Hero Sections](#7-dashboard-hero-sections)
8. [Loading States](#8-loading-states)
9. [Notification System](#9-notification-system)
10. [Document Upload UX](#10-document-upload-ux)

---

## 1. Navigation Model

### Portal Architecture

The system is a portal-only application. The root path `/` redirects immediately to `/login`. There are no public-facing pages. After authentication, users are routed to the dashboard for their assigned role:

| Role | URL prefix | Layout component |
|---|---|---|
| `applicant` | `/applicant` | `ApplicantLayout` |
| `admin` | `/admin` | `AdminLayout` |
| `medical` | `/medical` | `MedicalLayout` |
| `super_admin` | `/super-admin` | `SuperAdminLayout` |

### DashboardShell

Every authenticated portal is composed using `DashboardShell` (`src/ui/layout/DashboardShell.tsx`). The shell is the outermost layout wrapper shared by all four role-specific layouts. Its structure is:

```
<div flex h-screen data-bg-tone>         ← full-viewport row, adaptive glass root
  <BackgroundSlideshow />                ← fixed, z-index: -1, behind all content
  <DashboardSidebar />                   ← fixed-width left column, never scrolls
  <div flex-col>                         ← expanding right column
    <DashboardHeader />                  ← sticky top bar
    <main overflow-y-auto>               ← scrollable page content
      <div key={location.pathname}>      ← keyed inner div for page transition
        {children}
      </div>
    </main>
  </div>
</div>
```

`DashboardShell` derives a human-readable page title from the current URL pathname automatically. Individual pages do not need to pass a title prop.

### Sidebar Navigation

`DashboardSidebar` receives a `navItems` array and an optional `pinnedBottomItems` array from each portal layout. Nav items that match the current URL receive an active state styled with `var(--dash-nav-active-bg)`. Hover state uses `var(--dash-nav-hover-bg)`.

All nav labels are resolved via `t('portal_nav.*')` i18n keys so they respond to language changes at runtime. Group names and the brand label are also translated.

Each portal layout defines its own nav structure. For example, the `admin` portal groups include Applications, Families, Campers, Sessions, Reports, and Messaging. The `super_admin` portal includes all admin items plus User Management and Audit Log.

### Sign-Out Flow

The sign-out option appears in the user avatar dropdown in `DashboardHeader`. Clicking it:

1. Calls `POST /api/logout` via the auth API.
2. Dispatches `clearAuth()` to the Redux auth slice, clearing user and role state from memory.
3. The auth token stored in `sessionStorage` under the key `auth_token` is cleared as a side effect of the Redux state reset.
4. The user is navigated to `/login`.

Because the token is in `sessionStorage`, it is automatically discarded when the browser tab is closed regardless of explicit sign-out.

### Inbox Special Treatment

The `/inbox` route receives special layout treatment in `DashboardShell`. When the current pathname ends with `/inbox`, the content area receives `overflow-hidden` instead of `overflow-y-auto`, and no padding is applied. This allows the two-panel messaging layout to fill edge-to-edge and manage its own internal scroll independently.

### Mobile Behavior

The application targets desktop-primary use. Responsive breakpoints (Tailwind `lg:`) are applied on list and detail pages for column layout adjustments. The sidebar does not collapse to a hamburger menu — it remains visible at all supported viewport widths.

---

## 2. Page Transitions

### pageIn Keyframe

Every page navigation within a portal triggers a CSS entrance animation. The animation is defined in `design-tokens.css`:

```css
@keyframes pageIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

The animation fires because `DashboardShell` renders the page content inside a `<div>` keyed on `location.pathname`:

```tsx
<div key={location.pathname} style={{ animation: 'pageIn 160ms ease-out backwards' }}>
  {children}
</div>
```

When React Router changes the route, `key` changes, React unmounts and remounts the inner div, and the CSS animation restarts from the `from` state. The duration is 160ms with `ease-out` easing and `backwards` fill-mode (holds the `from` state during any delay).

This technique requires no animation library for standard page navigation. The transition is applied uniformly across all portals and all routes that use `DashboardShell`.

### Framer Motion

Framer Motion (v12) is present in the project but is restricted to the super-admin form builder pages only (`FormEditorPage`, `FormDashboardPage`, `SectionFieldEditorPage`, and related components under `src/features/superadmin/components/form-builder/`). It is not used for any page-level navigation transitions or in any other portal.

### Outside DashboardShell

Pages rendered outside `DashboardShell` — specifically, the start page and form page for applicant applications — apply the `pageIn` animation directly on their root element via an inline style:

```tsx
<div style={{ animation: 'pageIn 0.3s ease both' }}>
```

---

## 3. Status Badge System

### Component

`StatusBadge` is located at `src/ui/components/StatusBadge.tsx`. It renders an inline pill badge that maps a status string to a background tint, text color, and translated label. An optional `showDot` prop adds a small filled circle before the label for additional visual weight.

```tsx
<StatusBadge status="approved" />
<StatusBadge status="under_review" showDot />
```

### Application Status Colors

| Status | Background | Text color | Notes |
|---|---|---|---|
| `pending` | `rgba(107,114,128,0.12)` | `#374151` | Gray |
| `draft` | `rgba(107,114,128,0.12)` | `#374151` | Gray; UI-only, not an `ApplicationStatus` enum value |
| `under_review` | `rgba(37,99,235,0.12)` | `#2563eb` | Blue |
| `approved` | `rgba(22,163,74,0.10)` | `#16a34a` | Green |
| `rejected` | `rgba(220,38,38,0.12)` | `#dc2626` | Red |
| `withdrawn` | `rgba(107,114,128,0.12)` | `#374151` | Gray |
| `cancelled` | `rgba(107,114,128,0.12)` | `#374151` | Gray |
| `waitlisted` | `rgba(234,88,12,0.12)` | `#ea580c` | Orange |

### General Status Colors

| Status | Background | Text color | Notes |
|---|---|---|---|
| `active` | `rgba(22,163,74,0.10)` | `#16a34a` | Green |
| `inactive` | `rgba(107,114,128,0.12)` | `#374151` | Gray |
| `open` | `rgba(22,163,74,0.10)` | `#16a34a` | Green |
| `closed` | `rgba(220,38,38,0.12)` | `#dc2626` | Red |
| `waitlist` | `rgba(22,163,74,0.10)` | `#16a34a` | Green; distinct from `waitlisted` |

### Medical Severity Colors

| Status | Background | Text color |
|---|---|---|
| `low` | `rgba(22,163,74,0.10)` | `#16a34a` |
| `moderate` | `rgba(180,83,9,0.10)` | `#b45309` |
| `high` | `rgba(194,65,12,0.10)` | `#c2410c` |
| `critical` | `rgba(220,38,38,0.12)` | `#dc2626` |

### i18n Labels

Status display labels are never hardcoded in the component. Each status maps to a key in the `status_labels` i18n namespace (e.g., `status_labels.under_review`). The `t()` call inside the component resolves the label at render time, so labels update immediately when the user switches language. Color values are defined in the static `variantStyles` map outside the component and never change with language.

### Fallback Behavior

If a status string is passed that does not match any `BadgeVariant`, the component falls back to `draft` styles and the `draft` label rather than throwing.

---

## 4. Form Interaction Patterns

### Inline Editing (Admin)

Admin users can edit application data directly on `ApplicationReviewPage`. Each editable section (Camper Information, Emergency Contacts, Behavioral Profile, Narrative Responses) has an Edit button in its section card header. Clicking Edit transforms the section from read-only display into live form controls.

- Each section maintains its own local `editing` boolean state.
- Save and Cancel buttons appear per section. Save calls the relevant API endpoint; Cancel reverts local state to the last fetched values.
- A dirty-state dot indicator appears on sections with unsaved changes.
- A status warning banner is displayed when editing an application in `approved` or `rejected` status.
- Emergency contact rows reveal Edit and Delete controls on hover.

### Draft Persistence (Applicant Form)

The applicant application form (`ApplicationFormPage`) persists all form state to `localStorage` automatically. Key behaviors:

- **Storage key:** `cbg_app_draft`
- **Auto-save:** A debounced write fires 3 seconds after the last state change (`AUTOSAVE_DELAY = 3000`).
- **What is stored:** The complete `FormState` object, which includes all 10 sections plus a `meta` object tracking `activeSection` and `lastSaved` timestamp. File objects (`File` instances) cannot be serialized and are held in a `useRef` (`docFilesRef`) outside of state; only file metadata (name, size, MIME type) is persisted to `localStorage`.
- **Draft recovery:** On mount, `ApplicationFormPage` reads `cbg_app_draft` and hydrates the form state from it.
- **Draft clearing:** Starting a new application from `ApplicationStartPage` calls `localStorage.removeItem(DRAFT_KEY)` before navigating to the form.

### Multi-Section Form Progression

`ApplicationFormPage` uses a 10-section accordion layout with a 260 px left sidebar for section navigation. Navigation is free — the user may open any section at any time without completing previous sections in order. The sidebar displays each section's title and completion indicator.

### Re-apply Prefill

When navigating to the application form via the re-apply flow, `location.state.prefill` carries a small set of fields: `first_name`, `last_name`, `date_of_birth`, `gender`, `tshirt_size`. `ApplicationFormPage` reads this on mount and initializes the relevant Section 1 fields from these values.

### Paginated List Pages

All paginated list pages (AdminApplicationsPage, AdminCampersPage, etc.) consolidate all filter values into a single `filters` state object. This avoids race conditions that occur when individual filter state variables trigger simultaneous `useEffect` calls. The pattern is:

```tsx
const [filters, setFilters] = useState({ search: '', status: '', session_id: '' });
// ...
useEffect(() => { fetchData(filters); }, [filters]);
```

---

## 5. Error Handling UX

### Retry Pattern

Pages that fetch data use a `retryKey` counter to trigger a retry without full page reload. When a fetch fails, an error state is shown with a retry button. Clicking the button increments `retryKey`, which is included in the `useEffect` dependency array, causing the effect to re-run:

```tsx
const [retryKey, setRetryKey] = useState(0);
useEffect(() => { fetchData(); }, [retryKey]);
// ...
<button onClick={() => setRetryKey((k) => k + 1)}>Retry</button>
```

### Error Boundaries

The routing layer wraps all portal pages with `ErrorBoundary` (located at `src/app/ErrorBoundary.tsx`). Unhandled React rendering errors are caught and an error UI is displayed without crashing the entire application.

### Toast Notifications

API errors and success confirmations surface via `sonner` toast notifications (`toast.success()`, `toast.error()`). Toasts are ephemeral and dismiss automatically.

### PHI Decryption Errors

PHI fields use Laravel's `encrypted` cast. Loading encrypted fields in list endpoints causes a `DecryptException` which produces an HTTP 500 response. The frontend treats all 500 responses as generic server errors and displays an error state. Medical record data is never loaded on index/list endpoints by design.

---

## 6. Language Switching

### i18next Setup

All user-facing strings use i18next. Two locales are fully supported: English (`en`) and Spanish (`es`). Both `en.json` and `es.json` are kept in sync and cover all portals.

### Language Toggle

`DashboardHeader` contains a `LanguageToggle` component. Clicking the toggle calls `i18n.changeLanguage()` with the new locale code. The change is immediate and affects all rendered components simultaneously — there is no page reload.

### Effect on Portal Navigation

i18n namespace coverage includes:

- `status_labels` — StatusBadge display labels
- `portal_nav` — all sidebar nav labels and group names in all four portal layouts
- `sidebar` — brand name, sign-out, system label
- `roles` — role display names
- `applicant_detail`, `admin_extra`, `audit_extra`, `messaging_extra`, `auth_extra` — feature-specific namespaces

### Module-Level Label Object Constraint

Some components previously defined label lookup objects at module level (outside the component function). Module-level objects are created once at import time and do not re-evaluate when the locale changes. Any label object that must respond to locale changes must be defined inside the component function so it is rebuilt on each render after a language switch.

### Applicant Form Language

The application form language is selected explicitly on `ApplicationStartPage`. The user chooses English or Spanish, and `i18n.changeLanguage()` is called before navigating to the form. The form displays a language badge in its header reflecting the active locale. The selected language and session ID are passed via React Router `location.state`.

---

## 7. Dashboard Hero Sections

Every portal dashboard page includes a hero section at the top. All hero sections must use the interpolating animated background system. This is implemented via `BackgroundSlideshow`, a fixed-position component that cycles through nature/camp photography. The slideshow detects whether the current image is light or dark (`BgTone`) and emits a tone change event. `DashboardShell` propagates this tone via `BackgroundBrightnessContext`, setting a `data-bg-tone` attribute on the shell root. CSS attribute selectors in `design-tokens.css` override the adaptive glass custom properties (`--glass-card-bg`, `--glass-card-border`, etc.) accordingly, ensuring text and card surfaces remain readable regardless of background image brightness.

Static background colors on hero sections are not acceptable. The animated background system is a non-negotiable visual requirement.

---

## 8. Loading States

### Code Splitting and withSuspense

Every page component in `src/core/routing/index.tsx` is loaded with `React.lazy()` wrapped in a `withSuspense()` factory function. This splits each page into its own JS bundle that downloads only when the route is first visited.

The `Suspense` fallback is `null` — the sidebar and header remain visible during bundle download; no spinner flash occurs. This avoids the jarring full-page spinner that appears when a large fallback component is shown.

### Skeleton Components

`Skeletons` (`src/ui/components/Skeletons.tsx`) provides skeleton placeholder components used on detail pages while data is fetching over the network. Skeletons match the approximate shape of the content they replace (cards, rows, text blocks) to prevent layout shift.

### Inline Loading Indicators

For in-place loading (e.g., opening the notification panel, uploading a file), `Loader2` from lucide-react is used with a spin animation class. This keeps the user contextually aware that an operation is in progress without navigating away from the current page.

---

## 9. Notification System

### Bell Icon and Badge

`DashboardHeader` renders a bell icon (`Bell` from lucide-react) with a numeric unread-count badge. The unread count is fetched from `GET /api/notifications` on header mount. The badge is hidden when the count is zero.

### NotificationPanel

Clicking the bell opens `NotificationPanel`, a fixed slide-out aside that animates in from the right edge of the screen over a transparent backdrop. Clicking the backdrop dismisses the panel.

The panel:

- Fetches `GET /api/notifications` each time it opens to ensure the list is current.
- Renders skeleton placeholders while loading.
- Supports marking a single notification read via `PATCH /api/notifications/{id}/read` — local state updates immediately without a refetch.
- Supports marking all notifications read at once.
- Supports clearing all notifications via `DELETE /api/notifications`.
- Calls `onUnreadChange(count)` after any state change so `DashboardHeader` updates its badge count.

### Notification Types

Notifications are triggered server-side by application status changes, document requests, and messaging events. The notification model is defined in `src/shared/types.ts`.

---

## 10. Document Upload UX

### Upload Interaction

Document uploads in the applicant portal (`ApplicantDocumentsPage`, `ApplicantOfficialFormsPage`) use a `<input type="file">` element paired with a styled button that triggers it via a `useRef`. On file selection, the upload begins immediately via `POST /api/documents` (multipart/form-data).

During upload, the button shows a `Loader2` spinner to communicate progress. On success, the uploaded document is added to local state and the UI transitions to a "View" state showing the document name and a view link. On error, a `toast.error()` notification appears and the upload state resets to idle.

### Viewing Uploaded Documents

Uploaded documents are served from a signed URL returned by the API in the `url` field of the document object. The view action opens this URL in a new browser tab via `window.open(doc.url)`. This applies in both:

- `ApplicantOfficialFormsPage` — View link on the medical form card after upload.
- `ApplicantApplicationDetailPage` — View links in the document list on the application detail page.

### Upload Status States

File upload cards cycle through four states:

| State | UI |
|---|---|
| `idle` | Upload button with upload icon |
| `uploading` | Disabled button with spinner |
| `done` | Document name + View link |
| `error` | Error indicator; upload button re-enabled |

### Admin Upload on Behalf

Admin users can upload documents on behalf of an applicant from `ApplicationReviewPage`. The upload button in the Documents section triggers `POST /api/documents` with `documentable_type=Application` and the application's ID. The upload is associated with the application and appears in the applicant's document list.

### Accepted File Types and Size

Refer to `docs/features/File_Uploads.md` for accepted MIME types, maximum file size, and the virus-scanning process that runs asynchronously after every upload.
