# TESTING.md

# Camp Burnt Gin API - Backend Testing Guide

---

## 1. Overview

### What This Document Is For

This document provides a complete guide to testing the Camp Burnt Gin API backend. It explains how to verify that all backend features work correctly, how to run tests, and how to interpret results.

### What Parts of the System Are Being Tested

This guide covers **backend-only testing**. The following components are tested:

- **Authentication**: User registration, login, logout, and password reset
- **Multi-Factor Authentication (MFA)**: TOTP-based MFA setup, verification, and disabling
- **Role-Based Access Control (RBAC)**: Super admin, admin, parent, and medical provider role restrictions with hierarchical authority
- **Camper Management**: Creating and managing camper profiles
- **Application Workflow**: Creating, submitting, reviewing, and signing applications
- **Medical Records**: HIPAA-compliant medical information management
- **Emergency Contacts**: Contact management with pickup authorization
- **Allergies and Medications**: Health data tracking
- **Document Uploads**: File upload, download, and validation
- **Medical Provider Links**: Secure token-based provider access
- **Notifications**: User notification delivery and management
- **Inbox Messaging**: HIPAA-compliant internal messaging with read receipts and attachments
- **Reports**: Administrative reporting endpoints
- **Camp and Session Management**: Camp program administration

### What It Means for the Backend to Be "Working Correctly"

The backend is working correctly when:

1. All API endpoints return correct HTTP status codes
2. Authentication protects all secured endpoints
3. Authorization restricts access based on user roles
4. Input validation rejects invalid data with clear error messages
5. Database operations create, read, update, and delete data correctly
6. Business rules are enforced (e.g., parents can only access their own children)
7. All automated tests pass without failures

---

## Quick Start (5 Minutes)

For a rapid verification that the backend is functional, run these commands in order:

```bash
composer install
php artisan key:generate
php artisan migrate
php artisan test
```

**Observable Success:**
- All commands complete without errors
- Final output shows `Tests: 308 passed (708 assertions)` with zero failures
- No red text or `FAIL` messages appear
- Test duration: 2-3 seconds

If all 308 tests pass, the backend is verified and working correctly.

---

## 2. Who This Testing Guide Is For

### Who Can Use This Guide

- **Developers** working on or reviewing the codebase
- **Professors and TAs** evaluating the project
- **Reviewers** assessing code quality and functionality
- **Team members** performing quality assurance

### Technical Knowledge Assumed

This guide assumes you:

- Can use a command-line terminal
- Can run basic shell commands (cd, ls, cat)
- Understand what an API endpoint is
- Know that HTTP status codes like 200, 401, 403, and 422 have meanings

### What You Do NOT Need to Know

You do not need to:

- Understand the internal implementation of the code
- Know PHP or Laravel framework specifics
- Have experience with the specific testing tools
- Understand database schemas or SQL

---

## 3. Prerequisites

### Checklist: Required Before Testing

Complete all items before proceeding with tests.

#### Software Requirements

- [ ] **PHP 8.2 or higher** installed
  - Verify: Run `php -v` and confirm version is 8.2.x or higher
- [ ] **Composer** (PHP dependency manager) installed
  - Verify: Run `composer -V` and confirm output shows version
- [ ] **MySQL 8.0 or higher** installed and running
  - Verify: Run `mysql --version` and confirm output
- [ ] **Git** installed (for cloning the repository)
  - Verify: Run `git --version` and confirm output

#### Environment Setup

- [ ] Repository cloned to local machine
- [ ] Terminal open in the project root directory:
  ```
  /path/to/camp-burnt-gin-api
  ```
- [ ] `.env` file exists (copy from `.env.example` if needed)
  - Verify: Run `ls -la .env` and confirm file exists
- [ ] Database credentials configured in `.env` file

#### Database Requirements

- [ ] MySQL server is running
- [ ] A database named `camp_burnt_gin` exists (or as configured in `.env`)
- [ ] Database user has full permissions on the database

#### Verification Commands

Run these commands to verify your environment:

```bash
# Check PHP version (expect 8.2+)
php -v

# Check Composer is installed
composer -V

# Check you are in the correct directory
pwd
# Should end with: camp-burnt-gin-api

# Check .env file exists
ls -la .env
```

---

## 4. Test Environment Setup

### Step 1: Install Dependencies

**Command:**
```bash
composer install
```

**What You Should See If It Works:**
```
Installing dependencies from lock file
...
Generating optimized autoload files
...
No errors or warnings at the end
```

**What Indicates Failure:**
- Error messages mentioning "failed to install"
- PHP version compatibility errors
- Missing PHP extensions

### Step 2: Generate Application Key

**Command:**
```bash
php artisan key:generate
```

**What You Should See If It Works:**
```
INFO  Application key set successfully.
```

**What Indicates Failure:**
- Error: "Unable to write to .env file"
- Error: "Application key already set"

### Step 3: Run Database Migrations

**Command:**
```bash
php artisan migrate
```

**What You Should See If It Works:**
```
INFO  Running migrations.

2024_01_01_000000_create_users_table ........... DONE
2024_01_01_000001_create_roles_table ........... DONE
...
(All migrations show DONE)
```

