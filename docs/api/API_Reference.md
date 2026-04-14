# API Overview

This document provides a high-level overview of the Camp Burnt Gin API, including authentication, role-based access, endpoint categories, and usage conventions. For detailed endpoint specifications, request/response formats, and code examples, refer to [API_REFERENCE.md](API_REFERENCE.md).

---

## 1. Introduction

The Camp Burnt Gin API is a RESTful backend designed to support camp registration, medical records management, application processing, and administrative reporting. The API serves as the authoritative data source for all camp operations and is built to handle Protected Health Information (PHI) in compliance with HIPAA security requirements.

### Target Users

| User Type | Description | Primary Use Cases |
|-----------|-------------|-------------------|
| **Super Admin** | System owners and primary administrators | Role management, delegation governance, all admin capabilities |
| **Admin** | Camp administrators and operational staff | Application review, camp management, reporting, system administration |
| **Parent/Guardian** | Parents registering campers | Camper registration, application submission, medical records, document uploads |
| **Medical Provider** | Healthcare professionals (token-based) | Medical information submission via secure token (no account required) |

---

## 2. Base URL

All API endpoints are prefixed with `/api/`:

```
https://api.campburntgin.org/api/
```

**Example Request:**
```
GET https://api.campburntgin.org/api/campers
```

---

## 3. Authentication

### Token-Based Authentication

The API uses **Laravel Sanctum** for token-based authentication. Most endpoints require a valid authentication token.

### Obtaining a Token

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
    "email": "parent@example.com",
    "password": "SecurePassword123"
}
```

**Response:**
```json
{
    "user": {
        "id": 1,
        "name": "Jane Doe",
        "email": "applicant@example.com",
        "role": "applicant"
    },
    "token": "1|AbCdEfGhIjKlMnOpQrStUvWxYz1234567890..."
}
```

### Using the Token

Include the token in the `Authorization` header of all subsequent requests:

```http
Authorization: Bearer 1|AbCdEfGhIjKlMnOpQrStUvWxYz1234567890...
Content-Type: application/json
Accept: application/json
```

### Token Expiration

- Tokens expire after 30 minutes of inactivity
- Expired tokens return `401 Unauthorized`
- Clients should handle 401 responses by redirecting to login

### Public Endpoints

The following endpoints do not require authentication:
- `POST /api/auth/register` — User registration
- `POST /api/auth/login` — User login
- `POST /api/auth/forgot-password` — Password reset request
- `POST /api/auth/reset-password` — Password reset completion
- `GET /api/camps` — List active camps (public view)
- `GET /api/sessions` — List active sessions (public view)
- `GET /api/provider-access/{token}` — Medical provider access (token-based)

---

## 4. Role Access Model

The API implements role-based access control (RBAC) with a four-tier hierarchical role system:

**Hierarchy:** super_admin > admin > applicant > medical

| Role | Access Scope | Key Permissions |
|------|--------------|-----------------|
| **super_admin** | Absolute system authority | All admin permissions plus: assign/modify roles, create/delete role definitions, promote/demote users, delegation governance |
| **admin** | Full operational access | View all data, review applications, manage camps/sessions, generate reports, access audit logs, moderate conversations |
| **parent** | Own resources only | Create/view/edit own campers and applications, manage medical records for own campers, upload documents, create conversations with admins |
| **medical** | Read-only medical access | View medical records, allergies, medications for all campers (audit logged, no modification rights) |
| **provider** | Token-specific access | Submit medical information for linked camper (no user account, access via secure token) |

### Authorization Enforcement

- **Route-Level** — Middleware restricts entire endpoints by role
- **Resource-Level** — Policies verify ownership and relationships (RolePolicy for delegation governance)
- **Field-Level** — Sensitive fields hidden based on role (e.g., SSNs, full medical records)
- **Model-Level** — Safeguards prevent deletion of last super_admin

### Hierarchical Authority

- **super_admin** inherits all **admin** privileges via isAdmin() override
- **admin** retains full operational authority but cannot manage roles
- Only **super_admin** can assign roles or promote users
- Last **super_admin** cannot be deleted or demoted

### Example Authorization Rules

| Action | Super Admin | Admin | Parent | Medical | Provider |
|--------|-------------|-------|--------|---------|----------|
| Assign user roles |  Yes |  No |  No |  No |  No |
| View all campers |  Yes |  Yes |  No (own only) |  No |  No |
| Edit camper profile |  Yes |  Yes |  Yes (own only) |  No |  No |
| Review application |  Yes |  Yes |  No |  No |  No |
| View medical records |  Yes |  Yes |  Yes (own campers) |  Yes (all, read-only) |  No |
| Submit medical info |  Yes |  Yes |  Yes (own campers) |  No |  Yes (linked camper only) |
| Generate reports |  Yes |  Yes |  No |  No |  No |

---

## 5. Endpoint Categories

### Authentication

User registration, login, logout, and password management.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `POST` | `/api/auth/register` | Create new parent account | Public |
| `POST` | `/api/auth/login` | Authenticate and receive token | Public |
| `POST` | `/api/auth/logout` | Revoke current token | Authenticated |
| `POST` | `/api/auth/forgot-password` | Request password reset link | Public |
| `POST` | `/api/auth/reset-password` | Complete password reset | Public (with token) |
| `POST` | `/api/auth/email/verify` | Verify email address | Authenticated |
| `POST` | `/api/auth/email/resend` | Resend email verification link | Authenticated |

**Key Features:**
- Email/password authentication
- Account lockout after 5 failed attempts
- Password reset via email link
- Token revocation on logout

---

### Multi-Factor Authentication (MFA)

TOTP-based two-factor authentication for enhanced security.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `POST` | `/api/mfa/setup` | Generate MFA secret and QR code | Authenticated |
| `POST` | `/api/mfa/verify` | Verify code and enable MFA | Authenticated |
| `POST` | `/api/mfa/disable` | Disable MFA on account | Authenticated |

**Key Features:**
- Google Authenticator / Authy compatible
- 6-digit TOTP codes
- QR code for easy setup
- Optional (not required by default)

---

### User Profile

Manage authenticated user's account information.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/profile/` | Get current user profile | Authenticated |
| `PUT` | `/api/profile/` | Update profile (name, email) | Authenticated |
| `GET` | `/api/profile/prefill` | Get pre-filled data for returning families | Authenticated |
| `GET` | `/api/profile/notification-preferences` | Get notification preferences | Authenticated |
| `PUT` | `/api/profile/notification-preferences` | Update notification preferences | Authenticated |
| `PUT` | `/api/profile/password` | Change password | Authenticated |
| `POST` | `/api/profile/avatar` | Upload avatar | Authenticated (throttle: uploads) |
| `DELETE` | `/api/profile/avatar` | Remove avatar | Authenticated |
| `GET` | `/api/profile/emergency-contacts` | List user's emergency contacts | Authenticated |
| `POST` | `/api/profile/emergency-contacts` | Add emergency contact | Authenticated |
| `PUT` | `/api/profile/emergency-contacts/{contact}` | Update emergency contact | Authenticated |
| `DELETE` | `/api/profile/emergency-contacts/{contact}` | Delete emergency contact | Authenticated |
| `DELETE` | `/api/profile/account` | Delete account | Authenticated (throttle: sensitive) |

**Key Features:**
- Profile information management
- Pre-fill data for returning applicants
- Email change with verification
- Notification preference management
- Avatar upload and removal
- User-level emergency contact management
- Account deletion

---

### Camps

Manage camp programs and their details.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/camps` | List all camps | Public (active) / Admin (all) |
| `GET` | `/api/camps/{id}` | View camp details | Public |
| `POST` | `/api/camps` | Create new camp | Admin |
| `PUT` | `/api/camps/{id}` | Update camp information | Admin |
| `DELETE` | `/api/camps/{id}` | Delete camp | Admin |

**Key Features:**
- Camp program management
- Active/inactive status control
- Location and description information

---

### Camp Sessions

Manage camp sessions with dates, capacity, and age requirements.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/sessions` | List all sessions | Public (active) / Admin (all) |
| `GET` | `/api/sessions/{session}` | View session details | Public |
| `POST` | `/api/sessions` | Create new session | Admin |
| `PUT` | `/api/sessions/{session}` | Update session | Admin |
| `DELETE` | `/api/sessions/{session}` | Delete session | Admin |

**Key Features:**
- Session scheduling (start/end dates)
- Capacity management
- Age restrictions (min/max age)
- Registration window (open/close dates)

---

### Campers

Manage camper profiles linked to parent accounts.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/campers` | List campers | Admin (all) / Parent (own) |
| `GET` | `/api/campers/{id}` | View camper details | Admin / Parent (own) |
| `POST` | `/api/campers` | Register new camper | Admin / Parent |
| `PUT` | `/api/campers/{id}` | Update camper profile | Admin / Parent (own) |
| `DELETE` | `/api/campers/{id}` | Delete camper | Admin / Parent (own) |

**Key Features:**
- Basic profile (name, DOB, gender)
- Parent/guardian association
- Related medical records and applications

---

### Applications

Manage the complete application lifecycle from submission to final decision.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/applications` | List applications with filtering | Admin (all) / Parent (own) |
| `GET` | `/api/applications/{id}` | View application details | Admin / Parent (own) |
| `POST` | `/api/applications` | Create new application | Admin / Parent |
| `PUT` | `/api/applications/{id}` | Update application (if editable) | Admin / Parent (own) |
| `POST` | `/api/applications/{id}/sign` | Add digital signature | Parent (own) |
| `POST` | `/api/applications/{id}/review` | Approve/reject/waitlist | Admin |
| `DELETE` | `/api/applications/{id}` | Delete application | Admin |

**Key Features:**
- Draft mode with auto-save
- Digital signature capture
- Status workflow (pending → under review → approved/rejected/waitlisted)
- Search and filtering (by status, session, camper)
- Admin review with notes
- Automatic acceptance/rejection letters

**Application Status Flow:**
```
Draft (pending) → Under Review → Approved (final)
                              → Rejected (final)
                              → Waitlisted
```

---

### Medical Records

Manage Protected Health Information (PHI) for campers.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/medical-records` | List medical records | Admin / Parent (own) |
| `GET` | `/api/medical-records/{id}` | View record details | Admin / Parent (own) |
| `POST` | `/api/medical-records` | Create medical record | Admin / Parent |
| `PUT` | `/api/medical-records/{id}` | Update medical record | Admin / Parent (own) |
| `DELETE` | `/api/medical-records/{id}` | Delete medical record | Admin |

**Key Features:**
- Physician information (name, phone)
- Insurance details (provider, policy number)
- Special needs and dietary restrictions
- All PHI access logged for HIPAA compliance

---

### Allergies

Manage allergy information for campers.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/allergies` | List allergies | Admin / Parent (own) |
| `GET` | `/api/allergies/{id}` | View allergy details | Admin / Parent (own) |
| `POST` | `/api/allergies` | Add allergy | Admin / Parent |
| `PUT` | `/api/allergies/{id}` | Update allergy | Admin / Parent (own) |
| `DELETE` | `/api/allergies/{id}` | Delete allergy | Admin / Parent (own) |

**Key Features:**
- Allergen identification
- Severity levels (mild, moderate, severe, life-threatening)
- Reaction description
- Treatment protocol

---

### Medications

