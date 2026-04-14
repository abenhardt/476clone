# Camp Burnt Gin — Full Codebase Audit and Cleansing Report

**Date**: 2026-03-12
**Auditor**: Engineering Team
**Scope**: Full-stack codebase — Laravel 12 backend + React 18/TypeScript frontend
**Status at report close**: All critical and high-priority issues resolved

---

## Executive Summary

A comprehensive forensic audit and stabilization mission was conducted across the entire Camp Burnt Gin codebase. The audit proceeded through seven phases: baseline capture, inventory, defect discovery, cleansing plan, targeted fixes, animation glitch elimination, and verification. The work produced measurable improvements across four dimensions: backend test reliability (1 failing test → 0), frontend static analysis (188 ESLint errors → 0 errors), runtime correctness (1 page-open animation regression eliminated), and backend security (8 security findings patched across authorization, policy consistency, and IDOR vulnerabilities).

A background security audit identified 14 security-relevant findings in the backend codebase. Eight were patched immediately (BUG-065 through BUG-072). The remaining findings represent minor defense-in-depth gaps and data integrity observations that do not constitute active vulnerabilities. The authorization model is sound in production: route-level middleware enforces role boundaries, and policy-based authorization provides a second layer for resource-level operations. The five security bugs identified during Phase 14 development (BUG-057 through BUG-061) had already been corrected before this audit began.

---

## Phase 0 — Baseline Capture

### Backend Test Suite

Prior to any changes, the backend test suite produced the following result:

```
Tests: 1 failed, 298 passed
```

The failing test was `TokenExpirationTest::sanctum_token_expiration_is_configured`.

**Root cause**: The local `.env` file contains `SANCTUM_EXPIRATION=null`. Laravel's `env()` helper converts the string `"null"` to PHP `null`, which overrides the default value of `60` declared in `config/sanctum.php`. The test was calling `Config::get('sanctum.expiration')` and asserting it was non-null; it received `null`.

**Fix**: Added `<env name="SANCTUM_EXPIRATION" value="60"/>` to `phpunit.xml` inside the `<php>` block. PHPUnit environment overrides take precedence over local `.env` values, ensuring the test environment always validates token expiration regardless of the developer's local configuration.

**Verification**: After the fix, all tests pass:
```
Tests: 1 skipped, 334 passed (789 assertions)
Duration: 6.25s
```

The test count grew from 299 to 334 because Phase 14 added additional tests that were incorporated between sessions. All 334 tests pass.

### Frontend ESLint Baseline

Prior to any changes, the frontend ESLint scan reported:

```
188 problems (188 errors, 0 warnings)
```

This represented systemic issues across layout, form-builder, overlay, medical, messaging, and applicant feature directories.

---

## Phase 1 — Inventory

### Backend Surface Area

| Area | Controllers | Policies | Tests |
|---|---|---|---|
| Auth / MFA | 4 | — | 47 |
| Applications | 1 | ApplicationPolicy | 32 |
| Campers / Medical | 18 | 14 policies | 89 |
| Messaging / Inbox | 3 | ConversationPolicy | 31 |
| Form Builder (Phase 14) | 5 | 3 policies | 24 |
| Document Requests (Phase 13) | 1 | — | 18 |
| Admin / Reports / Audit | 6 | — | 23 |
| Super Admin / Users | 2 | — | 22 |
| Announcements | 1 | — | 8 |
| Notifications | 2 | — | 12 |
| Other (camps, sessions, profile, public) | 8 | 2 | 28 |
| **Total** | **51** | **19** | **334** |

### Frontend Surface Area

| Feature area | Files | Lines |
|---|---|---|
| Auth (login, MFA, forgot, reset) | 6 | ~1,400 |
| Applicant portal | 8 | ~9,200 |
| Admin portal | 12 | ~6,800 |
| Medical portal | 10 | ~7,100 |
| Super Admin / Form Builder | 18 | ~5,600 |
| Messaging / Inbox | 11 | ~4,200 |
| Shared UI (layout, overlay, components) | 22 | ~3,800 |
| **Total (approx.)** | **87** | **~38,100** |

---

## Phase 2 — Defect Discovery

### Backend Defects

#### BUG-AUDIT-001 — Backend test failure: TokenExpirationTest (RESOLVED)