**What Indicates Failure:**
- Error: "Access denied for user"
- Error: "Unknown database"
- Error: "SQLSTATE" followed by database error

### Step 4: Verify the Backend Server Starts

**Command:**
```bash
php artisan serve
```

**What You Should See If It Works:**
```
INFO  Server running on [http://127.0.0.1:8000].
Press Ctrl+C to stop the server
```

**What Indicates Failure:**
- Error: "Address already in use"
- Error: "Failed to listen on 127.0.0.1:8000"

**Note:** Press Ctrl+C to stop the server after verifying it starts.

### Step 5: Confirm Backend Responds to Requests

With the server running (from Step 4), open a **new terminal** and run:

**Command:**
```bash
curl -s http://127.0.0.1:8000/api/camps | head -20
```

**What You Should See If It Works:**
```json
{"data":[...],"links":...,"meta":...}
```
Or:
```json
{"data":[]}
```

The response should be valid JSON, not an error page.

**What Indicates Failure:**
- "Connection refused"
- HTML error page content
- No response at all

---

## 5. Testing Strategy (High-Level)

### Types of Backend Tests Used

This project uses three types of tests:

| Test Type | Purpose | Location |
|-----------|---------|----------|
| **Feature Tests** | Test complete API workflows and HTTP requests | `tests/Feature/Api/` |
| **Unit Tests** | Test individual classes in isolation | `tests/Unit/` |
| **Authorization Tests** | Test role-based access restrictions | `tests/Feature/Api/*AuthorizationTest.php` |

### Why These Tests Are Used

- **Feature Tests** verify that API endpoints work correctly end-to-end
- **Unit Tests** verify that individual components behave correctly
- **Authorization Tests** verify that security rules are enforced

### What Is NOT Tested

The following are intentionally not tested in this backend guide:

- Frontend user interface
- Browser interactions
- JavaScript functionality
- Visual styling
- Mobile responsiveness

All testing is performed via API calls and automated test suites.

---

## 6. Running the Full Test Suite

### Command to Run All Tests

```bash
php artisan test
```

### What a Successful Test Run Looks Like

```
   PASS  Tests\Feature\Api\ValidationTest
   registration requires name
   registration requires valid email
   registration requires password confirmation
  ...

   PASS  Tests\Feature\Api\CamperAuthorizationTest
   admin can view all campers
   parent can view own campers
  ...

Tests:    308 passed (708 assertions)
Duration: 4.56s
```

**Key Indicators of Success:**
- All tests show `PASS` or green checkmarks
- Bottom line shows "X passed" with zero failures
- No red text or `FAIL` messages

### What a Failed Test Run Looks Like

```
   FAIL  Tests\Feature\Api\ValidationTest
   registration requires name
  ✗ registration requires valid email

  Failed asserting that 200 matches expected 422.

Tests:    1 failed, 227 passed (429 assertions)
Duration: 2.80s
```

**Key Indicators of Failure:**
- Tests show `FAIL` or red X marks
- Error message explains what went wrong
- Bottom line shows "X failed"

### Typical Test Duration

- Full suite: 2-5 seconds
- Individual tests: Less than 1 second

If tests take longer than 30 seconds, there may be a configuration problem.

### Running a Single Test

To run a specific test method:

```bash
php artisan test --filter test_registration_requires_name
```

---

## 7. Feature-Based Testing (CORE SECTION)

---

### 7.1 Authentication

#### What Is Being Tested

The authentication system allows users to:
- Register new accounts
- Log in with email and password
- Log out and revoke access tokens
- Reset forgotten passwords

**Validates:** FR-1, FR-2, FR-3

#### How to Perform the Test

**Run the authentication validation tests:**
```bash
php artisan test --filter ValidationTest
```

**Test registration via API:**
```bash
curl -X POST http://127.0.0.1:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "SecurePass123",
    "password_confirmation": "SecurePass123"
  }'
```

#### Observable Success Criteria

**For Registration:**
- HTTP Status: `201 Created`
- Response contains: `"user"` object with id, name, email
- Response contains: `"token"` string
- Example success response:
```json
{
  "user": {
    "id": 1,
    "name": "Test User",
    "email": "test@example.com"
  },
  "token": "1|abc123..."
}
```

**For Login:**
- HTTP Status: `200 OK`
- Response contains user data and access token

#### Observable Failure Indicators

**Invalid Registration:**
- HTTP Status: `422 Unprocessable Entity`
- Response contains `"errors"` object with field-specific messages
- Example:
```json
{
  "message": "The email has already been taken.",
  "errors": {
    "email": ["The email has already been taken."]
  }
}
```

**Invalid Login:**
- HTTP Status: `401 Unauthorized`
- Response contains: `"message": "Invalid credentials"`

---

### 7.2 Multi-Factor Authentication (MFA)

#### What Is Being Tested

MFA provides an additional security layer using Time-based One-Time Passwords (TOTP):
- Setting up MFA on an account
- Verifying MFA codes during login
- Disabling MFA when no longer needed

