# System Security Architecture Overview
## Camp Burnt Gin — Camp Management System

**Document Version:** 1.0  
**Date:** 2026-04-06  
**Classification:** Internal Security Document — Restricted Distribution  
**Prepared By:** Security Engineering Team  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Trust Boundaries](#3-trust-boundaries)
4. [Request Lifecycle](#4-request-lifecycle)
5. [Authentication Flow](#5-authentication-flow)
6. [Authorization Flow](#6-authorization-flow)
7. [File Upload Flow](#7-file-upload-flow)
8. [File Download Flow](#8-file-download-flow)
9. [Notification Flow](#9-notification-flow)
10. [Messaging Flow](#10-messaging-flow)

---

## 1. System Overview

Camp Burnt Gin is a HIPAA-sensitive camp management application built to support the full lifecycle of a camper's application to a summer camp serving children with special healthcare needs (CYSHCN). The system enables parent/guardian applicants to submit applications containing medical and behavioral information, allows administrative staff to review and process those applications, and provides medical providers with access to camper health records for clinical planning and emergency response during camp.

The system consists of two primary components:

- **Laravel 12 REST API backend** — handles all business logic, data persistence, authorization enforcement, and file operations; deployed as a PHP application behind a web server
- **React 18 TypeScript SPA (single-page application)** — provides four distinct user portals (applicant, admin, super-admin, medical); built with Vite, served as a static asset bundle; communicates with the backend exclusively via authenticated HTTP API calls

All data at rest (PHI fields) is encrypted using AES-256-CBC via Laravel's `encrypted` cast. All data in transit is protected by TLS (HTTPS). The system handles Protected Health Information and is designed to meet HIPAA Security Rule technical and administrative safeguard requirements.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 INTERNET                                         │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
                              HTTPS / TLS boundary
                              URL::forceHttps() enforced
                                       │
         ┌─────────────────────────────┴──────────────────────────────┐
         │                                                             │
         ▼                                                             ▼
┌─────────────────────────┐                               ┌──────────────────────────┐
│   REACT SPA (browser)   │                               │  EMAIL SERVICE           │
│   Vite production build │                               │  (notifications)         │
│                         │                               │  Outbound only           │
│  Redux Store            │                               │  No PHI in subject lines │
│  (in-memory only,       │                               └──────────────────────────┘
│   no PHI persisted)     │
│                         │
│  sessionStorage:        │
│  auth_token only        │
│  (tab-scoped, auto-     │
│   cleared on close)     │
│                         │
│  RoleGuard:             │
│  wraps restricted       │
│  routes by role         │
│                         │
│  DOMPurify:             │
│  SAFE_MESSAGE_CONFIG    │
│  on all message HTML    │
│                         │
│  TipTap:                │
│  https/http/mailto only │
│  JS/VBScript blocked    │
│                         │
│  Portals:               │
│  /applicant/*           │
│  /admin/*               │
│  /super-admin/*         │
│  /medical/*             │
└──────────┬──────────────┘
           │ Authorization: Bearer {token}
           │ from sessionStorage
           │ HTTPS
           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          LARAVEL 12 API SERVER                                   │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                         MIDDLEWARE STACK                                    │ │
│  │                                                                             │ │
│  │  Sanctum ──► verified ──► Role+MFA ──► AuditPhiAccess ──► RateLimiters    │ │
│  │                                                                             │ │
│  │  Rate Limiters: api(60/min) | auth(5/min) | mfa(5/15min)                   │ │
│  │                uploads(10/hr) | phi-export(5/hr) | sensitive(30/hr)        │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                   │                                              │
│                                   ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                       CONTROLLERS + POLICIES                                │ │
│  │                                                                             │ │
│  │  $this->authorize() ──► Policy (18 policy classes) ──► allow / deny        │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                   │                                              │
│                                   ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                       ELOQUENT MODELS + SERVICES                            │ │
│  │                                                                             │ │
│  │  encrypted cast: AES-256-CBC decrypt in memory on read                      │ │
│  │  SoftDeletes: all 14 PHI/identity tables                                   │ │
│  │  scopeActive(): filters inactive campers and medical records                │ │
│  │                                                                             │ │
│  │  FileUploadService | MessageService | ApplicationService                   │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────────────────────────────┘
                   │                              │
         ┌─────────▼──────────┐      ┌────────────▼────────────────────────────┐
         │  MySQL 8.0         │      │  LOCAL DISK FILE STORAGE                 │
         │                    │      │                                          │
         │  PHI columns:      │      │  storage/app/private/                   │
         │  encrypted at rest │      │  NOT in web server document root         │
         │  (Laravel cast)    │      │  UUID filenames only                     │
         │                    │      │  No PHI in file system paths             │
         │  All PHI tables:   │      │  Access: authenticated API only          │
         │  SoftDeletes       │      │  Downloads: Cache-Control: no-store      │
         │  (deleted_at)      │      └─────────────────────────────────────────┘
         │                    │
         │  audit_logs:       │      ┌─────────────────────────────────────────┐
         │  append-only,      │      │  HaveIBeenPwned API                     │
         │  all PHI access    │      │  (outbound only)                        │
         │                    │      │  Receives: k-anonymity hash prefix      │
         │  FK constraints    │      │  (first 5 chars of SHA-1 of password)   │
         └────────────────────┘      │  No user data, no PHI transmitted       │
                                     └─────────────────────────────────────────┘
```

---

## 3. Trust Boundaries

The system is organized into five nested trust zones. Each zone adds requirements that must be satisfied before a request is permitted to proceed.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PUBLIC ZONE — Unauthenticated                                               │
│                                                                             │
│  Accessible without authentication:                                         │
│  /api/login, /api/register, /api/forgot-password,                          │
│  /api/reset-password, /api/email/verify/{id}/{hash}                        │
│                                                                             │
│  Controls: rate limiting (auth limiter), no PHI accessible                 │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  AUTHENTICATED ZONE — All roles                                        │ │
│  │                                                                       │ │
│  │  Requires: valid Sanctum token + email_verified_at not null           │ │
│  │  Access: own profile, own notifications, own conversations            │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  ELEVATED ZONE — admin / super_admin / medical roles             │ │ │
│  │  │                                                                  │ │ │
│  │  │  Additional requirement: MFA enrolled (mfa_enabled = true)       │ │ │
│  │  │  Enforced by: EnsureUserIsAdmin, EnsureUserIsMedicalProvider,    │ │ │
│  │  │               EnsureUserHasRole middleware                       │ │ │
│  │  │                                                                  │ │ │
│  │  │  ┌───────────────────────────────────────────────────────────┐  │ │ │
│  │  │  │  PHI ZONE — Medical routes                                 │  │ │ │
│  │  │  │                                                            │  │ │ │
│  │  │  │  Additional requirement: medical role                      │  │ │ │
│  │  │  │  AuditPhiAccess middleware: every request logged           │  │ │ │
│  │  │  │  Covers: /api/medical/*, /api/campers/*/medical-*,         │  │ │ │
│  │  │  │          medications, diagnoses, vitals, care plans, etc.  │  │ │ │
│  │  │  │                                                            │  │ │ │
│  │  │  └───────────────────────────────────────────────────────────┘  │ │ │
│  │  │                                                                  │ │ │
│  │  │  ┌───────────────────────────────────────────────────────────┐  │ │ │
│  │  │  │  SUPER-ADMIN ZONE — super_admin role only                  │  │ │ │
│  │  │  │                                                            │  │ │ │
│  │  │  │  Strictest rate limits (phi-export: 5/hr)                  │  │ │ │
│  │  │  │  Access: user management, audit export, form templates     │  │ │ │
│  │  │  │  All operations audit-logged                               │  │ │ │
│  │  │  └───────────────────────────────────────────────────────────┘  │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Request Lifecycle

The following describes the complete lifecycle of a typical authenticated PHI request (e.g., a medical provider fetching a camper's medical record):

**Step 1 — Token transmission**

The SPA reads the authentication token from `sessionStorage` under the key `auth_token`. The Axios interceptor configured in `axios.config.ts` automatically attaches this token as an `Authorization: Bearer {token}` header on every outbound API request.

**Step 2 — Sanctum token validation**

The Sanctum middleware validates the token against the `personal_access_tokens` table, locating the associated user record. If the token is not found, expired, or revoked, the request is rejected with HTTP 401 Unauthenticated.

**Step 3 — Email verification check**

The `verified` middleware checks that the authenticated user's `email_verified_at` field is not null. Accounts that have not completed email verification are rejected with HTTP 403.

**Step 4 — Role and MFA check**

The appropriate role middleware (`EnsureUserIsMedicalProvider` for medical routes) confirms that the authenticated user holds the required role and that `mfa_enabled = true` on their account. If either check fails, the request is rejected with HTTP 403. If MFA is not enrolled, the response body includes `mfa_setup_required: true` so the frontend can route the user to the MFA setup flow.

**Step 5 — PHI access logging**

`AuditPhiAccess` middleware checks whether the current route matches any of the 14 designated PHI route groups. If it matches, an audit record is written to the `audit_logs` table before the request proceeds, capturing user ID, role, route, IP address, user agent, and timestamp.

**Step 6 — Controller method entry and policy authorization**

The controller method is invoked. The first statement calls `$this->authorize('view', $medicalRecord)`, which evaluates the relevant Policy class (e.g., `MedicalRecordPolicy`). The policy checks role membership, relationship to the resource, and any additional business rules. If the check fails, HTTP 403 is returned.

**Step 7 — Eloquent model read with decryption**

The Eloquent model fetches the record from MySQL. Fields with the `encrypted` cast are automatically decrypted using AES-256-CBC in PHP application memory. The decrypted values are never written to disk; they exist only in the memory of the current request process.

**Step 8 — Response shaping**

The controller builds the JSON response including only the fields required by the consuming view. Fields not needed by the client (such as internal metadata, audit fields, or unnecessary PII) are omitted. No email addresses are included in responses that do not require them.

**Step 9 — HTTPS delivery**

The response is transmitted to the browser over HTTPS. For file download responses, a `Cache-Control: no-store` header is added to prevent the browser or any intermediate proxy from caching PHI content.

---

## 5. Authentication Flow

```
  User submits login form (email + password)
         │
         │  POST /api/login
         │  rate limiter: auth (5/min)
         ▼
  LoginController::login()
         │
         ├── Hash::check(password, user->password)
         │       └── fail → HTTP 422, increment attempt counter
         │
         ├── Check user->email_verified_at not null
         │       └── fail → HTTP 403 "Email not verified"
         │
         ├── If role requires MFA (admin/super_admin/medical):
         │       ├── Check user->mfa_enabled = true
         │       │       └── false → return HTTP 403 + mfa_setup_required: true
         │       └── Validate TOTP code from request
         │               └── fail → HTTP 422 "Invalid MFA code"
         │
         ├── $user->tokens()->delete()  [clear prior sessions]
         │
         └── $user->createToken('api') → plaintext token returned once
                 │
                 ▼
         JSON response: { token, user: { id, role, name, mfa_enabled } }
                 │
                 ▼
  LoginPage.tsx stores token in sessionStorage['auth_token']
         │
         ▼
  Redux authSlice: user object stored in memory
         │
         ▼
  All subsequent requests:
  axios interceptor → Authorization: Bearer {token}
```

---

## 6. Authorization Flow

```
  Incoming API request (with valid Sanctum token)
         │
         ▼
  Sanctum middleware
  ├── Valid token? ──── No ──► HTTP 401 Unauthenticated
  └── Yes → resolve User model
         │
         ▼
  verified middleware
  ├── email_verified_at not null? ──── No ──► HTTP 403 Forbidden
  └── Yes → continue
         │
         ▼
  Role middleware (one of):
  EnsureUserIsAdmin | EnsureUserIsMedicalProvider | EnsureUserHasRole
         │
         ├── Correct role? ──── No ──► HTTP 403 Forbidden
         │
         └── mfa_enabled = true? ──── No ──► HTTP 403 + mfa_setup_required: true
                 │
                 ▼
  AuditPhiAccess middleware
  ├── Route in PHI group? → write audit_log record
  └── Continue regardless
         │
         ▼
  Rate limiter middleware
  ├── Under limit? ──── No ──► HTTP 429 Too Many Requests
  └── Yes → continue
         │
         ▼
  Controller method invoked
         │
         ▼
  $this->authorize('action', $resource)
         │
  Gate::inspect() → resolves Policy class
         │
  Policy method evaluates:
  ├── Role membership check
  ├── Ownership / relationship check (e.g., applicant owns camper?)
  └── Business rule checks (e.g., application in reviewable state?)
         │
         ├── Policy returns false ──► HTTP 403 This action is unauthorized.
         └── Policy returns true  ──► Business logic proceeds
```

---

## 7. File Upload Flow

```
  User selects file in browser
         │
         │  POST /api/documents
         │  multipart/form-data
         │  Authorization: Bearer {token}
         ▼
  DocumentController::store()
         │
         ├── Sanctum + verified + Role + MFA (middleware stack)
         │
         ├── $this->authorize('create', Document::class)
         │       └── DocumentRequestPolicy checks ownership and role
         │
         ├── StoreDocumentRequest validation:
         │       ├── mimes: pdf,jpg,jpeg,png,doc,docx
         │       └── max: 10240 (10 MB)
         │
         ▼
  FileUploadService::store($file)
         │
         ├── finfo_file($file->getPathname(), FILEINFO_MIME_TYPE)
         │       → magic-byte MIME detection (independent of HTTP Content-Type)
         │
         ├── Check detected MIME against allowlist:
         │       [application/pdf, image/jpeg, image/png,
         │        application/msword, application/vnd.openxmlformats...]
         │       └── not in allowlist → throw ValidationException
         │
         ├── $uuid = Str::uuid()->toString()
         │
         ├── $path = "documents/{$uuid}"
         │       (UUID path — no original filename, no PHI in path)
         │
         ├── Storage::disk('local')->put($path, file contents)
         │       (stored in storage/app/private/ — not web-accessible)
         │
         └── return $path, sanitized original filename
                 │
                 ▼
  Document model created:
  ├── file_path: $uuid path
  ├── original_filename: sanitized original name
  ├── document_type: from request
  ├── documentable: polymorphic (Application, Camper, etc.)
  └── uploaded_by: auth()->id()
         │
         ▼
  HTTP 201 Created — document record returned (no file contents in response)
```

---

## 8. File Download Flow

```
  User requests file download
         │
         │  GET /api/documents/{id}/download
         │  Authorization: Bearer {token}
         ▼
  DocumentController::download()
         │
         ├── Sanctum + verified + Role + MFA (middleware stack)
         │
         ├── Document::findOrFail($id)
         │
         ├── $this->authorize('view', $document)
         │       └── DocumentRequestPolicy:
         │           ├── applicant: owns the documentable parent?
         │           └── admin/medical: role check
         │
         ├── Storage::disk('local')->exists($document->file_path)
         │       └── not found → HTTP 404
         │
         └── Storage::disk('local')->download(
                 $document->file_path,
                 $document->original_filename,
                 ['Cache-Control' => 'no-store']
             )
                 │
                 ▼
         File served as HTTP response
         ├── Content-Type: detected from stored file
         ├── Content-Disposition: attachment; filename="{sanitized name}"
         └── Cache-Control: no-store
             (browser and proxies must not cache this response)
```

---

## 9. Notification Flow

```
  Triggering action occurs in the application
  (e.g., application status changed, new message received,
   document uploaded, application assigned for review)
         │
         ▼
  Laravel Notification dispatched
  (e.g., ApplicationStatusChanged, NewMessageReceived)
         │
         ├── Notification stored in notifications table
         │       (database channel — always used)
         │
         └── Mail channel (where configured):
                 ├── Notification built as Mailable
                 ├── No PHI in email subject line
                 ├── Email body contains minimal info + link to portal
                 └── Dispatched to email service (outbound SMTP/API)
                         │
                         ▼
                 Email delivered to recipient
                 (recipient must log in to portal to view PHI details)
         │
         ▼
  Frontend notification bell
         │
         ├── Polling: GET /api/notifications (on interval or navigation)
         │
         └── Real-time (where WebSocket configured):
                 WebSocket event pushed to user's channel
                 → frontend updates notification count / list

  All notification reads are authenticated
  Notification mark-as-read: PATCH /api/notifications/{id}
  All notification data scoped to authenticated user only
```

---

## 10. Messaging Flow

```
  Compose — new conversation
         │
         │  User opens FloatingCompose component
         │  Selects recipients: TO / CC / BCC (Gmail-style UI)
         │  Types message in TipTap rich-text editor
         │  (TipTap: https/http/mailto only; JS protocols blocked)
         │
         │  POST /api/inbox/conversations
         │  { subject, body_html, recipients: [{user_id, type: 'to'|'cc'|'bcc'}] }
         ▼
  ConversationController::store()
         │
         ├── Sanctum + verified + Role + MFA (middleware stack)
         │
         ├── $this->authorize('create', Conversation::class)
         │       └── ConversationPolicy:
         │           ├── applicant: can compose to admin/super_admin only
         │           └── medical: can compose to admin/super_admin only
         │           (not to each other; not to applicants directly)
         │
         ├── MessageService::sendMessage($sender, $data)
         │       │
         │       ├── Create Conversation record
         │       │
         │       ├── Create Message record (body_html stored)
         │       │
         │       └── For each recipient entry:
         │               Create MessageRecipient record:
         │               { message_id, user_id, recipient_type, is_read: false }
         │
         ├── ConversationParticipant records created (access control)
         │
         └── Real-time: WebSocket event dispatched to recipient channels
                 │
                 ▼
         Recipients see notification / thread update

  Reply
         │  POST /api/inbox/conversations/{id}/reply
         ▼
  ConversationController::reply()
         │
         ├── Sanctum + Policy (must be participant in conversation)
         │
         ├── MessageService::reply($sender, $conversation, $data)
         │       └── Server computes TO = [original sender]
         │
         └── MessageRecipient records created; WebSocket event dispatched

  Reply All
         │  POST /api/inbox/conversations/{id}/reply-all
         ▼
  ConversationController::replyAll()
         │
         ├── Sanctum + Policy
         │
         ├── MessageService::calculateReplyAllRecipients($sender, $message)
         │       ├── TO = original TO recipients (excluding sender)
         │       ├── CC = original CC recipients
         │       └── BCC excluded (BCC privacy preserved)
         │
         └── MessageRecipient records created; WebSocket event dispatched

  Thread rendering (frontend)
         │
         ├── GET /api/inbox/conversations/{id}
         │       └── Message::getRecipientsForUser($viewer):
         │           ├── sender sees: TO + CC + BCC
         │           └── others see: TO + CC only (BCC hidden)
         │
         └── ThreadView.tsx renders messages:
                 └── DOMPurify.sanitize(message.body_html, SAFE_MESSAGE_CONFIG)
                     applied before injecting HTML into DOM
                     (prevents stored XSS from message body content)
```

---

*End of System Security Architecture Overview*

*This document should be updated following any significant change to the authentication system, authorization model, data flow, or external service integrations. Next scheduled review: 2026-10-06.*
