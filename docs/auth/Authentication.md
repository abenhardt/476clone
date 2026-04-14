# Authentication and Authorization

This document provides comprehensive documentation of the authentication and authorization mechanisms implemented in the Camp Burnt Gin API backend.

---

## Table of Contents

1. [Authentication System](#authentication-system)
2. [Laravel Sanctum Implementation](#laravel-sanctum-implementation)
3. [Multi-Factor Authentication](#multi-factor-authentication)
4. [Password Security](#password-security)
5. [Session Management](#session-management)
6. [Authorization System](#authorization-system)
7. [Policy-Based Authorization](#policy-based-authorization)
8. [Security Features](#security-features)

---

## Authentication System

### Overview

The Camp Burnt Gin API uses token-based authentication via Laravel Sanctum. This stateless authentication system is appropriate for API-only backends and provides secure, scalable authentication without server-side session storage.

### Authentication Flow

```
Client Request                    Server Processing
─────────────────                ─────────────────

1. Login Request
   POST /api/auth/login
   {
     "email": "user@example.com",
     "password": "SecurePass123",
     "mfa_code": "123456"
   }
                        ──────► Validate credentials (email + password)
                                Check if MFA is enabled
                                If MFA enabled, verify TOTP code
                                Generate API token (Sanctum)
                                Hash token (SHA-256) and store

2. Login Response
   {
     "user": {...},
     "token": "1|abc123...",
     "mfa_enabled": false
   }              ◄──────

3. Authenticated Request
   GET /api/campers
   Authorization: Bearer 1|abc123...
                        ──────► Validate token against database
                                Load user from token
                                Check token expiration (30 min)
                                Execute request with authenticated user

4. Response
   {
     "data": [...]
   }              ◄──────
```

### Registration

**Endpoint:** `POST /api/auth/register`

**Required Fields:**
- `name` - Full name (string, max 255)
- `email` - Valid email address (unique)
- `password` - Minimum 8 characters with uppercase, lowercase, number
- `password_confirmation` - Must match password

**Process:**
1. Validate input
2. Check email uniqueness
3. Hash password using bcrypt (cost factor 14)
4. Create user record
5. Assign default role (applicant)
6. Generate API token
7. Return user and token

### Login

**Endpoint:** `POST /api/auth/login`

**Required Fields:**
- `email` - User email address
- `password` - User password
- `mfa_code` - (optional) TOTP code if MFA enabled

**Process:**
1. Validate credentials
2. Check account lockout status
3. Verify password hash
4. Check MFA enabled status
5. If MFA enabled, verify TOTP code
6. Generate new API token
7. Reset failed login attempts
8. Return user and token

**Account Lockout:**
- Locks after 5 failed login attempts
- 15-minute lockout duration
- Automatic unlock after expiration
- Failed attempt counter visible in response

### Logout

**Endpoint:** `POST /api/auth/logout`

**Process:**
1. Authenticate request
2. Delete current API token from database
3. Token immediately invalid
4. Return success confirmation

---

## Laravel Sanctum Implementation

### Token Generation

Sanctum generates plain-text tokens that are returned to the client once. The token is hashed (SHA-256) before storage in the database.

**Token Structure:**
```
<token_id>|<token_string>
Example: 1|KpPJQm8tGqHZ5wNrYxV3LbC7DfMj4sRt
```

### Token Storage

Tokens are stored in the `personal_access_tokens` table:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | bigint | Token identifier |
| `tokenable_type` | varchar | Polymorphic type (User) |
| `tokenable_id` | bigint | User ID |
| `name` | varchar | Token name (always "auth") |
| `token` | varchar(64) | SHA-256 hash of token |
| `abilities` | text | Token abilities (always ["*"]) |
| `expires_at` | timestamp | Expiration timestamp (30 minutes) |
| `created_at` | timestamp | Token creation time |

### Token Validation

On each authenticated request:

1. Extract token from `Authorization: Bearer <token>` header
2. Parse token to get `<token_id>|<token_string>`
3. Hash `<token_string>` using SHA-256
4. Query database for token with matching ID and hash
5. Verify token has not expired
6. Load associated user
7. Inject user into request

If validation fails at any step, return HTTP 401 Unauthorized.

### Token Expiration

**Configuration:** `config/sanctum.php`

```php
'expiration' => 30, // 30 minutes
```

Tokens automatically expire 30 minutes after creation. This enforces HIPAA-compliant automatic session timeout.

**Expiration Behavior:**
- Expired tokens return HTTP 401
- Client must re-authenticate
- No grace period or token refresh mechanism

---

## Multi-Factor Authentication

### Overview

MFA provides an additional security layer using Time-based One-Time Passwords (TOTP) compatible with standard authenticator apps (Google Authenticator, Authy, Microsoft Authenticator).

### MFA Enrollment

**Endpoint:** `POST /api/mfa/setup`

**Process:**
1. Generate 160-bit secret key
2. Create QR code URL for authenticator app
3. Store secret in database (not yet enabled)
4. Return secret and QR code to client

**Response:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,..."
}
```

**Endpoint:** `POST /api/mfa/verify`

**Required Fields:**
- `code` - 6-digit TOTP code from authenticator app

**Process:**
1. Retrieve user's MFA secret
2. Verify code using Google2FA library
3. If valid, set `mfa_enabled = true` and `mfa_verified_at = now()`
4. Return success confirmation

### MFA Login

When MFA is enabled, login requires both password and TOTP code:

**Login Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "mfa_code": "123456"
}
```

**Validation:**
- Password verified first
- If valid, TOTP code verified
- Code must be valid for current time window (±1 window for clock skew)
- Rate limited to 3 attempts per minute per user

### MFA Enforcement by Role

MFA enrollment is mandatory for the `admin`, `super_admin`, and `medical` roles. Enforcement operates at two independent layers:

| Layer | Middleware Alias | Purpose |
|---|---|---|
| Enrollment gate | `mfa.enrolled` | Blocks all protected routes until the account has completed MFA setup |
| Step-up gate | `mfa.step_up` | Requires a fresh TOTP verification for sensitive operations (e.g., audit export, user management) |

The `EnsureUserIsMedicalProvider`, `EnsureUserIsAdmin`, and `EnsureUserHasRole` middleware classes validate role membership only. They do not duplicate the MFA check. MFA is enforced solely via the `mfa.enrolled` alias applied to elevated-role route groups in `routes/api.php`.

`applicant` role accounts are not subject to mandatory MFA enrollment.

### MFA Disable

**Endpoint:** `POST /api/mfa/disable`

**Required Fields:**
- `password` - Current password
- `code` - Valid TOTP code from authenticator app

**Process:**
1. Verify current password
2. Verify TOTP code
3. Set `mfa_enabled = false` and clear `mfa_secret`
4. Return success confirmation

**Security:**
- Requires both password AND valid MFA code to disable
- Rate limited to 5 attempts per 15 minutes per user
- Prevents unauthorized MFA disable even with stolen password

---

## Password Security

### Password Requirements

Enforced at registration and password reset:

| Requirement | Rule |
|-------------|------|
| Minimum length | 8 characters |
| Uppercase | At least one uppercase letter |
| Lowercase | At least one lowercase letter |
| Number | At least one digit |
| Confirmation | Must match confirmation field |

### Password Hashing

**Algorithm:** bcrypt with cost factor 14

**Configuration:** `config/hashing.php`

```php
'bcrypt' => [
    'rounds' => env('BCRYPT_ROUNDS', 14),
],
```

**Security:**
- Each password has unique salt
- Hash length: 60 characters
- Computationally expensive to brute force
- Resistant to rainbow table attacks

### Password Reset

**Request Reset:** `POST /api/auth/forgot-password`

**Process:**
1. Validate email
2. Check user exists
3. Generate 64-character cryptographically secure token
4. Hash token and store with 30-minute expiration
5. Email reset link to user

**Reset Password:** `POST /api/auth/reset-password`

**Required Fields:**
- `token` - Reset token from email link
- `email` - User email address
- `password` - New password
- `password_confirmation` - Password confirmation

**Process:**
1. Validate token and email
2. Check token not expired (30 minutes)
3. Verify password meets requirements
4. Hash new password
5. Update user password
6. Delete reset token
7. Return success confirmation

---

## Session Management

### Token Lifecycle

| Event | Action |
|-------|--------|
| Login | New token generated |
| Request | Token validated against database |
| Expiration | Token becomes invalid after 30 minutes |
| Logout | Current token deleted |

### Concurrent Sessions

The system supports multiple concurrent sessions:
- Each device/client receives unique token
- Tokens expire independently
- Logout only revokes current token
- All tokens can be revoked by changing password

### Session Timeout

**Automatic Timeout:** 30 minutes

Enforced via Sanctum token expiration:
```php
'expiration' => 30, // minutes
```

**HIPAA Compliance:** Automatic session timeout prevents unauthorized access from abandoned sessions.

---

## Authorization System

### Overview

Authorization is enforced through Laravel's Policy system. Every resource operation checks user permissions before execution.

### Authorization Flow

```
Request → Middleware → Controller → Policy → Service → Model
                                      ↓
                                   Allow/Deny
```

### Policy Structure

Each model has a corresponding policy:

| Model | Policy | Location |
|-------|--------|----------|
| User | N/A | Controllers handle user-specific logic |
| Camper | CamperPolicy | `app/Policies/CamperPolicy.php` |
| Application | ApplicationPolicy | `app/Policies/ApplicationPolicy.php` |
| MedicalRecord | MedicalRecordPolicy | `app/Policies/MedicalRecordPolicy.php` |
| Allergy | AllergyPolicy | `app/Policies/AllergyPolicy.php` |
| Medication | MedicationPolicy | `app/Policies/MedicationPolicy.php` |
| EmergencyContact | EmergencyContactPolicy | `app/Policies/EmergencyContactPolicy.php` |
| Document | DocumentPolicy | `app/Policies/DocumentPolicy.php` |
| Conversation | ConversationPolicy | `app/Policies/ConversationPolicy.php` |
| Message | MessagePolicy | `app/Policies/MessagePolicy.php` |

### Policy Methods

Standard policy methods:

| Method | Purpose | Typical Usage |
|--------|---------|---------------|
| `viewAny` | List resources | Index endpoints |
| `view` | View single resource | Show endpoints |
| `create` | Create resource | Store endpoints |
| `update` | Update resource | Update endpoints |
| `delete` | Delete resource | Delete endpoints |

Custom policy methods (application-specific):
- `review` - Review applications (admin only)
- `revoke` - Revoke medical provider links
- `archive` - Archive conversations (participant only)
- `addParticipant` - Add participants to conversations
- `removeParticipant` - Remove participants from conversations
- `leave` - Leave conversations
- `viewAttachments` - View message attachments (participant only)

---

## Policy-Based Authorization

### Example: CamperPolicy

```php
class CamperPolicy
{
    public function viewAny(User $user): bool
    {
        // Admins and applicants can list campers
        // Applicants see only their own campers (filtered in controller)
        // Medical providers cannot list campers
        return $user->isAdmin() || $user->isApplicant();
    }

    public function view(User $user, Camper $camper): bool
    {
        // Admins can view any camper
        // Applicants can view only their own campers
        return $user->isAdmin() || $user->ownsCamper($camper);
    }

    public function create(User $user): bool
    {
        // Admins and applicants can create campers
        return $user->isAdmin() || $user->isApplicant();
    }

    public function update(User $user, Camper $camper): bool
    {
        // Admins can update any camper
        // Applicants can update only their own campers
        return $user->isAdmin() || $user->ownsCamper($camper);
    }

    public function delete(User $user, Camper $camper): bool
    {
        // Admins can delete any camper
        // Applicants can delete only their own campers
        return $user->isAdmin() || $user->ownsCamper($camper);
    }
}
```

### Example: ConversationPolicy and MessagePolicy

The Inbox Messaging System implements participant-based authorization where users must be active participants in a conversation to access its contents.

**ConversationPolicy Authorization:**

```php
class ConversationPolicy
{
    public function view(User $user, Conversation $conversation): bool
    {
        // Admins can view all conversations
        // Users must be active participants
        return $user->isAdmin() || $conversation->hasParticipant($user);
    }

    public function create(User $user, bool $hasNonAdminParticipants = false): bool
    {
        // Medical providers cannot create conversations
        if ($user->isMedicalProvider()) {
            return false;
        }

        // Admins can create any conversation
        if ($user->isAdmin()) {
            return true;
        }

        // Applicants can only create conversations with admins (no applicant-to-applicant)
        if ($user->isApplicant()) {
            return !$hasNonAdminParticipants;
        }

        return false;
    }

    public function archive(User $user, Conversation $conversation): bool
    {
        // Only active participants can archive conversations
        return $conversation->hasParticipant($user);
    }

    public function addParticipant(User $user, Conversation $conversation, User $newParticipant): bool
    {
        // Admins can add participants to any conversation
        if ($user->isAdmin()) {
            return true;
        }

        // Regular users must be participants to add others
        return $conversation->hasParticipant($user);
    }

    public function leave(User $user, Conversation $conversation): bool
    {
        // Users can leave conversations they participate in
        return $conversation->hasParticipant($user);
    }

    public function delete(User $user, Conversation $conversation): bool
    {
        // Only admins can soft delete conversations
        return $user->isAdmin();
    }
}
```

**MessagePolicy Authorization:**

```php
class MessagePolicy
{
    public function viewAny(User $user, Conversation $conversation): bool
    {
        // Users must be participants to view messages
        return $conversation->hasParticipant($user);
    }

    public function view(User $user, Message $message): bool
    {
        // Users must be participants in the conversation
        return $message->conversation->hasParticipant($user);
    }

    public function create(User $user, Conversation $conversation): bool
    {
        // Users must be participants to send messages
        // Conversation must not be archived
        return $conversation->hasParticipant($user) && !$conversation->is_archived;
    }

    public function update(User $user, Message $message): bool
    {
        // Messages are immutable - no editing allowed
        return false;
    }

    public function delete(User $user, Message $message): bool
    {
        // Only admins can soft delete messages
        return $user->isAdmin();
    }

    public function forceDelete(User $user, Message $message): bool
    {
        // Force delete disabled for HIPAA compliance
        return false;
    }

    public function viewAttachments(User $user, Message $message): bool
    {
        // Users must be participants to download attachments
        return $message->conversation->hasParticipant($user);
    }
}
```

**Inbox Authorization Rules Summary:**

| Action | Admin | Parent | Medical Provider |
|--------|-------|--------|------------------|
| Create conversation | Yes (any) | Yes (admin-only participants) | No |
| View conversation | Yes (all) | Yes (if participant) | No |
| Send message | Yes (if participant) | Yes (if participant) | No |
| Edit message | No | No | No |
| Delete message | Yes (soft delete) | No | No |
| Archive conversation | Yes (if participant) | Yes (if participant) | No |
| Add participant | Yes (any) | Yes (own conversations) | No |
| Leave conversation | Yes | Yes | No |

> **Note:** In the table above, "Parent" refers to the `applicant` role. The system uses the role slug `applicant` internally; "parent" is the user-facing label only.

**Key Design Principles:**

1. **Participant-Based Access**: All message operations require active participant status in the conversation
2. **Message Immutability**: Messages cannot be edited after creation to maintain audit integrity
3. **Parent Restrictions**: Parents can only create conversations with admins (no parent-to-parent messaging)
4. **Admin Moderation**: Admins can soft delete messages and conversations without destroying audit trail
5. **No Force Delete**: Permanent deletion disabled to comply with HIPAA retention requirements

### Controller Authorization

Controllers use the `authorize` method:

```php
public function show(Camper $camper)
{
    $this->authorize('view', $camper);

    return response()->json(['data' => $camper]);
}
```

If authorization fails, Laravel automatically returns HTTP 403 Forbidden.

---

## Security Features

### Account Lockout

**Implementation:** `app/Services/AuthService.php`

**Trigger:** 5 failed login attempts

**Duration:** 15 minutes

**Behavior:**
- Failed attempts tracked in `users.failed_login_attempts`
- Lockout timestamp stored in `users.lockout_until`
- Login blocked even with correct password during lockout
- Counter resets on successful login
- Lockout expires automatically after 15 minutes

### Rate Limiting

**Implementation:** `routes/api.php` middleware

**Tiers:**

| Endpoint | Limit | Scope | Purpose |
|----------|-------|-------|---------|
| `/api/auth/login` | 5/minute | Per IP | Prevent credential stuffing |
| `/api/mfa/*` | 3/minute | Per user | Prevent MFA brute force |
| `/api/documents` | 5/minute | Per user | Prevent resource abuse |
| General API | 60/minute | Per user | Prevent API abuse |

**Response:** HTTP 429 Too Many Requests with `Retry-After` header

### IDOR Prevention

**Implementation:** Authorization before validation

**Pattern:**
```php
//  Correct: Authorize first
public function update(Request $request, Camper $camper)
{
    $this->authorize('update', $camper); // Check ownership
    $validated = $request->validate([...]); // Then validate input
    // Process update
}

//  Incorrect: Validate first (leaks information)
public function update(Request $request, Camper $camper)
{
    $validated = $request->validate([...]); // Validates even if unauthorized
    $this->authorize('update', $camper); // Too late
}
```

**Prevention:**
- Authorize before validation
- Ownership checked in policies
- Resource IDs validated against user scope
- Sequential ID enumeration blocked

### PHI Audit Logging

**Implementation:** `app/Http/Middleware/AuditPhiAccess.php`

**Logged Operations:**
- Medical record access (view, create, update)
- Camper profile access (view, update)
- Application access (view, update)

**Audit Record:**
```php
[
    'request_id'     => 'req_abc-123-def-456',
    'user_id'        => 1,
    'event_type'     => 'phi_access',
    'auditable_type' => 'App\\Models\\MedicalRecord',
    'auditable_id'   => 5,
    'action'         => 'view',
    'description'    => 'GET /api/medical-records/5',
    'metadata'       => ['route' => 'medical-records.show', 'method' => 'GET', 'status' => 200],
    'ip_address'     => '192.168.1.1',
    'user_agent'     => 'Mozilla/5.0...',
    'created_at'     => '2026-02-11 10:30:45',
    // No updated_at — audit records are immutable
]
```

**Storage:** `audit_logs` table (immutable, no updates allowed)

---

## Related Documentation

- [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) - Role definitions and permission matrix
- [SECURITY.md](SECURITY.md) - Comprehensive security documentation
- [API_REFERENCE.md](API_REFERENCE.md) - API endpoint reference

---

**Document Status:** Complete and authoritative
**Last Updated:** April 2026 (2026-04-09) — Full System Forensic Audit; removed dead provider-access references; corrected MFA enforcement model; corrected audit record field names