MFA uses a standard TOTP authenticator app (such as Google Authenticator, Authy, or Microsoft Authenticator) to generate 6-digit verification codes.

**Validates:** FR-4, FR-5

#### How to Perform the Test

**Setup MFA (requires authentication):**
```bash
curl -X POST http://127.0.0.1:8000/api/mfa/setup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"
```

#### Observable Success Criteria

**MFA Setup:**
- HTTP Status: `200 OK`
- Response contains: `"secret"` (base32 string)
- Response contains: `"qr_code"` (data URL for authenticator app)
- Example:
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,..."
}
```

**MFA Verification:**
- HTTP Status: `200 OK`
- Response contains: `"message": "MFA enabled successfully"`

#### Observable Failure Indicators

**Invalid MFA Code:**
- HTTP Status: `422 Unprocessable Entity`
- Response contains: `"message": "Invalid verification code"`

**MFA Setup Without Authentication:**
- HTTP Status: `401 Unauthorized`

---

### 7.3 Role-Based Access Control (RBAC)

#### What Is Being Tested

The system enforces four user roles with hierarchical authority:
- **Super Admin**: Absolute system authority and delegation governance
- **Admin**: Full operational access (inherits from super_admin authority model)
- **Parent**: Access to own children only
- **Medical**: Access to medical data only

**Hierarchy:** super_admin > admin > parent > medical

**Validates:** FR-6, FR-7, FR-8

#### How to Perform the Test

**Run authorization tests:**
```bash
php artisan test --filter AuthorizationTest
```

**Test admin-only endpoint as non-admin:**
```bash
# Login as regular parent user first
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email": "parent@example.com", "password": "password"}'

# Try to access admin reports
curl -X GET http://127.0.0.1:8000/api/reports/applications \
  -H "Authorization: Bearer PARENT_TOKEN" \
  -H "Accept: application/json"
```

#### Observable Success Criteria

**Admin accessing admin endpoint:**
- HTTP Status: `200 OK`
- Response contains requested data

**Parent accessing own camper:**
- HTTP Status: `200 OK`
- Response contains camper data

#### Observable Failure Indicators

**Non-admin accessing admin endpoint:**
- HTTP Status: `403 Forbidden`
- Response contains: `"message": "Unauthorized"`
- Example:
```json
{
  "message": "Unauthorized"
}
```

**Parent accessing another parent's camper:**
- HTTP Status: `403 Forbidden`

---

### 7.4 Application Creation and Workflow

#### What Is Being Tested

The application workflow includes:
- Creating draft applications
- Submitting completed applications
- Admin review (approve/reject/waitlist)
- Digital signatures
- Status tracking

**Validates:** FR-9, FR-10, FR-11, FR-12

#### How to Perform the Test

**Run application tests:**
```bash
php artisan test --filter ApplicationAuthorizationTest
```

**Create a draft application:**
```bash
curl -X POST http://127.0.0.1:8000/api/applications \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "camper_id": 1,
    "camp_session_id": 1,
    "is_draft": true
  }'
```

**Submit an application:**
```bash
curl -X PUT http://127.0.0.1:8000/api/applications/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "is_draft": false
  }'
```

#### Observable Success Criteria

**Draft Creation:**
- HTTP Status: `201 Created`
- Response contains application with `"status": "pending"` and `"is_draft": true`

**Application Submission:**
- HTTP Status: `200 OK`
- Response shows `"is_draft": false`
- Response shows `"submitted_at"` timestamp

**Admin Review:**
- HTTP Status: `200 OK`
- Response shows updated `"status"` field
- Response shows `"reviewed_at"` timestamp

#### Observable Failure Indicators

**Missing Required Fields:**
- HTTP Status: `422 Unprocessable Entity`
- Response contains field-specific errors:
```json
{
  "errors": {
    "camper_id": ["The camper id field is required."]
  }
}
```

**Duplicate Application:**
- HTTP Status: `422 Unprocessable Entity`
- Response: "An application for this camper and session already exists"

---

### 7.5 Required Field Validation

#### What Is Being Tested

All API endpoints validate required fields and reject invalid input.

**Validates:** FR-13, FR-14

#### How to Perform the Test

**Run all validation tests:**
```bash
php artisan test tests/Feature/Api/ValidationTest.php
```

**Test missing required field:**
```bash
curl -X POST http://127.0.0.1:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123",
    "password_confirmation": "SecurePass123"
  }'
```

(Note: `name` field is missing)

#### Observable Success Criteria

**Valid Input:**
- HTTP Status: `200 OK` or `201 Created`
- Response contains expected data

**Validation Test Suite:**
- All validation tests pass
- Output shows green checkmarks for each test

#### Observable Failure Indicators

**Missing Required Field:**
- HTTP Status: `422 Unprocessable Entity`
- Response identifies the missing field:
```json
{
  "message": "The name field is required.",
  "errors": {
    "name": ["The name field is required."]
  }
}
```

**Invalid Email Format:**
- HTTP Status: `422 Unprocessable Entity`
- Response: `"The email field must be a valid email address."`

**Password Too Short:**
- HTTP Status: `422 Unprocessable Entity`
- Response: `"The password field must be at least 8 characters."`

---

### 7.6 Administrative-Only Actions

#### What Is Being Tested

Certain actions are restricted to administrators:
- Creating/editing camps and sessions
- Reviewing applications (approve/reject)
- Deleting applications
- Generating reports
- Resending provider links

**Validates:** FR-15, FR-16, FR-17

#### How to Perform the Test

**Test admin endpoint without admin role:**
```bash
# As a regular user, try to create a camp
curl -X POST http://127.0.0.1:8000/api/camps \
  -H "Authorization: Bearer NON_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "name": "New Camp",
    "description": "A test camp"
  }'