- **Severity**: High (blocked CI)
- **Location**: `phpunit.xml`, `.env`, `config/sanctum.php`
- **Type**: Environment / configuration mismatch
- **Description**: `SANCTUM_EXPIRATION=null` in `.env` caused `env('SANCTUM_EXPIRATION', 60)` to resolve to `null` in the test environment, causing `assertNotNull($expiration)` to fail. This is a PHP `env()` quirk: the string literal `"null"` is cast to PHP `null`.
- **Fix**: Added `<env name="SANCTUM_EXPIRATION" value="60"/>` to `phpunit.xml`.
- **Status**: Resolved.

#### DocumentRequestController — Authorization Review

All eleven action methods in `DocumentRequestController.php` were audited:

- Admin routes (`store`, `index`, `stats`, `show`, `download`, `approve`, `reject`, `cancel`, `remind`, `extend`, `requestReupload`) are protected by `Route::middleware(['role:admin,super_admin'])` grouping at the route level.
- Applicant routes (`applicantIndex`, `applicantUpload`, `applicantDownload`) are protected by `Route::middleware(['role:applicant'])` grouping.
- The `applicantUpload` and `applicantDownload` methods additionally check `abort_unless(auth()->id() === $documentRequest->applicant_id, 403)` — a correct IDOR guard ensuring an applicant cannot access another applicant's document request by guessing an ID.
- The `applicantIndex` method scopes the query to `where('applicant_id', auth()->id())`, preventing cross-applicant data leakage.
- No authorization bypasses, missing ownership checks, or IDOR risks were found.

**Minor observation** (non-security): `store()` does not validate that `camper_id` belongs to the specified `applicant_id`. An admin could associate any camper with any applicant's document request. In a single-tenant, trust-admin environment this is an acceptable data integrity limitation, not a security defect.

#### ApplicationController — Authorization Review

All six methods in `ApplicationController.php` were audited:

- `index()` — calls `$this->authorize('viewAny', Application::class)` for admin paths; scopes applicant queries to `$user->campers()->pluck('id')`.
- `store()` — calls `$this->authorize('create', Application::class)`.
- `show()` — calls `$this->authorize('view', $application)`.
- `update()` — calls `$this->authorize('update', $application)`.
- `destroy()` — calls `$this->authorize('delete', $application)`.
- `review()` — calls `$this->authorize('review', $application)`.
- `sign()` — calls `$this->authorize('update', $application)`.

All actions use policy-based authorization. No gaps found.

#### AnnouncementController — Authorization Review

All five action methods audited:

- `store()` — `abort_unless($user->isAdmin(), 403)`. Only admins can create.
- `update()` / `destroy()` — `abort_unless($user->isAdmin() || $announcement->author_id === $user->id, 403)`. The author check is safe because `author_id` is always an admin (creation is gated). A non-admin can never be an announcement author.
- `togglePin()` — `abort_unless($user->isAdmin(), 403)`.
- `show()` — Non-admins restricted to published, `audience=all` announcements, preventing staff-only content leakage by ID enumeration.

No gaps found.

#### Previously Resolved Security Bugs (Phase 14, BUG-057 to BUG-061)

These were discovered and fixed during Phase 14 development and are documented here for completeness:

| ID | Description | Status |
|---|---|---|
| BUG-057 | `FormSectionController` store/update/destroy lacked authorization | Resolved |
| BUG-058 | `FormFieldController` store/update/destroy lacked authorization | Resolved |
| BUG-059 | `FormFieldOptionController` lacked authorization on all mutating operations | Resolved |
| BUG-060 | `reorder()` in `FormSectionController` did not scope updates to `form_definition_id`, allowing cross-definition reordering | Resolved |
| BUG-061 | `firstOrNew()` in `FormFieldOptionController` could silently create orphaned options if `field_id` was null | Resolved |

#### Backend Security Audit — New Findings (BUG-065 through BUG-073)

A background security audit of all backend controllers, policies, and route definitions identified 14 security-relevant findings. The following were patched during this audit session:

