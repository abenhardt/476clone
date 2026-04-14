# System Overview

**Camp Burnt Gin — Camp Management Platform**
**Version:** 3.0.0
**Last Updated:** March 2026
**Document Status:** Authoritative

---

## Table of Contents

1. [System Purpose](#1-system-purpose)
2. [System Scope](#2-system-scope)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Core Modules](#4-core-modules)
5. [Technology Stack](#5-technology-stack)
6. [User Roles](#6-user-roles)
7. [Compliance Posture](#7-compliance-posture)
8. [Key Design Decisions](#8-key-design-decisions)

---

## 1. System Purpose

Camp Burnt Gin is a full-stack web application purpose-built for managing a residential summer camp that serves Children and Youth with Special Health Care Needs (CYSHCN). It replaces paper-based and email-driven workflows with a structured, role-gated, auditable platform.

The system addresses three core operational problems:

1. **Registration complexity.** CYSHCN applications require multi-section forms, physician-completed medical documentation, digital signatures, and multi-session scheduling. Paper workflows are error-prone and create compliance risk.

2. **Medical data management.** Camp staff must access camper health information quickly during sessions while ensuring that Protected Health Information (PHI) is never exposed to unauthorized parties. This requires encryption at rest, strict role-based access controls, and a complete audit trail.

3. **Administrative coordination.** Camp administrators, medical staff, and families need a shared communication channel, a document exchange system, and a unified view of application and camper status — without giving any one role inappropriate access to another role's data.

---

## 2. System Scope

The platform delivers the following capabilities:

| Domain | Description |
|---|---|
| **Registration** | Multi-section digital application form (10 sections) with auto-save draft, consent capture, digital signature, and session selection. Supports English and Spanish via i18n. |
| **Medical Records** | PHI-protected camper health profiles covering diagnoses, allergies, medications, behavioral profiles, personal care plans, seizure history, feeding plans, and assistive devices. |
| **Document Management** | Secure file upload with MIME validation and malware-scan lifecycle. Supports applicant uploads, admin-to-applicant document delivery, and physician-completed form uploads. |
| **Messaging** | Threaded inbox with Gmail-style TO/CC/BCC recipient model, floating compose, rich text editor, and per-conversation context links (application, camper, session). |
| **Administration** | Application review workflow with status machine enforcement, camper directory, session management with capacity gating, reporting, and calendar. |
| **Announcements** | Admin-created announcements pinned to portal dashboards across all roles. |
| **Session Management** | Camp session lifecycle: creation, capacity enforcement, waitlist promotion, archiving, and per-session camper/application reporting. |
| **Form Builder** | Super-admin-managed dynamic form definitions (versioned) that govern what fields appear on the application form without requiring code changes. |
| **Audit Logging** | Immutable audit trail for all PHI access, administrative actions, and security events. Required for HIPAA Security Rule § 164.312(b). |
| **User Management** | Super-admin governance interface for creating staff accounts, assigning roles, and managing TOTP-based MFA enrollment. |

---

## 3. High-Level Architecture

The system follows a strict client-server separation. The frontend is a browser-resident Single Page Application (SPA); the backend is a stateless REST API. There is no server-side rendering and no shared session cookie across the two tiers.

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Browser                          │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │            React SPA (TypeScript / Vite)            │   │
│   │                                                     │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │   │
│   │  │  Applicant   │  │    Admin /   │  │ Medical  │  │   │
│   │  │   Portal     │  │ Super Admin  │  │  Portal  │  │   │
│   │  │ /applicant/* │  │  Portal      │  │/medical/*│  │   │
│   │  └──────────────┘  │ /admin/*     │  └──────────┘  │   │
│   │                    │ /super-admin*│                 │   │
│   │                    └──────────────┘                 │   │
│   │                                                     │   │
│   │  Redux Toolkit (state)  ·  i18next (en / es)        │   │
│   │  Axios (HTTP client)    ·  sessionStorage (token)   │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │  HTTPS  ·  JSON  ·  Bearer token
                              │  (Authorization: Bearer <token>)
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Laravel REST API                          │
│               (PHP 8.2  ·  Laravel 12)                      │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Sanctum    │  │  Controllers │  │  Service Layer     │  │
│  │  Auth Layer │  │  + Policies  │  │  (business logic)  │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Form       │  │  Eloquent    │  │  Audit Logger      │  │
│  │  Requests   │  │  Models      │  │  (PHI trail)       │  │
│  │  (validate) │  │  (encrypted) │  │                    │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │  SQL (InnoDB / utf8mb4)
                              │
┌─────────────────────────────────────────────────────────────┐
│                      MySQL 8.0                              │
│                                                             │
│   39 tables  ·  Encrypted PHI columns  ·  Soft deletes      │
│   Foreign key constraints  ·  Composite indexes             │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. The user interacts with the React SPA in the browser.
2. The SPA issues an HTTPS request to the Laravel API, including an `Authorization: Bearer <token>` header injected by the Axios interceptor.
3. Laravel Sanctum validates the token and resolves the authenticated user.
4. The route middleware chain applies: `auth:sanctum` → `verified` (email verified) → resource Policy (authorization).
5. The controller delegates business logic to a service class, which interacts with Eloquent models.
6. PHI fields are transparently decrypted by Eloquent's `encrypted` cast on read, and re-encrypted on write.
7. The API resource serializes the response and returns JSON.
8. The Axios interceptor on the frontend handles 401 responses by clearing auth state and redirecting to `/login`.

---

## 4. Core Modules

| Module | Backend Location | Frontend Location | Description |
|---|---|---|---|
| **Auth** | `AuthController`, `AuthService` | `features/auth/` | Login, registration, TOTP MFA, password reset, token lifecycle |
| **Applications** | `ApplicationController`, `ApplicationService` | `features/parent/`, `features/admin/` | Application form submission, draft management, admin review workflow, status machine |
| **Medical Records** | `MedicalRecordController`, `TreatmentLogController`, `MedicalIncidentController`, `MedicalVisitController` | `features/medical/` | PHI profiles, treatment logging, incident reporting, health office visits, restrictions |
| **Messaging** | `MessageController`, `MessageService`, `ConversationController` | `features/messaging/` | Threaded inbox, TO/CC/BCC recipients, reply/reply-all, floating compose |
| **Document Management** | `DocumentController`, `DocumentRequestController` | `features/documents/` | Secure upload, scan lifecycle, admin-to-applicant delivery, official form downloads |
| **Session Management** | `CampSessionController`, `SessionDashboardController` | `features/admin/` | Session CRUD, capacity enforcement, waitlist, archiving, session dashboard |
| **Reporting** | `AdminReportsController` | `features/admin/` | Application and camper reports by session and status |
| **Form Builder** | `FormDefinitionController` | `features/super-admin/` | Versioned dynamic form definitions managed by super admins |
| **Announcements** | `AnnouncementController` | `features/announcements/` | Admin-authored announcements published to portal dashboards |
| **Audit Logging** | `AuditLog` model, `AuditLogController` | `features/super-admin/` | Immutable PHI-access and admin-action audit trail |
| **User Management** | `UserController` | `features/super-admin/` | Staff account creation, role assignment, MFA management |
| **Calendar** | `CalendarEventController` | `features/admin/` | Camp calendar events with optional deadline linkage |

---

## 5. Technology Stack

### Backend

| Component | Technology | Version |
|---|---|---|
| Framework | Laravel | 12 |
| Language | PHP | 8.2+ |
| Database | MySQL | 8.0 |
| Authentication | Laravel Sanctum | 4.2 |
| Testing | PHPUnit | — |
| Package manager | Composer | — |

### Frontend

| Component | Technology | Version |
|---|---|---|
| UI framework | React | 18 |
| Language | TypeScript (strict mode) | 5 |
| Build tool | Vite | 5 |
| State management | Redux Toolkit | 2 |
| HTTP client | Axios | — |
| CSS framework | Tailwind CSS | 3 |
| Animation | Framer Motion | 12 |
| Internationalization | i18next | 25 |
| Testing | Vitest | — |
| Package manager | pnpm | — |

---

## 6. User Roles

The system enforces a four-role hierarchy. Each role maps to a distinct portal and access scope.

| Role | Slug | Portal Prefix | Who Uses It | Access Scope |
|---|---|---|---|---|
| **Super Administrator** | `super_admin` | `/super-admin` | System owners | All admin capabilities plus user management, role assignment, form builder, and audit log. Last `super_admin` account cannot be deleted or demoted. |
| **Administrator** | `admin` | `/admin` | Camp staff | All applications, campers, sessions, reports, announcements, calendar, and inbox. Cannot manage user accounts. |
| **Medical Staff** | `medical` | `/medical` | On-site nurses and clinicians | Medical records browser and treatment logging (read/write). Cannot view application details or messaging. |
| **Applicant** | `applicant` | `/applicant` | Parents and guardians | Own campers and applications only. No cross-family visibility. |

**Role inheritance:** `super_admin` inherits all `admin` privileges via the `isAdmin()` override on the `User` model. Role checks are enforced at three independent layers: route middleware, Laravel Policies, and frontend route guards.

---

## 7. Compliance Posture

The system is designed to operate in compliance with HIPAA technical safeguard requirements. The following controls are in place:

### PHI Encryption at Rest

All PHI fields use Laravel's `encrypted` cast, which encrypts values using AES-256-CBC before writing to the database and decrypts transparently on read. Encrypted columns are defined at the model level and enforced by code review policy.

PHI columns exist on: `medical_records`, `allergies`, `medications`, `treatment_logs`, `medical_incidents`, `medical_visits`, `medical_restrictions`, `behavioral_profiles`, `personal_care_plans`, `emergency_contacts`, and `campers` (applicant address fields).

### Audit Logging

The `audit_logs` table provides an immutable record of all PHI access, content changes, and administrative actions. Each entry captures: event type, actor (user_id), target entity (polymorphic auditable), before/after state snapshots, IP address, user agent, and a UUID request correlator. Required by HIPAA Security Rule § 164.312(b).

### Authorization

Every resource endpoint is guarded by a Laravel Policy. Controllers call `$this->authorize()` before any service invocation. Route-level middleware enforces role membership. The frontend applies additional role-based route guards.

### Soft Deletes on PII Tables

Hard deletion of records in PII tables (`campers`, `conversations`, `messages`) is prohibited. Soft deletes using Laravel's `SoftDeletes` trait (the `deleted_at` column) preserve record retention obligations while removing data from active queries.

### Token Security

Authentication tokens are issued by Laravel Sanctum. Tokens expire after 30 minutes of inactivity. Account lockout is enforced after 5 failed login attempts (15-minute cooldown). TOTP-based MFA is available for all accounts and required for privileged roles.

### PHI Exposure Prevention

List and index endpoints must never eager-load `medicalRecord.*` relationships. Loading encrypted PHI at list scale causes `DecryptException` and can leak exception details. This constraint is enforced by convention and documented in the safety gate.

---

## 8. Key Design Decisions

### API-Only Backend (Strict SPA Separation)

The Laravel application exposes only a JSON REST API. It returns no HTML, has no Blade views for the application UI, and manages no frontend assets. The React SPA is a fully independent client. This separation enables independent deployment, simpler CDN integration, and clear boundary enforcement between frontend and backend concerns.

### Token Storage in sessionStorage

Authentication tokens are stored in the browser's `sessionStorage` (key: `auth_token`), not `localStorage` or cookies. This decision scopes token lifetime to the browser tab: tokens are automatically cleared when the tab is closed, which reduces session hijacking risk in shared-device scenarios common in camp environments. The `useAuthInit` hook restores Redux auth state from `sessionStorage` on page load.

### Feature-Driven Frontend Architecture

The frontend is organized by domain feature (`features/auth/`, `features/medical/`, `features/admin/`, etc.) rather than by technical layer. Each feature module owns its own components, pages, API calls, types, and state slice. Shared primitives (design tokens, layout shells, constants) live in `ui/` and `shared/`. This structure keeps domain logic co-located and limits cross-feature coupling.

### Status Machine with Explicit Transition Validation

Application status transitions are governed by `ApplicationStatus::canTransitionTo()`, which encodes a full transition matrix. Invalid transitions are rejected with HTTP 422. This prevents state corruption caused by out-of-order or unauthorized status changes and provides a single authoritative source for workflow rules.

### Operational Activation Pattern

Campers and medical records carry an `is_active` flag that is controlled exclusively by `ApplicationService`. The flag is set to `true` when an application is approved and to `false` when an approval is reversed with no remaining approved applications. Medical staff operational views filter on `is_active = true`. This ensures medical staff only see records for campers currently enrolled in a session, without requiring additional query logic at the controller layer.

### Encrypted PHI via Eloquent Cast

PHI encryption is implemented at the Eloquent model layer using the `encrypted` cast. This approach ensures that encryption is always applied regardless of which controller or service writes the data, and that decryption happens automatically on model access. It also means raw database reads (e.g., via a MySQL client) return ciphertext, not plaintext.