```

**Test reports endpoint:**
```bash
curl -X GET http://127.0.0.1:8000/api/reports/applications \
  -H "Authorization: Bearer NON_ADMIN_TOKEN" \
  -H "Accept: application/json"
```

#### Observable Success Criteria

**Admin performing admin action:**
- HTTP Status: `200 OK` or `201 Created`
- Action completes successfully

#### Observable Failure Indicators

**Non-admin attempting admin action:**
- HTTP Status: `403 Forbidden`
- Response:
```json
{
  "message": "Unauthorized"
}
```

---

### 7.7 Medical Provider Restricted Access

#### What Is Being Tested

Medical providers have limited access:
- Can view medical records, allergies, medications
- Cannot modify camper profiles
- Cannot review applications
- Cannot access administrative functions

Token-based provider links allow external medical providers to:
- Access specific camper forms via secure token
- Submit medical information
- Upload documents

**Validates:** FR-18, FR-19, FR-20

#### How to Perform the Test

**Test provider link access:**
```bash
# Access form via provider token (no authentication needed)
curl -X GET http://127.0.0.1:8000/api/provider-access/VALID_TOKEN \
  -H "Accept: application/json"
```

**Test provider link submission:**
```bash
curl -X POST http://127.0.0.1:8000/api/provider-access/VALID_TOKEN/submit \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "physician_name": "Dr. Smith",
    "physician_phone": "555-1234"
  }'
```

#### Observable Success Criteria

**Valid Provider Link:**
- HTTP Status: `200 OK`
- Response contains camper form data
- Link is marked as accessed

**Provider Submission:**
- HTTP Status: `200 OK`
- Response confirms submission received
- Link is marked as submitted (single use)

#### Observable Failure Indicators

**Expired Link:**
- HTTP Status: `403 Forbidden`
- Response: `"message": "This link has expired"`

**Revoked Link:**
- HTTP Status: `403 Forbidden`
- Response: `"message": "This link has been revoked"`

**Already Used Link:**
- HTTP Status: `403 Forbidden`
- Response: `"message": "This link has already been used"`

**Invalid Token:**
- HTTP Status: `404 Not Found`

---

### 7.8 Notifications

#### What Is Being Tested

The notification system handles:
- Application status change notifications
- Incomplete application reminders
- Acceptance/rejection letters
- Provider link notifications

**Validates:** FR-21, FR-22

#### How to Perform the Test

**List user notifications:**
```bash
curl -X GET http://127.0.0.1:8000/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"
```

**Mark notification as read:**
```bash
curl -X PUT http://127.0.0.1:8000/api/notifications/1/read \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"
```

#### Observable Success Criteria

**List Notifications:**
- HTTP Status: `200 OK`
- Response contains array of notifications
- Each notification has: id, type, data, read_at, created_at

**Mark as Read:**
- HTTP Status: `200 OK`
- Notification `read_at` field is now populated

#### Observable Failure Indicators

**Unauthorized Access:**
- HTTP Status: `401 Unauthorized`

**Notification Not Found:**
- HTTP Status: `404 Not Found`

---

### 7.9 File Uploads (Documents)

#### What Is Being Tested

Document management includes:
- File upload with MIME type validation
- File size limits (10MB max)
- Secure file download
- Document deletion

Allowed file types: PDF, JPEG, PNG, GIF, DOC, DOCX

**Validates:** FR-23, FR-24

#### How to Perform the Test

**Upload a document:**
```bash
curl -X POST http://127.0.0.1:8000/api/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json" \
  -F "file=@/path/to/document.pdf" \
  -F "documentable_type=camper" \
  -F "documentable_id=1"
```

**Download a document:**
```bash
curl -X GET http://127.0.0.1:8000/api/documents/1/download \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded_file.pdf
```

#### Observable Success Criteria

**Successful Upload:**
- HTTP Status: `201 Created`
- Response contains document metadata:
```json
{
  "data": {
    "id": 1,
    "original_name": "document.pdf",
    "mime_type": "application/pdf",
    "size": 12345
  }
}
```

**Successful Download:**
- HTTP Status: `200 OK`
- File downloads to specified location
- File content matches original

#### Observable Failure Indicators

**Invalid File Type:**
- HTTP Status: `422 Unprocessable Entity`
- Response:
```json
{
  "errors": {
    "file": ["The file must be a file of type: pdf, jpeg, jpg, png, gif, doc, docx."]
  }
}
```

**File Too Large:**
- HTTP Status: `422 Unprocessable Entity`
- Response: `"The file must not be greater than 10240 kilobytes."`

---

### 7.10 Security Constraints

#### What Is Being Tested

Security measures include:
- All protected endpoints require authentication
- Passwords are hashed and never exposed
- Tokens are securely generated
- CSRF protection for state-changing operations
- Rate limiting on sensitive endpoints

**Validates:** FR-25, FR-26, FR-27

#### How to Perform the Test

**Test unauthenticated access:**
```bash
curl -X GET http://127.0.0.1:8000/api/user \
  -H "Accept: application/json"
