# Application Form

**Version:** 1.0
**Last Updated:** April 2026 (2026-04-09)
**Scope:** Applicant portal — the digital CYSHCN camper application and its related start flow, official forms page, and admin review surface.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Application Start Flow](#2-application-start-flow)
3. [Form Architecture](#3-form-architecture)
4. [Draft Persistence](#4-draft-persistence)
5. [Re-apply Flow](#5-re-apply-flow)
6. [Form Submission](#6-form-submission)
7. [Bilingual Support](#7-bilingual-support)
8. [Medical Form](#8-medical-form)
9. [Official Forms Page](#9-official-forms-page)
10. [Admin Review Context](#10-admin-review-context)
11. [Key Constraints](#11-key-constraints)

---

## 1. Overview

The Camp Burnt Gin application form is a 10-section interactive digital form that replaces the legacy paper-based CYSHCN application packet. The form is completed entirely within the applicant portal. It is available in English and Spanish via i18next. A single form submission creates all related backend records in one operation.

The digital form covers the following domains: general and contact information, health and medical history, development and behavioral profile, equipment and mobility needs, diet and feeding, personal care, activity permissions, medications, required document uploads, narrative responses, and consent signatures.

The form is separate from the Medical Exam Form, which is a physician-completed PDF that must be downloaded, completed offline, and uploaded separately.

---

## 2. Application Start Flow

### Route

`/applicant/applications/start` — rendered by `ApplicationStartPage.tsx`

### Entry Points

Users reach the start page by clicking "New Application" on `ApplicantApplicationsPage` or from the empty state on the same page. Both navigate to `ROUTES.PARENT_APPLICATION_START`.

### Page Layout

`ApplicationStartPage` uses a two-column responsive layout: a main flow column on the left and a sticky summary panel on the right. On smaller viewports the columns stack vertically.

### Step 1 — Session Selection

The page fetches available sessions from `GET /api/sessions` on mount. Sessions with status `cancelled` are excluded from the list. Sessions are ordered with active/waitlist sessions first, followed by closed sessions.

Each session displays a status badge:

| Session state | Badge label | Selectable |
|---|---|---|
| `closed` or `cancelled` | Closed | No |
| `waitlist` | Waitlist | Yes |
| Capacity ≥ 80% filled | Filling Fast | Yes |
| Otherwise | Open | Yes |

Only one session can be selected per start flow. The "Start Application" button is disabled until a session is selected.

### Step 2 — Language Selection

The page presents two language options: English and Spanish. The default is English. The selection controls which locale is applied to the form.

### Starting a New Application

Clicking "Start Application":

1. Calls `i18n.changeLanguage('es')` if Spanish was selected, or `i18n.changeLanguage('en')` if English.
2. Clears any existing draft by calling `localStorage.removeItem('cbg_app_draft')`.
3. Navigates to `ROUTES.PARENT_APPLICATION_NEW` with `location.state = { language, sessionId }`.

### Continue Draft

If a draft exists in `localStorage` under the key `cbg_app_draft`, the page parses it on mount and displays the camper's name (from `s1.camper_first_name` + `s1.camper_last_name`) on a "Continue Draft" card. Clicking "Continue Draft" navigates directly to `ROUTES.PARENT_APPLICATION_NEW` without state — the form will hydrate from localStorage.

### Re-apply

The re-apply option navigates to the form with `location.state = { prefill: { first_name, last_name, date_of_birth, gender, tshirt_size } }` pulled from a previously submitted application. See [Section 5](#5-re-apply-flow) for details.

---

## 3. Form Architecture

### Route

`/applicant/applications/new` — rendered by `ApplicationFormPage.tsx`

### Layout

The form uses a fixed 260 px left sidebar for section navigation and an accordion main panel on the right. The sidebar lists all 10 sections with their titles. Navigation is free — users may open any section at any time without completing previous sections in order.

### Sections

| # | Section name | Key | Domain |
|---|---|---|---|
| 1 | General Information | `s1` | Camper identity, both guardians, emergency contact, session selection, language/interpreter |
| 2 | Health & Medical | `s2` | Insurance, physician, diagnoses, allergies, seizures, immunizations, health flags |
| 3 | Development & Behavior | `s3` | Behavioral flags, communication methods, school attendance, behavioral descriptions |
| 4 | Equipment & Mobility | `s4` | Assistive devices, CPAP, mobility notes |
| 5 | Diet & Feeding | `s5` | Special diet, texture modification, fluid restriction, G-tube / formula |
| 6 | Personal Care | `s6` | Bathing, toileting, dressing, oral hygiene, positioning, sleep, bowel/bladder |
| 7 | Activities & Permissions | `s7` | Sports, arts & crafts, nature, fine arts, swimming, boating, camp-out — each with level and notes |
| 8 | Medications | `s8` | Medication list with dosage, frequency, route, physician, self-admin flag |
| 9 | Required Documents | `s9` | Immunization record, medical exam, insurance card, CPAP waiver, seizure plan, G-tube plan |
| Narratives | Narrative Responses | `sn` | 8 open-text narrative fields (rustic environment, staff suggestions, participation concerns, camp benefit, heat tolerance, transportation, additional info, emergency protocols) |
| 10 | Consents & Signatures | `s10` | 7 consent checkboxes + drawn or typed signature |

### Section 1 — General Information Detail

Section 1 captures:

- Application meta: `first_application` (boolean), `attended_before` (boolean)
- Camper: name, date of birth, gender, T-shirt size, preferred name, county, mailing address (street, city, state, zip)
- Guardian 1: name, relationship, three phone fields (home, work, cell), email, full address
- Guardian 2: same fields as Guardian 1, plus `primary_language` and `interpreter_needed` boolean
- Emergency contact: name, relationship, three phone fields (cell/primary, home, work), full address (street, city, state, zip), `primary_language`, `interpreter_needed`
- Session selection: primary session (`session_id`) and optional second-choice session (`session_id_2nd`)
- Applicant interpreter/language needs: `needs_interpreter`, `preferred_language`

### Section 10 — Consents Detail

Seven consent items are required:

1. `consent_general` — General consent
2. `consent_medical` — Medical consent
3. `consent_photo` — Photo consent
4. `consent_liability` — Liability release
5. `consent_permission_activities` — Permission to participate in activities
6. `consent_medication` — Medication consent
7. `consent_hipaa` — HIPAA authorization

The signature block supports two modes selected via `signature_type`:

- `drawn` — canvas-based drawn signature; stored as a base64 PNG in `signature_data`
- `typed` — typed name only; `signature_data` is empty string

`signed_name` and `signed_date` are captured regardless of signature type.

---

## 4. Draft Persistence

### Mechanism

`ApplicationFormPage` mirrors the full `FormState` object to `sessionStorage` on every state change. The write is debounced with a 3-second delay (`AUTOSAVE_DELAY = 3000` ms) to avoid excessive writes during rapid typing. A separate auto-save timer (30-second interval) persists the draft to the server via `PUT /api/application-drafts/{id}`.

### Storage Key

`cbg_app_draft` (stored in `sessionStorage`, not `localStorage`)

### What is Persisted

The entire `FormState` object is serialized as JSON. This includes all 10 sections, the narratives section (`sn`), and the `meta` object (`{ activeSection, lastSaved }`).

File objects (`File` instances) attached in Section 9 cannot be serialized to JSON. File metadata only (`{ file_name, size, mime }`) is stored in `DocSlot` fields. The actual `File` objects are held in a `docFilesRef` (a `useRef`) outside of React state. File references are lost if the page is closed and a draft is resumed; users must re-select document files when continuing a draft.

### Draft Recovery

On mount, `ApplicationFormPage` attempts to parse `sessionStorage.getItem('cbg_app_draft')`. If a valid object is found, form state is initialized from it. The `activeSection` stored in `meta` restores the user to the section they last had open.

### Draft Display in Start Page

`ApplicationStartPage` reads `cbg_app_draft` on mount to extract `s1.camper_first_name` and `s1.camper_last_name`. If a name is found, it is displayed on the "Continue Draft" card to confirm which camper's draft is saved.

### Draft Scope

The client-side draft is tab-scoped (stored in `sessionStorage`) and therefore:

- Cleared automatically when the browser tab is closed
- Not accessible from other tabs, devices, or browsers
- Not persistent across sessions — resuming a draft requires the same tab to remain open

The server-side draft (`application_drafts` table) provides cross-session persistence. When the applicant returns via the "Continue Draft" card, the form is populated from the server record.

### Server-Side Draft and Concurrency Guard

The 30-second auto-save timer and the manual "Save Draft" button both call `saveDraft()` in `applicant.api.ts`, which issues `PUT /api/application-drafts/{id}`.

To prevent a race condition when the same draft is open in two browser tabs simultaneously, the request optionally includes a `last_known_updated_at` timestamp reflecting the server's `updated_at` at the time the draft was last successfully saved. The server compares this value against the current database record:

- If they match, the update proceeds and the response includes the new `updated_at` value.
- If they differ (stale write), the server returns `HTTP 409 Conflict` with `{ conflict: true, server_updated_at: "..." }`.

On a 409 response, the frontend displays a `draft_conflict` toast notifying the user to reload the page to retrieve the latest version. The local draft is not overwritten.

The `last_known_updated_at` field is optional for backward compatibility. If omitted, the server applies the update unconditionally.

---

## 5. Re-apply Flow

### Purpose

The re-apply flow allows a parent to start a new application for a camper who has applied in a previous session, pre-filling basic identifying fields to save time.

### Prefill Data

When re-apply is initiated, `ApplicationStartPage` (or `ApplicantApplicationsPage`) navigates to `ROUTES.PARENT_APPLICATION_NEW` with:

```ts
location.state = {
  prefill: {
    first_name: string,
    last_name: string,
    date_of_birth: string,
    gender: string,
    tshirt_size: string,
  }
}
```

### Hydration

`ApplicationFormPage` reads `location.state?.prefill` on mount. If present, the following Section 1 fields are initialized from prefill values:

- `camper_first_name` ← `prefill.first_name`
- `camper_last_name` ← `prefill.last_name`
- `camper_dob` ← `prefill.date_of_birth`
- `camper_gender` ← `prefill.gender`
- `tshirt_size` ← `prefill.tshirt_size`

All other fields begin at their `INITIAL_STATE` defaults. No medical or behavioral data is pre-populated.

---

## 6. Form Submission

### API Calls

`ApplicationFormPage` does not issue a single monolithic POST. On submit, it calls a sequence of API endpoints using the data from each section, coordinating creation of all related backend records. The sequence uses the API functions imported from `src/features/parent/api/applicant.api.ts`:

1. `getSessions()` — resolved at form mount to populate session dropdowns
2. `createCamper()` — creates the camper record (Section 1 camper fields)
3. `createApplication()` — creates the application record (session, application meta, narrative responses)
4. `createEmergencyContact()` — creates emergency contact (Section 1 EC fields)
5. `createDiagnosis()` — for each diagnosis entry (Section 2)
6. `createAllergy()` — for each allergy entry (Section 2)
7. `createBehavioralProfile()` — creates behavioral profile (Section 3)
8. `createAssistiveDevice()` — for each device entry (Section 4)
9. `createFeedingPlan()` — creates feeding plan (Section 5)
10. `storeHealthProfile()` — stores health/medical data (Section 2)
11. `createPersonalCarePlan()` — creates personal care plan (Section 6)
12. `createMedication()` — for each medication entry (Section 8)
13. `createActivityPermission()` — for each activity in Section 7
14. `uploadDocument()` — for each document selected in Section 9
15. `signApplication()` — stores signature data and marks the application signed
16. `storeConsents()` — records the seven consent responses (Section 10)

### Field Categories Submitted

**Application meta:** `first_application`, `attended_before`, `camp_session_id`, `camp_session_id_second`

**Camper:** `first_name`, `last_name`, `date_of_birth`, `gender`, `tshirt_size`, `preferred_name`, `county`, `applicant_address`, `city`, `state`, `zip`

**Guardian 1:** `name`, `relationship`, `phone_home`, `phone_work`, `phone_cell`, `email`, `address`, `city`, `state`, `zip`

**Guardian 2:** same fields plus `primary_language`, `interpreter_needed`

**Emergency contact:** `name`, `relationship`, `phone` (cell), `phone_home`, `phone_work`, `address`, `city`, `state`, `zip`, `primary_language`, `interpreter_needed`

**Medical:** `insurance_type`, `insurance_provider`, `insurance_policy`, `insurance_group`, `medicaid_number`, `physician_name`, `physician_phone`, `physician_address`, `has_seizures`, `last_seizure_date`, `seizure_description`, `has_neurostimulator`, `immunizations_current`, `tetanus_date`, `date_of_medical_exam`, `has_contagious_illness`, `contagious_illness_description`, `has_recent_illness`, `recent_illness_description`, `tubes_in_ears`

**Behavioral profile:** `aggression` + description, `self_abuse` + description, `wandering` + description, `one_to_one` + description, `developmental_delay`, `functional_age_level`, `functional_reading`, `functional_writing`, `independent_mobility`, `verbal_communication`, `social_skills`, `behavior_plan`, `sexual_behaviors` + description, `interpersonal_behavior` + description, `social_emotional` + description, `follows_instructions` + description, `group_participation` + description, `attends_school`, `classroom_type`, `communication_methods`, `behavior_notes`

**Personal care:** `bathing_level`, `bathing_notes`, `toileting_level`, `toileting_notes`, `nighttime_toileting`, `nighttime_notes`, `dressing_level`, `dressing_notes`, `oral_hygiene_level`, `oral_hygiene_notes`, `positioning_notes`, `sleep_notes`, `falling_asleep_issues`, `sleep_walking`, `night_wandering`, `bowel_control_notes`, `irregular_bowel`, `irregular_bowel_notes`, `urinary_catheter`, `menstruation_support`

**Narratives:** `narrative_rustic_environment`, `narrative_staff_suggestions`, `narrative_participation_concerns`, `narrative_camp_benefit`, `narrative_heat_tolerance`, `narrative_transportation`, `narrative_additional_info`, `narrative_emergency_protocols`

**Consents:** `consent_general`, `consent_medical`, `consent_photo`, `consent_liability`, `consent_permission_activities`, `consent_medication`, `consent_hipaa`

**Signature:** `signed_name`, `signed_date`, `signature_type`, `signature_data` (base64 PNG or empty string)

---

## 7. Bilingual Support

### Language Selection

The application form renders in the locale that is active when the form page loads. The locale is set by `ApplicationStartPage` before navigation via `i18n.changeLanguage()`. The selected language code (`'en'` or `'es'`) and session ID are passed to the form via `location.state`.

### Language Badge

`ApplicationFormPage` reads `location.state?.language` and displays a language badge in the form header (e.g., "Español" or "English") indicating which language is in use. This is a display indicator; the active locale drives all translatable strings via i18next.

### Translation Coverage

All form labels, section titles, placeholder text, validation messages, button labels, and consent text are translated. Both `en.json` and `es.json` are kept at full key parity.

### Mid-Form Language Change

The language toggle in `DashboardHeader` is visible while the applicant is filling out the form. Switching language via the header toggle calls `i18n.changeLanguage()` and re-renders all translated strings immediately. Form data is unaffected.

---

## 8. Medical Form

### What It Is

The Medical Exam Form (Form 4523-ENG-DPH) is a physician-completed health clearance document. It is not a digital form — it cannot be filled out in the application system. The applicant must:

1. Download the blank PDF from the system.
2. Bring or send it to the camper's licensed medical provider for completion.
3. Upload the signed, completed PDF back to the system.

### Download

The blank PDF is stored in `storage/app/forms/medical_form.pdf` on the server (private disk). It is served via `GET /api/form-templates/medical_form/download` as a file download. The endpoint requires authentication.

### Upload

The completed medical form is uploaded via the medical form card on the Official Forms page (`/applicant/forms`). The upload posts to `POST /api/documents` as a multipart/form-data request with `document_type` set to `official_medical_form`.

### Storage

Uploaded medical forms are stored in the application's document library and associated with the applicant's account. The `document_type` value `official_medical_form` is the key used to identify this document in admin review.

### Never Digital

The medical form is the only form type that requires upload. It is not rendered as an interactive form and has no digital equivalent in the system.

---

## 9. Official Forms Page

### Route

`/applicant/forms` — rendered by `ApplicantOfficialFormsPage.tsx`

### Purpose

This page guides applicants through the two required components of a complete application:

1. The digital application form (completed in-system)
2. The medical exam form (downloaded, completed by physician, uploaded)

### Data Loading

On mount, the page issues a `Promise.all` to fetch three resources simultaneously:

- `GET /api/form-templates` — list of available form templates
- `GET /api/applications` — applicant's existing applications (to determine digital form completion status)
- `GET /api/documents` — applicant's existing documents (to determine medical form upload status)

### Digital vs. Upload Split

The `DIGITAL_FORM_TYPES` constant controls which form types are rendered as digital form cards:

```ts
const DIGITAL_FORM_TYPES: OfficialFormTypeKey[] = [
  'english_application',
  'spanish_application',
  'cyshcn_form',
];
```

Any form template with an `id` in this array is treated as digital. All others (specifically `medical_form`) are treated as upload-required.

### Digital Form Cards

Each digital form card shows:

- Form title and description
- A status indicator: **Submitted** (application exists with `submitted_at && !is_draft`), **In Progress** (draft exists), or **Not Started**
- A contextual action button: "Start Application" (navigates to `PARENT_APPLICATION_START`), "Continue" (navigates to `PARENT_APPLICATION_NEW`), or a "Submitted" disabled state

### Medical Form Card

The medical form card shows:

- A Download button that triggers `GET /api/form-templates/medical_form/download`
- An Upload control (file input + styled button) for the completed PDF
- If an `official_medical_form` document exists: a View link that opens `doc.url` in a new tab

### Upload Status

The medical form card cycles through four upload states: `idle`, `uploading`, `done`, `error`. See `docs/ui-ux/UI_UX_Behavior.md § 10` for the full upload state behavior.

---

## 10. Admin Review Context

### Application Components Section

`ApplicationReviewPage` includes an "Application Components" section card that shows the completion status of the two required submission elements:

**Row 1 — Digital Application Form**
- Complete: `application.submitted_at && !application.is_draft` evaluates to true → green checkmark + "Submitted"
- Incomplete: yellow indicator + "Not submitted"

**Row 2 — Medical Exam Form**
- Complete: `application.documents.find(d => d.document_type === 'official_medical_form')` returns a document → green checkmark + "Uploaded"
- Incomplete: yellow indicator + "Not uploaded"

### Editable Sections

Admin users can edit the following sections inline on `ApplicationReviewPage`:

- **Camper Information** — name, date of birth, gender, T-shirt size, preferred name
- **Emergency Contacts** — add, edit, or delete contacts
- **Behavioral Profile** — triggers, de-escalation strategies, communication style
- **Narrative Responses** — all 8 narrative fields plus admin notes

All admin edits are written to the audit log via `AuditLog::logContentChange()` with before/after snapshots.

### Completeness Check

Before approving, `ApplicationReviewPage` calls `GET /api/applications/{id}/completeness` to check whether required documents are present and all required fields are filled. If the check fails, an `IncompleteApprovalModal` dialog is shown, requiring the admin to explicitly confirm they wish to approve despite the incomplete state.

### Application Status Transitions

Status transition rules are enforced on the backend by `ApplicationStatus::canTransitionTo()`. The valid transitions are:

- `pending` → `under_review`
- `under_review` → `approved`, `rejected`, `waitlisted`
- `waitlisted` → `approved`, `rejected`
- `approved` → `waitlisted`, `rejected`, `cancelled`
- `rejected` → `pending` (re-open)

Attempts to transition to an invalid status return HTTP 422.

---

## 11. Key Constraints

**One application per camper per session.** The backend enforces uniqueness on `(camper_id, camp_session_id)`. Attempting to submit a duplicate application returns a validation error.

**Draft is client-only.** The draft stored in `localStorage` is never synchronized to the server. If a user clears browser storage or switches devices, the draft is gone. There is no server-side draft recovery mechanism.

**File objects are not persisted in draft.** Only file metadata is stored in `localStorage`. When resuming a draft, users must re-select any documents they had attached in Section 9.

**Medical form upload is not application-scoped.** The `POST /api/documents` endpoint for the medical form upload does not associate the document with a specific application ID. The document is added to the applicant's general document library. Admin review works because `application.documents` includes all documents belonging to the applicant; however, cross-application disambiguation (e.g., if a parent applies for the same camper in two sessions) is not currently supported. This is documented as a known gap.

**Digital forms do not generate a PDF upload.** The `english_application`, `spanish_application`, and `cyshcn_form` template types are completed interactively and stored as structured database records. No PDF is generated from the digital form submission.

**Session selection at start, not at form.** The session is selected on `ApplicationStartPage` before the form loads. The session ID is passed via `location.state` and pre-populated in the `s1.session_id` field. It can be changed inside the form but the start page selection is authoritative if state is present.
