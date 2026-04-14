# Application Workflows

This document provides a comprehensive overview of the application lifecycle, state transitions, and workflow processes within the Camp Burnt Gin API system. It describes how applications progress from creation through submission, review, and final decision.

---

## Table of Contents

1. [Workflow Overview](#workflow-overview)
2. [Application States](#application-states)
3. [State Transitions](#state-transitions)
4. [Application Creation Flow](#application-creation-flow)
5. [Draft Mode Workflow](#draft-mode-workflow)
6. [Submission Workflow](#submission-workflow)
7. [Digital Signature Workflow](#digital-signature-workflow)
8. [Review Workflow](#review-workflow)
9. [Decision Notification Workflow](#decision-notification-workflow)
10. [Medical Provider Integration Workflow](#medical-provider-integration-workflow)
11. [Business Rules and Constraints](#business-rules-and-constraints)
12. [Error Handling and Edge Cases](#error-handling-and-edge-cases)

---

## Workflow Overview

The application workflow manages the complete lifecycle of camp registration applications, from initial creation through final acceptance or rejection. The workflow enforces business rules, maintains data integrity, and ensures proper authorization at each stage.

### Key Components

| Component | Role |
|-----------|------|
| Application Model | Represents registration request with status tracking |
| Camper\ApplicationController | Handles API requests for application operations |
| Camper\ApplicationService | Manages application approval workflow and compliance |
| ApplicationPolicy | Enforces authorization rules |
| ApplicationStatus Enum | Defines valid states and transitions |
| Notification System | Alerts users of status changes |
| Audit Logging | Records all state transitions for compliance |

### Workflow Participants

| Participant | Role | Actions |
|-------------|------|---------|
| Parent | Application creator | Create, edit, sign, cancel applications |
| Medical Provider | Healthcare professional | Submit medical information via secure link |
| Administrator | Camp staff | Review, approve, reject, or waitlist applications |
| System | Automated process | Send notifications, enforce deadlines, log events |

---

## Application States

The ApplicationStatus enum defines six possible states for an application:

### State Definitions

| State | Value | Description | Is Final | Is Editable |
|-------|-------|-------------|----------|-------------|
| Pending | `pending` | Initial state, not yet submitted | No | Yes |
| Under Review | `under_review` | Submitted and being reviewed | No | Yes |
| Approved | `approved` | Accepted for camp attendance | Yes | No |
| Rejected | `rejected` | Not accepted | Yes | No |
| Waitlisted | `waitlisted` | Placed on waiting list | No | No |
| Cancelled | `cancelled` | Cancelled by parent | Yes | No |

### State Properties

#### Final States

Final states represent terminal decisions that cannot be reversed:

- **Approved** — Camper accepted, enrollment confirmed
- **Rejected** — Application denied
- **Cancelled** — Application withdrawn by parent

Once an application reaches a final state, no further status changes are permitted.

#### Editable States

Applications can be modified by parents or admins during these states:

- **Pending** — Before submission
- **Under Review** — During administrative review

Once approved, rejected, or cancelled, the application becomes read-only.

---

## State Transitions

### Valid Transition Matrix

```
┌──────────────┐
│   Pending    │
│  (is_draft)  │
└──────┬───────┘
       │ Submit
       ▼
┌──────────────┐     Review     ┌───────────┐
│ Under Review │ ──────────────► │ Approved  │ (Final)
│              │                 └───────────┘
└──────┬───────┘
       │
       │ Review     ┌───────────┐
       ├───────────► │ Rejected  │ (Final)
       │            └───────────┘
       │
       │ Review     ┌─────────────┐     Review     ┌───────────┐
       └───────────► │ Waitlisted  │ ─────────────► │ Approved  │
                    └─────┬───────┘                └───────────┘
                          │
                          │ Review
                          ▼
                    ┌───────────┐
                    │ Rejected  │ (Final)
                    └───────────┘

Parent can cancel at any time before final state:
    ┌───────────────────────────────┐
    │  Any Non-Final State          │
    └───────────┬───────────────────┘
                │ Parent Cancel
                ▼
          ┌───────────┐
          │ Cancelled │ (Final)
          └───────────┘
```

### Transition Rules

| From State | To State | Trigger | Actor | Conditions |
|------------|----------|---------|-------|------------|
| Pending | Under Review | Submit | Parent | Signature required, draft = false |
| Under Review | Approved | Review decision | Admin | Review notes optional |
| Under Review | Rejected | Review decision | Admin | Review notes required |
| Under Review | Waitlisted | Review decision | Admin | Review notes optional |
| Waitlisted | Approved | Review decision | Admin | Space becomes available |
| Waitlisted | Rejected | Review decision | Admin | No space available |
| Any non-final | Cancelled | Cancellation | Parent | Cannot cancel after final decision |

### Prevented Transitions

The following transitions are explicitly forbidden:

- Cannot transition from any final state (approved, rejected, cancelled)
- Cannot skip from pending directly to approved/rejected (must go through under_review)
- Cannot move from rejected back to any other state
- Cannot move from cancelled back to any other state
- Cannot return to pending once submitted

---

## Application Creation Flow

### Initial Creation

```
1. Parent authenticates via API
      │
      ▼
2. Parent selects camp session
      │
      ▼
3. Parent selects or creates camper profile
      │
      ▼
4. System validates unique constraint (one application per camper per session)
      │
      ▼
5. Application created with status = pending, is_draft = true
      │
      ▼
6. System returns application ID and editable flag = true
```

### Required Data

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| camper_id | Integer | Yes | Must exist, owned by authenticated parent |
| camp_session_id | Integer | Yes | Must exist, session must be active |
| is_draft | Boolean | No | Defaults to true |
| status | Enum | No | Defaults to pending |

### Uniqueness Constraint

The system enforces a unique constraint: one application per camper per camp session. Attempting to create a duplicate returns HTTP 422 with validation error.

**Database Constraint:**
```sql
UNIQUE KEY unique_application (camper_id, camp_session_id)
```

---

## Draft Mode Workflow

Draft mode allows parents to save incomplete applications and return later to complete them.

### Draft Characteristics

| Property | Value |
|----------|-------|
| is_draft | true |
| status | pending |
| submitted_at | NULL |
| Editable | Yes |
| Visible to admin | No (filtered out of review queue) |
| Can be deleted | Yes |

### Draft Operations

#### Save Draft
```
POST /api/applications
{
  "camper_id": 1,
  "camp_session_id": 2,
  "is_draft": true,
  "notes": "Partial application data"
}
```

**Response:** HTTP 201 with application object

#### Update Draft
```
PUT /api/applications/{id}
{
  "notes": "Updated application data",
  "is_draft": true
}
```

**Response:** HTTP 200 with updated application

#### Convert Draft to Submission

To submit a draft application, the parent must:

1. Complete digital signature
2. Set `is_draft` to `false`
3. Submit via PUT request

The system validates completeness and transitions to `under_review` status.

---

## Submission Workflow

### Submission Process

```
1. Parent reviews draft application
      │
      ▼
2. Parent adds digital signature
      │
      ▼
3. Parent sets is_draft = false
      │
      ▼
4. System validates application completeness
      │
      ├─► Validation fails: HTTP 422 with errors
      │
      └─► Validation passes
            │
            ▼
      5. System updates:
         - is_draft = false
         - status = under_review
         - submitted_at = current timestamp
            │
            ▼
      6. System logs submission event
            │
            ▼
      7. System queues notification to parent
            │
            ▼
      8. System returns HTTP 200 with updated application
```

### Submission Requirements

Before an application can be submitted, the following must be complete:

| Requirement | Validation |
|-------------|------------|
| Camper profile | Must exist with complete information |
| Camp session | Must be active and within registration window |
| Digital signature | Must have signature_data, signature_name, signed_at |
| Medical information | Medical record recommended but not required |
| Emergency contacts | At least one contact recommended |

### Submission Endpoint

```
PUT /api/applications/{id}
{
  "is_draft": false
}
```

**Authorization:** Parent must own the camper, or user must be admin.

**Response:**
```json
{
  "id": 1,
  "camper_id": 1,
  "camp_session_id": 2,
  "status": "under_review",
  "is_draft": false,
  "submitted_at": "2026-02-11T10:30:00.000000Z",
  "signature_name": "Jane Doe",
  "signed_at": "2026-02-11T10:29:45.000000Z"
}
```

---

## Digital Signature Workflow

Digital signatures provide legal acknowledgment and consent for the application.

### Signature Components

| Component | Description | Storage |
|-----------|-------------|---------|
| signature_data | Base64-encoded signature image | Database (hidden from API responses) |
| signature_name | Printed name of signer | Database |
| signed_at | Timestamp of signature | Database |
| signed_ip_address | IP address of signer | Database |

### Signature Process

```
1. Parent completes application form
      │
      ▼
2. Frontend displays signature canvas
      │
      ▼
3. Parent signs using mouse/touch input
      │
      ▼
4. Frontend converts signature to base64 image
      │
      ▼
5. Frontend submits signature via API:
   POST /api/applications/{id}/sign
   {
     "signature_data": "data:image/png;base64,...",
     "signature_name": "Jane Doe"
   }
      │
      ▼
6. System validates and stores:
   - signature_data (hidden from responses)
   - signature_name
   - signed_at = current timestamp
   - signed_ip_address = request IP
      │
      ▼
7. System returns HTTP 200 with confirmation
```

### Signature Endpoint

```
POST /api/applications/{id}/sign
```

**Request Body:**
```json
{
  "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "signature_name": "Jane Doe"
}
```

**Validation Rules:**
- `signature_data` — Required, must be valid base64 string
- `signature_name` — Required, string, max 255 characters

**Authorization:** Parent must own the camper, or user must be admin.

**Response:**
```json
{
  "id": 1,
  "signature_name": "Jane Doe",
  "signed_at": "2026-02-11T10:30:00.000000Z",
  "is_signed": true
}
```

---

## Review Workflow

Administrative review is the process by which camp staff evaluate and make decisions on submitted applications.

### Review Process

```
1. Admin logs into system
      │
      ▼
2. Admin navigates to applications list
   GET /api/applications?status=under_review
      │
      ▼
3. Admin views individual application
   GET /api/applications/{id}
      │
      ▼
4. Admin reviews:
   - Camper information
   - Medical records
   - Emergency contacts
   - Application notes
      │
      ▼
5. Admin makes decision:
   POST /api/applications/{id}/review
   {
     "status": "approved",
     "notes": "Application meets all requirements"
   }
      │
      ▼
6. System validates decision
      │
      ├─► Invalid: HTTP 422 with errors
      │
      └─► Valid
            │
            ▼
      7. System updates:
         - status = new status
         - reviewed_at = timestamp
         - reviewed_by = admin user ID
         - notes = review notes
            │
            ▼
      8. System logs review event to audit log
            │
            ▼
      9. System queues status change notification to parent
            │
            ▼
     10. If approved: System generates acceptance letter
            │
            ▼
     11. If rejected: System generates rejection letter
            │
            ▼
     12. System returns HTTP 200 with updated application
```

### Review Endpoint

```
POST /api/applications/{id}/review
```

**Request Body:**
```json
{
  "status": "approved",
  "notes": "Application approved. Camper meets age requirements and medical information is complete."
}
```

**Validation Rules:**
- `status` — Required, must be one of: approved, rejected, waitlisted
- `notes` — Required for rejected status, optional for approved/waitlisted

**Authorization:** Admin only.

**Response:**
```json
{
  "id": 1,
  "status": "approved",
  "reviewed_at": "2026-02-11T14:30:00.000000Z",
  "reviewed_by": 5,
  "notes": "Application approved. Camper meets age requirements.",
  "reviewer": {
    "id": 5,
    "name": "Admin User",
    "email": "admin@campburntgin.org"
  }
}
```

---

## Decision Notification Workflow

When an application receives a final decision, the system automatically notifies the parent via email and in-app notification.

### Notification Triggers

| Event | Trigger | Recipients |
|-------|---------|------------|
| Application Submitted | status changes to under_review | Parent |
| Application Approved | status changes to approved | Parent |
| Application Rejected | status changes to rejected | Parent |
| Application Waitlisted | status changes to waitlisted | Parent |

### Approval Notification Flow

```
1. Admin approves application
      │
      ▼
2. System updates application status = approved
      │
      ▼
3. System generates acceptance letter via LetterService
      │
      ▼
4. System queues AcceptanceLetterNotification job
      │
      ▼
5. Job dispatches to notifications queue
      │
      ▼
6. Background worker processes notification:
   - Creates database notification record
   - Sends email to parent with acceptance letter
      │
      ▼
7. Parent receives email with:
   - Congratulations message
   - Camp session details
   - Next steps instructions
   - Acceptance letter attachment (if configured)
```

### Rejection Notification Flow

```
1. Admin rejects application
      │
      ▼
2. System updates application status = rejected
      │
      ▼
3. System generates rejection letter via LetterService
      │
      ▼
4. System queues RejectionLetterNotification job
      │
      ▼
5. Job dispatches to notifications queue
      │
      ▼
6. Background worker processes notification:
   - Creates database notification record
   - Sends email to parent with rejection letter
      │
      ▼
7. Parent receives email with:
   - Polite rejection message
   - Explanation (if provided in notes)
   - Encouragement to apply for future sessions
```

### Notification Jobs

| Job | Purpose | Retry Policy |
|-----|---------|--------------|
| SendNotificationJob | Dispatch email notifications | 3 attempts with exponential backoff |

**Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: After 60 seconds
- Attempt 3: After 5 minutes
- Attempt 4: After 15 minutes

---

## Medical Provider Integration Workflow

The medical provider workflow allows healthcare professionals to submit medical information securely without requiring system authentication.

### Provider Link Creation

```
1. Parent logs into system
      │
      ▼
2. Parent navigates to camper medical records
      │
      ▼
3. Parent clicks "Request Medical Provider Input"
      │
      ▼
4. Parent enters provider email and optional message
   POST /api/medical-provider-links
   {
     "camper_id": 1,
     "provider_email": "doctor@example.com",
     "message": "Please complete medical form for camp"
   }
      │
      ▼
5. System generates:
   - 64-character cryptographically secure token
   - Expiration timestamp (72 hours default)
   - Unique link URL
      │
      ▼
6. System stores link record:
   - token (plaintext for lookup)
   - camper_id
   - provider_email
   - expires_at
   - is_used = false
   - revoked_at = NULL
      │
      ▼
7. System queues ProviderLinkCreatedNotification
      │
      ▼
8. System returns HTTP 201 with link details
```

### Provider Submission Flow

```
1. Provider receives email with secure link
      │
      ▼
2. Provider clicks link
   GET /api/provider-access/{token}
      │
      ▼
3. System validates token:
   - Token exists
   - Not expired (expires_at > now)
   - Not used (is_used = false)
   - Not revoked (revoked_at = NULL)
      │
      ├─► Invalid: HTTP 404 or 410 (Gone)
      │
      └─► Valid
            │
            ▼
      4. System displays medical information form
         - Camper name (read-only)
         - Medical questions
         - Document upload capability
            │
            ▼
      5. Provider completes form and submits
         POST /api/provider-access/{token}/submit
         {
           "medical_record": {...},
           "allergies": [...],
           "medications": [...]
         }
            │
            ▼
      6. System validates submission
            │
            ├─► Invalid: HTTP 422 with errors
            │
            └─► Valid
                  │
                  ▼
            7. System updates/creates medical records
                  │
                  ▼
            8. System marks link as used:
               - is_used = true
               - used_at = timestamp
                  │
                  ▼
            9. System logs provider submission to audit log
                  │
                  ▼
           10. System queues notifications:
               - ProviderSubmissionReceivedNotification to parent
               - ProviderSubmissionReceivedNotification to admin
                  │
                  ▼
           11. System returns HTTP 200 with success message
```

### Provider Link Revocation

Parents or administrators can revoke provider links at any time:

```
DELETE /api/medical-provider-links/{id}
```

**Effect:**
- Sets `revoked_at` to current timestamp
- Sets `revoked_by` to user ID
- Link immediately becomes invalid
- Provider receives no notification (security consideration)

---

## Business Rules and Constraints

### Application Uniqueness

Each camper can have only one application per camp session.

**Enforcement:** Database unique constraint on `(camper_id, camp_session_id)`

**Error Response:** HTTP 422
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "camper_id": ["This camper already has an application for this session."]
  }
}
```

### Session Registration Windows

Applications can only be created during the session's registration window.

**Validation:** Session must meet:
- `registration_opens_at` <= current date
- `registration_closes_at` >= current date

**Error Response:** HTTP 422
```json
{
  "message": "Registration is not currently open for this session."
}
```

### Age Requirements

Campers must meet session age requirements on the session start date.

**Calculation:**
```
camper_age_on_start_date = session_start_date - camper_date_of_birth
```

**Validation:**
- `camper_age_on_start_date` >= `session.min_age`
- `camper_age_on_start_date` <= `session.max_age`

**Error Response:** HTTP 422
```json
{
  "message": "Camper does not meet age requirements for this session."
}
```

### Capacity Limits

Sessions have maximum capacity limits.

**Validation:** Count of approved applications < session capacity

**Behavior:** Applications can be waitlisted when capacity is reached.

### Signature Requirements

Applications cannot be submitted without a digital signature.

**Validation:**
- `signature_data` must be present
- `signature_name` must be present
- `signed_at` must be present

**Error Response:** HTTP 422
```json
{
  "message": "Application must be signed before submission."
}
```

---

## Error Handling and Edge Cases

### Concurrent Updates

**Scenario:** Two users attempt to update the same application simultaneously.

**Handling:** Last write wins. Laravel's Eloquent ORM handles database-level locking.

**Mitigation:** Frontend should implement optimistic locking with version checking.

### Provider Link Expiration During Submission

**Scenario:** Provider begins form but link expires before submission.

**Handling:** Submission returns HTTP 410 (Gone) with clear error message.

**Mitigation:** Parents can generate new link. Provider must restart submission.

### Application Cancellation After Approval

**Scenario:** Parent attempts to cancel application after it has been approved.

**Handling:** HTTP 422 with error message.

**Resolution:** Parent must contact administrator directly.

### Medical Provider Submits Duplicate Data

**Scenario:** Provider clicks submit button multiple times.

**Handling:** Link is marked as used on first submission. Subsequent attempts return HTTP 410.

**Mitigation:** Frontend should disable submit button after first click.

### Session Deletion with Active Applications

**Scenario:** Administrator attempts to delete session with existing applications.

**Handling:** Database foreign key constraint prevents deletion. HTTP 500 with generic error.

**Resolution:** Applications must be cancelled or session must be soft-deleted (marked inactive).

### Application Filtering by Parent

**Scenario:** Parent attempts to view applications for campers they don't own.

**Handling:** Policy authorization filters results. Parent only sees their own campers' applications.

**Implementation:** Query scope automatically applies `where('campers.user_id', auth()->id())`

---

## Cross-References

For related documentation, see:

- [API Reference](./API_REFERENCE.md) — Detailed endpoint specifications
- [Data Model](./DATA_MODEL.md) — Database schema and relationships
- [Business Rules](./BUSINESS_RULES.md) — Complete business rule catalog
- [Roles and Permissions](./ROLES_AND_PERMISSIONS.md) — Authorization matrix
- [Audit Logging](./AUDIT_LOGGING.md) — PHI access tracking and compliance
- [Error Handling](./ERROR_HANDLING.md) — Error response patterns

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