```

**Test password not exposed in response:**
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

#### Observable Success Criteria

**Authenticated Endpoint Returns Data:**
- HTTP Status: `200 OK`
- Response contains expected data

**Password Never in Response:**
- User object in response does NOT contain `password` field
- User object does NOT contain `mfa_secret` field

#### Observable Failure Indicators

**Unauthenticated Access:**
- HTTP Status: `401 Unauthorized`
- Response:
```json
{
  "message": "Unauthenticated."
}
```

---

### 7.11 Advanced Security Testing (February 2026 Audit)

#### What Is Being Tested

Enhanced security measures implemented during comprehensive security audit:
- Account lockout after failed login attempts
- Rate limiting on authentication endpoints
- MFA disable brute-force protection
- Token expiration enforcement
- IDOR (Insecure Direct Object Reference) prevention
- PHI access audit logging
- Session encryption

**Validates:** Enterprise security requirements and HIPAA compliance

#### How to Perform the Test

**Run security test suite:**
```bash
php artisan test tests/Feature/Security/
```

**Test account lockout:**
```bash
# Attempt 5 failed logins
for i in {1..5}; do
  curl -X POST http://127.0.0.1:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{"email": "user@example.com", "password": "wrong"}'
done

# 6th attempt should be locked out
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email": "user@example.com", "password": "correct"}'
```

**Test rate limiting:**
```bash
# Rapid-fire authentication attempts
for i in {1..10}; do
  curl -s -X POST http://127.0.0.1:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{"email": "test@example.com", "password": "test"}'
