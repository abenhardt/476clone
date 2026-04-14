# Audit Logging

This document describes the audit logging system implemented in the Camp Burnt Gin API for HIPAA compliance, security monitoring, and Protected Health Information (PHI) access tracking. It provides comprehensive documentation of logging mechanisms, event types, data retention, and compliance requirements.

---

## Table of Contents

1. [Overview](#overview)
2. [HIPAA Compliance Requirements](#hipaa-compliance-requirements)
3. [Audit Log Architecture](#audit-log-architecture)
4. [Event Types](#event-types)
5. [PHI Access Logging](#phi-access-logging)
6. [Authentication Event Logging](#authentication-event-logging)
7. [Administrative Action Logging](#administrative-action-logging)
8. [Audit Log Data Model](#audit-log-data-model)
9. [Audit Middleware](#audit-middleware)
10. [Log Querying and Analysis](#log-querying-and-analysis)
11. [Data Retention and Archival](#data-retention-and-archival)
12. [Graceful Failure Handling](#graceful-failure-handling)

---

## Overview

The Camp Burnt Gin API implements comprehensive audit logging to support HIPAA compliance requirements for systems handling Protected Health Information (PHI). All access to medical records, allergies, medications, emergency contacts, and related sensitive data is logged with sufficient detail for compliance auditing and security monitoring.

### Audit Logging Objectives

| Objective | Description |
|-----------|-------------|
| HIPAA Compliance | Meet Technical Safeguards audit control requirements (§164.312(b)) |
| Security Monitoring | Detect unauthorized access attempts and suspicious activity |
| Incident Investigation | Provide forensic trail for security incident analysis |
| Access Accountability | Track who accessed what information and when |
| Legal Defense | Document compliance with regulatory requirements |

### Key Features

- Automatic PHI access logging via middleware
- Authentication and authorization event tracking
- Administrative action logging
- Immutable audit records (no updates, only inserts)
- Graceful failure handling (audit failures do not block requests)
- Structured metadata for detailed analysis
- Request ID correlation for distributed tracing

---

## HIPAA Compliance Requirements

The audit logging system addresses HIPAA Technical Safeguards requirements:

### §164.312(b) Audit Controls

**Requirement:** "Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use electronic protected health information."

**Implementation:**

| Requirement Component | Implementation |
|---------------------|----------------|
| Record activity | Middleware logs all PHI access automatically |
| Examine activity | Audit logs stored in database for querying and analysis |
| User identification | User ID captured for all authenticated requests |
| Date and time | Timestamp recorded for all events |
| Access type | Action (view, create, update, delete) recorded |
| Resource identification | Resource type and ID captured |

### Logged PHI Access Events

The following PHI-related activities are logged:

- Medical record access (view, create, update)
- Allergy information access (view, create, update, delete)
- Medication information access (view, create, update, delete)
- Emergency contact access (view, create, update, delete)
- Document access (upload, view, download, delete)
- Medical provider link access (unauthenticated PHI submission)
- Application review (contains PHI references)

---

## Audit Log Architecture

### System Architecture

```
┌──────────────────┐
│  HTTP Request    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Middleware:     │
│  AuditPhiAccess  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐         ┌─────────────────┐
│  Route Handler   │────────►│  Policy Check   │
│  (Controller)    │         └─────────────────┘
└────────┬─────────┘
         │
         │ Process Request
         ▼
┌──────────────────┐
│  Service Layer   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Database        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Response        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  AuditPhiAccess  │  ◄── Post-response logging
│  (After)         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  AuditLog::create│
│  (Async)         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  audit_logs      │
│  Table           │
└──────────────────┘
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| AuditLog Model | `app/Models/AuditLog.php` | Database model and helper methods |
| AuditPhiAccess Middleware | `app/Http/Middleware/AuditPhiAccess.php` | Automatic PHI access logging |
| AddRequestId Middleware | `app/Http/Middleware/AddRequestId.php` | Request ID generation and correlation |
| audit_logs Table | Database | Persistent storage for audit records |

---

## Event Types

The system categorizes audit events into distinct types for filtering and analysis.

### Event Type Definitions

| Event Type | Constant | Description | Examples |
|------------|----------|-------------|----------|
| Authentication | `EVENT_TYPE_AUTH` | Login, logout, password changes | User login, MFA verification, logout |
| PHI Access | `EVENT_TYPE_PHI_ACCESS` | Access to protected health information | Medical record view, allergy update |
| Admin Action | `EVENT_TYPE_ADMIN_ACTION` | Administrative operations | Application review, user role change |
| Security | `EVENT_TYPE_SECURITY` | Security-related events | Failed authentication, authorization denial |
| Data Change | `EVENT_TYPE_DATA_CHANGE` | Significant data modifications | Record deletion, bulk updates |
| File Access | `EVENT_TYPE_FILE_ACCESS` | Document operations | Document upload, download, scan |
| Conversation | `EVENT_TYPE_CONVERSATION` | Conversation lifecycle operations | Conversation creation, archive, participant management |
| Message | `EVENT_TYPE_MESSAGE` | Message operations | Message sent, read, soft deleted |
| Message Attachment | `EVENT_TYPE_MESSAGE_ATTACHMENT` | Message attachment operations | Attachment uploaded, downloaded |

### Event Type Usage

**Authentication Events:**
```php
AuditLog::logAuth('login', $user, [
    'success' => true,
    'mfa_used' => true,
]);
```

**PHI Access Events:**
```php
AuditLog::logPhiAccess('view', $user, $medicalRecord, [
    'route' => 'medical-records.show',
    'method' => 'GET',
]);
```

**Administrative Actions:**
```php
AuditLog::logAdminAction('application_review', $user,
    'Approved application for camper ID 5', [
    'application_id' => 10,
    'decision' => 'approved',
]);
```

---

## PHI Access Logging

PHI access logging is the most critical component of the audit system for HIPAA compliance.

### Automatic Logging via Middleware

The `AuditPhiAccess` middleware automatically logs all successful requests to PHI-related endpoints.

**Monitored Route Patterns:**
```php
protected array $phiRoutePatterns = [
    'medical-records.*',
    'allergies.*',
    'medications.*',
    'emergency-contacts.*',
    'documents.*',
    'provider-access.*',
    'applications.show',
    'applications.store',
    'applications.review',
    'campers.show',
];
```

### Logged PHI Access Data

| Field | Description | Example |
|-------|-------------|---------|
| request_id | Unique request identifier | `req_abc123xyz...` |
| user_id | Authenticated user (null for provider access) | `5` |
| event_type | Always `phi_access` | `phi_access` |
| action | HTTP method mapped to action | `view`, `create`, `update`, `delete` |
| description | Human-readable description | `GET /api/medical-records/10` |
| metadata | Structured request details | See below |
| ip_address | Client IP address | `192.168.1.100` |
| user_agent | Browser/client identifier | `Mozilla/5.0...` |
| created_at | Timestamp of access | `2026-02-11 14:30:45` |

**Metadata Structure:**
```json
{
  "route": "medical-records.show",
  "method": "GET",
  "status": 200,
  "route_parameters": {
    "medicalRecord": 10
  }
}
```

### Action Mapping

HTTP methods are mapped to audit actions:

| HTTP Method | Audit Action |
|-------------|--------------|
| GET | `view` |
| POST | `create` |
| PUT, PATCH | `update` |
| DELETE | `delete` |

**Special Case:** Review endpoints use POST but are logged as `update` actions.

### PHI Access Examples

**Example 1: Medical Record Access**
```
Event Type: phi_access
Action: view
User ID: 5
Description: GET /api/medical-records/10
Metadata: {"route":"medical-records.show","method":"GET","status":200}
IP Address: 192.168.1.100
Timestamp: 2026-02-11 14:30:45
```

**Example 2: Allergy Update**
```
Event Type: phi_access
Action: update
User ID: 5
Description: PUT /api/allergies/3
Metadata: {"route":"allergies.update","method":"PUT","status":200}
IP Address: 192.168.1.100
Timestamp: 2026-02-11 14:35:12
```

**Example 3: Provider Access (Unauthenticated)**
```
Event Type: phi_access
Action: create
User ID: null
Description: POST /api/provider-access/abc123token/submit
Metadata: {"route":"provider-access.submit","method":"POST","status":200}
IP Address: 10.0.5.23
Timestamp: 2026-02-11 15:00:00
```

---

## Authentication Event Logging

Authentication events track user login, logout, and credential changes.

### Logged Authentication Events

| Event | When Logged | Data Captured |
|-------|-------------|---------------|
| Login Attempt | Every login request | Email, success/failure, IP, MFA status |
| Login Success | Successful authentication | User ID, token created, MFA used |
| Login Failure | Invalid credentials | Email (sanitized), reason, IP |
| MFA Verification | MFA code submission | User ID, success/failure |
| Logout | Token revocation | User ID, token ID |
| Password Change | Password update | User ID, IP |
| Password Reset Request | Reset email sent | Email, IP |
| Password Reset Complete | Password changed via reset | User ID, IP |

### Authentication Event Examples

**Successful Login:**
```php
AuditLog::logAuth('login_success', $user, [
    'email' => $user->email,
    'mfa_required' => $user->mfa_enabled,
    'mfa_verified' => true,
    'token_id' => $token->id,
]);
```

**Failed Login:**
```php
AuditLog::logAuth('login_failed', null, [
    'email' => $request->input('email'),
    'reason' => 'invalid_credentials',
    'attempts_remaining' => 3,
]);
```

**Account Lockout:**
```php
AuditLog::logAuth('account_locked', $user, [
    'email' => $user->email,
    'failed_attempts' => 5,
    'lockout_duration_minutes' => 15,
]);
```

---

## Administrative Action Logging

Administrative actions represent privileged operations performed by system administrators.

### Logged Administrative Actions

| Action | When Logged | Data Captured |
|--------|-------------|---------------|
| Application Review | Admin approves/rejects application | Application ID, decision, notes |
| Role Change | Admin modifies user role | User ID, old role, new role |
| Account Disable | Admin deactivates account | User ID, reason |
| Bulk Operation | Admin performs bulk action | Record count, operation type |
| Configuration Change | Admin modifies system settings | Setting name, old value, new value |
| Report Generation | Admin generates report | Report type, filters, record count |

### Administrative Action Examples

**Application Review:**
```php
AuditLog::logAdminAction('application_review', $admin,
    "Approved application {$application->id} for camper {$camper->id}", [
    'application_id' => $application->id,
    'camper_id' => $camper->id,
    'decision' => 'approved',
    'notes' => $reviewNotes,
]);
```

**Role Assignment:**
```php
AuditLog::logAdminAction('role_change', $admin,
    "Changed user {$user->id} role from {$oldRole} to {$newRole}", [
    'user_id' => $user->id,
    'old_role' => $oldRole,
    'new_role' => $newRole,
]);
```

---

## Audit Log Data Model

### Database Schema

```sql
CREATE TABLE audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(255) NULL,
    user_id BIGINT UNSIGNED NULL,
    event_type VARCHAR(50) NOT NULL,
    auditable_type VARCHAR(255) NULL,
    auditable_id BIGINT UNSIGNED NULL,
    action VARCHAR(50) NULL,
    description TEXT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    metadata JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP NOT NULL,

    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at),
    INDEX idx_request_id (request_id),
    INDEX idx_auditable (auditable_type, auditable_id),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### Field Descriptions

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | BIGINT | No | Primary key |
| request_id | VARCHAR(255) | Yes | Unique request identifier for correlation |
| user_id | BIGINT | Yes | User who performed action (null for unauthenticated) |
| event_type | VARCHAR(50) | No | Category of event (see Event Types) |
| auditable_type | VARCHAR(255) | Yes | Model class name (polymorphic relation) |
| auditable_id | BIGINT | Yes | Model ID (polymorphic relation) |
| action | VARCHAR(50) | Yes | Action performed (view, create, update, delete) |
| description | TEXT | Yes | Human-readable event description |
| old_values | JSON | Yes | State before change (for data modifications) |
| new_values | JSON | Yes | State after change (for data modifications) |
| metadata | JSON | Yes | Additional structured data |
| ip_address | VARCHAR(45) | Yes | Client IP address (IPv4 or IPv6) |
| user_agent | TEXT | Yes | Browser/client user agent string |
| created_at | TIMESTAMP | No | Event timestamp |

**Note:** No `updated_at` column. Audit logs are immutable.

### Relationships

**User Relationship:**
```php
public function user(): BelongsTo
{
    return $this->belongsTo(User::class);
}
```

**Polymorphic Auditable:**
```php
public function auditable(): MorphTo
{
    return $this->morphTo();
}
```

---

## Audit Middleware

The `AuditPhiAccess` middleware provides automatic PHI access logging.

### Middleware Registration

**File:** `app/Http/Kernel.php` or route definition

```php
Route::middleware(['auth:sanctum', 'audit.phi'])->group(function () {
    Route::get('/medical-records', [Medical\MedicalRecordController::class, 'index']);
});
```

### Middleware Logic

```php
public function handle(Request $request, Closure $next): Response
{
    // Process request first
    $response = $next($request);

    // Log PHI access after successful response
    if ($this->shouldAudit($request, $response)) {
        $this->logPhiAccess($request, $response);
    }

    return $response;
}
```

### Audit Criteria

PHI access is logged when:

1. Route matches PHI route patterns
2. Response is successful (2xx status code)
3. User is authenticated OR route is provider-access (unauthenticated PHI submission)

**Non-Logged Scenarios:**
- Failed requests (4xx, 5xx status codes)
- Non-PHI routes
- Authenticated requests to non-PHI endpoints

### Parameter Sanitization

Sensitive route parameters are redacted from logs:

```php
protected function sanitizeParameters(array $parameters): array
{
    $sanitized = [];

    foreach ($parameters as $key => $value) {
        if (in_array($key, ['token', 'password', 'secret'])) {
            $sanitized[$key] = '[REDACTED]';
        } elseif (is_object($value) && method_exists($value, 'getKey')) {
            $sanitized[$key] = $value->getKey(); // Store ID only
        } else {
            $sanitized[$key] = is_scalar($value) ? $value : gettype($value);
        }
    }

    return $sanitized;
}
```

---

## Log Querying and Analysis

### Common Query Patterns

**All PHI Access by User:**
```php
AuditLog::where('user_id', $userId)
    ->where('event_type', AuditLog::EVENT_TYPE_PHI_ACCESS)
    ->orderBy('created_at', 'desc')
    ->get();
```

**Failed Authentication Attempts:**
```php
AuditLog::where('event_type', AuditLog::EVENT_TYPE_AUTH)
    ->where('action', 'login_failed')
    ->where('created_at', '>=', now()->subHours(24))
    ->get();
```

**Access to Specific Medical Record:**
```php
AuditLog::where('auditable_type', 'App\\Models\\MedicalRecord')
    ->where('auditable_id', $recordId)
    ->orderBy('created_at', 'desc')
    ->with('user')
    ->get();
```

**Administrative Actions by Date Range:**
```php
AuditLog::where('event_type', AuditLog::EVENT_TYPE_ADMIN_ACTION)
    ->whereBetween('created_at', [$startDate, $endDate])
    ->with('user')
    ->get();
```

**Request Correlation (Distributed Tracing):**
```php
AuditLog::where('request_id', $requestId)
    ->orderBy('created_at')
    ->get();
```

### Analytics Queries

**PHI Access Volume by Day:**
```sql
SELECT DATE(created_at) as date, COUNT(*) as access_count
FROM audit_logs
WHERE event_type = 'phi_access'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Most Active Users:**
```sql
SELECT user_id, users.name, COUNT(*) as action_count
FROM audit_logs
JOIN users ON audit_logs.user_id = users.id
WHERE event_type = 'phi_access'
GROUP BY user_id, users.name
ORDER BY action_count DESC
LIMIT 20;
```

**Access Patterns by IP Address:**
```sql
SELECT ip_address, COUNT(*) as request_count
FROM audit_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY ip_address
ORDER BY request_count DESC;
```

---

## Data Retention and Archival

### Retention Policy

| Event Type | Retention Period | Rationale |
|------------|------------------|-----------|
| PHI Access | 6 years minimum | HIPAA requirement |
| Authentication | 1 year | Security monitoring |
| Admin Actions | 6 years | Compliance and audit trail |
| Security Events | 1 year | Incident investigation |

**HIPAA Requirement:** HIPAA requires retention of audit logs for 6 years from creation or last access, whichever is later.

### Archival Strategy

**Recommended Approach:**

1. **Active Database** — Last 90 days of logs remain in primary database
2. **Archive Database** — 90 days to 6 years moved to archive database
3. **Cold Storage** — Beyond 6 years moved to encrypted cold storage (if required)

**Archival Script Example:**
```php
// Archive logs older than 90 days
$cutoffDate = now()->subDays(90);

AuditLog::where('created_at', '<', $cutoffDate)
    ->chunk(1000, function ($logs) {
        // Export to archive database or file
        // Then delete from active database
    });
```

### Backup Requirements

- Daily backup of audit_logs table
- Encrypted backups stored securely
- Off-site backup retention for disaster recovery
- Verify backup integrity monthly

---

## Graceful Failure Handling

The audit logging system implements graceful failure handling to prevent audit system issues from causing service outages.

### Failure Handling Strategy

**Principle:** Audit failures must not block PHI access requests.

**Rationale:** If audit logging fails, it is more important to maintain service availability for patient care than to block access. However, audit failures must be immediately detected and remediated.

### Implementation

```php
protected function logPhiAccess(Request $request, Response $response): void
{
    try {
        AuditLog::create([
            // ... audit data
        ]);
    } catch (\Throwable $e) {
        // DO NOT throw exception - log failure instead
        Log::error('AUDIT LOG FAILED - PHI access not recorded', [
            'exception' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'request_id' => $request->header('X-Request-ID'),
            'user_id' => $request->user()?->id,
            'route' => $request->route()?->getName(),
            'method' => $request->method(),
            'path' => $request->path(),
            'ip' => $request->ip(),
        ]);

        // Optionally: dispatch immediate alert to security team
    }
}
```

### Failure Monitoring

**Critical Alert Triggers:**

1. Audit log write failure
2. Audit log database connection failure
3. Audit log table full
4. Sudden absence of audit logs (indicates system failure)

**Response Procedures:**

1. Immediate notification to system administrators
2. Investigation of root cause
3. Manual reconstruction of audit trail from application logs
4. Remediation of underlying issue
5. Documentation in security incident log

---

## Cross-References

For related documentation, see:

- [Security](./SECURITY.md) — Complete security architecture and HIPAA compliance
- [API Reference](./API_REFERENCE.md) — API endpoints and authentication
- [Roles and Permissions](./ROLES_AND_PERMISSIONS.md) — Authorization model
- [Troubleshooting](./TROUBLESHOOTING.md) — Common audit logging issues

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
**HIPAA Compliance:** Reviewed and approved for §164.312(b) requirements