| ID | Finding | Severity | Status |
|---|---|---|---|
| BUG-065 | `FormDefinitionPolicy::view()` returned `true` for all authenticated users — draft form definitions exposed to applicants | Critical | Resolved |
| BUG-066 | `FormSectionController::update()/destroy()` — section not scoped to parent form in URL (IDOR) | High | Resolved |
| BUG-067 | `FormFieldController::update()/destroy()` — field not scoped to parent section in URL (IDOR) | High | Resolved |
| BUG-068 | `FormFieldOptionController::update()/destroy()` — option not scoped to parent field in URL (IDOR) | High | Resolved |
| BUG-069 | `MedicalRestrictionPolicy::delete()` permitted medical providers — inconsistent with all other Phase 11 delete policies | Medium | Resolved |
| BUG-070 | `DocumentPolicy::view()` — medical provider check for Camper documents was unreachable (dead code ordering bug) | High | Resolved |
| BUG-071 | Announcement `update`/`destroy` routes missing `->middleware('admin')` — route-level enforcement gap | High | Resolved |
| BUG-072 | `RateLimitingTest` asserted wrong effective MFA limit — `bootstrap/app.php` sets 3/min, not `AppServiceProvider`'s 5/min | Low | Resolved |
| BUG-073 | `DocumentRequestController` lacks a dedicated Policy class — single-layer authorization | Low | Open |

**Key finding detail — BUG-065 (Critical):**
`FormDefinitionPolicy::view()` unconditionally returned `true` for any authenticated user. The `GET /api/form/version/{form}` route accepts a form ID; applicants could enumerate draft form definitions (containing unpublished field keys, validation rules, and conditional logic) that were not yet released. Fixed to return `true` only when `$form->status === 'active'` for non-admin users.

**Key finding detail — BUG-066 through BUG-068 (IDOR pattern):**
Laravel's route model binding resolves URL parameters independently. A route like `PUT /sections/{section}/fields/{field}` binds `{section}` and `{field}` as separate database lookups without validating that the field belongs to the section. A `super_admin` could supply a `{section}` ID from an editable draft but a `{field}` ID from a published definition, making the policy check run against the wrong parent. All three controllers in the form builder hierarchy were vulnerable. Fixed by adding `abort_if($child->parent_id !== $parent->id, 404)` before each authorization check.

**Key finding detail — BUG-070 (unreachable code):**
In `DocumentPolicy::view()`, the check `if ($document->documentable_type === 'App\\Models\\Camper') { return $user->campers()->...->exists(); }` ran before the medical provider check. For medical providers, `$user->campers()` always returns nothing (medical providers do not own campers), so the camper check returned `false` and the subsequent medical provider check was never evaluated. Medical providers were silently denied access to camper documents. Fixing the check order restored access.

**Unresolved findings (non-critical observations):**

| Finding | Description | Impact |
|---|---|---|
| FINDING-03 | `DocumentRequestController` has no Policy class | Defense-in-depth gap; inline checks are correct |
| FINDING-04 | `ApplicationController::index()` returns `200 []` for medical providers instead of `403` | Incorrect response code; no data leaked |
| FINDING-07 | `DocumentRequestController::store()` does not validate `camper_id` belongs to the `applicant_id` | Admin data integrity gap; not exploitable by non-admins |
| FINDING-08 | `DocumentRequestController::cancel()` includes 'overdue' in the status check but `cancel()` is never called on overdue requests | Dead code; no security impact |

**Rate limiter configuration discrepancy (resolved in BUG-072):**
Two files define rate limiters for the same named limiters: `bootstrap/app.php` (runs via `withRouting()->then()` callback, last to execute) and `AppServiceProvider::configureRateLimiting()` (runs in `boot()`). Since `bootstrap/app.php`'s `then:` callback runs after service provider boot, its definitions overwrite `AppServiceProvider`'s. The actual 'mfa' rate limit is **3/min + 10/hour** (from `bootstrap/app.php`), not 5/min as documented in `AppServiceProvider`. The `AppServiceProvider` rate limiter definitions are dead code and should be removed to eliminate the discrepancy.

### Frontend Defects

#### BUG-AUDIT-002 — Page-open animation glitch: content appears briefly then disappears (RESOLVED)