done
```

#### Observable Success Criteria

**Account Lockout:**
- First 5 failed attempts: HTTP 401 with remaining attempts count
- 6th attempt: HTTP 401 with lockout message and retry_after seconds
- After 15 minutes: Account automatically unlocked

**Rate Limiting:**
- Requests within limit: HTTP 200/201/401 based on credentials
- Requests exceeding limit: HTTP 429 (Too Many Requests)
- Response includes `Retry-After` header

**Token Expiration:**
- Tokens expire after 60 minutes of inactivity
- Expired tokens return HTTP 401
- Users must re-authenticate

**IDOR Prevention:**
- Parents cannot access other parents' resources
- Returns HTTP 403 Forbidden
- Sequential ID enumeration blocked

**PHI Audit Logging:**
- All medical record access logged
- Logs include user ID, IP, timestamp, action
- Audit failures don't block requests (graceful degradation)

#### Observable Failure Indicators

**Account Lockout Not Working:**
- Unlimited failed login attempts allowed
- No lockout after 5 failures

**Rate Limiting Not Working:**
- No HTTP 429 responses after excessive requests
- Unlimited requests accepted

**Token Expiration Not Working:**
- Old tokens still valid after 60 minutes
- No automatic session timeout

#### Security Test Categories

| Test File | Tests | Focus |
|-----------|-------|-------|
| AccountLockoutTest.php | 5 | Brute-force protection |
| RateLimitingTest.php | 6 | API abuse prevention |
| TokenExpirationTest.php | 8 | Session timeout |
| IdorPreventionTest.php | 11 | Authorization bypass prevention |
| PhiAuditingTest.php | 9 | HIPAA compliance logging |

**Total Security Tests:** 39 (All passing)

---

### 7.12 Inbox Messaging System

#### What Is Being Tested

The Inbox Messaging System provides HIPAA-compliant internal messaging for secure communication between parents, administrators, and medical providers. Tests verify:
- Conversation creation with role-based restrictions
- Message sending and retrieval
- Read receipt tracking
- File attachment handling with validation
- Participant management (admin-only operations)
- Message immutability and soft deletion
- Idempotency protection
- Rate limiting on messaging operations
- RBAC enforcement across all operations

**Validates:** Inbox functional requirements (FR-INB-01 through FR-INB-30)

#### How to Perform the Test

**Run complete Inbox test suite:**
```bash
php artisan test tests/Feature/Inbox/
```

**Run Conversation tests only:**
```bash
php artisan test tests/Feature/Inbox/ConversationTest.php
```

**Run Message tests only:**
```bash
php artisan test tests/Feature/Inbox/MessageTest.php
```

#### Test Coverage

**ConversationTest.php - 17 tests covering conversation management:**

1. `admin_can_create_conversation_with_parent` - Admin conversation creation
2. `parent_can_create_conversation_with_admin` - Parent-initiated conversations
3. `parent_cannot_create_conversation_with_another_parent` - Parent-to-parent restriction
4. `parent_cannot_create_conversation_with_medical_provider` - Parent-to-medical restriction
5. `medical_provider_cannot_create_conversation` - Medical provider creation block
6. `user_can_list_their_conversations` - Conversation listing and pagination
7. `user_cannot_view_conversation_they_are_not_part_of` - Participant-only access
8. `participant_can_view_conversation_details` - Conversation detail retrieval
9. `creator_can_archive_conversation` - Conversation archiving
10. `non_creator_cannot_archive_conversation` - Archive permission enforcement
11. `only_admin_can_add_participants` - Participant addition (admin-only)
12. `parent_cannot_add_participants` - Non-admin participant addition block
13. `only_admin_can_soft_delete_conversation` - Soft delete (admin-only)
14. `parent_cannot_delete_conversation` - Non-admin deletion block
15. `conversation_creation_is_rate_limited` - Rate limiting enforcement
16. `validation_fails_with_empty_participant_list` - Participant list validation
17. `validation_fails_with_invalid_user_id` - User ID validation

**MessageTest.php - 15 tests covering message operations:**

1. `participant_can_send_message_in_conversation` - Message sending by participants
2. `non_participant_cannot_send_message` - Non-participant message block
3. `message_can_include_attachments` - File attachment support
4. `attachment_size_limit_is_enforced` - 10MB file size limit
5. `attachment_mime_type_restriction_is_enforced` - MIME type validation
6. `idempotency_key_prevents_duplicate_messages` - Duplicate message prevention
7. `participant_can_retrieve_messages` - Message retrieval and pagination
8. `message_is_marked_as_read_when_retrieved` - Automatic read receipt marking
9. `sender_message_is_not_marked_as_read` - Sender read status logic
10. `unread_message_count_is_accurate` - Unread count calculation
11. `message_send_is_rate_limited` - Message rate limiting
12. `only_admin_can_delete_message` - Message deletion (admin-only)
13. `parent_cannot_delete_their_own_message` - Message immutability for non-admins
14. `validation_fails_with_empty_message_body` - Message body validation
15. `validation_fails_with_excessive_attachments` - Attachment count limit (5 max)

**Total Inbox Tests:** 32 (17 conversation + 15 message)

#### Observable Success Criteria

**Conversation Creation:**
- HTTP Status: `201 Created`
- Response contains conversation with participant list
- All participants receive conversation access
- Role restrictions enforced (parents cannot message other parents directly)

**Message Sending:**
- HTTP Status: `201 Created`
- Response contains message with sender details
- Attachments uploaded and associated with message
- Idempotency key prevents duplicate sends
- All participants notified

**Read Receipt Tracking:**
- Message retrieval auto-marks as read for recipient
- Sender's own messages not marked as read
- Unread count decrements after reading

**Participant Management:**
- Only admins can add/remove participants
- Participant addition returns HTTP 200
- Non-admin attempts return HTTP 403

**File Attachments:**
- Up to 5 attachments per message
- Each file limited to 10MB
- Allowed types: pdf, jpeg, png, gif, doc, docx
- Attachment download returns correct MIME type

#### Observable Failure Indicators

**Conversation Creation Failures:**
- HTTP 403: Parent attempting parent-to-parent or parent-to-medical conversation
- HTTP 403: Medical provider attempting any conversation creation
- HTTP 422: Empty participant list or invalid user IDs
- HTTP 429: Rate limit exceeded (5 conversations per minute)

**Message Sending Failures:**
- HTTP 403: Non-participant attempting to send message
- HTTP 403: Sending to archived conversation
- HTTP 422: Empty message body
- HTTP 422: More than 5 attachments
- HTTP 422: File exceeds 10MB
- HTTP 422: Invalid MIME type
- HTTP 429: Rate limit exceeded (60 messages per minute)

**Read Receipt Failures:**
- HTTP 403: Non-participant attempting to view message
- HTTP 404: Message not found

**Participant Management Failures:**
- HTTP 403: Non-admin attempting to add/remove participants
- HTTP 422: Adding user already in conversation
- HTTP 404: Invalid participant user ID

**Soft Delete Failures:**
- HTTP 403: Non-admin attempting to delete conversation or message
- HTTP 404: Conversation/message not found

#### Security and Compliance Verification

**HIPAA Compliance:**
- All message operations logged to audit trail
- Messages immutable (cannot be edited)
- Soft delete preserves audit trail
- PHI access tracked per user

**RBAC Enforcement:**
- Parent-to-parent messaging blocked (must go through admin)
- Medical providers cannot initiate conversations
- Only admins can manage participants
- Only admins can soft delete messages/conversations

**Data Integrity:**
- Idempotency keys prevent duplicate messages
- Rate limiting prevents abuse
- File validation prevents malicious uploads
- Participant verification on all operations

#### Test Execution Example

```bash
# Run full Inbox test suite
php artisan test tests/Feature/Inbox/

# Expected output:
   PASS  Tests\Feature\Inbox\ConversationTest
   ✓ admin can create conversation with parent
   ✓ parent can create conversation with admin
   ✓ parent cannot create conversation with another parent
   ...
   (17 tests)

   PASS  Tests\Feature\Inbox\MessageTest
   ✓ participant can send message in conversation
   ✓ non participant cannot send message
   ✓ message can include attachments
   ...
   (15 tests)