Manage medication information for campers.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/medications` | List medications | Admin / Parent (own) |
| `GET` | `/api/medications/{id}` | View medication details | Admin / Parent (own) |
| `POST` | `/api/medications` | Add medication | Admin / Parent |
| `PUT` | `/api/medications/{id}` | Update medication | Admin / Parent (own) |
| `DELETE` | `/api/medications/{id}` | Delete medication | Admin / Parent (own) |

**Key Features:**
- Medication name and dosage
- Frequency and administration time
- Prescribing physician
- Purpose and additional notes

---

### Emergency Contacts

Manage emergency contact information for campers.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/emergency-contacts` | List emergency contacts | Admin / Parent (own) |
| `GET` | `/api/emergency-contacts/{id}` | View contact details | Admin / Parent (own) |
| `POST` | `/api/emergency-contacts` | Add contact | Admin / Parent |
| `PUT` | `/api/emergency-contacts/{id}` | Update contact | Admin / Parent (own) |
| `DELETE` | `/api/emergency-contacts/{id}` | Delete contact | Admin / Parent (own) |

**Key Features:**
- Contact name and relationship
- Primary and secondary phone numbers
- Email address
- Primary contact designation
- Authorized pickup flag

---

### Medical Provider Links

Generate secure tokens for healthcare providers to submit medical information.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/provider-links` | List generated links | Admin / Parent (own) |
| `POST` | `/api/provider-links` | Create provider link | Admin / Parent |
| `GET` | `/api/provider-links/{id}` | View link details | Admin / Parent (own) |
| `POST` | `/api/provider-links/{id}/revoke` | Revoke link | Admin / Parent (own) |
| `POST` | `/api/provider-links/{id}/resend` | Resend notification email | Admin |

**Provider Submission (Token-Based, No Authentication):**

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/provider-access/{token}` | View submission form | Token bearer |
| `POST` | `/api/provider-access/{token}/submit` | Submit medical information | Token bearer |
| `POST` | `/api/provider-access/{token}/documents` | Upload supporting documents | Token bearer |

**Key Features:**
- 64-character cryptographically secure tokens
- 72-hour expiration (configurable)
- Single-use enforcement
- Email notification to provider
- Revocation capability
- Access logging

---

### Documents

Manage secure file uploads and downloads.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/documents` | List accessible documents | Authenticated |
| `POST` | `/api/documents` | Upload new document | Authenticated |
| `GET` | `/api/documents/{id}` | View document metadata | Owner / Admin |
| `GET` | `/api/documents/{id}/download` | Download document file | Owner / Admin |
| `DELETE` | `/api/documents/{id}` | Delete document | Owner / Admin |

**Key Features:**
- Supported file types: PDF, images (JPG, PNG, GIF), Word documents
- Maximum file size: 10 MB
- MIME type validation
- Security scanning (async)
- Unscanned files blocked from download (non-admin)
- Polymorphic attachment to campers, applications, medical records

---

### Notifications

Manage user notifications and read status.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/notifications` | List user's notifications | Authenticated |
| `PUT` | `/api/notifications/{notification}/read` | Mark notification as read | Authenticated |
| `PUT` | `/api/notifications/read-all` | Mark all notifications as read | Authenticated |
| `DELETE` | `/api/notifications/clear-all` | Delete all notifications | Authenticated |

**Key Features:**
- Email and database notification channels
- Unread notification count
- Automatic notifications for application status changes
- Provider link status updates
- Acceptance/rejection letter delivery

---

### Reports

Generate administrative reports for camp management.

**All reporting endpoints require admin role.**

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/reports/applications` | Applications summary report | Admin |
| `GET` | `/api/reports/accepted` | Accepted applicants report | Admin |
| `GET` | `/api/reports/rejected` | Rejected applicants report | Admin |
| `GET` | `/api/reports/mailing-labels` | Mailing label data | Admin |
| `GET` | `/api/reports/id-labels` | ID badge data with allergy flags | Admin |

**Key Features:**
- Filtering by status, session, date range
- CSV export capability
- Summary statistics
- Camper age calculation
- Allergy flagging for ID badges

---

### Inbox Endpoints

Secure internal messaging system for threaded conversations between users.

**All Inbox endpoints require authentication.**

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/inbox/conversations` | List user's conversations | Authenticated |
| `POST` | `/api/inbox/conversations` | Create new conversation | Authenticated |
| `GET` | `/api/inbox/conversations/{id}` | View conversation details | Participant |
| `POST` | `/api/inbox/conversations/{id}/archive` | Archive conversation | Participant |
| `POST` | `/api/inbox/conversations/{id}/unarchive` | Unarchive conversation | Participant |
| `POST` | `/api/inbox/conversations/{id}/participants` | Add participant | Participant / Admin |
| `DELETE` | `/api/inbox/conversations/{id}/participants/{user}` | Remove participant | Participant / Admin |
| `POST` | `/api/inbox/conversations/{id}/leave` | Leave conversation | Participant |
| `DELETE` | `/api/inbox/conversations/{id}` | Delete conversation | Admin |
| `GET` | `/api/inbox/conversations/{id}/messages` | List messages in conversation | Participant |
| `POST` | `/api/inbox/conversations/{id}/messages` | Send message | Participant |
| `GET` | `/api/inbox/messages/{id}` | View specific message | Participant |
| `GET` | `/api/inbox/messages/unread-count` | Get unread message count | Authenticated |
| `GET` | `/api/inbox/messages/{id}/attachments/{document}` | Download message attachment | Participant |
| `DELETE` | `/api/inbox/messages/{id}` | Delete message | Admin |

**Key Features:**
- Threaded conversations with up to 10 participants
- Subject lines and conversation context (link to applications, campers, sessions)
- Read receipt tracking
- Message attachments (5 files per message, 10MB each)
- Archive/unarchive functionality
- Idempotent message sending
- Message immutability (no editing after creation)
- Unread count tracking
- RBAC enforcement (parents restricted to admin conversations)

**Endpoint Groups:**
- **Conversation Management**: 9 endpoints for conversation lifecycle
- **Message Operations**: 6 endpoints for sending, reading, and managing messages

---

### Announcements

Create, manage, and pin camp-wide announcements.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/announcements/` | List announcements | Authenticated |
| `GET` | `/api/announcements/{announcement}` | View announcement | Authenticated |
| `POST` | `/api/announcements/` | Create announcement | Admin |
| `PUT` | `/api/announcements/{announcement}` | Update announcement | Admin |
| `DELETE` | `/api/announcements/{announcement}` | Delete announcement | Admin |
| `POST` | `/api/announcements/{announcement}/pin` | Toggle pin status | Admin |

---

### Calendar Events

Manage the camp calendar.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/calendar/` | List calendar events | Authenticated |
| `GET` | `/api/calendar/{calendarEvent}` | View calendar event | Authenticated |
| `POST` | `/api/calendar/` | Create calendar event | Admin |
| `PUT` | `/api/calendar/{calendarEvent}` | Update calendar event | Admin |
| `DELETE` | `/api/calendar/{calendarEvent}` | Delete calendar event | Admin |

---

### User Management

Platform user administration (super_admin only).

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/users/` | List all users | Super Admin |
| `PUT` | `/api/users/{user}/role` | Update user role | Super Admin |
| `POST` | `/api/users/{user}/deactivate` | Deactivate user | Super Admin |
| `POST` | `/api/users/{user}/reactivate` | Reactivate user | Super Admin |

---

### Applicant Documents

Admin-to-applicant document distribution and collection.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `POST` | `/api/admin/documents/send` | Send document to applicant | Admin |
| `GET` | `/api/admin/documents` | List all applicant documents | Admin |
| `GET` | `/api/applicant/documents` | List own received documents | Applicant |
| `POST` | `/api/applicant/documents/upload` | Upload submitted document | Applicant |

---

### Document Requests

Structured lifecycle requests for applicant document submission.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/document-requests/stats` | Dashboard statistics | Admin |
| `GET` | `/api/document-requests` | List all requests | Admin |
| `POST` | `/api/document-requests` | Create request | Admin |
| `PATCH` | `/api/document-requests/{documentRequest}/approve` | Approve document | Admin |
| `PATCH` | `/api/document-requests/{documentRequest}/reject` | Reject document | Admin |
| `GET` | `/api/applicant/document-requests` | List own requests | Applicant |
| `POST` | `/api/applicant/document-requests/{documentRequest}/upload` | Upload document | Applicant |

---

### Application Form Management

Dynamic form builder for managing the camper application form schema.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/form/active` | Get active form schema | Authenticated |
| `GET` | `/api/form/definitions` | List form definitions | Admin |
| `POST` | `/api/form/definitions` | Create form definition | Super Admin |
| `POST` | `/api/form/definitions/{form}/publish` | Publish draft form | Super Admin |
| `POST` | `/api/form/definitions/{form}/duplicate` | Duplicate form | Super Admin |

**Key Features:**
- Dynamic form schema with sections, fields, and options
- Active form cached for 10 minutes
- field_key immutability enforced once applications reference the key
- Section, field, and option reordering supported

---

### System Health

Public liveness and readiness probes for infrastructure monitoring.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/health` | Liveness check | Public |
| `GET` | `/api/ready` | Readiness check | Public |

---

## 6. Request / Response Format

### Request Format