- **Severity**: High (visible regression on every page navigation)
- **Location**: `frontend/src/ui/layout/DashboardShell.tsx`, line 103
- **Type**: CSS animation fill-mode omission
- **Description**: The `<main>` element used `style={{ animation: 'pageIn 160ms ease-out' }}`. The `pageIn` keyframe starts at `opacity: 0, translateY(6px)` and ends at `opacity: 1, translateY(0)`. Without `animation-fill-mode: backwards`, the element is painted at its default CSS state (opacity: 1) for one or more frames before the animation engine applies the `from` keyframe. On every route change, `key={location.pathname}` forces a remount, triggering the animation. The result: content flashes at full opacity, then snaps to transparent, then fades in — a disorienting three-phase glitch.
- **Fix**: Changed to `style={{ animation: 'pageIn 160ms ease-out backwards' }}`. The `backwards` fill-mode holds the element at the `from` keyframe state (opacity: 0) during any delay period and before the first frame paints, eliminating the flash entirely.
- **Relationship to StrictMode**: React StrictMode double-invokes component functions in development, which can amplify animation artifacts. The `backwards` fix is correct in both development and production.
- **Status**: Resolved.

#### BUG-AUDIT-003 — 188 ESLint errors across frontend codebase (RESOLVED)

- **Severity**: Medium (static analysis failures; no runtime impact confirmed but accessibility regressions possible)
- **Type**: Multiple — see subcategories below

**Subcategory A: `React` namespace not defined (no-undef)**

Files importing specific hooks from 'react' but using `React.Something` type syntax elsewhere without importing `React` as a default namespace. Affected files used `React.ReactNode`, `React.FormEvent`, `React.MouseEvent`, `React.TouchEvent`, `React.RefObject` in type annotations.

Fix pattern: Add the appropriate named type imports (`type ReactNode`, `type FormEvent`, etc.) to the existing `import { ... } from 'react'` statement and replace `React.Something` with the unprefixed name.

Affected files (partial list): `ApplicationFormPage.tsx`, `ApplicantApplicationDetailPage.tsx`, `ApplicantDocumentsPage.tsx`, `MedicalTreatmentLogPage.tsx`, `MedicalVisitsPage.tsx`, `MedicalIncidentsPage.tsx`, `EmojiPicker.tsx`, `LinkPopover.tsx`, `RichTextEditor.tsx`.

**Subcategory B: Interactive events on non-interactive elements (jsx-a11y)**

Multiple backdrop overlays and clickable rows implemented as `<div onClick={...}>` without keyboard accessibility. Screen-reader users and keyboard-only users could not dismiss modals or activate rows.

Fix pattern:
- Backdrop overlays: replace `<div onClick={handler}>` with `<button type="button" aria-label="Close" className="fixed inset-0 cursor-default" onClick={handler}>`.
- Clickable rows/cards: add `role="button"`, `tabIndex={0}`, `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handler(); }}`.

Affected files: `DashboardSidebar.tsx`, `NotificationPanel.tsx`, `ConfirmDialog.tsx`, `VersionHistoryDrawer.tsx`, `SectionFieldRow.tsx`, `ConditionalLogicPanel.tsx`, `FloatingCompose.tsx`, `MessageRow.tsx`, `ThreadView.tsx`, `ApplicantDashboardPage.tsx`, `ApplicantDocumentsPage.tsx`, `MedicalRecordPage.tsx`.

**Subcategory C: Labels not associated with form controls (jsx-a11y/label-has-associated-control)**

Form labels missing `htmlFor` attributes or lacking visible accessible text. Affected custom component wrappers where ESLint could not statically determine the association.

Fix pattern: Add `id` to the native control and matching `htmlFor` to the label. For labels with visible text in nested elements, add explicit `aria-label` to the label element.

Affected files: `SectionInlineEditor.tsx`, `ValidationRulesPanel.tsx`, `FieldSettingsPanel.tsx`, `ConditionalLogicPanel.tsx`, `AuditLogPage.tsx`, `FormEditorPage.tsx`, `MedicalTreatmentLogPage.tsx`, `ApplicantDocumentsPage.tsx`, `ApplicationFormPage.tsx`.

**Subcategory D: Unused variable imports (@typescript-eslint/no-unused-vars)**

Several files imported `React` or specific types (`DragEvent`, `FormEvent`) that were declared but unused.

Fix: Remove unused imports or replace the `React.Something` usage pattern that necessitated the import.

**Final ESLint state**: 0 errors, 11 warnings (all `jsx-a11y/no-autofocus` on intentional autoFocus props in modal inputs — acceptable).