Tests:    32 passed (85 assertions)
Duration: 1.2s
```

---

## 8. Role-Based Access Testing

### Testing Applicant (Parent) Restrictions

**What the Parent Role CAN Do:**
- View and edit their own profile
- Create and manage campers (their children)
- Create and submit applications for their campers
- View their own applications
- Upload documents for their campers
- Create medical provider links for their campers

**What the Parent Role CANNOT Do:**
- View other parents' campers or applications
- Approve or reject applications
- Access administrative reports
- Create or modify camps/sessions
- View all system users

**Test: Parent tries to view another parent's camper**

```bash
curl -X GET http://127.0.0.1:8000/api/campers/OTHER_PARENTS_CAMPER_ID \
  -H "Authorization: Bearer PARENT_TOKEN" \
  -H "Accept: application/json"
```

**Expected Result:**
- HTTP Status: `403 Forbidden`

---

### Testing Medical Provider Restrictions

**What the Medical Role CAN Do:**
- View medical records (all campers)
- View allergies and medications
- View emergency contacts

**What the Medical Role CANNOT Do:**
- Create or edit campers
- Create or review applications
- Access administrative reports
- Modify medical records (view only)

**Test: Medical provider tries to create application**

```bash
curl -X POST http://127.0.0.1:8000/api/applications \
  -H "Authorization: Bearer MEDICAL_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"camper_id": 1, "camp_session_id": 1}'
```

**Expected Result:**
- HTTP Status: `403 Forbidden`

---

### Testing Administrator Privileges

**What the Admin Role CAN Do:**
- All actions available to parent and medical roles
- Create, edit, and delete camps and sessions
- Review and change application status
- Generate all reports
- View all campers and applications
- Delete any record

**Test: Admin reviews an application**

```bash
curl -X POST http://127.0.0.1:8000/api/applications/1/review \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"status": "approved", "notes": "Approved by admin"}'
```

**Expected Result:**
- HTTP Status: `200 OK`
- Application status changed to "approved"

---

## 9. Negative and Edge Case Testing

### 9.1 Invalid Input Testing

**Test: Registration with invalid email**
```bash
curl -X POST http://127.0.0.1:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "name": "Test",
    "email": "not-an-email",
    "password": "SecurePass123",
    "password_confirmation": "SecurePass123"
  }'
```

**Expected Result:**
- HTTP Status: `422 Unprocessable Entity`
- Error: `"The email field must be a valid email address."`

---

### 9.2 Missing Required Fields

**Test: Create camper without required fields**
```bash
curl -X POST http://127.0.0.1:8000/api/campers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{}'
```

**Expected Result:**
- HTTP Status: `422 Unprocessable Entity`
- Errors for: first_name, last_name, date_of_birth

---

### 9.3 Unauthorized Access Attempts

**Test: Access without token**
```bash
curl -X GET http://127.0.0.1:8000/api/campers \
  -H "Accept: application/json"
```

**Expected Result:**
- HTTP Status: `401 Unauthorized`
- Message: `"Unauthenticated."`

**Test: Access with invalid token**
```bash
curl -X GET http://127.0.0.1:8000/api/campers \
  -H "Authorization: Bearer invalid_token_here" \
  -H "Accept: application/json"
```

**Expected Result:**
- HTTP Status: `401 Unauthorized`

---

### 9.4 Expired Medical Provider Links

**Test: Access expired provider link**
```bash
curl -X GET http://127.0.0.1:8000/api/provider-access/EXPIRED_TOKEN \
  -H "Accept: application/json"
```

**Expected Result:**
- HTTP Status: `403 Forbidden`
- Message: `"This link has expired"`

---

### 9.5 Revoked Medical Provider Links

**Test: Access revoked provider link**
```bash
curl -X GET http://127.0.0.1:8000/api/provider-access/REVOKED_TOKEN \
  -H "Accept: application/json"
```

**Expected Result:**
- HTTP Status: `403 Forbidden`
- Message: `"This link has been revoked"`

---

### 9.6 Invalid File Uploads

**Test: Upload executable file**
```bash
curl -X POST http://127.0.0.1:8000/api/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json" \
  -F "file=@/path/to/script.exe" \
  -F "documentable_type=camper" \
  -F "documentable_id=1"
