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
        "email": "parent@example.com",
        "role": "parent"
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

- Tokens expire after 60 minutes of inactivity
- Expired tokens return `401 Unauthorized`
- Clients should handle 401 responses by redirecting to login

### Public Endpoints

The following endpoints do not require authentication:
- `POST /api/auth/register` — User registration
- `POST /api/auth/login` — User login
- `POST /api/auth/password/email` — Password reset request
- `POST /api/auth/password/reset` — Password reset completion
- `GET /api/camps` — List active camps (public view)
- `GET /api/camp-sessions` — List active sessions (public view)
- `GET /api/provider-access/{token}` — Medical provider access (token-based)

---

## 4. Role Access Model

The API implements role-based access control (RBAC) with a four-tier hierarchical role system:

**Hierarchy:** super_admin > admin > parent > medical

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
| `POST` | `/api/auth/password/email` | Request password reset link | Public |
| `POST` | `/api/auth/password/reset` | Complete password reset | Public (with token) |

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
| `GET` | `/api/user` | Get current user profile | Authenticated |
| `PUT` | `/api/user` | Update profile (name, email) | Authenticated |
| `GET` | `/api/user/prefill` | Get pre-filled data for returning families | Authenticated |

**Key Features:**
- Profile information management
- Pre-fill data for returning applicants
- Email change with verification

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
| `GET` | `/api/camp-sessions` | List all sessions | Public (active) / Admin (all) |
| `GET` | `/api/camp-sessions/{id}` | View session details | Public |
| `POST` | `/api/camp-sessions` | Create new session | Admin |
| `PUT` | `/api/camp-sessions/{id}` | Update session | Admin |
| `DELETE` | `/api/camp-sessions/{id}` | Delete session | Admin |

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
| `POST` | `/api/notifications/{id}/read` | Mark notification as read | Authenticated |
| `POST` | `/api/notifications/read-all` | Mark all notifications as read | Authenticated |

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

- Tokens expire after 60 minutes of inactivity
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

## Summary

The Camp Burnt Gin API provides comprehensive functionality for camp registration, medical information management, and administrative workflows. The API follows RESTful conventions, implements robust security measures, and supports role-based access control appropriate for handling Protected Health Information.

**Key Features:**
- Token-based authentication with MFA support
- Role-based access control (admin, parent, medical provider)
- Protected Health Information (PHI) handling with HIPAA compliance
- Comprehensive application lifecycle management
- Secure document uploads with validation
- Medical provider access via secure tokens
- Administrative reporting and analytics

For detailed endpoint specifications, request/response schemas, and code examples, consult [API_REFERENCE.md](API_REFERENCE.md).
