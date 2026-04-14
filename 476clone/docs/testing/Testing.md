# Camp Burnt Gin API - Testing Guide

**Test Suite Status:** 549 passing (100%) | **Runtime:** < 3 seconds | **Assertions:** 1358

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Environment Configuration](#test-environment-configuration)
3. [Test Structure](#test-structure)
4. [Running Tests](#running-tests)
5. [Security Testing](#security-testing)
6. [Regression Testing](#regression-testing)
7. [Inbox Messaging Testing](#inbox-messaging-testing)
8. [Authorization Testing](#authorization-testing)
9. [Code Quality and Static Analysis](#code-quality-and-static-analysis)
10. [CI/CD Integration](#cicd-integration)
11. [Performance Benchmarks](#performance-benchmarks)
12. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Running All Tests

```bash
php artisan test
```

**Expected output:**
```
Tests:    549 passed (1358 assertions)
Duration: < 3 seconds
```

### Docker Environment

```bash
docker-compose exec app php artisan test
```

### Running Specific Test Suites

```bash
# Security tests only
php artisan test tests/Feature/Security

# Regression tests only
php artisan test tests/Feature/Regression

# Authorization tests only
php artisan test tests/Feature/Api/*AuthorizationTest.php

# Specific test class
php artisan test tests/Feature/Security/AccountLockoutTest.php

# Single test method
php artisan test --filter test_account_locks_after_five_failed_attempts
```

---

## Test Environment Configuration

### phpunit.xml Settings

The test environment is configured for fast, deterministic testing:

```xml
<env name="APP_ENV" value="testing"/>
<env name="DB_DATABASE" value=":memory:"/>
<env name="DB_CONNECTION" value="sqlite"/>
<env name="QUEUE_CONNECTION" value="sync"/>
<env name="MAIL_MAILER" value="array"/>
<env name="CACHE_STORE" value="array"/>
<env name="SESSION_DRIVER" value="array"/>
```

**Benefits:**
- **:memory: SQLite** - Fast in-memory database, no disk I/O
- **sync queue** - Jobs execute immediately, no workers needed
- **array mail** - No actual emails sent, messages stored in memory
- **array cache/session** - No Redis/Memcached required

**Important:** Tests never require:
- Queue workers running
- External SMTP servers
- Real database connections
- Manual setup steps

---

## Test Structure

### Overview

| Category | Tests | Location | Purpose |
|----------|-------|----------|---------|
| Security | 41 | `tests/Feature/Security/` | Account lockout, rate limiting, IDOR, PHI auditing, file upload security, token expiration |
| Regression | 48 | `tests/Feature/Regression/` | Queue reliability, audit resilience, performance indexes, compliance enforcement |
| Authorization | 90+ | `tests/Feature/Api/*AuthorizationTest.php` | Policy enforcement, role-based access control |
| Inbox Messaging | 32 | `tests/Feature/Inbox/` | HIPAA-compliant messaging system |
| Validation | 26 | `tests/Feature/Api/ValidationTest.php` | Input validation rules |
| Integration | 30+ | `tests/Feature/Api/` | Complete API workflows |

**Total:** 549 tests, 1358 assertions

---

## Running Tests

### Test Execution Options

```bash
# Run all tests (recommended)
php artisan test

# Run specific test suite
php artisan test tests/Feature/Security
php artisan test tests/Feature/Regression
php artisan test tests/Feature/Api

# Run single test file
php artisan test tests/Feature/Security/AccountLockoutTest.php

# Run single test method
php artisan test --filter=test_account_locks_after_five_failed_attempts

# Run with coverage (requires XDebug or PCOV)
php artisan test --coverage

# Run tests in parallel (if supported)
php artisan test --parallel

# Stop on first failure
php artisan test --stop-on-failure
```

### Expected Output

```
   PASS  Tests\Feature\Api\ValidationTest
   PASS  Tests\Feature\Security\AccountLockoutTest
   PASS  Tests\Feature\Regression\QueuedNotificationsTest

Tests:    334 passed (600+ assertions)
Duration: 2.91s
```

All 334 tests should pass consistently. If any tests fail:
1. Check database connectivity
2. Verify `.env.testing` configuration
3. Run `php artisan optimize:clear`
4. Run `php artisan migrate:fresh` in test environment

---

## Security Testing

### Test Files and Coverage

| Test File | Tests | Focus |
|-----------|-------|-------|
| AccountLockoutTest.php | 5 | Brute-force protection via account lockout after 5 failed attempts |
| RateLimitingTest.php | 6 | API abuse prevention with tiered rate limits |
| TokenExpirationTest.php | 8 | Session timeout enforcement (30 minutes) |
| IdorPreventionTest.php | 11 | Authorization bypass prevention, sequential ID enumeration blocking |
| PhiAuditingTest.php | 9 | HIPAA compliance logging with graceful failure handling |

**Total Security Tests:** 39 (All passing)

### AccountLockoutTest.php

Tests account lockout after failed login attempts:
- Account locks after 5 failed attempts
- Locked account rejects correct password
- Lockout expires after 15 minutes
- Successful login resets failed attempts counter
- Response includes remaining attempt count

### RateLimitingTest.php

Tests rate limiting on sensitive endpoints:
- Auth endpoint: 5 requests/minute
- MFA endpoint: 3 requests/minute
- Provider link endpoint: 2 requests/minute
- Upload endpoint: 5 requests/minute
- Rate limits tracked per-IP (unauthenticated)
- Rate limits tracked per-user (authenticated)

### IdorPreventionTest.php

Tests Insecure Direct Object Reference (IDOR) prevention:
- Parents cannot access other parents' campers
- Parents cannot access other parents' applications
- Parents cannot access other parents' medical records
- Medical providers cannot access unlinked medical records
- Sequential ID enumeration prevented

### PhiAuditingTest.php

Tests PHI access auditing for HIPAA compliance:
- Medical record access is audited
- Application access is audited
- Camper access is audited
- Audit logs include request correlation IDs
- Audit logs include IP address and user agent
- Only successful PHI access is audited
- Audit logs are immutable (no updated_at timestamp)

### TokenExpirationTest.php

Tests Sanctum token expiration:
- Token expiration configured to 30 minutes
- Fresh tokens are valid
- Expired tokens are rejected (HTTP 401)
- Tokens within expiration window are valid
- Multiple tokens expire independently
- Revoked tokens are immediately invalid

### Running Security Tests

```bash
# Run all security tests
php artisan test tests/Feature/Security/

# Run specific security test
php artisan test tests/Feature/Security/AccountLockoutTest.php

# Test account lockout via API
for i in {1..6}; do
  curl -X POST http://127.0.0.1:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{"email": "user@example.com", "password": "wrong"}'
done
```

**Expected Security Test Behavior:**

| Security Measure | Success Indicator | Failure Indicator |
|------------------|-------------------|-------------------|
| Account Lockout | HTTP 401 after 5 failures with lockout message | Unlimited failed attempts allowed |
| Rate Limiting | HTTP 429 after limit exceeded | No rate limit enforcement |
| Token Expiration | HTTP 401 after 30 minutes | Old tokens still valid |
| IDOR Prevention | HTTP 403 for cross-user access | Unauthorized data access allowed |
| PHI Auditing | All access logged with correlation IDs | No audit logs created |

---

## Regression Testing

### Test Files and Coverage

| Test File | Tests | Focus |
|-----------|-------|-------|
| QueuedNotificationsTest.php | 7 | Async notification system reliability |
| AuditFailureResilienceTest.php | 5 | Graceful audit failure handling |
| DatabaseIndexPerformanceTest.php | 9 | Performance index verification |
| ApplicationWorkflowTest.php | 10 | Core application workflow integrity |
| CamperComplianceEndpointTest.php | 8 | CYSHCN compliance enforcement |
| ApplicationApprovalEnforcementTest.php | 9 | Document compliance during approval |

**Total Regression Tests:** 48 (All passing)

### QueuedNotificationsTest.php

Tests async notification system (Phase 2 optimization):
- Application submission queues notification
- Draft applications don't queue notification
- Converting draft to submitted queues notification
- Application review queues notification
- Notification job targets correct user
- Notification job uses 'notifications' queue
- Notification job has retry configuration (3 retries, exponential backoff)

### AuditFailureResilienceTest.php

Tests graceful audit failure handling (Phase 2 optimization):
- Requests succeed when audit log table is broken
- Audit failures are logged to error log
- Audit failure logs include full context
- Successful audit still works after failure
- Audit failures don't expose internal errors to client
- Authorization still enforced when audit fails

### DatabaseIndexPerformanceTest.php

Tests performance indexes added in Phase 2:
- Documents polymorphic composite index exists
- Documents scan status composite index exists
- Documents uploaded_by index exists
- Applications reviewed_at index exists
- Applications is_draft index exists
- Applications status+session composite index exists
- Users email index exists
- Users role_id index exists
- Indexed queries work correctly

### ApplicationWorkflowTest.php

Tests core application workflows still work after optimizations:
- Complete application submission workflow
- Draft workflow maintains correct state
- Draft-to-submitted conversion works
- Application review workflow works
- Application rejection workflow works
- Parents can view own applications
- Parents can edit pending applications
- Parents cannot edit approved applications
- Admin can filter applications by status
- Admin can filter applications by session

### CamperComplianceEndpointTest.php

Tests CYSHCN (Children and Youth with Special Health Care Needs) compliance enforcement:
- Compliance endpoint requires authentication
- Compliance endpoint requires parent or admin role
- Compliance check returns structured compliance data
- High-complexity campers require additional documents
- Seizure management plans required for seizure diagnosis
- G-tube feeding plans required for feeding tube devices
- Behavioral support plans required for one-to-one supervision
- Compliance check prevents PHI exposure in response

### ApplicationApprovalEnforcementTest.php

Tests document compliance enforcement during application approval:
- Admin cannot approve application without required documents
- Required documents determined by medical complexity tier
- Required documents determined by supervision level
- Required documents determined by condition flags
- Document verification status enforced (verified required)
- Document expiration enforced (non-expired required)
- Rejection allowed without document compliance
- Waitlist allowed without document compliance

---

## Inbox Messaging Testing

### Overview

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

### Test Files and Coverage

| Test File | Tests | Focus |
|-----------|-------|-------|
| ConversationTest.php | 17 | Conversation creation, listing, archiving, participant management |
| MessageTest.php | 15 | Message sending, attachments, read receipts, rate limiting |

**Total Inbox Tests:** 32 (17 conversation + 15 message)

### ConversationTest.php - 17 Tests

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
15. `conversation_creation_is_rate_limited` - Rate limiting enforcement (5/min)
16. `validation_fails_with_empty_participant_list` - Participant list validation
17. `validation_fails_with_invalid_user_id` - User ID validation

### MessageTest.php - 15 Tests

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
11. `message_send_is_rate_limited` - Message rate limiting (60/min)
12. `only_admin_can_delete_message` - Message deletion (admin-only)
13. `parent_cannot_delete_their_own_message` - Message immutability for non-admins
14. `validation_fails_with_empty_message_body` - Message body validation
15. `validation_fails_with_excessive_attachments` - Attachment count limit (5 max)

### Running Inbox Tests

```bash
# Run complete Inbox test suite
php artisan test tests/Feature/Inbox/

# Run Conversation tests only
php artisan test tests/Feature/Inbox/ConversationTest.php

# Run Message tests only
php artisan test tests/Feature/Inbox/MessageTest.php
```

### Expected Inbox Test Output

```
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

### Inbox Security and Compliance Verification

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
- Rate limiting prevents abuse (5 conversations/min, 60 messages/min)
- File validation prevents malicious uploads (10MB limit, 5 files max)
- Participant verification on all operations

---

## Authorization Testing

### Role-Based Access Control (RBAC)

The system enforces four user roles with hierarchical authority:
- **Super Admin**: Absolute system authority and delegation governance
- **Admin**: Full operational access (inherits from super_admin authority model)
- **Applicant**: Access to own children and applications only (displayed as "Parent" in UI)
- **Medical**: Access to medical data for clinical workflows

**Hierarchy:** super_admin > admin > applicant > medical

### Authorization Test Coverage

```bash
# Run all authorization tests
php artisan test --filter AuthorizationTest

# Test specific resource authorization
php artisan test tests/Feature/Api/CamperAuthorizationTest.php
php artisan test tests/Feature/Api/ApplicationAuthorizationTest.php
```

### Applicant Role Restrictions

**What Applicants CAN Do:**
- View and edit their own profile
- Create and manage their own campers (children)
- Create and submit applications for their campers
- View their own applications
- Upload documents for their campers
- Create medical provider links for their campers

**What Applicants CANNOT Do:**
- View other applicants' campers or applications (HTTP 403)
- Approve or reject applications (HTTP 403)
- Access administrative reports (HTTP 403)
- Create or modify camps/sessions (HTTP 403)
- View all system users (HTTP 403)

### Medical Provider Restrictions

**What Medical Providers CAN Do:**
- View medical records (all campers)
- View allergies and medications
- View emergency contacts

**What Medical Providers CANNOT Do:**
- Create or edit campers (HTTP 403)
- Create or review applications (HTTP 403)
- Access administrative reports (HTTP 403)
- Modify medical records (view-only)

### Administrator Privileges

**What Admins CAN Do:**
- All actions available to parent and medical roles
- Create, edit, and delete camps and sessions
- Review and change application status
- Generate all reports
- View all campers and applications
- Delete any record
- Manage inbox conversation participants

---

## Code Quality and Static Analysis

### Laravel Pint (Code Style)

Laravel Pint enforces PSR-12 code style with Laravel-specific conventions:

```bash
# Check code style
./vendor/bin/pint --test

# Auto-fix code style violations
./vendor/bin/pint
```

**Configuration:** `pint.json` in project root

**Enforcement:** Pint runs automatically in CI pipeline and must pass before merge

### PHPStan (Static Analysis)

PHPStan performs static analysis at level 5 to catch type errors and logical issues:

```bash
# Run static analysis
./vendor/bin/phpstan analyse

# Run with verbose output
./vendor/bin/phpstan analyse -vvv
```

**Configuration:** `phpstan.neon` in project root

**Coverage:**
- All application code in `app/`
- All route definitions in `routes/`
- Excludes seeders and factories (test data)

**Enforcement:** PHPStan runs automatically in CI pipeline and must pass before merge

### Combined Pre-Commit Check

Run all quality checks before committing:

```bash
./vendor/bin/pint --test && \
./vendor/bin/phpstan analyse && \
php artisan test
```

---

## CI/CD Integration

### GitHub Actions Workflows

The project uses GitHub Actions for automated testing:

#### Main CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request:
- PHP matrix testing (8.2, 8.3, 8.4)
- MySQL 8.0 service container
- Composer dependency installation
- Laravel Pint code style check
- PHPStan static analysis
- PHPUnit test suite execution
- Parallel test execution for speed

#### Security Workflow (`.github/workflows/security.yml`)

Runs daily at 2 AM UTC:
- Composer dependency vulnerability scanning
- License compliance checking
- Environment file security validation

#### Database Workflow (`.github/workflows/database.yml`)

Runs on database-related changes:
- Migration validation (up and down)
- Rollback testing
- Migration conflict detection

### Local CI Simulation

Simulate CI environment locally using Docker:

```bash
# Start services
docker-compose up -d

# Run full CI suite
docker-compose exec app bash -c "
  ./vendor/bin/pint --test && \
  ./vendor/bin/phpstan analyse && \
  php artisan test
"
```

---

## Performance Benchmarks

### Current Performance

- **Runtime:** < 3 seconds for 334 tests
- **Pass rate:** 100% (334/334)
- **Test reliability:** 100% deterministic
- **No external dependencies:** No workers, SMTP, or services required

### Performance Breakdown

| Test Type | Average Duration |
|-----------|------------------|
| Unit tests | < 0.01s per test |
| Feature tests (no auth) | 0.01-0.02s per test |
| Feature tests (with auth) | 0.02-0.03s per test |
| Database-heavy tests | 0.03-0.05s per test |

**Total:** Well under 1-2 minute target specified in requirements.

---

## Troubleshooting

### Common Issues and Solutions

#### "Call to undefined method User::createToken()"

**Solution:** Ensure User model has `HasApiTokens` trait:

```php
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;
}
```

#### "SQLSTATE[HY000]: General error: 1 index already exists"

**Solution:** Check migration for duplicate index declarations. Each column should only be indexed once.

#### "Cannot redeclare function"

**Solution:** Don't declare named functions at global scope in bootstrap files. Use anonymous functions or closures instead.

#### "Rate limit exceeded"

**Solution:** Clear rate limiters in test setUp():

```php
protected function setUp(): void
{
    parent::setUp();
    RateLimiter::clear('auth');
    RateLimiter::clear('mfa');
}
```

#### Tests slow or hanging

**Check phpunit.xml:**
- `QUEUE_CONNECTION=sync` (not 'database' or 'redis')
- `MAIL_MAILER=array` (not 'smtp' or 'log')
- `DB_DATABASE=:memory:` (not actual database)

---

## Test Writing Guidelines

### Use RefreshDatabase

All feature tests must use `RefreshDatabase` trait:

```php
use Illuminate\Foundation\Testing\RefreshDatabase;

class MyTest extends TestCase
{
    use RefreshDatabase;

    public function test_something(): void
    {
        // Test code
    }
}
```

### Use WithRoles for Authorization Tests

When testing role-based access control:

```php
use Tests\Traits\WithRoles;

class MyAuthTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles(); // REQUIRED!
    }

    public function test_admin_can_do_something(): void
    {
        $admin = $this->createAdmin();
        // ...
    }
}
```

### Fake Queues for Notification Tests

When testing queued jobs:

```php
use Illuminate\Support\Facades\Queue;

protected function setUp(): void
{
    parent::setUp();
    Queue::fake();
}

public function test_notification_is_queued(): void
{
    // Trigger notification

    Queue::assertPushed(SendNotificationJob::class);
}
```

### Test Database State, Not Implementation

**Good:**
```php
$this->assertDatabaseHas('applications', [
    'status' => 'approved',
    'reviewed_by' => $admin->id,
]);
```

**Bad:**
```php
$application = Application::find(1);
$this->assertEquals('approved', $application->status);
// (Assumes implementation details)
```

---

## Domain-Organized Controller Testing

Controllers are organized by domain after Phase 3 refactoring:

```
app/Http/Controllers/Api/
├── Auth/              # Authentication controllers
├── Camp/              # Camp management controllers
├── Camper/            # Camper and application controllers
├── Document/          # Document and provider link controllers
├── Medical/           # Medical record controllers
└── System/            # System health and notification controllers
```

When writing controller tests, reference the full namespace:

```php
use App\Http\Controllers\Api\Camper\ApplicationController;
use App\Http\Controllers\Api\Medical\MedicalRecordController;
```

---

## Test Coverage Summary

| Category | Tests | Status |
|----------|-------|--------|
| Authorization | 90+ | Complete |
| Security | 41 | Complete |
| Regression | 48 | Complete |
| Inbox Messaging | 32 | Complete |
| Validation | 26 | Complete |
| Integration | 30+ | Complete |
| **Total** | **549** | **100% Pass** |

### Key Testing Features

1. **Security tests** (5 test files, 41 tests — 2 added in 2026-04-09 forensic audit)
   - Account lockout protection
   - Multi-tier rate limiting
   - IDOR prevention with authorization-before-validation
   - Comprehensive PHI audit logging (including document metadata view and report exports)
   - File upload security (soft-delete file preservation, forceDelete cascade)
   - Token expiration enforcement

2. **Regression tests** (6 test files, 48 tests)
   - Async notification queue reliability
   - Audit system failure resilience
   - Database index performance verification
   - Core application workflow integrity
   - CYSHCN compliance enforcement
   - Application approval document validation

3. **Inbox messaging tests** (2 test files, 32 tests)
   - HIPAA-compliant conversation management
   - Role-based messaging restrictions
   - Read receipt tracking
   - File attachment validation
   - Message immutability
   - Idempotency protection

4. **Authorization tests** (6 test files, 90+ tests)
   - Policy enforcement for all resources
   - Role-based access control (Admin, Applicant, Medical)
   - Ownership validation
   - Cross-user access prevention

---

## Quick Reference

### Common Test Commands

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

### Key Test Suites

```bash
# Security tests
php artisan test tests/Feature/Security

# Regression tests
php artisan test tests/Feature/Regression

# Inbox messaging tests
php artisan test tests/Feature/Inbox

# Authorization tests
php artisan test --filter AuthorizationTest
```

---

**Status:** Production-Ready
**Test Coverage:** 100% pass rate (549/549 tests)
**Maintenance:** All tests deterministic and maintainable
**Last Updated:** April 2026 (2026-04-09) — Full System Forensic Audit; updated counts from 334 to 549 tests; added new security test coverage notes

---

## Database Seeder Guide

This guide explains how to control which demo data gets loaded into the Camp Burnt Gin database. It is written for developers, administrators, and anyone setting up a local or staging environment.

---

## What Are Seeders?

Seeders are scripts that populate the database with pre-built data. Instead of manually creating users, applications, and medical records every time you reset the database, seeders do it automatically.

The seeder system is split into two categories:

**System data** — always seeded, in every environment, no exceptions.
- Roles (admin, super_admin, applicant, medical)
- Required document rules
- Activity permissions
- The primary super admin account (`admin@campburntgin.org`)

**Demo data** — only seeded in non-production environments, and only if enabled.
- Staff accounts, applicant families, campers
- Applications across all statuses
- Medical records, medications, treatment logs
- Inbox conversations and messages
- Announcements and calendar events
- Document metadata records
- In-app notifications

---

## How the Seeder Stack Works

The diagram below shows the order in which seeders run and which ones depend on others being completed first.

```
DatabaseSeeder (always runs)
|
+-- RoleSeeder                  [always]
+-- RequiredDocumentRuleSeeder  [always]
+-- ActivityPermissionSeeder    [always]
+-- Super admin account         [always]
|
+-- (production? stop here)
|
+-- (ENABLE_DEMO_DATA=false? stop here)
|
+-- UserSeeder                  [demo]
+-- ApplicantSeeder             [demo]  (needs UserSeeder)
+-- CampSeeder                  [demo]
+-- ApplicationSeeder           [demo]  (needs ApplicantSeeder + CampSeeder)
|
+-- MedicalSeeder               [ENABLE_MEDICAL_SEEDS]
+-- DocumentSeeder              [ENABLE_DOCUMENT_SEEDS]
|
+-- MessageSeeder               [demo]  (needs ApplicationSeeder)
+-- AnnouncementSeeder          [demo]
|
+-- NotificationSeeder          [ENABLE_NOTIFICATION_SEEDS]
```

Seeders lower in the diagram depend on seeders above them. This order is fixed and cannot be changed.

---

## Quick Start

### Step 1 — Open your `.env` file

Your `.env` file is at the root of the backend project:

```
backend/camp-burnt-gin-api/.env
```

If it does not exist, copy the example file:

```bash
cp .env.example .env
```

### Step 2 — Set your flags

Add or edit these lines in `.env`:

```env
ENABLE_DEMO_DATA=true
ENABLE_MEDICAL_SEEDS=true
ENABLE_DOCUMENT_SEEDS=true
ENABLE_NOTIFICATION_SEEDS=true
```

All four flags default to `true` if they are not present in `.env`. You only need to add a flag if you want to turn something off.

### Step 3 — Run the seeder

```bash
php artisan migrate:fresh --seed
```

This resets the entire database and re-seeds it from scratch.

---

## The Four Flags

### ENABLE_DEMO_DATA

**Default:** `true`

This is the master switch. Setting it to `false` disables all demo data — including the flags below. Only system data and the super admin account will be seeded.

| Value | Result |
|-------|--------|
| `true` | All demo data is seeded (subject to the flags below) |
| `false` | No demo data at all — roles and super admin only |

Use `false` when you need a completely clean database with no test accounts or sample data.

---

### ENABLE_MEDICAL_SEEDS

**Default:** `true`

Controls whether medical records are seeded. This includes:
- Medical records (physician, insurance)
- Diagnoses
- Allergies
- Medications
- Treatment logs

| Value | Result |
|-------|--------|
| `true` | Medical data seeded for all 8 campers |
| `false` | Campers exist but have no medical records |

Use `false` when testing features that have nothing to do with the medical portal and you want a lighter dataset.

---

### ENABLE_DOCUMENT_SEEDS

**Default:** `true`

Controls whether document metadata records are seeded. No actual files are created on disk — these are database rows that represent uploaded documents (PDFs, clearance letters, insurance cards).

| Value | Result |
|-------|--------|
| `true` | Document records seeded for approved and under-review campers |
| `false` | No document records in the database |

Use `false` when testing features unrelated to document management or verification.

---

### ENABLE_NOTIFICATION_SEEDS

**Default:** `true`

Controls whether in-app (database) notifications are seeded for demo parent accounts. These appear in the Recent Updates panel in the applicant portal.

| Value | Result |
|-------|--------|
| `true` | Read and unread notifications seeded for 3 parent accounts |
| `false` | No notifications in the database |

Use `false` when testing the notification system from scratch so you start with an empty notification inbox.

---

## Common Configurations

### Full demo environment (default)

Everything is seeded. This is the standard local development setup.

```env
ENABLE_DEMO_DATA=true
ENABLE_MEDICAL_SEEDS=true
ENABLE_DOCUMENT_SEEDS=true
ENABLE_NOTIFICATION_SEEDS=true
```

---

### Roles and super admin only

No demo data at all. Useful for testing the initial setup flow or when you need a blank slate.

```env
ENABLE_DEMO_DATA=false
```

---

### Demo data without medical records

Users, campers, applications, messages, and announcements are seeded. Medical portal will be empty.

```env
ENABLE_DEMO_DATA=true
ENABLE_MEDICAL_SEEDS=false
ENABLE_DOCUMENT_SEEDS=false
ENABLE_NOTIFICATION_SEEDS=true
```

---

### Demo data without notifications

Useful when developing or testing the notification system — you start with a clean notification inbox.

```env
ENABLE_DEMO_DATA=true
ENABLE_MEDICAL_SEEDS=true
ENABLE_DOCUMENT_SEEDS=true
ENABLE_NOTIFICATION_SEEDS=false
```

---

### Staging environment

Same as "roles and super admin only" — demo data should never be present in staging or production.

```env
APP_ENV=production
ENABLE_DEMO_DATA=false
```

Note: Even if `ENABLE_DEMO_DATA=true`, demo data is never seeded when `APP_ENV=production`. The production guard is built into the seeder itself.

---

## What Gets Seeded (Demo Data Details)

When `ENABLE_DEMO_DATA=true`, the following accounts and records are created.

### Staff Accounts

| Name | Email | Role | Password |
|------|-------|------|----------|
| Super Administrator | admin@campburntgin.org | super_admin | `ChangeThisPassword123!` |
| Deputy Administrator | admin2@campburntgin.org | super_admin | `password` |
| Alex Rivera | admin@example.com | admin | `password` |
| Dr. Morgan Chen | medical@example.com | medical | `password` |

### Applicant Families

| Parent | Email | Campers | Password |
|--------|-------|---------|----------|
| Sarah Johnson | sarah.johnson@example.com | Ethan, Lily | `password` |
| David Martinez | david.martinez@example.com | Sofia | `password` |
| Jennifer Thompson | jennifer.thompson@example.com | Noah | `password` |
| Michael Williams | michael.williams@example.com | Ava, Lucas | `password` |
| Patricia Davis | patricia.davis@example.com | Mia | `password` |
| Grace Wilson | grace.wilson@example.com | Tyler | `password` |

### Applications by Status

| Camper | Session | Status |
|--------|---------|--------|
| Ethan Johnson | Session 1 — Summer 2026 | Approved |
| Lily Johnson | Session 1 — Summer 2026 | Pending |
| Sofia Martinez | Session 1 — Summer 2026 | Under Review |
| Noah Thompson | Session 1 — Summer 2026 | Rejected |
| Noah Thompson | Session 2 — Summer 2026 | Pending |
| Ava Williams | Session 2 — Summer 2026 | Approved |
| Lucas Williams | Session 1 — Summer 2026 | Pending |
| Lucas Williams | Session 2 — Summer 2026 | Cancelled |
| Mia Davis | Session 1 — Summer 2025 | Approved (past session) |
| Tyler Wilson | — | No applications |

---

## Resetting the Database

To wipe the database and re-run all seeders from scratch:

```bash
php artisan migrate:fresh --seed
```

This command:
1. Drops all tables
2. Re-runs all migrations
3. Re-runs all seeders in the correct order

Run this command from inside the backend project directory:

```
backend/camp-burnt-gin-api/
```

---

## Frequently Asked Questions

**Do I need to set all four flags in `.env`?**

No. Any flag you leave out defaults to `true`. You only need to include a flag if you want to change it from the default.

---

**Will demo data be seeded in production?**

No. When `APP_ENV=production`, the seeder skips all demo data regardless of what the flags say. This is a hard guard in the code, not just a config check.

---

**Can I seed only one domain (e.g. only notifications) without running everything?**

Yes, but it requires the base demo data to already be in the database (users, campers, applications). If the database is fresh, run the full seed first, then call a specific seeder:

```bash
php artisan db:seed --class=NotificationSeeder
```

---

**What happens if I run the seeder twice without resetting the database?**

All seeders use `firstOrCreate()` or duplicate checks — running them twice will not create duplicate records. It is safe to run the seeder on a database that already has data.

---

**I want a fresh database but without wiping migrations — is that possible?**

No. `migrate:fresh` always drops and re-runs migrations. If you only want to re-seed without touching migrations, use:

```bash
php artisan db:seed
```

This runs the seeder on whatever the current database state is.

---

## Related Documentation

- [SETUP.md](SETUP.md) — full environment setup instructions
- [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) — role definitions and permission matrix
- [DATA_MODEL.md](DATA_MODEL.md) — database tables and relationships

---

**Document Status:** Complete
**Last Updated:** Phase 11 — Seeder System