```

**Expected Result:**
- HTTP Status: `422 Unprocessable Entity`
- Error: File type not allowed

**Test: Upload oversized file (>10MB)**

**Expected Result:**
- HTTP Status: `422 Unprocessable Entity`
- Error: `"The file must not be greater than 10240 kilobytes."`

---

### 9.7 Duplicate Record Prevention

**Test: Create duplicate application for same camper/session**
```bash
# First application created successfully
# Second application attempt:
curl -X POST http://127.0.0.1:8000/api/applications \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"camper_id": 1, "camp_session_id": 1}'
```

**Expected Result:**
- HTTP Status: `422 Unprocessable Entity`
- Error indicates duplicate

---

## 10. Non-Functional Verification

### 10.1 Security Enforcement

**Evidence of Security:**

| Security Measure | How to Verify |
|------------------|---------------|
| Authentication required | Access `/api/user` without token returns 401 |
| Password hashing | User response never contains `password` field |
| Token-based auth | Sanctum tokens are long random strings |
| Role enforcement | Non-admin accessing `/api/reports/*` returns 403 |
| Input validation | Invalid data returns 422 with specific errors |

**Test Command:**
```bash
# Verify passwords are not exposed
curl -X GET http://127.0.0.1:8000/api/user \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json" | grep -i password
```

**Expected Result:** No output (password field not present)

---

### 10.2 Data Integrity

**Evidence of Data Integrity:**

| Integrity Rule | How to Verify |
|----------------|---------------|
| Foreign key constraints | Deleting a camper cascades to related records |
| Unique constraints | Duplicate emails on registration returns 422 |
| Required fields | Missing fields returns 422 with field names |
| Date validation | Future birth dates rejected |

**Test Command:**
```bash
# Verify unique email constraint
php artisan test --filter test_registration_requires_unique_email
```

---

### 10.3 Reliability

**Evidence of Reliability:**

| Reliability Aspect | How to Verify |
|--------------------|---------------|
| Consistent responses | Same request returns same structure |
| Error handling | Invalid requests return proper error format |
| Transaction safety | Failed operations don't leave partial data |

**Test Command:**
```bash
# Run full test suite multiple times
php artisan test
php artisan test
php artisan test
```

**Expected Result:** All runs pass with identical results

---

### 10.4 Performance Expectations

While this guide does not include stress testing, the backend should:

- Respond to individual API requests in under 500ms
- Handle test suite completion in under 10 seconds
- Not timeout on standard CRUD operations

**Quick Performance Check:**
```bash
time curl -s http://127.0.0.1:8000/api/camps > /dev/null
```

**Expected Result:** Real time under 1 second

---

## 11. Interpreting Results

### How to Know the Backend Is Ready

The backend is ready for use when:

1. **All migrations complete successfully**
   - `php artisan migrate` shows all DONE

2. **All tests pass**
   - `php artisan test` shows 0 failures

3. **Server responds to requests**
   - `curl http://127.0.0.1:8000/api/camps` returns JSON

4. **Authentication works**
   - Registration creates user and returns token
   - Login returns token for valid credentials
   - Protected endpoints reject unauthenticated requests

5. **Authorization works**
   - Admin endpoints reject non-admin users
   - Parents can only access their own campers

### What to Do If a Test Fails

1. **Read the error message carefully**
   - It tells you what was expected vs what happened

2. **Check the specific test file**
   - Tests are in `tests/Feature/Api/`

3. **Verify database state**
   - Run `php artisan migrate:fresh` to reset

4. **Check environment configuration**
   - Verify `.env` settings match requirements

5. **Run the single failing test**
   ```bash
   php artisan test --filter failing_test_name
   ```

### How These Tests Support Grading

| Criterion | Evidence |
|-----------|----------|
| Functionality | All feature tests pass |
| Security | Authorization tests prevent unauthorized access |
| Validation | Validation tests reject invalid input |
| Code Quality | Tests document expected behavior |
| Completeness | Test coverage of all major features |

---

## 12. Conclusion

### What Was Tested

This testing guide covers:

- User authentication and MFA
- Role-based access control (admin, parent, medical)
- Complete application workflow
- Medical data management
- Document upload and download
- Provider link security
- Input validation
- Error handling

### Why the Testing Is Sufficient

The testing approach ensures:

1. **Functional correctness** - Feature tests verify all API endpoints work
2. **Security enforcement** - Authorization tests verify role restrictions
3. **Data validation** - Validation tests verify input requirements
4. **Edge case handling** - Negative tests verify error responses

### Confidence in Backend Correctness

When all tests pass:

- The API accepts valid requests and rejects invalid ones
- Authorization rules are enforced consistently
- Data integrity constraints are maintained
- The system behaves predictably and securely

The backend is ready for integration with a frontend application or for evaluation and demonstration purposes.

---

## Quick Reference: Common Test Commands

```bash
# Run all tests
php artisan test

# Run specific test file
php artisan test tests/Feature/Api/ValidationTest.php

# Run specific test method
php artisan test --filter test_method_name

# Run tests with verbose output
php artisan test --verbose

# Run tests and stop on first failure
php artisan test --stop-on-failure

# Check test coverage (if configured)
php artisan test --coverage
```

---

## Quick Reference: Key API Endpoints

| Endpoint | Method | Auth Required | Admin Only |
|----------|--------|---------------|------------|
| `/api/auth/register` | POST | No | No |
| `/api/auth/login` | POST | No | No |
| `/api/user` | GET | Yes | No |
| `/api/campers` | GET | Yes | No |
| `/api/applications` | GET | Yes | No |
| `/api/applications/{id}/review` | POST | Yes | Yes |
| `/api/reports/applications` | GET | Yes | Yes |
| `/api/provider-access/{token}` | GET | No | No |

---

*Document Version: 1.3*
*Last Updated: February 2026*
*Test Suite: 308 tests, 708 assertions, 100% pass rate*
