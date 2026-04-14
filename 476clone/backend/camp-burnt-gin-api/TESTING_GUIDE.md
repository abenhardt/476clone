# Testing Guide

## Overview

This document explains the test suite structure, execution, and troubleshooting for the Camp Burnt Gin API backend system.

**Test Suite Status:** 254 passing (100%) | **Runtime:** < 3 seconds | **Assertions:** 475+

---

## Quick Start

### Running All Tests

```bash
php artisan test
```

**Expected output:**
```
Tests:    254 passed (475 assertions)
Duration: < 3 seconds
```

### Docker Environment

If using Docker for development:

```bash
docker-compose exec app php artisan test
```

### Running Specific Test Suites

```bash
# Run only security tests
php artisan test tests/Feature/Security

# Run only regression tests
php artisan test tests/Feature/Regression

# Run only authorization tests
php artisan test tests/Feature/Api/*AuthorizationTest.php

# Run a specific test class
php artisan test tests/Feature/Security/AccountLockoutTest.php

# Run a single test method
php artisan test --filter test_account_locks_after_five_failed_attempts
```

---

## Test Environment Configuration

### phpunit.xml Settings

The test environment is correctly configured for fast, deterministic testing:

```xml
<env name="APP_ENV" value="testing"/>
<env name="DB_DATABASE" value=":memory:"/>
<env name="DB_CONNECTION" value="sqlite"/>
<env name="QUEUE_CONNECTION" value="sync"/>
<env name="MAIL_MAILER" value="array"/>
<env name="CACHE_STORE" value="array"/>
<env name="SESSION_DRIVER" value="array"/>
```

**Why this works:**
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

### Security Tests (`tests/Feature/Security/`)

#### AccountLockoutTest.php
Tests account lockout after failed login attempts:
- Account locks after 5 failed attempts
- Locked account rejects correct password
- Lockout expires after 15 minutes
- Successful login resets failed attempts
- Response includes remaining attempt count

#### RateLimitingTest.php
Tests rate limiting on sensitive endpoints:
- Auth endpoint limited to 5 requests/minute
- MFA endpoint limited to 3 requests/minute
- Provider link endpoint limited to 2 requests/minute
- Upload endpoint limited to 5 requests/minute
- Rate limits tracked per-IP (unauthenticated)
- Rate limits tracked per-user (authenticated)

#### IdorPreventionTest.php
Tests Insecure Direct Object Reference (IDOR) prevention:
- Parents cannot access other parents' campers
- Parents cannot access other parents' applications
- Parents cannot access other parents' medical records
- Medical providers cannot access unlinked medical records
- Sequential ID enumeration prevented

#### PhiAuditingTest.php
Tests PHI access auditing for HIPAA compliance:
- Medical record access is audited
- Application access is audited
- Camper access is audited
- Audit logs include request correlation IDs
- Audit logs include IP address and user agent
- Only successful PHI access is audited
- Audit logs are immutable (no updated_at)

#### TokenExpirationTest.php
Tests Sanctum token expiration:
- Token expiration configured to 60 minutes
- Fresh tokens are valid
- Expired tokens are rejected
- Tokens within expiration window are valid
- Multiple tokens expire independently
- Revoked tokens are immediately invalid

### Regression Tests (`tests/Feature/Regression/`)

#### QueuedNotificationsTest.php
Tests async notification system (Phase 2 optimization):
- Application submission queues notification
- Draft applications don't queue notification
- Converting draft to submitted queues notification
- Application review queues notification
- Notification job targets correct user
- Notification job uses 'notifications' queue
- Notification job has retry configuration (3 retries, exponential backoff)

#### AuditFailureResilienceTest.php
Tests graceful audit failure handling (Phase 2 optimization):
- Requests succeed when audit log table is broken
- Audit failures are logged to error log
- Audit failure logs include full context
- Successful audit still works after failure
- Audit failures don't expose internal errors to client
- Authorization still enforced when audit fails

#### DatabaseIndexPerformanceTest.php
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

#### ApplicationWorkflowTest.php
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

#### CamperComplianceEndpointTest.php
Tests CYSHCN (Children and Youth with Special Health Care Needs) compliance enforcement:
- Compliance endpoint requires authentication
- Compliance endpoint requires parent or admin role
- Compliance check returns structured compliance data
- High-complexity campers require additional documents
- Seizure management plans required for seizure diagnosis
- G-tube feeding plans required for feeding tube devices
- Behavioral support plans required for one-to-one supervision
- Compliance check prevents PHI exposure in response

#### ApplicationApprovalEnforcementTest.php
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

## Advanced Test Execution

### Test Options and Filters

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
Tests:    254 passed (475 assertions)
Duration: 2.91s
```

All 254 tests should pass consistently. If any tests fail:
1. Check database connectivity
2. Verify `.env.testing` configuration
3. Run `php artisan optimize:clear`
4. Run `php artisan migrate:fresh` in test environment

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

## Migration Validation

### Running Migrations in Test Environment

```bash
# Run all migrations
php artisan migrate --env=testing

# Check migration status
php artisan migrate:status --env=testing

# Rollback last migration
php artisan migrate:rollback --env=testing

