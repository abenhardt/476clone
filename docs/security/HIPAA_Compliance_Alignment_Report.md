# HIPAA Compliance Alignment Report
## Camp Burnt Gin — Camp Management System

**Document Version:** 1.0  
**Report Date:** 2026-04-09  
**Classification:** Internal Compliance Document — Restricted Distribution  
**Regulatory Framework:** Health Insurance Portability and Accountability Act (HIPAA), 45 CFR Parts 160 and 164  
**Prepared By:** Security Engineering Team  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [HIPAA Safeguards Mapping](#2-hipaa-safeguards-mapping)
3. [PHI Data Flow Diagram](#3-phi-data-flow-diagram)
4. [PHI Protection Table](#4-phi-protection-table)
5. [Audit Logging Coverage](#5-audit-logging-coverage)
6. [Data Retention and Deletion Policy](#6-data-retention-and-deletion-policy)
7. [Security Controls Summary](#7-security-controls-summary)
8. [Compliance Gaps](#8-compliance-gaps)

---

## 1. Executive Summary

### HIPAA Applicability

Camp Burnt Gin operates as a covered entity under HIPAA by virtue of receiving, maintaining, and transmitting Protected Health Information (PHI) on behalf of minor camper applicants. The application collects and stores health information including diagnoses, medications, medical history, behavioral profiles, personal care plans, and emergency medical data, all of which constitute PHI as defined under 45 CFR § 160.103.

The application has a designated security responsibility: all PHI is collected only for the purpose of camp health administration, medical planning, and emergency response. No PHI is shared with third parties or used for any secondary purpose.

### Scope

This report covers the technical and administrative security controls implemented in the Camp Burnt Gin web application system (Laravel 12 API backend + React 18 TypeScript SPA) as they align with the HIPAA Security Rule requirements at 45 CFR §§ 164.308, 164.310, and 164.312.

This report does not cover physical datacenter controls (a deployment infrastructure concern outside the application's scope) or business associate agreements (a legal/contractual concern managed by camp administration).

### Status

Following a three-phase forensic security audit and hardening cycle completed 2026-04-09, the application is in **substantial compliance** with applicable HIPAA technical and administrative safeguards. All critical and high-severity findings have been remediated. Identified gaps are documented in Section 8 with remediation plans.

---

## 2. HIPAA Safeguards Mapping

### 2.1 Administrative Safeguards (45 CFR § 164.308)

#### Access Management Policies

The system enforces role-based access control (RBAC) across four roles: `applicant` (parent/guardian), `admin`, `medical`, and `super_admin`. Role assignment is managed exclusively by super-admin users; self-elevation is not possible.

Access to PHI is further restricted by:

- **Laravel Policies:** 18 policy classes define resource-level access rules based on role, ownership, and relationship
- **Middleware enforcement:** `EnsureUserIsAdmin`, `EnsureUserIsMedicalProvider`, and `EnsureUserHasRole` validate role membership before any controller logic is reached. MFA enrollment is enforced separately via the `mfa.enrolled` route middleware alias on all protected route groups; the role middleware does not duplicate this check
- **Controller-level authorization:** `$this->authorize()` is called at the entry point of every protected controller method, ensuring policy enforcement cannot be bypassed via middleware configuration changes
- **Frontend RoleGuard:** Elevated-role routes on the React SPA are wrapped in a `RoleGuard` component that prevents rendering if the user's role does not meet the requirement

Access to PHI is strictly scoped by role:

| Role | PHI Access Permitted |
|---|---|
| `applicant` | Own camper(s) only — own applications, own medical forms |
| `admin` | Application review, family workspace — no direct medical record write access |
| `medical` | Full medical record read/write for all active approved campers |
| `super_admin` | All admin access plus user management and audit export |

#### Workforce Training and Access Monitoring Procedures

All access to PHI-bearing API endpoints is logged via the `AuditPhiAccess` middleware, which records the accessing user's ID, role, IP address, user agent, and timestamp for every request to any of the 14 designated PHI route groups. This provides a complete access trail for compliance review, incident investigation, and workforce accountability.

Administrative content modifications (camper record edits, application status changes, emergency contact updates) are additionally recorded as content-change audit events via `AuditLog::logContentChange()` with before/after snapshots.

Authentication events (login, logout, MFA enrollment, password reset) are recorded as auth audit events.

#### Security Incident Procedures

A documented incident response workflow exists at `workflows/incident-response-workflow.md`. This workflow defines the response procedures for PHI exposure events, including detection, containment, notification, and post-incident review steps.

The Redux middleware layer in the frontend includes PHI detection logic that triggers the incident response flow if PHI content is detected in application state outside of designated state slices.

#### Contingency Plan — Data Retention

All 14 PHI-bearing and identity tables implement soft deletes via Laravel's `SoftDeletes` trait. Deleted records have a `deleted_at` timestamp set rather than being physically removed from the database. This ensures that PHI records are retained and recoverable for the minimum retention period required under 45 CFR § 164.530(j) (six years from creation or last effective date).

Hard deletion of records from PII tables is prohibited by project-level safety gates documented in `system/safety-gate.md` and enforced as a non-negotiable convention.

#### Evaluation

A comprehensive forensic security audit was completed on 2026-04-06. The audit was conducted in two phases:

- **Phase 1:** Authentication, authorization, session security, logging, and configuration gaps
- **Phase 2:** XSS exposure, output encoding, cryptographic failures, duplicate component cleanup, and operational hardening

All Critical and High findings were remediated. The audit produced a full audit report (`docs/audits/workflow-correction-audit-report.md`) and the updated bug tracker (`BUG_TRACKER.md`).

---

### 2.2 Technical Safeguards (45 CFR § 164.312)

#### Access Control (§ 164.312(a))

- **Unique user identification:** Every user account has a unique database-assigned ID and email address; sessions are tied to individual user accounts via Sanctum personal access tokens
- **Sanctum tokens:** Token-based authentication using cryptographically random tokens stored as hashed values in the `personal_access_tokens` table
- **MFA for elevated roles:** Multi-factor authentication (TOTP) is mandatory for `admin`, `super_admin`, and `medical` role accounts; enforced at middleware layer before any PHI access is permitted
- **Automatic session timeout:** Authentication token stored in `sessionStorage` (tab-scoped); token is automatically discarded when the browser tab is closed, preventing persistent unattended sessions
- **Session invalidation on password reset:** All existing Sanctum tokens for a user are deleted upon successful password reset, ensuring compromised credentials do not maintain active sessions

#### Audit Controls (§ 164.312(b))

The `AuditLog` Eloquent model records:

- **PHI access events:** Every request to a PHI route group (14 groups monitored)
- **Content change events:** Before/after snapshots for all admin edits to camper, emergency contact, and behavioral profile records
- **Administrative action events:** Application status transitions, user account creation, role changes
- **Authentication events:** Login, logout, MFA enrollment, password reset

Each audit record includes: `request_id`, `user_id`, `event_type`, `auditable_type`, `auditable_id`, `action`, `description`, `old_values`, `new_values`, `metadata` (structured JSON), `ip_address`, `user_agent`, `created_at`. There is no `updated_at` column; audit records are immutable by design.

The audit log is accessible only to `super_admin` users via a rate-limited export endpoint (5 exports per hour), preventing bulk extraction.

#### Integrity (§ 164.312(c))

- **Soft deletes:** All PHI and identity tables use soft deletes; no PHI record can be permanently destroyed through normal application operations
- **Encrypted casts:** PHI fields use Laravel's `encrypted` cast, which encrypts the value before writing to MySQL and decrypts it in application memory on read; storage-layer compromise does not expose PHI in plaintext
- **Foreign key constraints:** Database-level foreign key constraints prevent orphaned PHI records
- **Status transition matrix:** `ApplicationStatus::canTransitionTo()` enforces a defined state machine for application lifecycle transitions, preventing invalid state changes that could corrupt the integrity of the application record

#### Transmission Security (§ 164.312(e))

- **HTTPS enforced:** `URL::forceHttps()` called in the production service provider; all API communication occurs over TLS
- **Secure session cookies:** Session cookies configured with `secure=true` (HTTPS only), `samesite=strict` (CSRF protection), and `encrypted=true`
- **Cache-Control on PHI downloads:** All file download responses include `Cache-Control: no-store` to prevent caching of PHI content by intermediate proxies or browser caches
- **No PHI in logs or response leakage:** Log output scrubbed of email addresses and PHI fields; API responses shaped to include only fields required for the consuming view

---

### 2.3 Physical Safeguards (45 CFR § 164.310)

Physical safeguards at the server and datacenter level are the responsibility of the hosting infrastructure provider and are outside the scope of this application. The following application-level physical safeguard controls are in place:

#### Workstation and File Access

- **Non-web-accessible file storage:** Uploaded documents (medical forms, applications) are stored in `storage/app/private/` — a directory that is explicitly excluded from the web server's public document root and cannot be accessed via direct URL
- **UUID-only filenames:** All uploaded files are stored using UUID-generated paths; the original filename is stored only in the database. No PHI appears in file system paths, preventing incidental exposure via directory listings or log files
- **Authenticated access only:** Files can only be retrieved via the `GET /api/documents/{id}/download` endpoint, which requires a valid Sanctum token and passes through Policy authorization before the file is served

---

## 3. PHI Data Flow Diagram

```
COLLECTION
──────────────────────────────────────────────────────────────────────────────
  Parent/Guardian (browser)
       │
       │  HTTPS (TLS enforced)
       │  Form data from ApplicationFormPage.tsx
       ▼
  Laravel API (POST /api/applications, /api/campers, /api/medical-records, etc.)
       │
       │  Form Request validation (all fields validated before model touch)
       ▼
  Eloquent Model (encrypted cast applied on write)
       │
       ▼
  MySQL 8.0 — PHI stored in encrypted columns
              (plaintext never written to disk)

PROCESSING
──────────────────────────────────────────────────────────────────────────────
  Request enters PHI route group
       │
       ├── AuditPhiAccess middleware: access event logged to audit_logs table
       │
       ├── Sanctum + Role + MFA middleware: identity and authorization verified
       │
       ▼
  Controller calls $this->authorize() → Policy evaluates access
       │
       ▼
  Eloquent Model reads encrypted columns → decrypts in application memory
  (plaintext PHI exists only in PHP process memory, never written to disk)
       │
       ▼
  Response shaped to minimal required fields
  (no unnecessary PII included in JSON response)

STORAGE
──────────────────────────────────────────────────────────────────────────────
  MySQL 8.0 (encrypted columns)
  ├── PHI fields: encrypted at rest via Laravel encrypted cast (AES-256-CBC)
  ├── All PHI/identity tables: soft-deleted (deleted_at, no hard deletes)
  └── audit_logs: append-only access record

  Local disk (storage/app/private/)
  ├── UUID filenames (no PHI in file path)
  ├── Not web-accessible
  └── Access only via authenticated API with Policy authorization

TRANSMISSION
──────────────────────────────────────────────────────────────────────────────
  All API responses: HTTPS only (URL::forceHttps() in production)
  File download responses: Cache-Control: no-store header applied
  Session cookies: secure=true, samesite=strict, encrypted=true
  No PHI in application logs or error output
  No PHI in file system paths
  No PHI transmitted to external services (HaveIBeenPwned receives only
  password hash prefix — no user data)
```

---

## 4. PHI Protection Table

| Data Type | Storage Method | Encryption | Access Control | Audit Logged | Retention |
|---|---|---|---|---|---|
| Medical records (diagnoses, history, emergency info) | MySQL `medical_records` table | Encrypted columns (Laravel encrypted cast) | `medical` role + Policy; `applicant` read-own via Policy | PHI access on every request; content changes logged | Soft delete; 6-year minimum |
| Camper PII (name, DOB, address) | MySQL `campers` table | Encrypted columns (name, DOB, address) | Role-scoped via Policy; applicant own-only | PHI access logged | Soft delete; 6-year minimum |
| Emergency contacts | MySQL `emergency_contacts` table | Encrypted columns (phones, addresses) | `applicant` own-family; `admin`/`medical` via Policy | PHI access logged; admin edits content-change logged | Soft delete; 6-year minimum |
| Medications | MySQL `medications` table | Encrypted columns | `medical` role + Policy | PHI access + content change logged | Soft delete; 6-year minimum |
| Diagnoses | MySQL `diagnoses` table | Encrypted columns | `medical` role + Policy | PHI access + content change logged | Soft delete; 6-year minimum |
| Vitals / Medical visits | MySQL `medical_visits` table | Encrypted columns (vitals added in hardening pass) | `medical` role + Policy | PHI access + content change logged | Soft delete; 6-year minimum |
| Behavioral profiles | MySQL `behavioral_profiles` table | Encrypted columns (descriptions) | `applicant` write-own; `admin`/`medical` read via Policy | PHI access logged; admin edits content-change logged | Soft delete; 6-year minimum |
| Personal care plans | MySQL `personal_care_plans` table | Encrypted columns (notes, instructions) | `medical` role + Policy | PHI access + content change logged | Soft delete; 6-year minimum |
| Feeding plans | MySQL `feeding_plans` table | Encrypted columns | `medical` role + Policy | PHI access logged | Soft delete; 6-year minimum |
| Assistive devices | MySQL `assistive_devices` table | Encrypted columns | `medical` role + Policy | PHI access logged | Soft delete; 6-year minimum |
| Activity permissions | MySQL `activity_permissions` table | Encrypted columns | `medical` role + Policy | PHI access logged | Soft delete; 6-year minimum |
| Application drafts (client-side) | Browser `sessionStorage` (key: `cbg_app_draft`) | None (client-side only) | Tab-scoped; cleared on tab close | Not applicable | Cleared on tab close |
| User accounts | MySQL `users` table | Password: bcrypt hash; sensitive fields: encrypted | All roles (own record); `super_admin` full access | Auth events logged | Soft delete; 6-year minimum |
| User emergency contacts | MySQL `user_emergency_contacts` table | Encrypted columns (added in hardening pass) | User own-record; `super_admin` via Policy | PHI access logged | Soft delete; 6-year minimum |

---

## 5. Audit Logging Coverage

### What Is Logged

The `AuditLog` model records four event categories:

| Event Category | Trigger | Examples |
|---|---|---|
| **PHI Access** | `AuditPhiAccess` middleware on PHI route groups | Any GET/POST/PUT/DELETE to `/api/medical/*`, `/api/campers/*`, `/api/applications/*`, etc. |
| **Content Change** | `AuditLog::logContentChange()` in controllers | Admin edits to camper info, emergency contacts, behavioral profiles; medical record updates |
| **Admin Action** | `AuditLog::logAdminAction()` in service layer | Application status transitions, user account creation, role assignment |
| **Auth Event** | Auth controllers | Login, logout, MFA enrollment, MFA disablement, password reset |

### Who (Identity Fields)

Every audit record captures:

- `user_id` — foreign key to `users` table (authenticated user performing the action)
- `ip_address` — request IP address
- `user_agent` — client user agent string
- `request_id` — correlation ID from the `X-Request-ID` header for distributed tracing

### What Fields Are Stored

| Field | Type | Description |
|---|---|---|
| `id` | BIGINT | Auto-increment primary key |
| `request_id` | VARCHAR(255) | Unique request identifier for correlation |
| `user_id` | FK | Performing user (FK to users, SET NULL on delete) |
| `event_type` | VARCHAR(50) | Category: `phi_access`, `admin_action`, `auth`, `security`, `data_change`, `file_access` |
| `auditable_type` | VARCHAR(255) | Model class name (e.g., `App\Models\MedicalRecord`) |
| `auditable_id` | BIGINT | Primary key of affected record |
| `action` | VARCHAR(50) | Action type (e.g., `view`, `create`, `update`, `delete`, `document_view`) |
| `description` | TEXT | Human-readable description of the event |
| `old_values` | JSON | State before change (content change events only) |
| `new_values` | JSON | State after change (content change events only) |
| `metadata` | JSON | Structured request or action details |
| `ip_address` | VARCHAR(45) | Request originator IP (IPv4 or IPv6) |
| `user_agent` | TEXT | Client browser/user agent |
| `created_at` | TIMESTAMP | Event timestamp (UTC) |

### Traceability and Export

The full audit log is available to `super_admin` users via the audit log export endpoint. The export is:

- Rate-limited to 5 exports per hour per user via the `phi-export` rate limiter
- Filtered to exclude email addresses and other unnecessary PII from the CSV output
- Accessible only after Sanctum + MFA verification

---

## 6. Data Retention and Deletion Policy

### Soft Delete Enforcement

All 14 PHI-bearing and identity tables have the Laravel `SoftDeletes` trait applied. When a delete operation is called on a model, the `deleted_at` column is set to the current timestamp. The record remains physically present in the database and is excluded from default query results by Eloquent's global scope.

Records subject to soft delete:

`users`, `campers`, `medical_records`, `applications`, `emergency_contacts`, `behavioral_profiles`, `personal_care_plans`, `feeding_plans`, `assistive_devices`, `activity_permissions`, `medications`, `diagnoses`, `medical_visits`, `user_emergency_contacts`

### Hard Delete Prohibition

Hard deletion of records from any of the above tables is prohibited by:

1. **Project safety gate:** `system/safety-gate.md` lists "hard-deleting records from PII tables" as a Forbidden action requiring no override
2. **Convention enforcement:** No controller method in the codebase calls `forceDelete()` on any PHI or identity model
3. **Code review requirement:** Any PR that introduces `forceDelete()` on a PHI model requires explicit security review

### Retention Period

The minimum retention period aligns with 45 CFR § 164.530(j), which requires HIPAA-related documentation to be retained for six years from the date of creation or the date it was last in effect. Application-level records (medical records, applications, camper profiles) are retained indefinitely via soft delete until a formal retention policy review determines records are eligible for archival or permanent removal via an authorized administrative process.

### Restore Capability

Soft-deleted records can be restored using `withTrashed()` and `restore()` Eloquent methods. Only `super_admin` users have access to restore operations through the application UI. Bulk restore and selective restore are both supported.

---

## 7. Security Controls Summary

| Control Category | Control | Implementation | HIPAA Reference |
|---|---|---|---|
| Access control | Role-based access (4 roles) | RBAC middleware + Laravel Policies | § 164.308(a)(4), § 164.312(a)(1) |
| Access control | MFA for elevated roles | TOTP enforced in middleware | § 164.312(d) |
| Access control | Unique user IDs + Sanctum tokens | personal_access_tokens table | § 164.312(a)(2)(i) |
| Access control | Session timeout (tab-scoped) | sessionStorage token | § 164.312(a)(2)(iii) |
| Audit controls | PHI access logging | AuditPhiAccess middleware (14 route groups) | § 164.312(b) |
| Audit controls | Content change logging | AuditLog::logContentChange() | § 164.312(b) |
| Audit controls | Auth event logging | Auth controllers | § 164.312(b) |
| Integrity | Soft deletes on 14 tables | SoftDeletes trait | § 164.312(c)(1) |
| Integrity | Encrypted PHI columns | Laravel encrypted cast (AES-256-CBC) | § 164.312(a)(2)(iv) |
| Integrity | Application state machine | ApplicationStatus::canTransitionTo() | § 164.312(c)(1) |
| Transmission security | HTTPS enforcement | URL::forceHttps() | § 164.312(e)(1) |
| Transmission security | Secure/encrypted cookies | Session config | § 164.312(e)(1) |
| Transmission security | Cache-Control: no-store | File download responses | § 164.312(e)(1) |
| Transmission security | No PHI in logs | Log channel configuration | § 164.312(e)(2) |
| Physical safeguards | Non-web-accessible file storage | storage/app/private/ | § 164.310(d)(1) |
| Physical safeguards | UUID file paths | FileUploadService | § 164.310(d)(1) |
| Password security | Breach-checked passwords | Password::defaults() + uncompromised() | § 164.308(a)(5) |
| Password security | Token invalidation on reset | tokens()->delete() after reset | § 164.312(a)(2)(i) |
| Incident response | PHI incident workflow | incident-response-workflow.md | § 164.308(a)(6) |
| Contingency plan | 6-year retention via soft delete | SoftDeletes on all PHI tables | § 164.530(j) |

---

## 8. Compliance Gaps

The following gaps were identified and are tracked for remediation. None represent a current PHI exposure risk under normal operating conditions.

### Gap 1 — Emergency Contact and Behavioral Profile Create Idempotency (MEDIUM)

**Description:** The `store()` operations for emergency contacts and behavioral profiles do not include idempotency guards. If an applicant's form submission is partially processed and retried, duplicate sub-records may be created for the same application.

**HIPAA relevance:** Data integrity (§ 164.312(c)(1)); duplicate records could cause confusion during medical review and emergency response.

**Remediation plan:** Add `firstOrCreate()` or `updateOrCreate()` guards to the store operations for these two resource types. Tracked as BUG-135.

**Timeline:** Next development sprint.

---

### Gap 2 — Physical Datacenter Controls (Infrastructure Dependency)

**Description:** Physical access controls, environmental controls (fire suppression, power redundancy), and workstation security at the server hosting level are the responsibility of the infrastructure/hosting provider. The application cannot enforce or verify these controls.

**HIPAA relevance:** § 164.310(a)(1), § 164.310(b), § 164.310(c).

**Remediation plan:** Hosting provider selection and BAA execution are administrative responsibilities of camp management. A Business Associate Agreement (BAA) should be in place with the hosting provider if they have any access to PHI at the storage level.

**Timeline:** Administrative action required; outside application scope.

---

### Gap 3 — Backup Encryption and Offsite Backup Procedures (Infrastructure Dependency)

**Description:** The application does not control or configure database backup procedures. Backup encryption, backup retention schedules, and offsite backup storage are infrastructure concerns.

**HIPAA relevance:** § 164.308(a)(7)(ii)(A) — Data backup plan; § 164.312(a)(2)(iv) — Encryption of data at rest in backups.

**Remediation plan:** Camp administration should ensure that the hosting/infrastructure provider encrypts all database backups at rest and maintains an offsite or redundant copy. This should be verified as part of the BAA negotiation.

**Timeline:** Administrative action required; outside application scope.

---

*End of HIPAA Compliance Alignment Report*

*This document reflects the state of the system as of 2026-04-09 following a third-phase forensic audit that remediated BUG-175 (MFA middleware bootstrap deadlock in EnsureUserIsMedicalProvider), BUG-177 (document metadata view not audit-logged), and BUG-178 (all five CSV report exports not audit-logged). It should be reviewed following any significant architectural change, regulatory update, or security incident. The next scheduled review is 2026-10-09.*
