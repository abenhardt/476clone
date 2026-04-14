# Application Workflows

This document provides a comprehensive overview of the application lifecycle, state transitions, and workflow processes within the Camp Burnt Gin API system.

> **See also:** [`APPLICATION_LIFECYCLE.md`](./APPLICATION_LIFECYCLE.md) — the authoritative specification for approval, reversal, re-approval, camper activation/deactivation, and medical record lifecycle. Where these two documents conflict, `APPLICATION_LIFECYCLE.md` takes precedence.

---

## Table of Contents

1. [Workflow Overview](#workflow-overview)
2. [Application States and Transitions](#application-states-and-transitions)
3. [Creation and Draft Workflow](#creation-and-draft-workflow)
4. [Submission and Signature Workflow](#submission-and-signature-workflow)
5. [Review and Decision Workflow](#review-and-decision-workflow)
6. [Medical Provider Integration](#medical-provider-integration)
7. [Business Rules and Constraints](#business-rules-and-constraints)
8. [Error Handling](#error-handling)

---

## Workflow Overview

The application workflow manages the complete lifecycle of camp registration applications from creation through final decision, enforcing business rules and maintaining data integrity.

### Key Components

| Component | Role |
|-----------|------|
| Application Model | Registration request with status tracking |
| ApplicationController | API request handling |
| ApplicationService | Approval workflow and compliance management |
| ApplicationPolicy | Authorization enforcement |
| ApplicationStatus Enum | Valid states and transitions |
| Notification System | Status change alerts |
| Audit Logging | State transition recording for compliance |

### Workflow Participants

| Participant | Role | Key Actions |
|-------------|------|-------------|
| Parent | Creator | Create, edit, sign, cancel applications |
| Medical Provider | Healthcare professional | Submit medical info via secure link |
| Administrator | Camp staff | Review, approve, reject, waitlist |
| System | Automated process | Send notifications, enforce deadlines, log events |

---

## Application States and Transitions

### State Definitions

| State | Value | Description | Parent Can Edit | Who Sets |
|-------|-------|-------------|-----------------|----------|
| Pending | `pending` | Initial state after submission | Yes | System |
| Under Review | `under_review` | Admin has opened the application for review | Yes | Admin |
| Approved | `approved` | Accepted for attendance | No | Admin |
| Rejected | `rejected` | Not accepted after review | No | Admin |
| Waitlisted | `waitlisted` | Session full; queued for promotion | No | Admin |
| Cancelled | `cancelled` | Cancelled by administrator | No | Admin only |
| Withdrawn | `withdrawn` | Voluntarily withdrawn by parent | No | Parent only |

**Terminal states** (no further transitions): `cancelled`, `withdrawn`.
`rejected` is not terminal — admins may re-approve.

> For the authoritative state transition matrix, camper/medical record activation rules,
> system invariants, and full workflow diagrams, see
> **[APPLICATION_LIFECYCLE.md](./APPLICATION_LIFECYCLE.md)** — that document supersedes
> any conflicting detail here.

---

## Creation and Draft Workflow

### Application Creation Flow

```
Parent Auth → Select Session → Select/Create Camper
    ↓
Validate Unique Constraint (one app per camper per session)
    ↓
Create Application (status=pending, is_draft=true)
    ↓
Return Application ID with editable=true
```

### Required Creation Data

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| camper_id | Integer | Yes | Must exist, owned by parent |
| camp_session_id | Integer | Yes | Must exist, active session |
| is_draft | Boolean | No | Defaults to true |
| status | Enum | No | Defaults to pending |

### Draft Mode Characteristics

| Property | Value |
|----------|-------|
| is_draft | true |
| status | pending |
| submitted_at | NULL |
| Editable | Yes |
| Visible to admin | No (filtered from review queue) |
| Can be deleted | Yes |

**Save/Update Draft:**
```http
POST /api/applications
PUT /api/applications/{id}
{
  "is_draft": true,
  "notes": "Partial data..."
}
```

---

## Submission and Signature Workflow

### Digital Signature Components

| Component | Description | Storage |
|-----------|-------------|---------|
| signature_data | Base64-encoded image | Database (hidden from API) |
| signature_name | Printed name | Database |
| signed_at | Signature timestamp | Database |
| signed_ip_address | Signer IP | Database |

### Signature Endpoint

```http
POST /api/applications/{id}/sign
{
  "signature_data": "data:image/png;base64,...",
  "signature_name": "Jane Doe"
}
```

**Authorization:** Parent owns camper OR admin

**Response:** 200 OK with signature confirmation

### Submission Process

```
Parent Reviews Draft → Adds Signature → Sets is_draft=false
    ↓
System Validates Completeness (422 if fails)
    ↓
Update: is_draft=false, status=under_review, submitted_at=now()
    ↓
Log Submission Event
    ↓
Queue Parent Notification
    ↓
Return 200 OK
```

### Submission Requirements

| Requirement | Status |
|-------------|--------|
| Camper profile | Must be complete |
| Camp session | Active, within registration window |
| Digital signature | signature_data, signature_name, signed_at required |
| Medical information | Recommended but not required |
| Emergency contacts | At least one recommended |

---

## Review and Decision Workflow

> For the full transactional review process flow (gates, activation, audit, notifications),
> see **[APPLICATION_LIFECYCLE.md §5–8 and §10](./APPLICATION_LIFECYCLE.md)**.

### Review Endpoint

```http
POST /api/applications/{id}/review
{
  "status": "approved",
  "notes": "Application approved. Meets all requirements."
}
```

**Validation:**
- `status`: Required — valid admin-level targets: `approved`, `rejected`, `under_review`, `waitlisted`, `cancelled`
- `notes`: Optional (required by convention for rejected decisions)

**Authorization:** Admin only

### Parent Withdrawal Endpoint

```http
POST /api/applications/{id}/withdraw
```

No request body required. Sets status to `withdrawn` (terminal). If the application was `approved`, deactivates the camper and medical record using the same multi-session safety check as admin reversal.

**Valid from:** `pending`, `under_review`, `approved`, `waitlisted`

**Authorization:** Parent owns camper only — admins must use `/review` with `status=cancelled`

### Decision Notifications

| Event | Trigger | Recipients | Content |
|-------|---------|------------|---------|
| Submitted | status→under_review | Parent | Confirmation of submission |
| Approved | status→approved | Parent | Acceptance letter, camp details, next steps |
| Rejected | status→rejected | Parent | Polite rejection, explanation |
| Waitlisted | status→waitlisted | Parent | Waitlist notification |

**Notification Retry Policy:**
- Attempt 1: Immediate
- Attempt 2: After 60 seconds
- Attempt 3: After 5 minutes
- Attempt 4: After 15 minutes

---

## Medical Provider Integration

### Provider Link Creation Flow

```
Parent → Request Provider Input
    ↓
POST /api/medical-provider-links
{
  "camper_id": 1,
  "provider_email": "doctor@example.com",
  "message": "Please complete medical form"
}
    ↓
System Generates:
  - 64-character secure token
  - Expiration: 72 hours
  - Unique link URL
    ↓
Store Link Record (token, camper_id, email, expires_at)
    ↓
Queue Provider Email
    ↓
Return 201 with Link Details
```

### Provider Submission Flow

```
Provider Clicks Link → GET /api/provider-access/{token}
    ↓
Validate Token (exists, not expired, not used, not revoked)
    ↓
Display Medical Form (camper name read-only)
    ↓
Provider Submits → POST /api/provider-access/{token}/submit
    ↓
Validate Submission (422 if invalid)
    ↓
Update/Create Medical Records
    ↓
Mark Link Used (is_used=true, used_at=now())
    ↓
Log Provider Submission
    ↓
Notify Parent and Admin
    ↓
Return 200 OK
```

### Provider Link Revocation

```http
DELETE /api/medical-provider-links/{id}
```

**Effect:**
- Sets revoked_at to timestamp
- Link immediately invalid
- No notification to provider (security)

---

## Business Rules and Constraints

### Critical Constraints

| Rule | Enforcement | Error Response |
|------|-------------|----------------|
| Application uniqueness | DB constraint on (camper_id, camp_session_id) | HTTP 422: "Camper already has application for this session" |
| Registration window | Session registration_opens_at ≤ now ≤ registration_closes_at | HTTP 422: "Registration not currently open for this session" |
| Age requirements | camper_age_on_start >= min_age AND <= max_age | HTTP 422: "Camper does not meet age requirements" |
| Signature required | signature_data, signature_name, signed_at must be present | HTTP 422: "Application must be signed before submission" |
| Capacity limits | approved_count < session.capacity | Applications waitlisted when full |

### Age Calculation

```
camper_age_on_start = session_start_date - camper_date_of_birth
```

---

## Error Handling

### Common Error Scenarios

| Scenario | Handling | Mitigation |
|----------|----------|------------|
| Concurrent updates | Last write wins (Eloquent) | Frontend optimistic locking with versioning |
| Provider link expires during submit | HTTP 410 Gone | Parent generates new link, provider restarts |
| Reversal (Approved → Rejected) | Allowed. Deactivates camper + medical record if no other approved app. | Admin uses "Reverse Decision" button in review panel. |
| Admin cancellation (Approved → Cancelled) | Allowed. Same deactivation logic as reversal. | Admin uses "Cancel Enrollment" button. |
| Parent withdrawal | POST /applications/{id}/withdraw → status=withdrawn. Deactivates if approved and no other app. | Parent sees "Withdraw application" button on detail page. |
| Rejected → Pending or UnderReview | Not allowed (HTTP 422). Rejected can only re-approve. | Re-approval is the only path forward from rejected. |
| Duplicate provider submission | Link marked used on first attempt, subsequent=410 | Disable submit button after click |
| Session deletion with apps | HTTP 422 with descriptive message, deletion blocked | Archive the session or cancel/transfer applications first |
| Parent viewing others' apps | Policy filters, only own apps visible | Query scope: `where('campers.user_id', auth()->id())` |

---

## Dynamic Form Schema Integration (Phase 14)

When an applicant begins a new application, the system fetches the currently active form schema from `GET /api/form/active`. The response contains:
- The form definition version
- All active sections in display order
- All active fields per section, including type, label, validation rules, and options (for select/radio/checkbox fields)

The `form_definition_id` is stored on the application record at creation time, linking that application to the specific form version used. This ensures that historical applications can be rendered correctly even after the form schema is updated.

**Key behaviors:**
- If no form definition is published, the application form falls back to the hardcoded form structure. The applicant experience is preserved regardless of whether a dynamic schema exists.
- Field keys are the stable identifiers linking form field definitions to application data. Once an application references a field key, that key is immutable.
- The schema is cached for 10 minutes. Form builder changes made by a super administrator take effect for new sessions within 10 minutes.

---

## Document Request Workflow Integration (Phase 13)

The document request system runs in parallel with the application lifecycle. Document requests are not a blocking step in the application status workflow — an application can be approved or rejected regardless of outstanding document requests.

**Typical workflow:**

```
Admin creates document request (POST /api/document-requests)
    ↓
Applicant receives system inbox notification
    ↓
Applicant uploads document (POST /api/applicant/document-requests/{id}/upload)
    ↓
Status transitions: awaiting_upload → uploaded → scanning → under_review
    ↓
Admin reviews and approves or rejects
    ↓
Applicant receives inbox message with decision
```

**Status notifications:** Each status change triggers an inbox message appended to the original system conversation thread, ensuring the applicant has a complete communication history in one place.

**Expiration:** If the applicant does not upload by the `due_date`, the system marks the request as `overdue`. The admin can extend the deadline at any time.

---

## Cross-References

For related documentation, see:

- [API Reference](./API_REFERENCE.md) — Endpoint specifications
- [Data Model](./DATA_MODEL.md) — Database schema
- [Business Rules](./BUSINESS_RULES.md) — Complete rule catalog
- [Roles and Permissions](./ROLES_AND_PERMISSIONS.md) — Authorization matrix
- [Audit Logging](./AUDIT_LOGGING.md) — PHI access tracking
- [Error Handling](./ERROR_HANDLING.md) — Error patterns

---

**Document Status:** Current — updated to reflect corrected state transition rules, camper/medical record activation lifecycle, and transactional review workflow.
**Last Updated:** 2026-03-24
**Version:** 2.0.0