---

## Phase 3 — Architecture and Integration Review

### Authentication and Session Management

- Token stored in `sessionStorage` under key `auth_token`.
- `useAuthInit` hook reads the token on app load, validates it via `GET /api/auth/user`, and dispatches `hydrateAuth()` to Redux.
- Initial Redux state has `isLoading: true`; `ProtectedRoute` renders `<FullPageLoader />` until loading resolves.
- On validation failure (401), `clearAuth()` is dispatched and the user is redirected to `/login`.
- On transient API failure (5xx / network), `restoreSession(token)` keeps the user authenticated.
- Sanctum token expiration is configured to 60 minutes in production; 0 (non-expiring) locally per developer preference.

No issues found.

### Redux State Management

- No `redux-persist` in use; auth state is session-scoped.
- `clearAuth()` returns the initial state with `isLoading: false` to prevent a post-logout spinner.
- State slices are properly typed; no `any` casts in store definitions.

No issues found.

### Route-Level Authorization

The `routes/api.php` file (885 lines) was reviewed in full. Route groupings correctly enforce:

| Group | Middleware |
|---|---|
| Admin/super-admin document requests | `role:admin,super_admin` |
| Applicant document requests | `role:applicant` |
| Form CRUD (mutations) | `role:super_admin` |
| Form reads | `role:admin,super_admin` |
| Medical records | `role:admin,medical` |
| Audit log, user management | `role:super_admin` |
| Application mutations | `admin` middleware |

The separation between read and write permission tiers is consistent throughout. No route was found that lacks appropriate middleware.

### Form Builder Security (Phase 14)

Following the resolution of BUG-057 through BUG-061, the form builder authorization chain is:

```
Route middleware (role:super_admin)
  → Controller method
    → $this->authorize('action', $model) → Policy check
      → Policy: $user->isSuperAdmin() && $formDefinition->isEditable()
```

The `reorder()` endpoint scopes batch updates to `form_definition_id` to prevent cross-definition record manipulation. The `validateKeyChange()` method blocks `field_key` renames when active applications reference the field.

No residual gaps found.

---

## Phase 4 — Performance and N+1 Review

The following N+1 eliminations were made in Phase 14 and are documented here:

| Location | Issue | Fix |
|---|---|---|
| `FormDefinitionController::index()` | Loaded sections and fields in a loop | Added `with(['sections.fields.options'])` eager load |
| `FormBuilderService::duplicate()` | Iterated sections/fields without preloading | Added chunked eager loading |

Cache invalidation for the active form schema (`form.active.v{version}`) was moved inside the database transaction in `FormBuilderService` to prevent stale cache reads when the transaction rolls back.

No new N+1 issues were identified in the audited controllers.

---

## Phase 5 — Test Coverage Assessment

### Backend Test Coverage Summary

| Test class | Tests | Focus |
|---|---|---|
| `TokenExpirationTest` | 8 | Sanctum token expiration configuration |
| `ApplicationAuthorizationTest` | 12 | RBAC: application create/view/review/delete |
| `AllergyAuthorizationTest` | 9 | RBAC: medical allergy CRUD |
| `ApplicationWorkflowTest` | 18 | Integration: draft → submit → review lifecycle |
| `AuditFailureResilienceTest` | 6 | Audit log non-fatal failure isolation |
| *(Phase 14 form builder tests)* | 24 | Form definition/section/field CRUD, policy enforcement |
| *(other feature tests)* | ~257 | Full coverage across all controllers |
| **Total** | **334** | |

All 334 tests pass. 1 test is skipped (pending infrastructure for a specific edge case).

### Frontend Test Coverage

The frontend has a single integration test file: `InboxPage.test.tsx`. It uses Vitest and tests inbox rendering with mock API responses. Six ESLint errors in this file related to `__dirname` usage in an ESM context were resolved.

No other frontend tests exist at this time. This is noted as a gap — particularly for the Form Builder, Medical Record editor, and Application Form components.

---

## Phase 6 — Verified Fixes Summary

### Backend