All requests must include the following headers:

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer {token}
```

**Example Request Body:**
```json
{
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "2015-06-15",
    "gender": "male"
}
```

### Response Format

#### Success Response (Single Resource)

```json
{
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "2015-06-15",
    "gender": "male",
    "created_at": "2024-01-15T10:30:00.000000Z",
    "updated_at": "2024-01-15T10:30:00.000000Z"
}
```

#### Success Response (Collection)

```json
{
    "data": [
        {
            "id": 1,
            "first_name": "John",
            "last_name": "Doe"
        },
        {
            "id": 2,
            "first_name": "Jane",
            "last_name": "Smith"
        }
    ],
    "meta": {
        "current_page": 1,
        "per_page": 15,
        "total": 42,
        "last_page": 3
    }
}
```

#### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| `200` | OK | Successful GET, PUT, PATCH requests |
| `201` | Created | Successful POST request (resource created) |
| `204` | No Content | Successful DELETE request |
| `400` | Bad Request | Malformed request syntax |
| `401` | Unauthorized | Missing or invalid authentication token |
| `403` | Forbidden | Insufficient permissions for action |
| `404` | Not Found | Resource does not exist |
| `422` | Unprocessable Entity | Validation errors |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server error |

---

## 7. Error Handling

### Validation Errors (422)

When request validation fails, the response includes field-specific error messages:

```json
{
    "message": "The given data was invalid.",
    "errors": {
        "email": [
            "The email field is required."
        ],
        "password": [
            "The password must be at least 8 characters."
        ]
    }
}
```

### Authentication Errors (401)

When token is missing or invalid:

```json
{
    "message": "Unauthenticated."
}
```

**Action:** Redirect user to login page and prompt for credentials.

### Authorization Errors (403)

When user lacks permission for the requested action:

```json
{
    "message": "This action is unauthorized."
}
```

**Action:** Display access denied message or hide UI elements for unauthorized actions.

### Not Found Errors (404)

When the requested resource does not exist:

```json
{
    "message": "Resource not found."
}
```

**Action:** Display "not found" message or redirect to list view.

### Rate Limit Errors (429)

When request rate limit is exceeded:

```json
{
    "message": "Too Many Attempts."
}
```

**Response Headers:**
```http
Retry-After: 60
```

**Action:** Display countdown timer and disable submit buttons until rate limit resets.

### Server Errors (500)

When an unexpected error occurs:

```json
{
    "message": "Server Error"
}
```

**Development Mode:** Includes stack trace and detailed error information.
**Production Mode:** Generic error message only (sensitive details hidden).

**Action:** Display generic error message, log error to monitoring system, provide retry option.

---

## 8. Versioning Strategy

### Current Version

The API currently operates without explicit versioning (implicit v1). All endpoints use the `/api/` prefix.

### Future Versioning

When breaking changes are introduced, the API will adopt versioned endpoints:

```
/api/v1/campers    (current version)
/api/v2/campers    (future version with breaking changes)
```

**Versioning Approach:**
- **URL-Based Versioning** — Version specified in endpoint path
- **Backward Compatibility** — Previous versions maintained for deprecation period
- **Deprecation Notices** — Clients notified 6 months before version removal
- **Documentation Per Version** — Each version has dedicated documentation

**Breaking Changes Include:**
- Removing fields from responses
- Changing field data types
- Renaming fields
- Changing authentication mechanisms
- Modifying error response formats

**Non-Breaking Changes Include:**
- Adding new endpoints
- Adding optional request fields
- Adding fields to responses
- Adding new error codes

---

## 9. Pagination

### Pagination Parameters

Collection endpoints support pagination to manage large datasets:

| Parameter | Type | Default | Maximum | Description |
|-----------|------|---------|---------|-------------|
| `page` | integer | 1 | — | Current page number |
| `per_page` | integer | 15 | 100 | Number of items per page |

**Example Request:**
```
GET /api/campers?page=2&per_page=25
```

### Pagination Metadata

Paginated responses include metadata in the `meta` object:

```json
{
    "data": [...],
    "meta": {
        "current_page": 2,
        "from": 16,
        "last_page": 5,
        "per_page": 15,
        "to": 30,
        "total": 73
    },
    "links": {
        "first": "https://api.example.com/api/campers?page=1",
        "last": "https://api.example.com/api/campers?page=5",
        "prev": "https://api.example.com/api/campers?page=1",
        "next": "https://api.example.com/api/campers?page=3"
    }
}
```

**Metadata Fields:**
- `current_page` — Current page number
- `from` — Index of first item on current page
- `to` — Index of last item on current page
- `per_page` — Items per page
- `last_page` — Total number of pages
- `total` — Total number of items across all pages

**Navigation Links:**
- `first` — URL for first page
- `last` — URL for last page
- `prev` — URL for previous page (null if on first page)
- `next` — URL for next page (null if on last page)

### Filtering and Sorting

Many endpoints support filtering and sorting:

**Example:**
```
GET /api/applications?status=approved&session_id=5&sort=-created_at
```

**Common Query Parameters:**
- `search` — Full-text search (camper name, parent email)
- `status` — Filter by status (applications)
- `session_id` — Filter by camp session
- `sort` — Sort field (prefix with `-` for descending)

---

## 10. Security Notes

### Token Expiration

- Tokens expire after 30 minutes of inactivity
- Clients should implement token refresh logic or prompt re-authentication
- Expired tokens return `401 Unauthorized`

### Authorization Policies

- All resource access validated by policies
- Parents can only access resources they own
- Admins have full system access
- Medical providers have token-based access to specific records only

### Input Validation

- All input validated before processing
- Custom validation rules for domain logic
- Type casting and sanitization applied
- Validation errors return `422` with field-specific messages

### Rate Limiting

The API implements rate limiting to prevent abuse:

| Endpoint Category | Limit | Scope |
|-------------------|-------|-------|
| General API | 60 requests/minute | Per authenticated user |
| Login | 5 attempts/minute | Per IP address |
| MFA Verify | 3 attempts/minute | Per user |
| Password Reset | 3 requests/minute | Per email address |
| Provider Access | 2 requests/minute | Per IP address |
| Document Upload | 5 uploads/minute | Per user |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
```

When rate limit exceeded, response includes `Retry-After` header indicating seconds until reset.

### Audit Logging

All access to Protected Health Information (PHI) is logged:
- User ID and role
- Resource accessed (medical record, allergy, medication)
- Timestamp
- IP address
- User agent

Audit logs are tamper-evident and retained for compliance purposes.

---

---

# Camp Burnt Gin API Reference