# Fresh migration (drops all tables)
php artisan migrate:fresh --env=testing
```

### Migration Testing Best Practices

**Test Migration Up:**
```bash
php artisan migrate:fresh --env=testing
php artisan migrate --env=testing
```

**Test Migration Down:**
```bash
php artisan migrate:rollback --env=testing
```

**Test Idempotence:**
```bash
# Run twice - should not error
php artisan migrate --env=testing
php artisan migrate --env=testing
```

### Migration Conflict Detection

The database CI workflow automatically detects:
- Conflicting migration timestamps
- Duplicate index definitions
- Missing foreign key constraints
- Schema inconsistencies

---

## Health Endpoint Verification

### Health Check Endpoint

```bash
# Check application health
curl http://localhost:8000/api/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-03-16T10:30:00.000000Z",
  "checks": {
    "database": "ok",
    "cache": "ok",
    "queue": "ok"
  }
}
```

### Docker Health Checks

Docker Compose includes health checks for all services:

```bash
# Check service health
docker-compose ps

# Expected output shows "healthy" status
```

### Automated Health Monitoring

Health checks are automatically validated in:
- Docker container startup
- CI/CD pipeline execution
- Production deployment verification

---

## Test Scope

### What Tests Cover

- **API Endpoints** - All 112 REST endpoints with authorization checks
- **Security Features** - Account lockout, rate limiting, IDOR prevention, token expiration
- **Business Logic** - Application workflows, medical records, compliance enforcement
- **Database Integrity** - Migrations, indexes, constraints, relationships
- **Authorization** - Policy enforcement for all protected resources
- **Validation** - Input validation rules for all form requests
- **Audit Logging** - PHI access tracking for HIPAA compliance
- **Queue Reliability** - Async notification processing with retry logic
- **CYSHCN Support** - Special needs risk assessment and document compliance

### What Tests Don't Cover

The following require integration or E2E testing beyond the scope of unit/feature tests:

- **PDF Generation** - Actual letter PDF creation (LetterService logic tested, not PDF output)
- **Email Delivery** - Real SMTP transmission (queuing tested, actual delivery not tested)
- **File Virus Scanning** - ClamAV integration (structure tested, actual scanning mocked)
- **Production Environment** - Infrastructure, load balancing, CDN, backups
- **Browser Interactions** - Frontend UI/UX (API contract tested, UI not tested)

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

## Performance Benchmarks

### Current Performance

- **Runtime:** 2.91 seconds for 254 tests
- **Pass rate:** 100% (254/254)
- **Test reliability:** 100% deterministic
- **No external dependencies:** No workers, SMTP, or services required

### Performance Breakdown

- **Unit tests:** < 0.01s per test
- **Feature tests (no auth):** 0.01-0.02s per test
- **Feature tests (with auth):** 0.02-0.03s per test
- **Database-heavy tests:** 0.03-0.05s per test

**Total:** Well under 1-2 minute target specified in requirements.

---

## Troubleshooting

### "Call to undefined method User::createToken()"

**Solution:** Ensure User model has `HasApiTokens` trait:

```php
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;
}
```

### "SQLSTATE[HY000]: General error: 1 index already exists"

**Solution:** Check migration for duplicate index declarations. Each column should only be indexed once.

### "Cannot redeclare function"

**Solution:** Don't declare named functions at global scope in bootstrap files. Use anonymous functions or closures instead.

### "Rate limit exceeded"

**Solution:** Clear rate limiters in test setUp():

```php
protected function setUp(): void
{
    parent::setUp();
    RateLimiter::clear('auth');
    RateLimiter::clear('mfa');
}
```

### Tests slow or hanging

**Check phpunit.xml:**
- `QUEUE_CONNECTION=sync` (not 'database' or 'redis')
- `MAIL_MAILER=array` (not 'smtp' or 'log')
- `DB_DATABASE=:memory:` (not actual database)

---

## Summary

### Test Suite Status

- **254/254 tests passing (100%)**
- **Runtime: < 3 seconds**
- **475+ assertions**
- **Zero flaky tests**
- **Deterministic execution**

### Test Coverage Breakdown

| Category | Tests | Status |
|----------|-------|--------|
| Authorization | 90+ | Complete |
| Security | 39 | Complete |
| Regression | 48 | Complete |
| Validation | 26 | Complete |
| Integration | 30+ | Complete |
| CYSHCN Compliance | 21 | Complete |

### Key Testing Features

1. **Security tests** (5 test files, 39 tests)
   - Account lockout protection
   - Multi-tier rate limiting
   - IDOR prevention with authorization-before-validation
   - Comprehensive PHI audit logging
   - Token expiration enforcement

2. **Regression tests** (6 test files, 48 tests)
   - Async notification queue reliability
   - Audit system failure resilience
   - Database index performance verification
   - Core application workflow integrity
   - CYSHCN compliance enforcement
   - Application approval document validation

3. **Authorization tests** (6 test files, 90+ tests)
   - Policy enforcement for all resources
   - Role-based access control (Admin, Parent, Medical)
   - Ownership validation
   - Cross-user access prevention

### Performance Metrics

- **Target:** < 1-2 minutes
- **Actual:** < 3 seconds
- **Improvement:** 20-40x faster than target
- **Database:** In-memory SQLite (zero disk I/O)
- **External Dependencies:** None (sync queue, array mail/cache)

---

**Status:** Production-Ready
**Test Coverage:** 100% pass rate
**Maintenance:** All tests deterministic and maintainable