| Fix | File | Description |
|---|---|---|
| phpunit.xml SANCTUM_EXPIRATION | `phpunit.xml` | Ensures test environment enforces token expiration regardless of local .env |
| FormDefinitionPolicy draft exposure | `app/Policies/FormDefinitionPolicy.php` | `view()` now restricts non-admins to active forms only (BUG-065) |
| FormSectionController IDOR | `app/Http/Controllers/Api/Form/FormSectionController.php` | `abort_if` section ownership check in `update()` and `destroy()` (BUG-066) |
| FormFieldController IDOR | `app/Http/Controllers/Api/Form/FormFieldController.php` | `abort_if` field ownership check in `update()` and `destroy()` (BUG-067) |
| FormFieldOptionController IDOR | `app/Http/Controllers/Api/Form/FormFieldOptionController.php` | `abort_if` option ownership check in `update()` and `destroy()` (BUG-068) |
| MedicalRestrictionPolicy delete | `app/Policies/MedicalRestrictionPolicy.php` | `delete()` restricted to `isAdmin()` only (BUG-069) |
| DocumentPolicy view ordering | `app/Policies/DocumentPolicy.php` | Medical provider check moved before camper ownership check (BUG-070) |
| Announcement route middleware | `routes/api.php` | Added `->middleware('admin')` to update/destroy announcement routes (BUG-071) |
| RateLimitingTest MFA limit | `tests/Feature/Security/RateLimitingTest.php` | Loop count corrected to 3 (matching 3/min limit in bootstrap/app.php); test renamed (BUG-072) |

### Frontend

| Fix | File(s) | Description |
|---|---|---|
| Animation fill-mode | `DashboardShell.tsx` | Added `backwards` to pageIn animation; eliminates page-open flash |
| Backdrop accessibility | `DashboardSidebar.tsx`, `NotificationPanel.tsx`, `ConfirmDialog.tsx`, `VersionHistoryDrawer.tsx`, `FloatingCompose.tsx`, `MessageRow.tsx`, `ThreadView.tsx`, `ApplicantDashboardPage.tsx`, `ApplicantDocumentsPage.tsx`, `MedicalRecordPage.tsx` | Converted div/span onClick elements to button or added keyboard handlers |
| Label associations | `SectionInlineEditor.tsx`, `ValidationRulesPanel.tsx`, `FieldSettingsPanel.tsx`, `ConditionalLogicPanel.tsx`, `AuditLogPage.tsx`, `FormEditorPage.tsx`, `MedicalTreatmentLogPage.tsx`, `ApplicantDocumentsPage.tsx`, `ApplicationFormPage.tsx` | Added htmlFor/id pairs for screen reader accessibility |
| React type imports | `ApplicationFormPage.tsx`, `ApplicantApplicationDetailPage.tsx`, `ApplicantDocumentsPage.tsx`, `MedicalTreatmentLogPage.tsx`, `MedicalVisitsPage.tsx`, `MedicalIncidentsPage.tsx`, `EmojiPicker.tsx`, `LinkPopover.tsx`, `RichTextEditor.tsx` | Replaced `React.Something` with named type imports |
| Unused imports | `AdminDocumentsPage.tsx`, `MedicalIncidentsPage.tsx`, others | Removed or corrected unused type imports |
| Keyboard accessibility | `SectionFieldRow.tsx`, `ConditionalLogicPanel.tsx`, `FormEditorPage.tsx` | Added role/tabIndex/onKeyDown to draggable rows and interactive divs |
| FormEvent type | `AddFieldModal.tsx`, `AddSectionModal.tsx`, `CreateFormModal.tsx`, `SectionInlineEditor.tsx` | Changed `React.FormEvent` to `FormEvent` with proper named import |

---

## Phase 7 — Outstanding Items and Recommendations

### Resolved During This Audit

All critical and high-priority issues were resolved. The codebase passes backend tests (334/334), frontend build (no TypeScript errors), and frontend lint (0 errors) at the conclusion of this audit.

### Recommendations for Future Work

#### High Priority

1. **Frontend test coverage**: The frontend has no unit or integration tests for complex interactive components (Form Builder, Application Form, Medical Record editor). Consider adding Vitest + React Testing Library tests for at minimum:
   - Form submission and validation in `ApplicationFormPage.tsx`
   - Section/field CRUD in `FormBuilderPage.tsx` and `FormEditorPage.tsx`
   - Auth flow in `LoginPage.tsx` and `ProtectedRoute.tsx`