**Version:** 1.0
**Base URL:** `/api`
**Authentication:** Bearer Token (Laravel Sanctum)
**Content Type:** `application/json`

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Rate Limiting](#rate-limiting)
3. [Global Error Responses](#global-error-responses)
4. [Authentication Endpoints](#authentication-endpoints)
5. [User Profile Endpoints](#user-profile-endpoints)
6. [MFA Endpoints](#mfa-endpoints)
7. [Camp Endpoints](#camp-endpoints)
8. [Camp Session Endpoints](#camp-session-endpoints)
9. [Camper Endpoints](#camper-endpoints)
10. [Application Endpoints](#application-endpoints)
11. [Medical Record Endpoints](#medical-record-endpoints)
12. [Allergy Endpoints](#allergy-endpoints)
13. [Medication Endpoints](#medication-endpoints)
14. [Emergency Contact Endpoints](#emergency-contact-endpoints)
15. [Document Endpoints](#document-endpoints)
16. [Medical Provider Link Endpoints](#medical-provider-link-endpoints)
17. [Treatment Log Endpoints](#treatment-log-endpoints)
- [Medical Incident Endpoints](#medical-incident-endpoints)
- [Medical Follow-Up Endpoints](#medical-follow-up-endpoints)
- [Medical Visit Endpoints](#medical-visit-endpoints)
- [Medical Restriction Endpoints](#medical-restriction-endpoints)
- [Medical Stats Endpoint](#medical-stats-endpoint)
18. [Notification Endpoints](#notification-endpoints)
19. [Inbox Endpoints](#inbox-endpoints)
20. [Report Endpoints](#report-endpoints)
21. [Announcements Endpoints](#announcements-endpoints)
22. [Calendar Events Endpoints](#calendar-events-endpoints)
23. [User Management Endpoints](#user-management-endpoints)
24. [Applicant Documents Endpoints](#applicant-documents-endpoints)
25. [Document Requests Endpoints](#document-requests-endpoints)
26. [Application Form Management Endpoints](#application-form-management-endpoints)
27. [System Health Endpoints](#system-health-endpoints)

---

## Authentication & Authorization

### Bearer Token Authentication

All authenticated endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer {your-api-token}
```

Tokens are issued upon successful login or registration. Tokens expire after 30 minutes of inactivity.

### Authorization Levels

| Role | Permissions |
|------|-------------|
| **Super Admin** | Full system access, delegation authority |
| **Admin** | Operational access, camp management, application review, reporting |
| **Parent** | Own campers, applications, documents only |
| **Medical Provider** | Full read/write access to medical records, treatment logs, and documents; no delete rights |

### Endpoint Notation

Each endpoint lists:
- **Auth:** Yes/No
- **Role:** Required role(s) or "Any" for all authenticated users
- **Rate Limit:** Applicable rate limiter

---

## Rate Limiting

| Rate Limiter | Limit | Scope | Applies To |
|--------------|-------|-------|------------|
| `api` | 60/min | General authenticated endpoints | Most endpoints |
| `auth` | 5/min, 20/hour | Login, registration, password reset | Auth endpoints |
| `mfa` | 3/min, 10/hour | MFA operations | MFA setup/verify/disable |
| `provider-link` | 2/min, 10/hour | Medical provider link access | Provider endpoints |
| `uploads` | 5/min, 50/hour | Document uploads | Upload endpoint |
| `sensitive` | 10/min, 100/hour | Document downloads, provider links | Download endpoints |
| `inbox-conversation` | 5/min | Conversation creation | Inbox conversations |
| `inbox-message` | 60/min | Message sending | Inbox messages |

**Rate limit tracking:** By user ID (authenticated) or IP address (unauthenticated)

**Rate limit response:** HTTP 429 with `Retry-After` header

---

## Global Error Responses

### Standard Error

```json
{
  "message": "Human-readable error message"
}
```

### Validation Error

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "field_name": ["Validation error message"]
  }
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful request |
| 201 | Created | Resource created |
| 400 | Bad Request | Business logic error |
| 401 | Unauthorized | Authentication required/failed |
| 403 | Forbidden | Not authorized for action |
| 404 | Not Found | Resource not found |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Common Error Scenarios

**401 Unauthorized - Invalid credentials:**
```json
{
  "success": false,
  "message": "Invalid credentials.",
  "attempts_remaining": 3
}
```

**401 Unauthorized - Account locked:**
```json
{
  "success": false,
  "message": "Too many failed login attempts. Account locked temporarily.",
  "lockout": true,
  "retry_after": 900
}
```

**403 Forbidden - Insufficient permissions:**
```json
{
  "message": "Unauthorized"
}
```

**404 Not Found:**
```json
{
  "message": "Resource not found"
}
```

---

## Authentication Endpoints

### POST /auth/register

Register a new user account (creates applicant role by default).

**Auth:** No | **Rate Limit:** `auth`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| name | string | Yes | Max 255 characters |
| email | string | Yes | Valid email, unique, max 255 |
| password | string | Yes | Min 12 chars, mixed case, numbers, symbols, not compromised |
| password_confirmation | string | Yes | Must match password |

**Success (201):**
```json
{
  "message": "Account created successfully.",
  "data": {
    "user": { "id": 1, "name": "John Smith", "email": "john@example.com", "mfa_enabled": false },
    "token": "1|aBcDeFgHiJkLmNoPqRsTuVwXyZ"
  }
}
```

---

### POST /auth/login

Authenticate user and issue API token.

**Auth:** No | **Rate Limit:** `auth`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| email | string | Yes | Valid email |
| password | string | Yes | - |
| mfa_code | string | Conditional | Exactly 6 chars (required if MFA enabled) |

**Success (200):**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": { "id": 1, "name": "John Smith", "role": { "id": 2, "name": "applicant" } },
    "token": "2|xYzAbCdEfGhIjKlMnOpQrStUvW"
  }
}
```

**MFA Required (200):**
```json
{
  "success": true,
  "message": "MFA verification required.",
  "mfa_required": true
}
```

---

### POST /auth/logout

Revoke current token.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** `{ "message": "Logged out successfully." }`

---

### GET /profile/

Get authenticated user profile.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | User ID |
| name | string | Full name |
| email | string | Email address |
| email_verified_at | timestamp | Email verification time |
| mfa_enabled | boolean | MFA status |
| role | object | Role object with id and name |

---

### POST /auth/email/verify

Verify email address after registration.

**Auth:** Yes | **Rate Limit:** `auth`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| id | string | Yes | User ID from verification link |
| hash | string | Yes | Verification hash from email link |

**Success (200):** `{ "message": "Email verified successfully." }`

---

### POST /auth/email/resend

Resend email verification link.

**Auth:** Yes | **Rate Limit:** `auth`

**Success (200):** `{ "message": "Verification link sent." }`

---

### POST /auth/forgot-password

Send password reset link.

**Auth:** No | **Rate Limit:** `auth`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| email | string | Yes | Valid email |

**Success (200):** `{ "message": "If an account exists with this email, a password reset link has been sent." }`

**Note:** Generic response prevents email enumeration.

---

### POST /auth/reset-password

Reset password using reset token.

**Auth:** No | **Rate Limit:** `auth`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| token | string | Yes | Reset token from email |
| email | string | Yes | Valid email |
| password | string | Yes | Min 12 chars, mixed case, numbers, symbols, not compromised |
| password_confirmation | string | Yes | Must match password |

**Success (200):** `{ "message": "Password has been reset successfully." }`

**Error (400):** `{ "message": "This password reset token is invalid or has expired." }`

---

## User Profile Endpoints

### GET /profile/

Get current user profile.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | User ID |
| name | string | Full name |
| email | string | Email address |
| email_verified_at | timestamp | Email verification time |
| mfa_enabled | boolean | MFA status |
| role | object | Role object with id and name |

---

### PUT /profile/

Update current user profile.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| name | string | No | Max 255 characters |
| email | string | No | Valid email, unique (excluding current user), max 255 |

**Success (200):** Updated user object

---

### GET /profile/prefill

Get pre-fill data for returning applicants.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Response includes:**
- Parent information
- Previous campers
- Previous emergency contacts
- Previous medical information (physician, insurance)

---

### GET /profile/notification-preferences

Get the authenticated user's notification preferences.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** Notification preferences object

---

### PUT /profile/notification-preferences

Update the authenticated user's notification preferences.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** Updated notification preferences object

---

### PUT /profile/password

Change the authenticated user's password.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| current_password | string | Yes | Must match current password |
| password | string | Yes | Min 12 chars, mixed case, numbers, symbols, not compromised |
| password_confirmation | string | Yes | Must match password |

**Success (200):** `{ "message": "Password updated successfully." }`

---

### POST /profile/avatar

Upload or replace the authenticated user's avatar image.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `uploads`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| avatar | file | Yes | Max 2MB, JPEG/PNG/GIF/WEBP |

**Success (200):** Updated user object with avatar URL

---

### DELETE /profile/avatar

Remove the authenticated user's avatar.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** `{ "message": "Avatar removed successfully." }`

---

### GET /profile/emergency-contacts

List the authenticated user's personal emergency contacts.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Response:** Array of emergency contact objects

---

### POST /profile/emergency-contacts

Add a personal emergency contact to the authenticated user's profile.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| name | string | Yes | Max 255 characters |
| relationship | string | Yes | Max 255 characters |
| phone_primary | string | Yes | Valid phone format |
| phone_secondary | string | No | Valid phone format |
| email | string | No | Valid email, max 255 |

**Success (201):** Created emergency contact object

---

### PUT /profile/emergency-contacts/{contact}

Update a personal emergency contact.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**URL Parameters:** `contact` (integer) — Emergency contact ID

All parameters optional (same validation as POST).

**Success (200):** Updated emergency contact object

---

### DELETE /profile/emergency-contacts/{contact}

Delete a personal emergency contact.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**URL Parameters:** `contact` (integer) — Emergency contact ID

**Success (200):** `{ "message": "Emergency contact deleted successfully." }`

---

### DELETE /profile/account

Permanently delete the authenticated user's account and all associated data.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `sensitive`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| password | string | Yes | Must match current password |

**Success (200):** `{ "message": "Account deleted successfully." }`

**Note:** This action is irreversible. All campers, applications, and documents associated with the account are permanently removed.

---

## MFA Endpoints

### POST /mfa/setup

Initialize MFA setup. Returns QR code and secret.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `mfa`

**Success (200):**
```json
{
  "message": "MFA setup initialized. Scan the QR code with your authenticator app.",
  "data": {
    "qr_code": "data:image/svg+xml;base64,...",
    "secret": "JBSWY3DPEHPK3PXP",
    "recovery_codes": ["ABC123-DEF456", "GHI789-JKL012", ...]
  }
}
```

**Error (400):** `{ "message": "MFA is already enabled for this account." }`

---

### POST /mfa/verify

Verify and enable MFA.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `mfa`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| code | string | Yes | Exactly 6 characters |

**Success (200):** Returns recovery codes

**Error (401):** `{ "message": "Invalid verification code." }`

---

### POST /mfa/disable

Disable MFA.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `mfa`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| code | string | Yes | Exactly 6 characters |
| password | string | Yes | Current password |

**Success (200):** `{ "message": "MFA has been disabled." }`

**Error (400):** `{ "message": "Invalid verification code or password." }`

---

## Camp Endpoints

### GET /camps

List all camps. Non-admin users see only active camps.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Response:** Array of camp objects with nested sessions array

---

### GET /camps/{id}

Get camp details.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**URL Parameters:** `id` (integer) - Camp ID

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Camp ID |
| name | string | Camp name |
| description | string | Camp description |
| location | string | Camp location |
| is_active | boolean | Active status |
| sessions | array | Associated camp sessions |

---

### POST /camps

Create new camp.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| name | string | Yes | Max 255 characters |
| description | string | No | - |
| location | string | No | Max 255 characters |
| is_active | boolean | No | Default: true |

**Success (201):** Created camp object

---

### PUT /camps/{id}

Update camp.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**URL Parameters:** `id` (integer) - Camp ID

All parameters optional (same validation as POST).

**Success (200):** Updated camp object

---

### DELETE /camps/{id}

Soft delete camp.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**URL Parameters:** `id` (integer) - Camp ID

**Success (200):** `{ "message": "Camp deleted successfully." }`

---

## Camp Session Endpoints

### GET /sessions

List all camp sessions. Non-admin users see only active sessions.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camp_id | integer | Filter by camp ID |

---

### GET /sessions/{session}

Get session details.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Session ID |
| camp_id | integer | Parent camp ID |
| name | string | Session name |
| start_date | date | Session start date |
| end_date | date | Session end date |
| capacity | integer | Maximum campers |
| min_age | integer | Minimum age requirement |
| max_age | integer | Maximum age requirement |
| registration_opens_at | timestamp | Registration open time |
| registration_closes_at | timestamp | Registration close time |
| is_active | boolean | Active status |

---

### POST /sessions

Create session.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camp_id | integer | Yes | Valid camp ID |
| name | string | Yes | Max 255 characters |
| start_date | date | Yes | YYYY-MM-DD format |
| end_date | date | Yes | After start_date |
| capacity | integer | Yes | Minimum 1 |
| min_age | integer | No | Minimum 5 |
| max_age | integer | No | Maximum 18 |
| registration_opens_at | timestamp | No | Before registration_closes_at |
| registration_closes_at | timestamp | No | Before start_date |
| is_active | boolean | No | Default: true |

**Success (201):** Created session object

---

### PUT /sessions/{session}

Update session.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated session object

---

### DELETE /sessions/{session}

Soft delete session.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Camp session deleted successfully." }`

---

## Camper Endpoints

### GET /campers

List campers. Parents see only their own campers; admins see all.

**Auth:** Yes | **Role:** Parent, Admin, Medical | **Rate Limit:** `api`

> **Note (Phase 11):** The `medical` role now receives the full camper list with eager-loaded medical record relations (allergies, medications, emergency contacts, active restrictions) to support clinical workflow.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| parent_id | integer | Filter by parent (admin only) |

---

### GET /campers/{id}

Get camper details.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Camper ID |
| parent_id | integer | Parent user ID |
| first_name | string | First name |
| last_name | string | Last name |
| date_of_birth | date | Birth date |
| gender | string | Gender |
| grade | string | School grade |
| school | string | School name |
| special_needs | string | Special needs description |
| dietary_restrictions | string | Dietary restrictions |
| t_shirt_size | string | T-shirt size |

---

### POST /campers

Create camper.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| first_name | string | Yes | Max 255 characters |
| last_name | string | Yes | Max 255 characters |
| date_of_birth | date | Yes | YYYY-MM-DD, age 5-18 |
| gender | string | Yes | Male, Female, Other, Prefer not to say |
| grade | string | No | Max 50 characters |
| school | string | No | Max 255 characters |
| special_needs | string | No | - |
| dietary_restrictions | string | No | - |
| t_shirt_size | string | No | YS, YM, YL, AS, AM, AL, AXL |

**Success (201):** Created camper object

---

### PUT /campers/{id}

Update camper.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated camper object

---

### DELETE /campers/{id}

Soft delete camper.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Camper deleted successfully." }`

---

### GET /campers/{camper}/risk-summary

Get a camper's aggregated risk summary, including active restrictions, severe allergies, and high-priority follow-ups.

**Auth:** Yes | **Role:** Admin, Medical | **Rate Limit:** `api`

**Success (200):** Risk summary object

---

### GET /campers/{camper}/compliance-status

Get a camper's medical compliance status, including required documents and verification state.

**Auth:** Yes | **Role:** Admin, Medical | **Rate Limit:** `api`

**Success (200):** Compliance status object

---

### GET /campers/{camper}/medical-alerts

Get active medical alerts for a camper (severe allergies, active restrictions, overdue follow-ups).

**Auth:** Yes | **Role:** Admin, Medical | **Rate Limit:** `api`

**Success (200):** Array of active medical alert objects

---

## Application Endpoints

### GET /applications

List applications. Parents see only their own; admins see all.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |
| camp_session_id | integer | Filter by session |
| status | string | Filter by status (pending, approved, rejected, waitlisted) |

---

### GET /applications/{id}

Get application details.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Application ID |
| camper_id | integer | Camper ID |
| camp_session_id | integer | Session ID |
| status | string | pending, approved, rejected, waitlisted |
| is_draft | boolean | Draft status |
| submitted_at | timestamp | Submission time |
| reviewed_at | timestamp | Review time |
| reviewed_by | integer | Reviewer user ID |
| review_notes | string | Admin review notes |
| parent_signature | string | Digital signature |
| signed_at | timestamp | Signature time |

---

### POST /applications

Create application.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| camp_session_id | integer | Yes | Valid session ID |
| is_draft | boolean | No | Default: false |

**Validation Rules:**
- Camper age must be within session age range
- No duplicate application for same camper/session
- Session must be open for registration

**Success (201):** Created application object

---

### PUT /applications/{id}

Update application.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| is_draft | boolean | No | Cannot edit approved/rejected applications |

**Success (200):** Updated application object

---

### POST /applications/{id}/review

Review application (admin only).

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| status | string | Yes | approved, rejected, waitlisted |
| review_notes | string | No | - |

**Compliance:** Approved applications require all medical compliance documents to be verified and not expired (CYSHCN enforcement).

**Success (200):** Updated application object

---

### POST /applications/{id}/sign

Sign application.

**Auth:** Yes | **Role:** Parent (own only) | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| signature | string | Yes | Digital signature |

**Success (200):** Application with signature timestamp

---

### DELETE /applications/{id}

Delete application.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Application deleted successfully." }`

---

## Medical Record Endpoints

### GET /medical-records

List medical records.

**Auth:** Yes | **Role:** Parent (own campers), Medical Provider, Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |

**HIPAA Compliance:** All medical record access is logged to audit trail.

---

### GET /medical-records/{id}

Get medical record details.

**Auth:** Yes | **Role:** Parent (own only), Medical Provider, Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Record ID |
| camper_id | integer | Camper ID |
| physician_name | string | Primary physician |
| physician_phone | string | Physician phone |
| insurance_provider | string | Insurance company |
| insurance_policy_number | string | Policy number |
| medical_history | text | Medical history |
| current_medications | text | Current medications |
| immunization_status | string | Immunization status |
| last_physical_date | date | Last physical exam date |

**HIPAA Compliance:** Access logged with correlation ID, user ID, IP address.

---

### POST /medical-records

Create medical record.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| physician_name | string | Yes | Max 255 characters |
| physician_phone | string | Yes | Valid phone format |
| insurance_provider | string | No | Max 255 characters |
| insurance_policy_number | string | No | Max 255 characters |
| medical_history | text | No | - |
| current_medications | text | No | - |
| immunization_status | string | No | up_to_date, pending, incomplete |
| last_physical_date | date | No | YYYY-MM-DD |

**Success (201):** Created medical record

---

### PUT /medical-records/{id}

Update medical record.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated medical record

**HIPAA Compliance:** Updates logged to audit trail.

---

### DELETE /medical-records/{id}

Delete medical record.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Medical record deleted successfully." }`

---

## Allergy Endpoints

### GET /allergies

List allergies.

**Auth:** Yes | **Role:** Parent (own campers), Medical Provider, Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |

---

### GET /allergies/{id}

Get allergy details.

**Auth:** Yes | **Role:** Parent (own only), Medical Provider, Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Allergy ID |
| camper_id | integer | Camper ID |
| allergen | string | Allergen name |
| severity | string | mild, moderate, severe |
| reaction | string | Reaction description |
| treatment | string | Treatment protocol |

---

### POST /allergies

Create allergy record.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| allergen | string | Yes | Max 255 characters |
| severity | string | Yes | mild, moderate, severe |
| reaction | string | No | - |
| treatment | string | No | - |

**Success (201):** Created allergy record

---

### PUT /allergies/{id}

Update allergy record.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated allergy record

---

### DELETE /allergies/{id}

Delete allergy record.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Allergy deleted successfully." }`

---

## Medication Endpoints

### GET /medications

List medications.

**Auth:** Yes | **Role:** Parent (own campers), Medical Provider, Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |

---

### GET /medications/{id}

Get medication details.

**Auth:** Yes | **Role:** Parent (own only), Medical Provider, Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Medication ID |
| camper_id | integer | Camper ID |
| name | string | Medication name |
| dosage | string | Dosage instructions |
| frequency | string | Administration frequency |
| time_of_day | string | Time of administration |
| prescribing_physician | string | Prescribing physician |
| reason | string | Reason for medication |

---

### POST /medications

Create medication record.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| name | string | Yes | Max 255 characters |
| dosage | string | Yes | Max 255 characters |
| frequency | string | Yes | Max 255 characters |
| time_of_day | string | No | morning, afternoon, evening, bedtime, as_needed |
| prescribing_physician | string | No | Max 255 characters |
| reason | string | No | - |

**Success (201):** Created medication record

---

### PUT /medications/{id}

Update medication record.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated medication record

---

### DELETE /medications/{id}

Delete medication record.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Medication deleted successfully." }`

---

## Emergency Contact Endpoints

### GET /emergency-contacts

List emergency contacts.

**Auth:** Yes | **Role:** Parent (own campers), Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |

---

### GET /emergency-contacts/{id}

Get contact details.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Contact ID |
| camper_id | integer | Camper ID |
| name | string | Contact name |
| relationship | string | Relationship to camper |
| phone_primary | string | Primary phone |
| phone_secondary | string | Secondary phone |
| email | string | Email address |
| is_primary | boolean | Primary contact flag |
| is_authorized_pickup | boolean | Pickup authorization |

---

### POST /emergency-contacts

Create emergency contact.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| name | string | Yes | Max 255 characters |
| relationship | string | Yes | Max 255 characters |
| phone_primary | string | Yes | Valid phone format |
| phone_secondary | string | No | Valid phone format |
| email | string | No | Valid email, max 255 |
| is_primary | boolean | No | Default: false |
| is_authorized_pickup | boolean | No | Default: false |

**Success (201):** Created contact

---

### PUT /emergency-contacts/{id}

Update emergency contact.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated contact

---

### DELETE /emergency-contacts/{id}

Delete emergency contact.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Emergency contact deleted successfully." }`

---

## Document Endpoints

### GET /documents

List documents.

**Auth:** Yes | **Role:** Parent (own campers), Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| documentable_type | string | Filter by type (camper, application, medical_record) |
| documentable_id | integer | Filter by parent resource ID |

---

### GET /documents/{id}

Get document metadata.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Document ID |
| documentable_type | string | Parent resource type |
| documentable_id | integer | Parent resource ID |
| document_type | string | Document type category |
| original_name | string | Original filename |
| mime_type | string | MIME type |
| size | integer | File size (bytes) |
| scan_status | string | Virus scan status |
| verification_status | string | Verification status |
| expires_at | date | Expiration date |
| uploaded_by | integer | Uploader user ID |

---

### POST /documents

Upload document.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `uploads`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| file | file | Yes | Max 10MB, PDF/JPEG/PNG/GIF/DOC/DOCX |
| documentable_type | string | Yes | camper, application, medical_record |
| documentable_id | integer | Yes | Valid parent resource ID (owned by user) |
| document_type | string | Yes | Valid document type |
| expires_at | date | No | YYYY-MM-DD (future date) |

**Document Types:**
- Medical: physical_exam, immunization_record, medication_authorization, allergy_action_plan
- Compliance: seizure_management_plan, gtube_feeding_plan, behavioral_support_plan
- General: parent_id, insurance_card, consent_form, photo_release

**Compliance:** High-complexity campers require additional documents. G-tube feeding plans required for feeding tube devices. Seizure management plans required for seizure diagnosis.

**Success (201):** Created document metadata

---

### GET /documents/{id}/download

Download document.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `sensitive`

**Success (200):** Binary file with appropriate headers

---

### DELETE /documents/{id}

Delete document.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Document deleted successfully." }`

---

## Medical Provider Link Endpoints

### GET /provider-links

List provider links.

**Auth:** Yes | **Role:** Parent (own campers), Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |

---

### GET /provider-links/{id}

Get provider link details.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Link ID |
| camper_id | integer | Camper ID |
| token | string | Secure access token |
| provider_email | string | Provider email |
| expires_at | timestamp | Expiration time |
| accessed_at | timestamp | First access time |
| submitted_at | timestamp | Submission time |
| is_revoked | boolean | Revoked status |

---

### POST /provider-links

Create provider link.

**Auth:** Yes | **Role:** Parent, Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Valid camper ID (owned by user) |
| provider_email | string | Yes | Valid email |
| expires_at | timestamp | No | Future timestamp (default: 7 days) |

**Success (201):** Created provider link with secure token

---

### POST /provider-links/{id}/resend

Resend provider link email.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Provider link has been resent." }`

---

### POST /provider-links/{id}/revoke

Revoke provider link.

**Auth:** Yes | **Role:** Parent (own only), Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Provider link has been revoked." }`

---

### GET /provider-access/{token}

Access provider form (no authentication required).

**Auth:** No | **Rate Limit:** `provider-link`

**URL Parameters:** `token` (string) - Secure access token

**Success (200):** Camper medical form data

**Errors:**
- 403: Link expired, revoked, or already used
- 404: Invalid token

---

### POST /provider-access/{token}/submit

Submit provider form.

**Auth:** No | **Rate Limit:** `provider-link`

**URL Parameters:** `token` (string) - Secure access token

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| physician_name | string | Yes | Max 255 characters |
| physician_phone | string | Yes | Valid phone format |
| medical_notes | text | No | - |
| documents | array | No | File uploads (same validation as /documents) |

**Success (200):** Submission confirmation

**Note:** Link becomes single-use after successful submission.

---

## Treatment Log Endpoints

### GET /treatment-logs

List treatment log entries with optional filters.

**Auth:** Yes | **Role:** `admin`, `medical` | **Rate Limit:** `api`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| camper_id | integer | Filter by camper |
| from | date (Y-m-d) | Filter entries on or after this date |
| to | date (Y-m-d) | Filter entries on or before this date |
| type | string | Filter by `TreatmentType` value |

**Success (200):**
```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 12,
      "recorded_by": 5,
      "treatment_date": "2026-07-14",
      "treatment_time": "09:30:00",
      "type": "first_aid",
      "title": "Minor abrasion — right knee",
      "description": "...",
      "outcome": "...",
      "follow_up_required": false,
      "follow_up_notes": null,
      "recorder": { "id": 5, "name": "..." },
      "camper": { "id": 12, "first_name": "...", "last_name": "..." },
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

---

### POST /treatment-logs

Record a new treatment log entry. `recorded_by` is automatically set to the authenticated user.

**Auth:** Yes | **Role:** `admin`, `medical` | **Rate Limit:** `api`

**Request Body:**

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| camper_id | integer | Yes | Exists in campers |
| treatment_date | date | Yes | `before_or_equal:today` |
| treatment_time | time | No | H:i format |
| type | string | Yes | One of: `medication_administered`, `first_aid`, `observation`, `emergency`, `other` |
| title | string | Yes | Max 255 |
| description | string | Yes | Max 5000 |
| outcome | string | No | Max 5000 |
| follow_up_required | boolean | No | Default false |
| follow_up_notes | string | No | Max 5000 |

**Success (201):** Created treatment log resource

---

### GET /treatment-logs/{id}

View a single treatment log entry.

**Auth:** Yes | **Role:** `admin`, `medical` | **Rate Limit:** `api`

**Success (200):** Treatment log resource with `recorder` and `camper` relationships loaded.

---

### PUT /treatment-logs/{id}

Update a treatment log entry. All fields optional (partial update). Medical staff may only update their own entries.

**Auth:** Yes | **Role:** `admin`, `medical` | **Rate Limit:** `api`

**Success (200):** Updated treatment log resource

---

### DELETE /treatment-logs/{id}

Delete a treatment log entry. Admin only.

**Auth:** Yes | **Role:** `admin` | **Rate Limit:** `api`

**Success (200):** `{ "message": "Treatment log deleted." }`

---

## Medical Incident Endpoints

Incident reports for events occurring during camp sessions. All PHI fields are encrypted at rest.

**Authorization:** `admin`, `medical` roles. Destroy is admin-only.

---

### `GET /medical-incidents`

List all incidents. Supports filtering.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `camper_id` | integer | Filter by camper |
| `type` | string | Filter by incident type enum value |
| `severity` | string | Filter by severity enum value |
| `date_from` | date | Filter incidents on or after this date |
| `date_to` | date | Filter incidents on or before this date |

**Response `200`:**
```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 4,
      "recorded_by": 3,
      "type": "medical",
      "severity": "moderate",
      "location": "Archery Range",
      "title": "Hypoglycemia episode",
      "description": "...",
      "witnesses": "Jordan Reed, Sam Park",
      "escalation_required": true,
      "escalation_notes": "Parents notified at 2:45 PM.",
      "incident_date": "2026-03-04",
      "incident_time": "14:12:00",
      "camper": { "id": 4, "full_name": "Ava Williams" },
      "recorder": { "id": 3, "name": "Dr. Morgan Chen" }
    }
  ],
  "meta": { "current_page": 1, "last_page": 1, "total": 7, "per_page": 15 }
}
```

---

### `POST /medical-incidents`

Create a new incident report.

**Request Body:**
```json
{
  "camper_id": 4,
  "type": "medical",
  "severity": "moderate",
  "location": "Archery Range",
  "title": "Hypoglycemia episode — BG 52 mg/dL",
  "description": "Dexcom alarmed during archery activity...",
  "witnesses": "Jordan Reed",
  "escalation_required": true,
  "escalation_notes": "Parents notified at 2:45 PM.",
  "incident_date": "2026-03-04",
  "incident_time": "14:12:00",
  "treatment_log_id": null
}
```

**Enum Values:**
- `type`: `behavioral`, `medical`, `injury`, `environmental`, `emergency`, `other`
- `severity`: `minor`, `moderate`, `severe`, `critical`

**Response `201`:** Created incident object.

---

### `GET /medical-incidents/{id}`

View a single incident by ID.

**Response `200`:** Full incident object with `camper` and `recorder` relations.

---

### `PUT /medical-incidents/{id}`

Update an existing incident.

**Request Body:** Any subset of `POST` fields.

**Response `200`:** Updated incident object.

---

### `DELETE /medical-incidents/{id}`

Delete an incident. **Admin only.**

**Response `204`:** No content.

---

### `GET /medical-incidents/camper/{camper}`

List all incidents for a specific camper.

**Response `200`:** Paginated list of incidents for the given camper.

---

## Medical Follow-Up Endpoints

Task queue for tracking medical follow-up actions after incidents, visits, or treatment logs.

**Authorization:** `admin`, `medical` roles. Destroy is admin-only.

---

### `GET /medical-follow-ups`

List all follow-ups. Supports filtering.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `camper_id` | integer | Filter by camper |
| `status` | string | Filter by status enum value |
| `priority` | string | Filter by priority enum value |
| `assigned_to` | integer | Filter by assigned user ID |

**Response `200`:**
```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 4,
      "created_by": 3,
      "assigned_to": 3,
      "title": "Contact endocrinologist re: basal rate adjustment",
      "notes": "Second hypoglycemia episode this session.",
      "status": "pending",
      "priority": "urgent",
      "due_date": "2026-03-05",
      "completed_at": null,
      "completed_by": null,
      "camper": { "id": 4, "full_name": "Ava Williams" },
      "assignee": { "id": 3, "name": "Dr. Morgan Chen" }
    }
  ],
  "meta": { "current_page": 1, "last_page": 1, "total": 7, "per_page": 15 }
}
```

---

### `POST /medical-follow-ups`

Create a follow-up task.

**Request Body:**
```json
{
  "camper_id": 4,
  "assigned_to": 3,
  "title": "Contact endocrinologist re: basal rate adjustment",
  "notes": "Second hypoglycemia episode this session.",
  "priority": "urgent",
  "due_date": "2026-03-05",
  "treatment_log_id": null
}
```

**Enum Values:**
- `status`: `pending`, `in_progress`, `completed`, `cancelled`
- `priority`: `low`, `medium`, `high`, `urgent`

**Response `201`:** Created follow-up object.

---

### `GET /medical-follow-ups/{id}`

View a single follow-up.

**Response `200`:** Full follow-up object with `camper`, `creator`, `assignee` relations.

---

### `PUT /medical-follow-ups/{id}`

Update a follow-up, including status transitions.

**Request Body:** Any subset of `POST` fields plus `status`, `completed_at`.

When `status` is set to `completed`, the API automatically sets `completed_at` to the current timestamp and `completed_by` to the authenticated user.

**Response `200`:** Updated follow-up object.

---

### `DELETE /medical-follow-ups/{id}`

Delete a follow-up task. **Admin only.**

**Response `204`:** No content.

---

## Medical Visit Endpoints

Health office visit records documenting chief complaint, vitals, treatment, and disposition.

**Authorization:** `admin`, `medical` roles. Destroy is admin-only.

---

### `GET /medical-visits`

List all health office visits.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `camper_id` | integer | Filter by camper |
| `disposition` | string | Filter by disposition enum value |
| `date_from` | date | Filter visits on or after this date |
| `date_to` | date | Filter visits on or before this date |

**Response `200`:**
```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 4,
      "recorded_by": 3,
      "visit_date": "2026-03-04",
      "visit_time": "14:30:00",
      "chief_complaint": "Post-hypoglycemia monitoring",
      "symptoms": "Pallor, diaphoresis at presentation.",
      "vitals": { "temp": "98.4", "pulse": "92", "bp": "108/66", "spo2": "99", "weight": null },
      "treatment_provided": "Glucose monitoring x3, oral hydration.",
      "medications_administered": "Glucose tabs 15g",
      "disposition": "returned_to_activity",
      "disposition_notes": "BG stable at 94 after 15 min.",
      "follow_up_required": true,
      "follow_up_notes": "Schedule call with endocrinologist.",
      "camper": { "id": 4, "full_name": "Ava Williams" }
    }
  ],
  "meta": { "current_page": 1, "last_page": 1, "total": 8, "per_page": 15 }
}
```

---

### `POST /medical-visits`

Record a new health office visit.

**Request Body:**
```json
{
  "camper_id": 4,
  "visit_date": "2026-03-04",
  "visit_time": "14:30:00",
  "chief_complaint": "Post-hypoglycemia monitoring",
  "symptoms": "Pallor, diaphoresis.",
  "vitals": { "temp": "98.4", "pulse": "92", "bp": "108/66", "spo2": "99", "weight": null },
  "treatment_provided": "Glucose monitoring x3.",
  "medications_administered": "Glucose tabs 15g",
  "disposition": "returned_to_activity",
  "disposition_notes": "BG stable at 94 mg/dL.",
  "follow_up_required": true,
  "follow_up_notes": "Contact endocrinologist."
}
```

**Enum Values (`disposition`):** `returned_to_activity`, `monitoring`, `sent_home`, `emergency_transfer`, `other`

**Response `201`:** Created visit object.

---

### `GET /medical-visits/{id}`

View a single health office visit.

**Response `200`:** Full visit object with `camper` and `recorder` relations.

---

### `PUT /medical-visits/{id}`

Update a health office visit record.

**Request Body:** Any subset of `POST` fields.

**Response `200`:** Updated visit object.

---

### `DELETE /medical-visits/{id}`

Delete a visit record. **Admin only.**

**Response `204`:** No content.

---

### `GET /medical-visits/camper/{camper}`

List all health office visits for a specific camper.

**Response `200`:** Paginated list of visits for the given camper.

---

## Medical Restriction Endpoints

Active camper restrictions (activity, dietary, environmental, equipment) for clinical context.

**Authorization:** `admin` can create/update/delete. `medical` can view only.

---

### `GET /medical-restrictions`

List all restrictions.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `camper_id` | integer | Filter by camper |
| `is_active` | boolean | Filter active/inactive restrictions |
| `restriction_type` | string | Filter by type (activity, dietary, environmental, equipment) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 1,
      "created_by": 3,
      "restriction_type": "activity",
      "description": "No unsupervised swimming. Seizure risk near water.",
      "start_date": "2026-03-01",
      "end_date": null,
      "is_active": true,
      "notes": "Clearance required from neurologist.",
      "camper": { "id": 1, "full_name": "Ethan Johnson" }
    }
  ],
  "meta": { "current_page": 1, "last_page": 1, "total": 6, "per_page": 15 }
}
```

---

### `POST /medical-restrictions`

Create a restriction. **Admin only.**

**Request Body:**
```json
{
  "camper_id": 1,
  "restriction_type": "activity",
  "description": "No unsupervised swimming. Seizure risk near water.",
  "start_date": "2026-03-01",
  "end_date": null,
  "is_active": true,
  "notes": "Clearance required from neurologist."
}
```

**Response `201`:** Created restriction object.

---

### `GET /medical-restrictions/{id}`

View a single restriction.

**Response `200`:** Full restriction object.

---

### `PUT /medical-restrictions/{id}`

Update a restriction. **Admin only.**

**Request Body:** Any subset of `POST` fields.

**Response `200`:** Updated restriction object.

---

### `DELETE /medical-restrictions/{id}`

Delete a restriction. **Admin only.**

**Response `204`:** No content.

---

## Medical Stats Endpoint

Aggregate statistics for the medical portal command center dashboard.

**Authorization:** `admin`, `medical` roles.

---

### `GET /medical/stats`

Returns aggregate counts and recent activity for dashboard widgets.

**Response `200`:**
```json
{
  "camper_counts": {
    "total": 8,
    "with_severe_allergies": 2,
    "on_medications": 6,
    "with_active_restrictions": 6,
    "missing_medical_records": 0
  },
  "follow_up_counts": {
    "overdue": 2,
    "due_today": 1,
    "open": 5
  },
  "recent_activity": [
    {
      "type": "incident",
      "camper_name": "Lucas Williams",
      "title": "Increased respiratory effort",
      "date": "2026-03-06"
    }
  ],
  "treatment_type_breakdown": {
    "medication_administered": 8,
    "first_aid": 4,
    "observation": 9,
    "emergency": 0,
    "other": 0
  }
}
```

---

## Notification Endpoints

### GET /notifications

List user notifications.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| unread | boolean | Filter unread notifications |

**Response:** Array of notification objects

---

### GET /notifications/{id}

Get notification details.

**Auth:** Yes | **Role:** Any (own only) | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Notification ID |
| type | string | Notification type |
| data | object | Notification data |
| read_at | timestamp | Read timestamp |
| created_at | timestamp | Creation timestamp |

---

### PUT /notifications/{notification}/read

Mark notification as read.

**Auth:** Yes | **Role:** Any (own only) | **Rate Limit:** `api`

**Success (200):** Updated notification

---

### PUT /notifications/read-all

Mark all notifications as read.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** `{ "message": "All notifications marked as read." }`

---

### DELETE /notifications/{id}

Delete notification.

**Auth:** Yes | **Role:** Any (own only) | **Rate Limit:** `api`

**Success (200):** `{ "message": "Notification deleted successfully." }`

---

## Inbox Endpoints

### GET /inbox/conversations

List conversations.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| archived | boolean | Include archived conversations |

**Response:** Paginated array of conversation objects

**HIPAA Compliance:** All inbox operations logged to audit trail.

---

### GET /inbox/conversations/{id}

Get conversation details.

**Auth:** Yes | **Role:** Participant | **Rate Limit:** `api`

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Conversation ID |
| subject | string | Conversation subject |
| created_by | integer | Creator user ID |
| archived_at | timestamp | Archive timestamp |
| participants | array | Participant user objects |

---

### POST /inbox/conversations

Create conversation.

**Auth:** Yes | **Role:** Admin, Parent | **Rate Limit:** `inbox-conversation` (5/min)

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| subject | string | Yes | Max 255 characters |
| participant_ids | array | Yes | Min 1 valid user ID |
| initial_message | string | Yes | Initial message body |

**Role Restrictions:**
- Parents can only create conversations with admins
- Parents cannot create parent-to-parent conversations
- Medical providers cannot create conversations
- Admins can create any conversation

**Success (201):** Created conversation

---

### POST /inbox/conversations/{id}/archive

Archive conversation.

**Auth:** Yes | **Role:** Creator | **Rate Limit:** `api`

**Success (200):** `{ "message": "Conversation archived." }`

---

### POST /inbox/conversations/{id}/participants

Add participant (admin only).

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| user_id | integer | Yes | Valid user ID |

**Success (200):** Updated conversation

---

### DELETE /inbox/conversations/{id}

Soft delete conversation (admin only).

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Conversation deleted." }`

---

### GET /inbox/conversations/{id}/messages

List messages in conversation.

**Auth:** Yes | **Role:** Participant | **Rate Limit:** `api`

**Response:** Paginated array of message objects

**Side Effect:** Auto-marks retrieved messages as read (except sender's own messages).

---

### POST /inbox/conversations/{id}/messages

Send message.

**Auth:** Yes | **Role:** Participant | **Rate Limit:** `inbox-message` (60/min)

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| body | string | Yes | Not empty |
| attachments | array | No | Max 5 files, 10MB each, PDF/JPEG/PNG/GIF/DOC/DOCX |
| idempotency_key | string | Yes | Unique key for duplicate prevention |

**Success (201):** Created message

**HIPAA Compliance:** Messages are immutable (cannot be edited). Soft deletion preserves audit trail.

---

### GET /inbox/messages/{id}/attachments/{documentId}

Download a file attached to a specific message.

**Auth:** Yes | **Role:** Conversation participant | **Rate Limit:** `10/hour`

**Response:** Binary file stream (`Content-Disposition: attachment`).

**Notes:**
- Authorization is two-layer: user must be a conversation participant AND the document must belong to the message.
- Every access is written to the HIPAA audit log.
- `original_filename` is decrypted server-side before being used as the download filename.
- Attachment metadata returned by message list/send endpoints: `{ id, original_filename, mime_type, file_size }` (storage internals are never exposed).

---

### DELETE /inbox/messages/{id}

Soft delete message (admin only).

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Message deleted." }`

**Note:** Parents cannot delete their own messages (immutability requirement).

---

### GET /inbox/unread-count

Get unread message count.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** `{ "unread_count": 5 }`

---

## Report Endpoints

### GET /reports/applications

Application summary report.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camp_session_id | integer | Filter by session |
| status | string | Filter by status |

**Response:** Application statistics and list

---

### GET /reports/campers

Camper summary report.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camp_session_id | integer | Filter by session |

**Response:** Camper demographics and statistics

---

### GET /reports/medical-compliance

Medical compliance report.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| camp_session_id | integer | Filter by session |

**Response:** Compliance status for all campers

**Includes:**
- Document verification status
- Expiration tracking
- CYSHCN compliance requirements
- Missing document identification

---

### GET /reports/documents

Document report.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Response:** Document upload statistics and verification status

---

## Announcements Endpoints

Manage camp announcements visible to authenticated users.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/announcements/` | List all announcements | Authenticated |
| `GET` | `/api/announcements/{announcement}` | View announcement details | Authenticated |
| `POST` | `/api/announcements/` | Create announcement | Admin |
| `PUT` | `/api/announcements/{announcement}` | Update announcement | Admin |
| `DELETE` | `/api/announcements/{announcement}` | Delete announcement | Admin |
| `POST` | `/api/announcements/{announcement}/pin` | Toggle pin status | Admin |

### GET /announcements/

List all announcements.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Response:** Paginated array of announcement objects, pinned announcements first

---

### GET /announcements/{announcement}

View a single announcement.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** Announcement object

---

### POST /announcements/

Create an announcement.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| title | string | Yes | Max 255 characters |
| body | string | Yes | Announcement content |
| is_pinned | boolean | No | Default: false |

**Success (201):** Created announcement object

---

### PUT /announcements/{announcement}

Update an announcement.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated announcement object

---

### DELETE /announcements/{announcement}

Delete an announcement.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Announcement deleted successfully." }`

---

### POST /announcements/{announcement}/pin

Toggle the pinned status of an announcement.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** Updated announcement object with new `is_pinned` value

---

## Calendar Events Endpoints

Manage the camp calendar, viewable by all authenticated users.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/calendar/` | List calendar events | Authenticated |
| `GET` | `/api/calendar/{calendarEvent}` | View calendar event | Authenticated |
| `POST` | `/api/calendar/` | Create calendar event | Admin |
| `PUT` | `/api/calendar/{calendarEvent}` | Update calendar event | Admin |
| `DELETE` | `/api/calendar/{calendarEvent}` | Delete calendar event | Admin |

### GET /calendar/

List all calendar events.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| from | date | Filter events on or after this date (YYYY-MM-DD) |
| to | date | Filter events on or before this date (YYYY-MM-DD) |

**Response:** Array of calendar event objects

---

### GET /calendar/{calendarEvent}

View a single calendar event.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** Calendar event object

---

### POST /calendar/

Create a calendar event.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| title | string | Yes | Max 255 characters |
| description | string | No | Event description |
| starts_at | datetime | Yes | ISO 8601 format |
| ends_at | datetime | Yes | After starts_at |
| all_day | boolean | No | Default: false |

**Success (201):** Created calendar event object

---

### PUT /calendar/{calendarEvent}

Update a calendar event.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated calendar event object

---

### DELETE /calendar/{calendarEvent}

Delete a calendar event.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Calendar event deleted successfully." }`

---

## User Management Endpoints

Endpoints for managing platform users. All require `super_admin` role.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/users/` | List all users | Super Admin |
| `PUT` | `/api/users/{user}/role` | Update user role | Super Admin |
| `POST` | `/api/users/{user}/deactivate` | Deactivate user account | Super Admin |
| `POST` | `/api/users/{user}/reactivate` | Reactivate user account | Super Admin |

### GET /users/

List all platform users.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| role | string | Filter by role (admin, applicant, medical, super_admin) |
| search | string | Search by name or email |

**Response:** Paginated array of user objects

---

### PUT /users/{user}/role

Update a user's role.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**URL Parameters:** `user` (integer) — User ID

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| role | string | Yes | admin, applicant, medical, super_admin |

**Safeguard:** The last `super_admin` cannot be demoted.

**Success (200):** Updated user object

---

### POST /users/{user}/deactivate

Deactivate a user account, preventing login.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**URL Parameters:** `user` (integer) — User ID

**Success (200):** `{ "message": "User account deactivated." }`

---

### POST /users/{user}/reactivate

Reactivate a previously deactivated user account.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**URL Parameters:** `user` (integer) — User ID

**Success (200):** `{ "message": "User account reactivated." }`

---

## Applicant Documents Endpoints

Manage documents sent by admins to applicants and submitted in return. Distinct from the general `/documents` endpoint which handles medical and application file uploads.

### Admin Endpoints (requires admin or super_admin role)

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `POST` | `/api/admin/documents/send` | Send a document to an applicant | Admin |
| `GET` | `/api/admin/documents` | List all applicant documents | Admin |
| `GET` | `/api/admin/documents/{applicantId}` | List documents for a specific applicant | Admin |
| `GET` | `/api/admin/applicant-documents/{applicantDocument}/download-original` | Download original document | Admin |
| `GET` | `/api/admin/applicant-documents/{applicantDocument}/download-submitted` | Download submitted document | Admin |
| `PATCH` | `/api/admin/applicant-documents/{applicantDocument}/review` | Mark document as reviewed | Admin |
| `POST` | `/api/admin/applicant-documents/{applicantDocument}/replace` | Replace document | Admin |

### Applicant Endpoints (requires applicant role)

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/applicant/documents` | List own received documents | Applicant |
| `GET` | `/api/applicant/applicant-documents/{applicantDocument}/download` | Download document | Applicant |
| `POST` | `/api/applicant/documents/upload` | Upload/submit a document | Applicant (throttle: uploads) |

### POST /admin/documents/send

Send a document to an applicant for review or completion.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| user_id | integer | Yes | Valid applicant user ID |
| file | file | Yes | Max 10MB, PDF/JPEG/PNG/GIF/DOC/DOCX |
| title | string | Yes | Max 255 characters |
| description | string | No | Instructions for the applicant |
| requires_submission | boolean | No | Default: false |

**Success (201):** Created applicant document record

---

### GET /admin/documents

List all applicant documents across all users.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Response:** Paginated array of applicant document objects

---

### GET /admin/documents/{applicantId}

List documents for a specific applicant.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**URL Parameters:** `applicantId` (integer) — Applicant user ID

**Response:** Array of applicant document objects for the specified user

---

### GET /admin/applicant-documents/{applicantDocument}/download-original

Download the original document sent to the applicant.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `sensitive`

**Success (200):** Binary file with appropriate headers

---

### GET /admin/applicant-documents/{applicantDocument}/download-submitted

Download the document submitted by the applicant.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `sensitive`

**Success (200):** Binary file with appropriate headers

---

### PATCH /admin/applicant-documents/{applicantDocument}/review

Mark a submitted document as reviewed by an admin.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** Updated applicant document object

---

### POST /admin/applicant-documents/{applicantDocument}/replace

Replace the original document sent to an applicant.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `uploads`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| file | file | Yes | Max 10MB, PDF/JPEG/PNG/GIF/DOC/DOCX |

**Success (200):** Updated applicant document object

---

### GET /applicant/documents

List documents received by the authenticated applicant.

**Auth:** Yes | **Role:** Applicant | **Rate Limit:** `api`

**Response:** Array of applicant document objects

---

### GET /applicant/applicant-documents/{applicantDocument}/download

Download a document sent to the authenticated applicant.

**Auth:** Yes | **Role:** Applicant (own only) | **Rate Limit:** `sensitive`

**Success (200):** Binary file with appropriate headers

---

### POST /applicant/documents/upload

Upload a document in response to an admin request.

**Auth:** Yes | **Role:** Applicant | **Rate Limit:** `uploads`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| applicant_document_id | integer | Yes | Valid document ID (own only) |
| file | file | Yes | Max 10MB, PDF/JPEG/PNG/GIF/DOC/DOCX |

**Success (200):** Updated applicant document object

---

## Document Requests Endpoints

Lifecycle management for document requests sent by admins to applicants. Requests follow a defined status workflow from creation through upload, review, and final decision.

**Document Request Status Lifecycle:**
```
awaiting_upload → uploaded → scanning → under_review → approved (final)
                                                      → rejected (final)
awaiting_upload → overdue (when deadline passes)
```

### Admin Endpoints (requires admin or super_admin role)

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/document-requests/stats` | Document request statistics dashboard | Admin |
| `GET` | `/api/document-requests` | List all document requests | Admin |
| `POST` | `/api/document-requests` | Create a new document request | Admin |
| `GET` | `/api/document-requests/{documentRequest}` | View document request details | Admin |
| `GET` | `/api/document-requests/{documentRequest}/download` | Download submitted document | Admin (throttle: sensitive) |
| `PATCH` | `/api/document-requests/{documentRequest}/approve` | Approve submitted document | Admin |
| `PATCH` | `/api/document-requests/{documentRequest}/reject` | Reject submitted document | Admin |
| `DELETE` | `/api/document-requests/{documentRequest}` | Cancel document request | Admin |
| `POST` | `/api/document-requests/{documentRequest}/remind` | Send reminder to applicant | Admin |
| `PATCH` | `/api/document-requests/{documentRequest}/extend` | Extend request deadline | Admin |
| `PATCH` | `/api/document-requests/{documentRequest}/reupload` | Request reupload of document | Admin |

### Applicant Endpoints (requires applicant role)

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/applicant/document-requests` | List own document requests | Applicant |
| `POST` | `/api/applicant/document-requests/{documentRequest}/upload` | Upload document in response to request | Applicant (throttle: uploads) |
| `GET` | `/api/applicant/document-requests/{documentRequest}/download` | Download request template/instructions | Applicant (throttle: sensitive) |

### GET /document-requests/stats

Retrieve a statistics dashboard for all document requests.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Response includes:** Total requests, status breakdowns (awaiting, uploaded, under review, approved, rejected, overdue), recent activity

---

### GET /document-requests

List all document requests with filtering.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (awaiting_upload, uploaded, scanning, under_review, approved, rejected, overdue) |
| applicant_id | integer | Filter by applicant user ID |

**Response:** Paginated array of document request objects

---

### POST /document-requests

Create a new document request for an applicant.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| user_id | integer | Yes | Valid applicant user ID |
| camper_id | integer | No | Valid camper ID associated with the applicant |
| title | string | Yes | Max 255 characters |
| description | string | No | Instructions for the applicant |
| due_date | date | No | YYYY-MM-DD, future date |

**Side Effect:** Creates a system conversation in the applicant's inbox notifying them of the new request.

**Success (201):** Created document request object

---

### GET /document-requests/{documentRequest}

View the details of a single document request.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** Document request object with applicant and camper relations

---

### GET /document-requests/{documentRequest}/download

Download the document submitted by the applicant.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `sensitive`

**Success (200):** Binary file with appropriate headers

**Error (404):** Returned if no document has been submitted yet

---

### PATCH /document-requests/{documentRequest}/approve

Approve a submitted document, finalising the request.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Status Transition:** `under_review` → `approved`

**Side Effect:** Appends a status-update message to the applicant's inbox thread.

**Success (200):** Updated document request object

---

### PATCH /document-requests/{documentRequest}/reject

Reject a submitted document with a reason.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| reason | string | Yes | Rejection reason communicated to applicant |

**Status Transition:** `under_review` → `rejected`

**Side Effect:** Appends a status-update message to the applicant's inbox thread.

**Success (200):** Updated document request object

---

### DELETE /document-requests/{documentRequest}

Cancel a document request. Only applicable to requests that have not yet been approved or rejected.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Document request cancelled." }`

---

### POST /document-requests/{documentRequest}/remind

Send a reminder notification to the applicant for a pending or overdue request.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Reminder sent." }`

---

### PATCH /document-requests/{documentRequest}/extend

Extend the deadline for an open document request.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| due_date | date | Yes | YYYY-MM-DD, must be in the future |

**Success (200):** Updated document request object

---

### PATCH /document-requests/{documentRequest}/reupload

Request the applicant to reupload a document (e.g., after a failed scan or rejection requiring resubmission).

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| reason | string | No | Explanation of why reupload is needed |

**Status Transition:** Returns request to `awaiting_upload`

**Success (200):** Updated document request object

---

### GET /applicant/document-requests

List all document requests for the authenticated applicant.

**Auth:** Yes | **Role:** Applicant | **Rate Limit:** `api`

**Response:** Array of document request objects (own only)

---

### POST /applicant/document-requests/{documentRequest}/upload

Upload a document in response to an admin request.

**Auth:** Yes | **Role:** Applicant (own only) | **Rate Limit:** `uploads`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| file | file | Yes | Max 10MB, PDF/JPEG/PNG/GIF/DOC/DOCX |

**Status Transition:** `awaiting_upload` → `uploaded` (then queued for scanning)

**Success (200):** Updated document request object

---

### GET /applicant/document-requests/{documentRequest}/download

Download the template or instructions document attached to the request by the admin.

**Auth:** Yes | **Role:** Applicant (own only) | **Rate Limit:** `sensitive`

**Success (200):** Binary file with appropriate headers

---

## Application Form Management Endpoints

Endpoints for managing dynamic application form definitions. The active form schema is cached for performance.

**Key Rule:** A field's `field_key` cannot be renamed once applications referencing that key have been submitted. Attempts will return a `422 Unprocessable Entity` error.

### Public Endpoints (any authenticated user)

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/form/active` | Get the currently active form schema | Authenticated (cached 10 min) |
| `GET` | `/api/form/version/{form}` | Get a specific form version by ID | Authenticated |

### Admin-Readable Endpoints (requires admin or super_admin role)

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/form/definitions` | List all form definitions | Admin |
| `GET` | `/api/form/definitions/{form}` | View form definition details | Admin |

### Super Admin Only — Form Definitions

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `POST` | `/api/form/definitions` | Create a new form definition | Super Admin |
| `PUT` | `/api/form/definitions/{form}` | Update form definition | Super Admin |
| `DELETE` | `/api/form/definitions/{form}` | Delete form definition (draft only) | Super Admin |
| `POST` | `/api/form/definitions/{form}/publish` | Publish a draft form definition | Super Admin |
| `POST` | `/api/form/definitions/{form}/duplicate` | Duplicate an existing form definition | Super Admin |

### Super Admin Only — Form Sections

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/form/definitions/{form}/sections` | List sections for a form | Super Admin |
| `POST` | `/api/form/definitions/{form}/sections` | Add a section to a form | Super Admin |
| `PUT` | `/api/form/definitions/{form}/sections/{section}` | Update a section | Super Admin |
| `DELETE` | `/api/form/definitions/{form}/sections/{section}` | Delete a section | Super Admin |
| `POST` | `/api/form/definitions/{form}/sections/reorder` | Reorder sections | Super Admin |

### Super Admin Only — Form Fields

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/form/sections/{section}/fields` | List fields in a section | Super Admin |
| `POST` | `/api/form/sections/{section}/fields` | Add a field to a section | Super Admin |
| `PUT` | `/api/form/sections/{section}/fields/{field}` | Update a field | Super Admin |
| `DELETE` | `/api/form/sections/{section}/fields/{field}` | Delete a field | Super Admin |
| `POST` | `/api/form/sections/{section}/fields/reorder` | Reorder fields within a section | Super Admin |
| `POST` | `/api/form/fields/{field}/activate` | Activate a field | Super Admin |
| `POST` | `/api/form/fields/{field}/deactivate` | Deactivate a field | Super Admin |

### Super Admin Only — Field Options

For select, checkbox, and radio field types.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/form/fields/{field}/options` | List options for a field | Super Admin |
| `POST` | `/api/form/fields/{field}/options` | Add an option to a field | Super Admin |
| `PUT` | `/api/form/fields/{field}/options/{option}` | Update an option | Super Admin |
| `DELETE` | `/api/form/fields/{field}/options/{option}` | Delete an option | Super Admin |
| `POST` | `/api/form/fields/{field}/options/reorder` | Reorder options | Super Admin |

### GET /form/active

Get the currently active form schema. Response is cached for 10 minutes (`form.active.v{version}`).

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**Success (200):** Full active form definition with nested sections, fields, and options

---

### GET /form/version/{form}

Get a specific form version by ID.

**Auth:** Yes | **Role:** Any | **Rate Limit:** `api`

**URL Parameters:** `form` (integer) — Form definition ID

**Success (200):** Form definition object with nested sections, fields, and options

---

### GET /form/definitions

List all form definitions.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Response:** Array of form definition objects (id, label, version, status, created_at)

**Note:** N+1 eliminated — sections and field counts are eager-loaded.

---

### GET /form/definitions/{form}

View form definition details.

**Auth:** Yes | **Role:** Admin | **Rate Limit:** `api`

**Success (200):** Full form definition with nested sections and fields

---

### POST /form/definitions

Create a new form definition (always created as draft).

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| label | string | Yes | Max 255 characters |
| description | string | No | Form description |

**Success (201):** Created form definition object

---

### PUT /form/definitions/{form}

Update a form definition's metadata.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated form definition object

---

### DELETE /form/definitions/{form}

Delete a form definition. Only draft definitions may be deleted; published definitions cannot be removed.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Error (422):** Returned if attempting to delete a published form definition

**Success (200):** `{ "message": "Form definition deleted." }`

---

### POST /form/definitions/{form}/publish

Publish a draft form definition. The previously active form is automatically archived. Cache is invalidated inside the publish transaction.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Success (200):** Published form definition object

---

### POST /form/definitions/{form}/duplicate

Duplicate an existing form definition, creating a new draft copy. N+1 eliminated — all sections, fields, and options are duplicated in a single transaction.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Success (201):** New draft form definition object

---

### GET /form/definitions/{form}/sections

List sections for a form definition.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Response:** Array of section objects ordered by `sort_order`

---

### POST /form/definitions/{form}/sections

Add a section to a form definition.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| title | string | Yes | Max 255 characters |
| description | string | No | Section description |

**Success (201):** Created section object

---

### PUT /form/definitions/{form}/sections/{section}

Update a section.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated section object

---

### DELETE /form/definitions/{form}/sections/{section}

Delete a section and all its fields.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Section deleted." }`

---

### POST /form/definitions/{form}/sections/reorder

Reorder sections within a form definition. The request must be scoped to the correct form to prevent cross-form reordering.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| order | array | Yes | Array of section IDs in desired order |

**Success (200):** `{ "message": "Sections reordered." }`

---

### GET /form/sections/{section}/fields

List fields in a section.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Response:** Array of field objects ordered by `sort_order`

---

### POST /form/sections/{section}/fields

Add a field to a section.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| field_key | string | Yes | Unique within the form definition, snake_case |
| label | string | Yes | Max 255 characters |
| field_type | string | Yes | text, textarea, select, checkbox, radio, date, file, number |
| is_required | boolean | No | Default: false |
| placeholder | string | No | Max 255 characters |
| help_text | string | No | Max 1000 characters |

**Success (201):** Created field object

---

### PUT /form/sections/{section}/fields/{field}

Update a field. The `field_key` cannot be changed if applications have been submitted referencing it.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Error (422):** `{ "message": "field_key cannot be renamed: applications reference this key." }` if renaming a key in use.

**Success (200):** Updated field object

---

### DELETE /form/sections/{section}/fields/{field}

Delete a field.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Field deleted." }`

---

### POST /form/sections/{section}/fields/reorder

Reorder fields within a section. The request is scoped to prevent cross-section reordering.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| order | array | Yes | Array of field IDs in desired order |

**Success (200):** `{ "message": "Fields reordered." }`

---

### POST /form/fields/{field}/activate

Activate a field, making it visible in the form schema.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Success (200):** Updated field object

---

### POST /form/fields/{field}/deactivate

Deactivate a field, hiding it from the form schema without deleting it.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Success (200):** Updated field object

---

### GET /form/fields/{field}/options

List options for a select, checkbox, or radio field.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Response:** Array of option objects ordered by `sort_order`

---

### POST /form/fields/{field}/options

Add an option to a field.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| label | string | Yes | Max 255 characters |
| value | string | Yes | Max 255 characters, unique within the field |

**Success (201):** Created option object

---

### PUT /form/fields/{field}/options/{option}

Update an option.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

All parameters optional (same validation as POST).

**Success (200):** Updated option object

---

### DELETE /form/fields/{field}/options/{option}

Delete an option.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

**Success (200):** `{ "message": "Option deleted." }`

---

### POST /form/fields/{field}/options/reorder

Reorder options within a field. The request is scoped to prevent cross-field reordering.

**Auth:** Yes | **Role:** Super Admin | **Rate Limit:** `api`

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| order | array | Yes | Array of option IDs in desired order |

**Success (200):** `{ "message": "Options reordered." }`

---

## System Health Endpoints

Public liveness and readiness probes. No authentication required.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| `GET` | `/api/health` | Liveness check | Public |
| `GET` | `/api/ready` | Readiness check | Public |

### GET /health

Liveness check. Returns `200 OK` if the application is running.

**Auth:** No | **Rate Limit:** None

**Success (200):** `{ "status": "ok" }`

---

### GET /ready

Readiness check. Returns `200 OK` if the application and its dependencies (database, cache) are ready to serve traffic.

**Auth:** No | **Rate Limit:** None

**Success (200):** `{ "status": "ready" }`

**Error (503):** `{ "status": "unavailable", "reason": "database connection failed" }` if any dependency is unhealthy.

---

---

**API Version:** 1.0
**Last Updated:** March 2026
**Total Endpoints:** ~164
**Authentication:** Laravel Sanctum Bearer Tokens
**Compliance:** HIPAA-compliant PHI access auditing, CYSHCN medical compliance enforcement
