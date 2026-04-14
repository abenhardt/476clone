# Rate Limiting Architecture & Enforcement Strategy

**System:** Camp Burnt Gin Application Platform
**Classification:** Internal System Architecture Document
**Author:** Backend Systems Architecture
**Last Updated:** March 2026
**Status:** Authoritative

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Scope of Rate Limiting](#2-system-scope-of-rate-limiting)
3. [Named Limiter Definitions](#3-named-limiter-definitions)
4. [Complete Route-Level Policy Table](#4-complete-route-level-policy-table)
5. [Role-Based Behavior](#5-role-based-behavior)
6. [Security Considerations](#6-security-considerations)
7. [Integration with Authentication and Sessions](#7-integration-with-authentication-and-sessions)
8. [Backend Implementation](#8-backend-implementation)
9. [Distributed System Considerations](#9-distributed-system-considerations)
10. [Error Handling and User Feedback](#10-error-handling-and-user-feedback)
11. [Logging, Monitoring, and Auditing](#11-logging-monitoring-and-auditing)
12. [Performance Impact](#12-performance-impact)
13. [Testing](#13-testing)
14. [Known Gaps and Future Enhancements](#14-known-gaps-and-future-enhancements)
15. [Conclusion](#15-conclusion)

---

## 1. Introduction

### Purpose

Rate limiting constrains how frequently a caller — identified by authenticated user ID or source IP address — may invoke an endpoint within a defined time window. When the limit is exceeded, the system returns HTTP 429 Too Many Requests and rejects the request without processing it.

### Why Rate Limiting Is Critical in This System

The platform handles Protected Health Information (PHI) for minors under HIPAA. The specific threats that rate limiting addresses are:

**Brute force credential attacks:** The login, MFA verification, and password reset endpoints accept credentials without requiring an existing session. Without rate limiting, an attacker can make unlimited attempts against these endpoints.

**PHI data extraction:** Authenticated users with valid tokens can query paginated endpoints repeatedly to extract bulk data. Rate limiting creates a window in which anomalous extraction patterns become visible and generate 429 responses before significant data has been retrieved.

**Resource exhaustion:** File uploads are memory- and I/O-intensive operations. Document downloads stream file content. Repeated high-volume calls to either can exhaust storage or degrade performance for all users.

**Inbox flooding:** The messaging system dispatches email notifications to recipients. Unthrottled message sending wastes notification quota and renders the inbox unusable for legitimate staff communication.

**HIPAA compliance contribution:** Rate limiting on authentication and PHI access endpoints is a documented Technical Safeguard contributing to Access Control requirements (§164.312(a)(1)). Combined with audit logging, it provides evidence of access control enforcement.

### Relationship to Authentication and Authorization

Rate limiting is an independent control layer. It operates alongside authentication (Sanctum token validation) and authorization (policy checks), not as a substitute for either. The middleware execution order per request is:

```
Rate limit check → Sanctum token validation → Role middleware → Policy authorization
```

Rate limit counters are incremented even for requests that will subsequently fail token validation or authorization. This prevents an attacker from probing expired tokens or unauthorized endpoints at high speed without incurring rate limit consequences.

---

## 2. System Scope of Rate Limiting

### 2.1 Areas with Dedicated Rate Limiting

The following areas have specific named limiters or inline throttle rules applied in addition to the global API limit:

**Authentication endpoints** — Login, registration, password reset, and email verification share the `auth` limiter. These are unauthenticated endpoints, so limits are scoped per source IP.

**MFA flows** — Setup, verification, and disable share the `mfa` limiter. These run against authenticated users but before email verification, so limits are scoped per user ID.

**File uploads** — Document uploads, avatar uploads, and applicant document submissions share the `uploads` limiter. Scoped per user ID.

**Sensitive operations** — Document downloads, document request downloads, message attachment downloads, and account deletion share the `sensitive` limiter. Scoped per user ID. The rationale for including downloads is PHI exfiltration prevention: bulk downloading of medical documents at high speed is a meaningful data extraction vector.

**Inbox messaging** — Individual conversation and message routes use inline throttle values tailored to each action's risk profile. New conversation creation (spam risk) is tighter than reading messages (low risk).

**Email verification resend** — A standalone inline throttle to prevent abuse of the verification email sending pathway.

**Medical provider link creation** — The `provider-link` limiter applies to the endpoint that generates secure access tokens for external medical providers.

### 2.2 Areas Covered Only by the Global API Limit

The following areas are covered exclusively by the global `api` limiter (300/min for authenticated users). No dedicated throttle exists for them:

- Camper CRUD operations
- Application CRUD and review actions
- Medical record CRUD (all clinical data routes: allergies, medications, diagnoses, behavioral profiles, feeding plans, assistive devices, treatment logs, incidents, visits, restrictions, follow-ups)
- Report generation
- User management (super_admin role management, deactivation)
- Camp and session management
- Family management
- Notifications
- Form builder management
- Calendar and deadline management
- Audit log export

### 2.3 Areas with No Rate Limiting

The following routes have no rate limit applied:

- `GET /api/health` and `GET /api/ready` — health check endpoints used by monitoring probes, intentionally unrestricted
- `GET /api/forms/*` (4 public form download routes) — public blank form PDFs; no authentication required and no throttle configured

---

## 3. Named Limiter Definitions

All named rate limiters are defined in `bootstrap/app.php` inside the `withRouting(then: ...)` callback. This is the authoritative definition location.

`AppServiceProvider::configureRateLimiting()` also defines the same six limiter names with different values. Because `bootstrap/app.php`'s `then:` callback executes during routing registration — after providers have booted — it overwrites the `AppServiceProvider` definitions. The `AppServiceProvider` values are therefore inactive. See Section 8.2 for implementation notes on this dual-registration issue.

### 3.1 `api` — Global API Backstop

**Purpose:** Default limit applied to all authenticated and verified routes via `middleware(['auth:sanctum', 'verified', 'throttle:api'])`.

| Caller type | Limit | Scope |
|---|---|---|
| Authenticated user | 300 requests / minute | Per user ID |
| Unauthenticated caller | 60 requests / minute | Per IP address |

**Rationale for 300/min:** The admin and medical portals make multiple parallel sub-requests per page load (allergies, medications, emergency contacts, behavioral profiles, etc.). During development, 60/min caused cascade 429 failures on normal multi-panel pages. 300/min accommodates legitimate parallel sub-requests while still being far below what an automated extraction script would require for efficient bulk export.

### 3.2 `auth` — Authentication Endpoints

**Purpose:** Protects login, registration, password reset, and email verification.

| Tier | Limit | Window | Scope |
|---|---|---|---|
| Burst | 5 requests | 1 minute | Per IP address |
| Sustained | 20 requests | 1 hour | Per IP address |

Both tiers apply simultaneously. The burst tier is the binding constraint in most attack scenarios.

### 3.3 `mfa` — Multi-Factor Authentication

**Purpose:** Protects MFA setup, verification, and disable.

| Tier | Limit | Window | Scope |
|---|---|---|---|
| Burst | 3 requests | 1 minute | Per user ID (fallback: IP) |
| Sustained | 10 requests | 1 hour | Per user ID (fallback: IP) |

The burst limit of 3/minute makes TOTP brute force mathematically infeasible. A 6-digit code space contains 1,000,000 possibilities. TOTP codes are valid for a 30-second window (±1 window). At 3 attempts per minute, exhausting the code space would require approximately 5,555 hours — far longer than any code's validity window.

### 3.4 `provider-link` — Medical Provider Link Creation

**Purpose:** Limits how frequently authenticated users can generate medical provider access tokens.

| Tier | Limit | Window | Scope |
|---|---|---|---|
| Burst | 2 requests | 1 minute | Per IP address |
| Sustained | 10 requests | 1 hour | Per IP address |

This limiter applies to `POST /api/medical-provider-links` (the link creation endpoint for parents and admins). It does not apply to token-based provider access because the external provider link access pathway was removed from the API in Phase 6; external providers now access the system through authenticated medical staff accounts.

### 3.5 `uploads` — File Uploads

**Purpose:** Limits file upload operations to prevent storage exhaustion.

| Tier | Limit | Window | Scope |
|---|---|---|---|
| Burst | 5 requests | 1 minute | Per user ID (fallback: IP) |
| Sustained | 50 requests | 1 hour | Per user ID (fallback: IP) |

Applied to: `POST /api/documents`, `POST /api/profile/avatar`, `POST /api/applicant/documents/upload`, `POST /api/applicant/document-requests/{id}/upload`.

No role differentiation. All roles use the same limit.

### 3.6 `sensitive` — Sensitive Operations

**Purpose:** Limits PHI-containing downloads and destructive account operations.

| Tier | Limit | Window | Scope |
|---|---|---|---|
| Burst | 10 requests | 1 minute | Per user ID (fallback: IP) |
| Sustained | 100 requests | 1 hour | Per user ID (fallback: IP) |

Applied to: `GET /api/documents/{id}/download`, `GET /api/document-requests/{id}/download`, `GET /api/applicant/document-requests/{id}/download`, `GET /api/inbox/messages/{id}/attachments/{documentId}`, `DELETE /api/profile/account`.

The inclusion of PHI document downloads under this limiter is an explicit exfiltration control. An authenticated user cannot bulk-download more than 10 documents per minute or 100 per hour regardless of role.

---

## 4. Complete Route-Level Policy Table

### 4.1 Public Endpoints (No Authentication)

| Endpoint | Method | Rate Limit | Scope | Notes |
|---|---|---|---|---|
| `/api/health` | GET | None | — | Monitoring probe |
| `/api/ready` | GET | None | — | Monitoring probe |
| `/api/forms/` | GET | None | — | Blank form download |
| `/api/forms/application` | GET | None | — | Blank form download |
| `/api/forms/application-spanish` | GET | None | — | Blank form download |
| `/api/forms/medical-exam` | GET | None | — | Blank form download |
| `/api/forms/cyshcn` | GET | None | — | Blank form download |
| `/api/auth/register` | POST | `auth`: 5/min + 20/hour | Per IP | |
| `/api/auth/login` | POST | `auth`: 5/min + 20/hour | Per IP | |
| `/api/auth/forgot-password` | POST | `auth`: 5/min + 20/hour | Per IP | |
| `/api/auth/reset-password` | POST | `auth`: 5/min + 20/hour | Per IP | |
| `/api/auth/email/verify` | POST | `auth`: 5/min + 20/hour | Per IP | |

### 4.2 Authenticated but Unverified Endpoints

These require a valid Sanctum token but not a verified email address (MFA is part of the authentication flow; users may not yet be verified).

| Endpoint | Method | Rate Limit | Scope |
|---|---|---|---|
| `/api/auth/email/resend` | POST | Inline: 6/min | Per user |
| `/api/mfa/setup` | POST | `mfa`: 3/min + 10/hour | Per user |
| `/api/mfa/verify` | POST | `mfa`: 3/min + 10/hour | Per user |
| `/api/mfa/disable` | POST | `mfa`: 3/min + 10/hour | Per user |
| `/api/logout` | POST | `api`: 300/min | Per user |
| `/api/user` | GET | `api`: 300/min | Per user |

### 4.3 File Upload Endpoints

All require `auth:sanctum` + `verified`. All carry `throttle:uploads` (5/min + 50/hour per user) in addition to the global `api` limit.

| Endpoint | Method |
|---|---|
| `/api/documents` | POST |
| `/api/profile/avatar` | POST |
| `/api/applicant/documents/upload` | POST |
| `/api/applicant/document-requests/{id}/upload` | POST |

### 4.4 Sensitive Operation Endpoints

All require `auth:sanctum` + `verified`. All carry `throttle:sensitive` (10/min + 100/hour per user) in addition to the global `api` limit.

| Endpoint | Method | Additional RBAC |
|---|---|---|
| `/api/documents/{id}/download` | GET | DocumentPolicy |
| `/api/document-requests/{id}/download` | GET | admin/super_admin only |
| `/api/applicant/document-requests/{id}/download` | GET | applicant role only |
| `/api/inbox/messages/{id}/attachments/{documentId}` | GET | Conversation participant |
| `/api/profile/account` | DELETE | Own account only |

### 4.5 Inbox Messaging Endpoints

All require `auth:sanctum` + `verified`. The global `api` limit (300/min) applies throughout. Each route also carries an inline throttle listed below.

| Endpoint | Method | Inline Throttle | Limit |
|---|---|---|---|
| `/api/inbox/users` | GET | `throttle:30,1` | 30/min |
| `/api/inbox/conversations` | GET | `throttle:60,1` | 60/min |
| `/api/inbox/conversations` | POST | `throttle:5,60` | 5/hour |
| `/api/inbox/conversations/{id}` | GET | `throttle:60,1` | 60/min |
| `/api/inbox/conversations/{id}/archive` | POST | `throttle:20,1` | 20/min |
| `/api/inbox/conversations/{id}/unarchive` | POST | `throttle:20,1` | 20/min |
| `/api/inbox/conversations/{id}/participants` | POST | `throttle:10,60` | 10/hour |
| `/api/inbox/conversations/{id}/participants/{user}` | DELETE | `throttle:10,60` | 10/hour |
| `/api/inbox/conversations/{id}/leave` | POST | `throttle:10,60` | 10/hour |
| `/api/inbox/conversations/{id}/star` | POST | `throttle:60,1` | 60/min |
| `/api/inbox/conversations/{id}/important` | POST | `throttle:60,1` | 60/min |
| `/api/inbox/conversations/{id}/trash` | POST | `throttle:20,1` | 20/min |
| `/api/inbox/conversations/{id}/restore-trash` | POST | `throttle:20,1` | 20/min |
| `/api/inbox/conversations/{id}/messages` | GET | `throttle:60,1` | 60/min |
| `/api/inbox/conversations/{id}/messages` | POST | `throttle:20,1` | 20/min |
| `/api/inbox/conversations/{id}/reply` | POST | `throttle:20,1` | 20/min |
| `/api/inbox/conversations/{id}/reply-all` | POST | `throttle:20,1` | 20/min |
| `/api/inbox/messages/unread-count` | GET | `throttle:60,1` | 60/min |
| `/api/inbox/messages/{id}` | GET | `throttle:60,1` | 60/min |
| `/api/inbox/messages/{id}/attachments/{documentId}` | GET | `sensitive`: 10/min + 100/hour | See 4.4 |
| `/api/inbox/messages/{id}/attachments/{documentId}/preview` | GET | `throttle:30,1` | 30/min |
| `/api/inbox/messages/{id}` | DELETE | `api`: 300/min | Per user |

### 4.6 All Remaining Authenticated Endpoints

The following route groups carry only the global `api` limit (300/min per user). No additional throttle is applied.

- User profile read/update (`/api/profile/*` except avatar and account deletion)
- Camp and session CRUD (`/api/camps/*`, `/api/sessions/*`)
- Notifications (`/api/notifications/*`)
- Documents index and metadata (`GET /api/documents`, `GET /api/documents/{id}`)
- Document verify (`PATCH /api/documents/{id}/verify`)
- Document delete (`DELETE /api/documents/{id}`)
- Family management (`/api/families/*`)
- Reports (`/api/reports/*`)
- Camper CRUD + computed endpoints (`/api/campers/*`)
- Application CRUD + review (`/api/applications/*`)
- Medical records and all clinical data — allergies, medications, diagnoses, behavioral profiles, feeding plans, assistive devices, treatment logs, incidents, visits, restrictions, follow-ups, activity permissions (`/api/medical-records/*`, etc.)
- Emergency contacts (`/api/emergency-contacts/*`)
- Medical stats (`/api/medical/stats`)
- Medical provider links CRUD (except creation, which adds `provider-link`)
- User management (`/api/users/*`)
- Audit log (`/api/audit-log/*`)
- Form builder management (`/api/form/*`)
- Form templates download (`/api/form-templates/*`)
- Deadlines and calendar events
- Announcements

---

## 5. Role-Based Behavior

The rate limiting system applies **identical limits to all roles**. There is no role-differentiated tier for any limiter. A super_admin, admin, applicant, and medical user all receive the same limit values for every named limiter and the same global `api` limit of 300/min.

The only variation is the `api` limiter's unauthenticated fallback (60/min per IP vs. 300/min per user ID), which applies regardless of role by definition — unauthenticated callers have no role.

**Implication for admin workflows:** Admins performing bulk operations (reviewing many applications in sequence, downloading multiple reports, bulk-processing document requests) are bounded by the same 300/min global limit as any other user. At one request per 200ms sustained, the global limit allows approximately 5 requests per second. For typical manual admin workflows this is never a constraint. Automated scripts acting as an admin account would reach the limit.

**Implication for medical portal:** The medical portal makes parallel sub-requests when loading a camper's full clinical picture (medical record, allergies, medications, diagnoses, behavioral profile, feeding plan, assistive devices). This motivated the increase of the global `api` limit from 60 to 300/min. Medical staff have no separate elevated limit but benefit from the same 300/min as all authenticated users.

---

## 6. Security Considerations

### 6.1 Brute Force Attack Prevention

**Login brute force:** The `auth` limiter (5/min + 20/hour per IP) operates alongside the application-level account lockout (5 failed attempts triggers a 15-minute lockout stored in `users.lockout_until`). These are independent controls. The rate limit is checked before any credential validation database query occurs, so an attacker cannot consume database query capacity at high speed. An attacker who rotates IP addresses bypasses the IP-based rate limit but still triggers account lockout once they identify a valid email.

**Password reset token guessing:** Password reset tokens are 64-character cryptographically secure strings. The `auth` limiter (5/min) bounds the speed at which an attacker can attempt token guessing. At 5 attempts per minute, guessing a 64-character hex token within its 30-minute validity window is computationally infeasible by many orders of magnitude.

**TOTP brute force:** Described in Section 3.3. The 3/min + 10/hour limit on `mfa` makes exhaustion of the 6-digit code space impossible within any code's validity window.

### 6.2 Credential Stuffing

Credential stuffing attacks use leaked email/password pairs from other breaches. The `auth` limiter's 5/min per IP limit constrains naive tools that do not distribute requests. Distributed stuffing campaigns that stay below the per-IP limit are constrained by the account lockout mechanism (5 failures per account, 15 minutes, regardless of IP).

The system's bcrypt cost factor of 14 adds approximately 100ms per hash verification server-side, which creates additional overhead for high-volume attackers even when the rate limit is not yet triggered.

### 6.3 PHI Data Extraction

An authenticated attacker with a valid token can page through clinical data using the general `api` limit of 300/min. At 300 requests per minute and a maximum session lifetime of 30 minutes (Sanctum token expiry), the ceiling for a single session before re-authentication is 9,000 requests. The session limit and re-authentication gate on the `auth` limiter bound the total extraction rate from a single credential set.

The `sensitive` limiter (10/min + 100/hour) on document downloads is an additional control specifically for file-based PHI extraction. An attacker cannot download more than 10 medical documents per minute regardless of the general api limit.

All medical record access is audit-logged. High-volume access from a single user ID within a session produces an observable pattern in the `audit_logs` table that monitoring queries can detect (see Section 11.4).

### 6.4 Document Upload Abuse

Each upload consumes disk storage, triggers a security scan job, and writes a database record. The `uploads` limiter (5/min + 50/hour) caps a single user at 50 MB/min (at the 10 MB maximum per file) in a burst and 500 MB/hour sustained. This is high enough to be imperceptible to any legitimate user and low enough to prevent trivial storage exhaustion.

### 6.5 Inbox Flooding

New conversation creation is limited to 5/hour per user by `throttle:5,60`. Message sending within a conversation is limited to 20/min by `throttle:20,1`. These limits prevent a user from flooding the admin inbox or generating excessive email notifications to staff. At 20 messages per minute, an active legitimate support conversation with rapid back-and-forth replies will never approach the limit. At 5 new conversations per hour, a parent with multiple questions can open multiple support threads.

### 6.6 Medical Provider Link Token Enumeration

The `provider-link` limiter (2/min + 10/hour per IP) applies to the creation of medical provider links, not to token access (the access pathway was removed in Phase 6). The limit prevents a legitimate user from accidentally generating large numbers of tokens in rapid succession and prevents automated link farming.

### 6.7 Account Lockout and Rate Limit Interaction

The account lockout (application-level, stored in `users.lockout_until`) and the `auth` rate limit (middleware-level, stored in cache) are independent mechanisms that interact as follows:

- If the `auth` rate limit fires first (5 attempts within one minute before 5 failures accumulate on the account), the caller receives HTTP 429. The account is not locked.
- If 5 account failures accumulate before the rate limit window resets, the account locks for 15 minutes regardless of remaining rate limit capacity.
- When both are triggered, the account lockout response takes precedence in the returned message and `retry_after` reflects the 15-minute lockout duration.
- After the lockout expires, the rate limit window may have already reset. The caller can attempt login again but will re-trigger lockout in 5 more failures.

---

## 7. Integration with Authentication and Sessions

### 7.1 Pre-Authentication Rate Limiting

For unauthenticated endpoints (`auth` limiter), the rate limit check runs on the incoming request before any credential validation. The scope key is the client IP address. This means the counter increments even for requests that would fail due to invalid input (missing fields, malformed JSON) before credential validation is reached. This is intentional: it prevents an attacker from probing the endpoint's validation logic at high speed.

### 7.2 Post-Authentication Rate Limiting

For authenticated endpoints (`api`, `uploads`, `sensitive`, inline messaging limits), the rate limit middleware runs after the `auth:sanctum` token validation middleware. This is because the scope key requires the authenticated user's ID. The sequence is:

1. `auth:sanctum` — validates Bearer token, rejects with 401 if expired or invalid
2. `verified` — checks email_verified_at, rejects with 403 if unverified
3. `throttle:api` (and any additional named throttles) — checks counter by user ID, rejects with 429 if exceeded

An invalid or expired token results in a 401 before the per-user rate limit counter is incremented, meaning invalid tokens do not consume a user's request budget.

### 7.3 MFA Rate Limiting Scope

MFA routes sit in a group requiring `auth:sanctum` but NOT `verified`. The `mfa` limiter scopes by `$request->user()?->id`. The user is available at this point because the Sanctum token has been validated. A user who has a valid token but has not yet verified their email can therefore be scoped by user ID for MFA rate limiting, which is correct behavior — MFA is part of the authentication completion flow.

### 7.4 Session Expiry and Re-authentication

Sanctum tokens expire after 30 minutes. When a token expires, the client must re-authenticate, which triggers the `auth` limiter (5/min per IP). This creates a natural re-authentication gate. An automated process that obtained a token cannot silently refresh it — it must pass the `auth` limiter again.

The 30-minute expiry also bounds the window for any rate-limited activity. A compromised token that reaches the `api` limit of 300/min cannot simply wait for the counter to reset and continue indefinitely — it expires at 30 minutes regardless.

### 7.5 Rate Limit Counter Persistence Across Requests

Rate limit counters are stored in the Laravel cache store. In a single-server development environment, this defaults to the `array` driver (in-memory, per-process). In production, the cache store must be Redis to ensure counters are shared across all application server processes and instances. See Section 9 for distributed system requirements.

---

## 8. Backend Implementation

### 8.1 Authoritative Configuration Location

**File:** `bootstrap/app.php`

The six named limiters are registered inside the `withRouting(then: ...)` callback. This is where they must be maintained. Any changes to limiter values must be made here.

```php
// bootstrap/app.php (authoritative)
RateLimiter::for('api', function (Request $request) {
    $limit = $request->user() ? 300 : 60;
    return Limit::perMinute($limit)->by($request->user()?->id ?: $request->ip());
});

RateLimiter::for('auth', function (Request $request) {
    return [
        Limit::perMinute(5)->by($request->ip()),
        Limit::perHour(20)->by($request->ip()),
    ];
});

RateLimiter::for('mfa', function (Request $request) {
    return [
        Limit::perMinute(3)->by($request->user()?->id ?: $request->ip()),
        Limit::perHour(10)->by($request->user()?->id ?: $request->ip()),
    ];
});

RateLimiter::for('provider-link', function (Request $request) {
    return [
        Limit::perMinute(2)->by($request->ip()),
        Limit::perHour(10)->by($request->ip()),
    ];
});

RateLimiter::for('uploads', function (Request $request) {
    return [
        Limit::perMinute(5)->by($request->user()?->id ?: $request->ip()),
        Limit::perHour(50)->by($request->user()?->id ?: $request->ip()),
    ];
});

RateLimiter::for('sensitive', function (Request $request) {
    return [
        Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()),
        Limit::perHour(100)->by($request->user()?->id ?: $request->ip()),
    ];
});
```

### 8.2 Duplicate Registration in AppServiceProvider

`AppServiceProvider::configureRateLimiting()` registers the same six limiter names with different values:

| Limiter | AppServiceProvider value | bootstrap/app.php value (active) |
|---|---|---|
| `api` | 60/min flat | 300/min authenticated, 60/min unauthenticated |
| `auth` | 5/min (single tier) | 5/min + 20/hour (two-tier) |
| `mfa` | 5/min (single tier) | 3/min + 10/hour (two-tier) |
| `provider-link` | 10/5min (single tier) | 2/min + 10/hour (two-tier) |
| `uploads` | 10/hour (single tier) | 5/min + 50/hour (two-tier) |
| `sensitive` | 30/hour (single tier) | 10/min + 100/hour (two-tier) |

`RateLimiter::for()` replaces any existing registration for the same name. The `bootstrap/app.php` definitions execute after the `AppServiceProvider::boot()` has run, so they overwrite the `AppServiceProvider` values. The `AppServiceProvider` definitions are functionally dead code.

**Action required:** The `AppServiceProvider::configureRateLimiting()` method and its entire contents should be removed to eliminate confusion. All rate limiter maintenance belongs in `bootstrap/app.php`.

Additionally, the comment on line 176 of `routes/api.php` reads `"Respects the 'api' rate limit (60 req/min)"` — this is stale. The active limit is 300/min for authenticated users.

The `routes/api.php` comment block above the documents section reads `"Document uploads are throttled by the 'uploads' limiter (10/hour). Downloads are throttled by 'sensitive' (30/hour)"` — these figures reflect the dead `AppServiceProvider` values. The active values are uploads: 5/min + 50/hour, sensitive: 10/min + 100/hour.

### 8.3 Route Middleware Application

Named limiters are applied via `middleware('throttle:{name}')` in `routes/api.php`. Inline limits use `middleware('throttle:N,M')` where N is the request count and M is the window in minutes.

The main authenticated group applies `throttle:api` as the outer wrapper:
```php
Route::middleware(['auth:sanctum', 'verified', 'throttle:api'])->group(function () {
    // All authenticated routes — global 300/min applies here
    // Individual routes add more specific throttles as needed
});
```

Additional throttles on individual routes stack on top of the global limit. A request to `POST /api/documents` is checked against both the `api` limit (300/min) and the `uploads` limit (5/min + 50/hour). The most restrictive check that fires first returns 429.

### 8.4 Key File Reference

| Purpose | File |
|---|---|
| Named limiter definitions (authoritative) | `bootstrap/app.php` |
| Route throttle application | `routes/api.php` |
| Duplicate definitions (inactive, to be removed) | `app/Providers/AppServiceProvider.php` |
| Sanctum token expiry | `config/sanctum.php` |
| Cache store configuration | `config/cache.php` |
| Existing rate limit tests | `tests/Feature/Security/RateLimitingTest.php` |

---

## 9. Distributed System Considerations

### 9.1 Requirement for a Centralized Cache Store

Laravel's rate limiter uses whatever cache driver is configured as the default. In local development, this defaults to the `array` driver, which is in-memory and per-process. In production with multiple PHP-FPM workers or multiple application servers, using the `array` driver means each process maintains independent counters, so a caller can make N requests to each of K server processes and bypass the N-per-minute limit entirely.

**Redis must be the cache store in production.** All application server instances must connect to the same Redis instance, ensuring rate limit counters are shared and synchronized.

### 9.2 Redis Configuration

`.env` (production):
```ini
CACHE_STORE=redis
REDIS_HOST=<redis-host>
REDIS_PASSWORD=<redis-password>
REDIS_PORT=6379
REDIS_DB=0
REDIS_CACHE_DB=1
```

`config/cache.php` must have `'default' => env('CACHE_STORE', 'redis')`.

Redis `INCR` is atomic, so counter increments across multiple simultaneous requests from the same user are race-condition-free without application-level locking.

### 9.3 IP Address Resolution Behind a Load Balancer

When the application runs behind a reverse proxy or load balancer, the real client IP arrives in the `X-Forwarded-For` header. Laravel's `$request->ip()` reads from this header when `TrustProxies` middleware is configured.

**File:** `app/Http/Middleware/TrustProxies.php`

`$proxies` must be set to the specific IP range of the load balancer, not `'*'`. Trusting all sources for `X-Forwarded-For` allows a client to spoof their IP address by injecting a forged header, bypassing IP-based rate limits on the `auth` limiter. In managed cloud environments where the load balancer strips attacker-injected headers (e.g., AWS ALB), `'*'` is acceptable but should be verified with the infrastructure provider.

### 9.4 Behavior on Redis Unavailability

If Redis becomes unavailable, the rate limiting middleware will throw a connection exception. The correct behavior is to fail open — allow the request through — rather than fail closed, which would take the entire application offline. A Redis outage is a worse outcome than a temporary loss of rate limit enforcement.

This behavior should be wrapped in a try-catch in any custom middleware or monitored at the infrastructure level via Redis health checks so that the on-call team is alerted immediately if Redis becomes unreachable.

---

## 10. Error Handling and User Feedback

### 10.1 HTTP 429 Response Format

When a rate limit is exceeded, Laravel's `ThrottleRequests` middleware returns HTTP 429. For the named limiters that define a custom `->response()` closure, the response body is a JSON object. For inline `throttle:N,M` rules that do not define a custom response, Laravel returns its default 429 JSON response.

**Named limiter responses (custom):**

`auth` limiter:
```json
{
    "message": "Too many authentication attempts. Please try again later."
}
```

`api` limiter:
```json
{
    "message": "Too many requests. Please wait a moment and try again.",
    "retry_after": 60
}
```

`uploads` limiter:
```json
{
    "message": "Upload limit exceeded. Please try again later."
}
```

`sensitive` limiter:
```json
{
    "message": "Rate limit exceeded for sensitive operations."
}
```

`mfa` limiter:
```json
{
    "message": "Too many MFA attempts. Please try again later."
}
```

`provider-link` limiter:
```json
{
    "message": "Too many provider link attempts. Please try again later."
}
```

**Inline throttle responses (Laravel default):**
```json
{
    "message": "Too Many Attempts."
}
```

### 10.2 Response Headers

Laravel's `ThrottleRequests` middleware automatically adds the following headers to all responses, not only 429 responses:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | The maximum number of requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining before the limit is reached |
| `Retry-After` | Seconds to wait before retrying (429 responses only) |
| `X-RateLimit-Reset` | Unix timestamp when the current window resets (429 responses only) |

For two-tier limiters (arrays of `Limit` objects), headers reflect the binding tier — the one with the least remaining capacity.

### 10.3 Frontend Behavior

The React frontend handles 429 responses in the Axios response interceptor in `frontend/src/api/axios.config.ts`. The expected behavior on a 429 response is:

1. The interceptor catches the 429 before it reaches the calling component.
2. A toast notification is shown to the user with the message from the response body and the value of `Retry-After` if present.
3. The originating action (form submit, upload, send button) is not automatically retried.
4. The request is not treated as an authentication failure — no redirect to login occurs.

---

## 11. Logging, Monitoring, and Auditing

### 11.1 What Is Logged

There is currently no dedicated audit log entry written when a rate limit is exceeded. Rate limit enforcement is handled entirely by Laravel's built-in `ThrottleRequests` middleware, which does not write to `audit_logs`.

Laravel's application log (`storage/logs/laravel.log`) will capture the HTTP 429 response in the standard request log if request logging is enabled, but this is not structured audit data.

This is a gap. See Section 14.1 for the recommended enhancement.

### 11.2 Monitoring via Existing Audit Logs

While 429 events are not explicitly logged, high-frequency access patterns leading up to rate limit events are observable through the existing PHI audit log. The `audit_logs` table records all access to medical records, camper profiles, and applications. The following query identifies users generating anomalously high volumes of PHI read events within a session window:

```sql
SELECT
    user_id,
    action,
    entity_type,
    COUNT(*)      AS event_count,
    MIN(created_at) AS first_at,
    MAX(created_at) AS last_at
FROM audit_logs
WHERE action IN ('view', 'download')
  AND created_at >= NOW() - INTERVAL 30 MINUTE
GROUP BY user_id, action, entity_type
HAVING COUNT(*) > 50
ORDER BY event_count DESC;
```

A user generating 50+ medical record views in 30 minutes is a signal worth investigating regardless of whether they triggered a rate limit.

### 11.3 Standard Laravel Log Output

Each 429 response appears in `storage/logs/laravel.log` as a standard HTTP response log entry if request logging is configured. In production, these logs should be shipped to a centralized log aggregation system (e.g., CloudWatch, Datadog, ELK). A saved search for `status=429` on the API prefix surfaces rate limit patterns across all endpoints.

### 11.4 Recommended Monitoring Queries

**High 429 rate on auth endpoint (brute force indicator):**
```
Log search: path=/api/auth/login AND status=429 in last 5 minutes
Alert threshold: 10 or more events
```

**429 from same IP on auth endpoint (credential stuffing):**
```
Log search: path=/api/auth/* AND status=429 GROUP BY client_ip
Alert threshold: same IP appearing 3+ times in 5 minutes
```

**429 from authenticated user on sensitive/uploads (anomalous download/upload):**
```
Log search: (path LIKE /api/documents/*/download OR path LIKE /api/inbox/messages/*/attachments/*) AND status=429
Alert threshold: any occurrence from a medical-role or admin-role user
```

---

## 12. Performance Impact

### 12.1 Per-Request Overhead

Rate limit enforcement requires one or two Redis operations per request (one for each active limiter tier on that route). For a request to `POST /api/documents`, which carries both the `api` limiter and the `uploads` limiter (each two-tier), this is up to four Redis `INCR` + `GET` operations. At sub-millisecond Redis latency on a local network, this adds under 2ms to request processing time — well within the 2-second response time target.

### 12.2 Redis as a Non-Bottleneck

Under a load of 250 concurrent users each making 60 requests per minute (15,000 requests per minute total), the rate limiting layer generates at most 60,000 Redis operations per minute (4 operations per request at the upload endpoint). Redis is capable of handling over 100,000 operations per second on commodity hardware. The rate limiting load does not approach Redis's throughput ceiling.

### 12.3 Cache Key Characteristics

Rate limit keys are stored in the Laravel cache with a prefix and TTL matching the window duration. Keys follow the format:

```
{cache_prefix}:timer:{limiter_name}:{user-id-or-ip}
```

Keys expire automatically via Redis TTL when their window ends. No background cleanup job is required. Memory usage is minimal — each key stores a counter integer with a TTL expiry.

---

## 13. Testing

### 13.1 Existing Test Coverage

**File:** `tests/Feature/Security/RateLimitingTest.php`

The existing test suite covers:

| Test | Endpoint | Assertion |
|---|---|---|
| `test_auth_endpoint_rate_limited_after_five_attempts` | `POST /api/auth/login` | 5 requests pass (401), 6th returns 429 |
| `test_mfa_endpoint_rate_limited_after_three_attempts` | `POST /api/mfa/verify` | 3 requests pass (401), 4th returns 429 |
| `test_provider_link_endpoint_rate_limited_after_two_attempts` | (removed endpoint) | Skipped — Phase 6 removal |
| `test_upload_endpoint_rate_limited_after_five_attempts` | `POST /api/documents` | 5 requests pass, 6th returns 429 |
| `test_rate_limits_are_per_ip_for_unauthenticated` | `POST /api/auth/login` | Two different IPs have independent counters |
| `test_rate_limits_are_per_user_for_authenticated` | `POST /api/mfa/verify` | Two different users have independent counters |

All tests flush the cache in `setUp()` to prevent counter carryover between tests.

### 13.2 Coverage Gaps

The following are not currently tested:

- The `sensitive` limiter (no test for download throttling)
- The two-tier hourly constraints on any limiter
- Inline messaging throttles (`throttle:5,60`, `throttle:20,1`, etc.)
- The `api` limiter's 300/min authenticated vs. 60/min unauthenticated differentiation
- Behavior on window boundary (counter resets after window expires)
- That `bootstrap/app.php` values override `AppServiceProvider` values (regression test for the dual-registration issue)

### 13.3 Recommended Additional Tests

```php
// Test: sensitive limiter fires on document download
public function test_document_download_rate_limited_after_ten_attempts(): void
{
    $user     = User::factory()->create();
    $document = Document::factory()->create(['scan_passed' => true]);

    for ($i = 0; $i < 10; $i++) {
        $this->actingAs($user)
            ->getJson("/api/documents/{$document->id}/download");
    }

    $this->actingAs($user)
        ->getJson("/api/documents/{$document->id}/download")
        ->assertStatus(429);
}

// Test: api limiter distinguishes authenticated (300/min) from unauthenticated (60/min)
public function test_api_limit_is_higher_for_authenticated_users(): void
{
    // Exhaust the unauthenticated limit (60) from an IP
    for ($i = 0; $i < 60; $i++) {
        $this->getJson('/api/health'); // Not under api throttle, just illustrative
    }

    // Authenticated user on same IP should not be blocked
    $user = User::factory()->create();
    $this->actingAs($user)
        ->getJson('/api/user')
        ->assertStatus(200);
}

// Test: inbox conversation creation is limited to 5/hour
public function test_new_conversation_rate_limited_after_five_per_hour(): void
{
    $user  = User::factory()->create();
    $admin = User::factory()->admin()->create();

    for ($i = 0; $i < 5; $i++) {
        $this->actingAs($user)->postJson('/api/inbox/conversations', [
            'subject'      => "Thread $i",
            'body'         => 'Test',
            'participant_ids' => [$admin->id],
        ]);
    }

    $this->actingAs($user)->postJson('/api/inbox/conversations', [
        'subject'      => 'Over limit',
        'body'         => 'Test',
        'participant_ids' => [$admin->id],
    ])->assertStatus(429);
}
```

---

## 14. Known Gaps and Future Enhancements

### 14.1 Rate Limit Violations Are Not Audit-Logged

This is the most significant gap in the current implementation. When a request is rejected by a rate limiter, no entry is written to the `audit_logs` table. This means:

- There is no structured record of brute force attempts against the login endpoint.
- There is no way to correlate a rate limit event on the `sensitive` limiter with the specific user and document they were attempting to access.
- HIPAA audit controls cannot demonstrate rate limiting enforcement with the same granularity as other access controls.

**Recommended fix:** Wrap the `ThrottleRequests` middleware with a custom `AuditedThrottle` middleware that catches `ThrottleRequestsException`, writes a structured audit log entry, and re-throws the exception. The audit entry should capture `user_id` (null if unauthenticated), `action = 'rate_limit_exceeded'`, `entity_type = 'rate_limit'`, `ip_address`, `user_agent`, `metadata.endpoint`, `metadata.limiter_name`, and `metadata.method`.

### 14.2 Stale Code in AppServiceProvider

`AppServiceProvider::configureRateLimiting()` defines all six named limiters with values that are overridden by `bootstrap/app.php`. This dead code creates a maintenance hazard: a developer who updates a limit value in `AppServiceProvider` will see no change in production behavior and may not discover that `bootstrap/app.php` is the authoritative location.

**Recommended fix:** Delete `configureRateLimiting()` from `AppServiceProvider` entirely. Update the stale comments in `routes/api.php` (lines 176, 273–275) to reflect the active values from `bootstrap/app.php`.

### 14.3 No Throttling on PHI Clinical Read Endpoints

Medical record reads, allergy views, medication details, treatment logs, incidents, and visits are governed only by the global `api` limit (300/min). An authenticated attacker with a medical-role token can make up to 300 clinical record requests per minute before hitting any limit. At that rate, with 30-minute token expiry, the maximum extractable records in one session is 9,000.

This is a documented risk, not an emergency — the combination of Sanctum token expiry, account lockout on re-authentication, and audit logging on every PHI access provides defense in depth. However, adding a dedicated lower limit on clinical read endpoints (e.g., a `medical-reads` named limiter at 120/min) would reduce the maximum extraction ceiling and create an additional observable signal.

### 14.4 No Throttling on Report Endpoints

Admin report endpoints (`/api/reports/*`) are covered only by the global `api` limit. Reports execute aggregate queries across all families and sessions. High-frequency report requests during peak usage could degrade database performance. A dedicated `reports` limiter (e.g., 10/minute) would protect database resources without impacting any legitimate use case.

### 14.5 No Throttling on Public Form Downloads

`GET /api/forms/*` has no rate limit. If these endpoints receive high traffic — from bots indexing the URLs or from a misconfigured client — they could generate unnecessary load. A light IP-based limit (e.g., `throttle:60,1`) would provide a minimal guard.

### 14.6 Adaptive Rate Limiting

The current limits are static values set at deployment time. A future enhancement would allow limits to adjust based on observed system load: tightening during periods of high latency or error rates, and restoring to baseline when performance recovers. This would provide automatic backpressure without manual intervention during traffic anomalies.

---

## 15. Conclusion

The Camp Burnt Gin rate limiting system uses six named limiters registered in `bootstrap/app.php` and a set of inline route-level throttles in `routes/api.php`. The named limiters use two-tier enforcement (per-minute burst + per-hour sustained) to address both rapid attacks and slow sustained abuse. The global `api` limiter applies to all authenticated endpoints at 300/min for authenticated users — a value calibrated specifically to accommodate the medical and admin portal's parallel sub-request patterns.

**Effective controls:** Authentication brute force (5/min per IP), MFA enumeration (3/min per user), PHI document download exfiltration (10/min + 100/hour per user), file upload storage exhaustion (5/min + 50/hour per user), inbox flooding (5 new conversations/hour, 20 messages/min).

**Gaps requiring action:** Rate limit violations are not written to audit logs (Section 14.1); dead `AppServiceProvider` definitions create a maintenance hazard (Section 14.2); clinical read endpoints have no dedicated throttle beyond the global limit (Section 14.3); report endpoints have no dedicated throttle (Section 14.4).

The system's rate limiting provides meaningful protection for its highest-risk surfaces. Addressing the audit logging gap is the highest priority enhancement, as it is the only current control gap with a direct HIPAA compliance implication.

---

## Related Documentation

- [AUTHENTICATION.md](AUTHENTICATION.md) — Account lockout, token expiry, MFA flows
- [SECURITY.md](SECURITY.md) — Security architecture overview
- [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) — Role definitions and permission matrix
- [AUDIT_LOGGING.md](AUDIT_LOGGING.md) — Audit log schema and HIPAA compliance
- [FILE_UPLOADS.md](FILE_UPLOADS.md) — Upload security and size limits
- [INBOX_SYSTEM.md](INBOX_SYSTEM.md) — Messaging architecture and authorization

---

**Document Status:** Authoritative
**Version:** 2.0.0 (revised against actual codebase)
**Source of truth:** `bootstrap/app.php` (named limiters), `routes/api.php` (route application)