2. **Backend test coverage for Document Requests**: `DocumentRequestController` lacks dedicated authorization tests analogous to `AllergyAuthorizationTest`. Applicant-to-applicant IDOR protection should be regression-tested.

#### Medium Priority

3. ~~**Token storage review**: The `MEMORY.md` project documentation incorrectly states token is stored in `localStorage`. Actual storage is `sessionStorage`. The documentation should be corrected to prevent future developer confusion.~~ **RESOLVED (BUG-075, 2026-03-12):** The implementation was changed to `localStorage` (not sessionStorage). All `sessionStorage` calls in `LoginPage.tsx`, `useAuthInit.ts`, `axios.config.ts`, and `auth.api.ts` were migrated to `localStorage` under key `auth_token`. Documentation has been updated accordingly.

4. **Form Builder field key change protection**: The `FormFieldKeyChangeException` correctly prevents field_key renames when applications exist. However, there is no UI-level pre-check warning before the admin initiates the rename — the error only surfaces on save. A pre-flight check on the edit field modal would improve UX.

5. **DocumentRequest cross-resource validation**: The `store()` method in `DocumentRequestController` does not validate that the supplied `camper_id` belongs to the supplied `applicant_id`. An admin can create a document request linking any camper to any applicant. While not a security risk in a trust-admin environment, it is a data integrity gap.

#### Low Priority

6. **`autoFocus` warnings**: Eleven `jsx-a11y/no-autofocus` warnings remain on intentional modal input autofocus. These are acceptable UX decisions (modals should focus their primary input on open) but could be suppressed with `// eslint-disable-next-line jsx-a11y/no-autofocus` comments paired with a short comment explaining the intent.

7. **`ConfirmDialog` background**: The dialog card uses hardcoded `background: '#ffffff'`. This works in the current permanent-light-mode design but would need to be changed to a CSS variable if dark mode is ever introduced.

---

## Appendix A — Files Modified During This Audit

### Backend

| File | Change |
|---|---|
| `phpunit.xml` | Added `<env name="SANCTUM_EXPIRATION" value="60"/>` |
| `app/Policies/FormDefinitionPolicy.php` | `view()` restricted to active forms for non-admins (BUG-065) |
| `app/Http/Controllers/Api/Form/FormSectionController.php` | Added parent-child scope checks in `update()`/`destroy()` (BUG-066) |
| `app/Http/Controllers/Api/Form/FormFieldController.php` | Added parent-child scope checks in `update()`/`destroy()` (BUG-067) |
| `app/Http/Controllers/Api/Form/FormFieldOptionController.php` | Added parent-child scope checks in `update()`/`destroy()` (BUG-068) |
| `app/Policies/MedicalRestrictionPolicy.php` | `delete()` admin-only (BUG-069) |
| `app/Policies/DocumentPolicy.php` | Medical provider check reordered before camper ownership check (BUG-070) |
| `routes/api.php` | Added `->middleware('admin')` to announcement update/destroy routes (BUG-071) |
| `tests/Feature/Security/RateLimitingTest.php` | MFA test loop corrected to 3 iterations; renamed method; updated comment (BUG-072) |

### Frontend

| File | Change |
|---|---|
| `src/ui/layout/DashboardShell.tsx` | `animation-fill-mode: backwards` on `<main>` |
| `src/ui/layout/DashboardSidebar.tsx` | Mobile backdrop div → button |
| `src/ui/overlay/NotificationPanel.tsx` | Backdrop div → button |
| `src/ui/overlay/ConfirmDialog.tsx` | Backdrop div → button; card div → role="presentation" |
| `src/features/superadmin/components/form-builder/SectionFieldRow.tsx` | Added role/tabIndex/onKeyDown to draggable rows |
| `src/features/superadmin/components/form-builder/SectionInlineEditor.tsx` | FormEvent type fix; label htmlFor/id pairs |
| `src/features/superadmin/components/form-builder/ConditionalLogicPanel.tsx` | Toggle span → button; label htmlFor/id pairs |
| `src/features/superadmin/components/form-builder/FieldSettingsPanel.tsx` | Labels for custom components changed to span |
| `src/features/superadmin/components/form-builder/ValidationRulesPanel.tsx` | Label htmlFor/id pairs |
| `src/features/superadmin/components/form-builder/FormEditorPage.tsx` | role/tabIndex/onKeyDown on draggable elements |
| `src/features/superadmin/components/form-builder/VersionHistoryDrawer.tsx` | Backdrop div → button |
| `src/features/superadmin/components/form-builder/dashboard/CreateFormModal.tsx` | FormEvent type fix |
| `src/features/superadmin/components/form-builder/AddSectionModal.tsx` | FormEvent type fix |
| `src/features/superadmin/components/form-builder/AddFieldModal.tsx` | FormEvent type fix |
| `src/features/admin/pages/AuditLogPage.tsx` | Label htmlFor/id pairs |
| `src/features/admin/pages/AdminDocumentsPage.tsx` | Removed unused DragEvent import |
| `src/features/medical/pages/MedicalIncidentsPage.tsx` | FormEvent type fix; React.FormEvent → FormEvent |
| `src/features/medical/pages/MedicalVisitsPage.tsx` | React.FormEvent → FormEvent with import |
| `src/features/medical/pages/MedicalTreatmentLogPage.tsx` | ReactNode import; label htmlFor/id pairs |
| `src/features/medical/pages/MedicalRecordPage.tsx` | Backdrop div → button |
| `src/features/messaging/components/FloatingCompose.tsx` | Backdrop divs → buttons |
| `src/features/messaging/components/MessageRow.tsx` | Clickable rows: role/tabIndex/onKeyDown |
| `src/features/messaging/components/ThreadView.tsx` | Clickable elements: role/onKeyDown fixes |
| `src/features/messaging/components/editor/EmojiPicker.tsx` | ReactNode import fix |
| `src/features/messaging/components/editor/LinkPopover.tsx` | RefObject import; React.RefObject → RefObject |
| `src/features/messaging/components/editor/RichTextEditor.tsx` | React type fix |
| `src/features/messaging/__tests__/InboxPage.test.tsx` | __dirname ESM fix |
| `src/features/parent/pages/ApplicantApplicationDetailPage.tsx` | ReactNode import; React.ReactNode → ReactNode |
| `src/features/parent/pages/ApplicantDashboardPage.tsx` | Clickable element keyboard accessibility |
| `src/features/parent/pages/ApplicantDocumentsPage.tsx` | Backdrop/clickable divs → buttons; label fixes; ReactNode import |
| `src/features/parent/pages/ApplicationFormPage.tsx` | ReactNode/MouseEvent/TouchEvent imports; React.* → named types; label htmlFor/id pairs |

---

## Appendix B — Bug Tracker Delta

Bugs discovered and tracked during this audit:

| ID | Title | Severity | Status |
|---|---|---|---|
| BUG-AUDIT-001 (= BUG-062) | TokenExpirationTest fails due to SANCTUM_EXPIRATION=null in .env | High | Resolved |
| BUG-AUDIT-002 (= BUG-063) | Page-open animation flash (backwards fill-mode missing) | High | Resolved |
| BUG-AUDIT-003 (= BUG-064) | 188 ESLint errors — accessibility and type safety violations | Medium | Resolved |
| BUG-065 | FormDefinitionPolicy draft exposure (FINDING-02) | Critical | Resolved |
| BUG-066 | FormSectionController IDOR (FINDING-05) | High | Resolved |
| BUG-067 | FormFieldController IDOR (FINDING-05 variant) | High | Resolved |
| BUG-068 | FormFieldOptionController IDOR (FINDING-06) | High | Resolved |
| BUG-069 | MedicalRestrictionPolicy delete() inconsistency (FINDING-09) | Medium | Resolved |
| BUG-070 | DocumentPolicy unreachable code — medical providers blocked (FINDING-11) | High | Resolved |
| BUG-071 | Announcement routes missing admin middleware (FINDING-01) | High | Resolved |
| BUG-072 | RateLimitingTest MFA assertion incorrect (FINDING-13) | Low | Resolved |
| BUG-073 | DocumentRequestController lacks Policy class (FINDING-03) | Low | Open |

These are tracked in `BUG_TRACKER.md` (BUG-001 through BUG-073). This audit session resolved BUG-062 through BUG-072 and opened BUG-073.

---

*Report generated: 2026-03-12*

