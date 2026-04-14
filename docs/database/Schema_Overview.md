# Database Schema Overview

**Camp Burnt Gin — MySQL Schema Reference**
**Version:** 3.0.0
**Last Updated:** March 2026
**Document Status:** Authoritative

---

## Table of Contents

1. [Database Engine](#1-database-engine)
2. [Table Inventory](#2-table-inventory)
3. [Core Entity Groups](#3-core-entity-groups)
4. [Key Constraints](#4-key-constraints)
5. [Naming Conventions](#5-naming-conventions)

---

## 1. Database Engine

| Property | Value |
|---|---|
| Engine | MySQL 8.0 |
| Storage engine | InnoDB (all tables) |
| Character set | utf8mb4 |
| Collation | utf8mb4_unicode_ci |
| Migration tool | Laravel Migrations (Eloquent Schema Builder) |
| Total tables | 39 application tables + 3 Laravel framework tables |

---

## 2. Table Inventory

One row per table. PHI Encrypted = "Yes" indicates the table contains one or more columns using Laravel's `encrypted` cast (AES-256-CBC at rest). Soft Delete = "Yes" indicates the table carries a `deleted_at` column managed by Laravel's `SoftDeletes` trait.

| Table | Primary Key | Key Columns | Key Relationships | PHI Encrypted | Soft Delete |
|---|---|---|---|---|---|
| `users` | `id` | `email` (unique), `role_id`, `is_active`, `lockout_until` | FK → `roles` | No | No |
| `roles` | `id` | `name` (unique), `slug` | — | No | No |
| `personal_access_tokens` | `id` | `tokenable_type`, `tokenable_id`, `token` (unique) | Polymorphic → `users` | No | No |
| `password_reset_tokens` | `email` | `token`, `created_at` | — | No | No |
| `sessions` | `id` | `user_id`, `ip_address`, `last_activity` | — | No | No |
| `camps` | `id` | `name`, `is_active` | has-many → `camp_sessions` | No | No |
| `camp_sessions` | `id` | `camp_id`, `start_date`, `end_date`, `capacity`, `is_active` | FK → `camps` | No | No |
| `cabins` | `id` | `camp_session_id`, `name` | FK → `camp_sessions` | No | No |
| `campers` | `id` | `user_id`, `is_active`, `deleted_at` | FK → `users` | Yes (address fields) | Yes |
| `applications` | `id` | `camper_id`, `camp_session_id`, `status`, `is_draft`, `submitted_at` | FK → `campers`, `camp_sessions`, `users` (reviewer) | No | No |
| `emergency_contacts` | `id` | `camper_id` | FK → `campers` | Yes (phones, address, language) | No |
| `documents` | `id` | `documentable_type`, `documentable_id`, `document_type`, `uploaded_by` | Polymorphic documentable | No | No |
| `document_requests` | `id` | `applicant_id`, `admin_id`, `application_id`, `status` | FK → `users`, `applications`, `documents` | No | No |
| `applicant_documents` | `id` | `applicant_id`, `admin_id`, `status` | FK → `users`, `documents` (original, submitted) | No | No |
| `required_document_rules` | `id` | `document_type`, `is_required` | — | No | No |
| `medical_records` | `id` | `camper_id` (unique), `is_active` | FK → `campers` | Yes (most columns) | No |
| `allergies` | `id` | `camper_id`, `severity` | FK → `campers` | No | No |
| `medications` | `id` | `camper_id` | FK → `campers` | No | No |
| `treatment_logs` | `id` | `camper_id`, `recorded_by`, `treatment_date`, `type` | FK → `campers`, `users` | Yes (title, description, outcome) | No |
| `medical_incidents` | `id` | `camper_id`, `recorded_by`, `type`, `severity`, `incident_date` | FK → `campers`, `users`, `treatment_logs` | Yes (location, title, description, witnesses, escalation_notes) | No |
| `medical_follow_ups` | `id` | `camper_id`, `created_by`, `assigned_to`, `status`, `due_date` | FK → `campers`, `users` (×3) | No | No |
| `medical_visits` | `id` | `camper_id`, `recorded_by`, `visit_date`, `disposition` | FK → `campers`, `users` | Yes (chief_complaint, symptoms, treatment_provided, disposition_notes) | No |
| `medical_restrictions` | `id` | `camper_id`, `created_by`, `restriction_type`, `is_active` | FK → `campers`, `users` | Yes (description, notes) | No |
| `medical_provider_links` | `id` | `camper_id`, `token` (unique), `provider_email`, `expires_at` | FK → `campers`, `users` (created_by, revoked_by) | No | No |
| `behavioral_profiles` | `id` | `camper_id` (unique), `wandering_risk`, `one_to_one_supervision` | FK → `campers` | Yes (notes, descriptions) | No |
| `personal_care_plans` | `id` | `camper_id` (unique) | FK → `campers` | Yes (all notes fields) | No |
| `diagnoses` | `id` | `camper_id` | FK → `campers` | No | No |
| `feeding_plans` | `id` | `camper_id` (unique) | FK → `campers` | Yes | No |
| `assistive_devices` | `id` | `camper_id` | FK → `campers` | No | No |
| `activity_permissions` | `id` | `camper_id` | FK → `campers` | No | No |
| `conversations` | `id` | `created_by_id`, `last_message_at`, `is_archived`, `deleted_at` | FK → `users`, optional FK → `applications`, `campers`, `camp_sessions` | No | Yes |
| `conversation_participants` | `id` | `conversation_id`, `user_id` (unique pair), `left_at` | FK → `conversations`, `users` | No | No |
| `messages` | `id` | `conversation_id`, `sender_id`, `idempotency_key` (unique), `deleted_at` | FK → `conversations`, `users` | No | Yes |
| `message_reads` | `id` | `message_id`, `user_id` (unique pair), `read_at` | FK → `messages`, `users` | No | No |
| `message_recipients` | `id` | `message_id`, `user_id` (unique pair), `recipient_type`, `is_read` | FK → `messages`, `users` | No | No |
| `notifications` | `id` | `user_id`, `type`, `read_at` | FK → `users` | No | No |
| `form_definitions` | `id` | `version`, `status`, `created_by` | FK → `users` | No | No |
| `form_sections` | `id` | `form_definition_id`, `order`, `is_active` | FK → `form_definitions` | No | No |
| `form_fields` | `id` | `form_section_id`, `field_key`, `type`, `order`, `is_active` | FK → `form_sections` | No | No |
| `form_field_options` | `id` | `form_field_id`, `value`, `order` | FK → `form_fields` | No | No |
| `announcements` | `id` | `author_id`, `is_pinned` | FK → `users` | No | No |
| `calendar_events` | `id` | `start_date`, `end_date`, `created_by`, `deadline_id` | FK → `users`, optional FK → `deadlines` | No | No |
| `deadlines` | `id` | `title`, `due_date` | — | No | No |
| `user_emergency_contacts` | `id` | `user_id` | FK → `users` | No | No |
| `audit_logs` | `id` | `request_id` (UUID), `user_id`, `event_type`, `auditable_type`, `auditable_id`, `created_at` | FK → `users` (nullable), polymorphic auditable | No | No |
| `application_consents` | `id` | `application_id`, `consent_type` | FK → `applications` | No | No |

---

## 3. Core Entity Groups

### 3.1 User and Auth

Manages identity, authentication credentials, role assignment, API token issuance, and session storage.

```
┌──────────┐     N:1      ┌───────┐
│  users   │─────────────►│ roles │
└──────────┘              └───────┘
     │
     │ 1:N (polymorphic)
     ▼
┌────────────────────────┐
│  personal_access_tokens│  (Sanctum tokens)
└────────────────────────┘

┌────────────────────────┐
│  password_reset_tokens │  (keyed by email, no FK)
└────────────────────────┘

┌─────────┐
│ sessions│  (Laravel server-side session storage)
└─────────┘
```

Key columns on `users`: `role_id`, `email` (unique), `email_verified_at`, `password` (bcrypt), `mfa_enabled`, `mfa_secret`, `failed_login_attempts`, `lockout_until`, `is_active`, `notification_preferences` (JSON).

---

### 3.2 Camp Management

Defines the camp programs and their scheduled sessions.

```
┌───────┐   1:N   ┌───────────────┐   1:N   ┌────────┐
│ camps │────────►│ camp_sessions │────────►│ cabins │
└───────┘         └───────────────┘         └────────┘
                         │
                         │ 1:N
                         ▼
                  ┌──────────────┐
                  │ applications │
                  └──────────────┘
```

Key columns on `camp_sessions`: `camp_id`, `name`, `start_date`, `end_date`, `capacity`, `min_age` (nullable), `max_age` (nullable), `registration_opens_at`, `registration_closes_at`, `is_active`.

---

### 3.3 Registration

Captures the camper-to-application workflow including the application form, consent records, document attachments, and admin document requests.

```
┌───────┐   1:N   ┌─────────┐   1:N   ┌──────────────┐
│ users │────────►│ campers │────────►│ applications │
└───────┘         └─────────┘         └──────────────┘
                      │                      │
                      │ 1:N                  │ 1:N
                      ▼                      ▼
              ┌──────────────────┐   ┌───────────────────┐
              │ emergency_       │   │ application_      │
              │ contacts         │   │ consents          │
              └──────────────────┘   └───────────────────┘

              ┌──────────────────┐ (polymorphic documentable)
              │    documents     │◄── campers, applications, messages
              └──────────────────┘

              ┌──────────────────┐
              │ document_        │
              │ requests         │
              └──────────────────┘

              ┌──────────────────┐
              │ applicant_       │
              │ documents        │
              └──────────────────┘

              ┌──────────────────────┐
              │ required_document_   │
              │ rules                │
              └──────────────────────┘
```

Key columns on `applications`: `camper_id`, `camp_session_id` (nullable), `camp_session_id_second` (nullable, second-choice session), `status` (enum: `pending`, `under_review`, `approved`, `rejected`, `waitlisted`, `cancelled`, `withdrawn`, `draft`), `is_draft`, `submitted_at`, `reviewed_at`, `reviewed_by`, `form_definition_id`, `reapplied_from_id`, `incomplete_approval` (flag for edge-case approvals).

The `documents` table uses a polymorphic `documentable_type` / `documentable_id` pair, allowing attachment to campers, applications, and messages from a single table.

---

### 3.4 Medical

All tables in this group contain PHI. Access is gated by the `medical` role and `is_active` flag enforcement. The `medical_records` table is the root record; all other medical tables hang off `campers` directly.

```
┌─────────┐
│ campers │
└────┬────┘
     │
     ├── 1:1 ──► medical_records        (PHI: insurance, physician, seizure info, dietary)
     │
     ├── 1:N ──► allergies              (severity: mild / moderate / severe)
     │
     ├── 1:N ──► medications            (dosage, frequency, prescribing_physician)
     │
     ├── 1:1 ──► behavioral_profiles    (PHI: triggers, de-escalation, communication notes)
     │
     ├── 1:1 ──► personal_care_plans    (PHI: bathing/toileting/dressing/oral hygiene notes)
     │
     ├── 1:N ──► diagnoses              (CYSHCN diagnosis codes and descriptions)
     │
     ├── 1:1 ──► feeding_plans          (PHI: tube feeding, dietary protocols)
     │
     ├── 1:N ──► assistive_devices      (device type and usage notes)
     │
     ├── 1:N ──► activity_permissions   (activity clearances and restrictions)
     │
     ├── 1:N ──► treatment_logs         (PHI: interventions, medication administrations)
     │
     ├── 1:N ──► medical_incidents      (PHI: incident narrative, escalation notes)
     │
     ├── 1:N ──► medical_follow_ups     (task queue: pending / in_progress / completed)
     │
     ├── 1:N ──► medical_visits         (PHI: vitals, chief complaint, disposition)
     │
     ├── 1:N ──► medical_restrictions   (PHI: activity/dietary/environmental restrictions)
     │
     └── 1:N ──► medical_provider_links (time-limited secure tokens for external providers)
```

**`is_active` enforcement.** Both `medical_records.is_active` and `campers.is_active` are controlled exclusively by `ApplicationService`. Medical staff operational endpoints use `scopeActive()` to filter both tables. Direct writes to these flags via API are not permitted.

---

### 3.5 Messaging

Implements a Gmail-style threaded inbox. `conversations` are the thread containers; `messages` are immutable. `conversation_participants` is the access-control layer (who can see the thread). `message_recipients` is the display layer (TO/CC/BCC per individual message).

```
┌───────┐   1:N   ┌───────────────┐   1:N   ┌──────────┐
│ users │────────►│ conversations │────────►│ messages │
└───────┘    N:M  └───────────────┘         └────┬─────┘
              │                                  │
              ▼                                  ├── 1:N ──► message_reads
 ┌───────────────────────┐                       │
 │ conversation_         │                       └── 1:N ──► message_recipients
 │ participants          │                                   (to / cc / bcc)
 └───────────────────────┘

┌───────────────┐
│ notifications │◄── users (system and messaging notifications)
└───────────────┘
```

**BCC privacy.** `message_recipients` rows with `recipient_type = 'bcc'` must never be returned to any client other than the original message sender. The `Message::getRecipientsForUser(User)` method is the only approved path for recipient API responses.

**Idempotency.** `messages.idempotency_key` (unique) prevents duplicate messages on network retry.

**Conversation context links.** `conversations` carries nullable FKs to `applications`, `campers`, and `camp_sessions`, enabling threaded conversations scoped to a specific registration context.

---

### 3.6 Forms

Stores versioned, super-admin-managed application form definitions. Only one `form_definition` may have `status = 'published'` at any time.

```
┌──────────────────┐
│ form_definitions │  (versioned, draft | published)
└────────┬─────────┘
         │ 1:N
         ▼
┌──────────────────┐
│  form_sections   │  (ordered sections within a form)
└────────┬─────────┘
         │ 1:N
         ▼
┌──────────────────┐
│   form_fields    │  (field_key, type, validation_rules)
└────────┬─────────┘
         │ 1:N
         ▼
┌──────────────────────┐
│  form_field_options  │  (options for select / radio / checkbox fields)
└──────────────────────┘
```

`form_fields.field_key` is a stable identifier. Once applications reference a published form, `field_key` values must not be changed because they serve as the mapping between form structure and stored application data.

---

### 3.7 Content

Admin-managed content visible in portal dashboards.

| Table | Purpose | Key Columns |
|---|---|---|
| `announcements` | Portal dashboard announcements | `author_id`, `title`, `body`, `is_pinned` |
| `calendar_events` | Camp calendar entries | `start_date`, `end_date`, `all_day`, `created_by`, `deadline_id` |
| `deadlines` | Named deadlines linked to calendar events | `title`, `due_date` |

---

### 3.8 Audit

Provides the immutable HIPAA audit trail. Records are never updated or deleted.

```
┌────────────┐
│ audit_logs │
└────────────┘
  id                  — bigint PK
  request_id          — UUID (correlates all log entries per HTTP request)
  user_id             — FK → users (nullable; null for unauthenticated events)
  event_type          — string(50): phi_access | admin_action | auth | content_change | security
  auditable_type      — polymorphic model class (nullable)
  auditable_id        — polymorphic model id (nullable)
  action              — string(100): description of the action taken
  description         — text (nullable): human-readable detail
  old_values          — JSON (nullable): snapshot before change
  new_values          — JSON (nullable): snapshot after change
  metadata            — JSON (nullable): additional context
  ip_address          — string(45): IPv4 or IPv6
  user_agent          — string: browser/client identifier
  created_at          — timestamp (indexed): no updated_at; records are immutable
```

The `audit_logs` table has no `updated_at` column by design — log entries are append-only.

---

## 4. Key Constraints

### Soft Deletes

The following tables use `deleted_at` (Laravel `SoftDeletes`). Hard deletion is prohibited for these records.

| Table | Rationale |
|---|---|
| `campers` | Record retention requirements; PHI must be auditable for minimum retention period |
| `conversations` | Message thread integrity; allows participants to still read archived threads |
| `messages` | Message immutability; senders cannot permanently destroy sent content |

### Unique Constraints

| Table | Constraint |
|---|---|
| `users` | `email` |
| `applications` | `(camper_id, camp_session_id)` — one application per camper per session |
| `medical_records` | `camper_id` — one medical record per camper |
| `behavioral_profiles` | `camper_id` — one behavioral profile per camper |
| `personal_care_plans` | `camper_id` — one care plan per camper |
| `feeding_plans` | `camper_id` — one feeding plan per camper |
| `conversation_participants` | `(conversation_id, user_id)` |
| `message_reads` | `(message_id, user_id)` |
| `message_recipients` | `(message_id, user_id)` |
| `messages` | `idempotency_key` |
| `medical_provider_links` | `token` |
| `roles` | `name`, `slug` |

### Foreign Key Cascades

- `campers` → cascade deletes to: `applications`, `medical_records`, `allergies`, `medications`, `emergency_contacts`, `treatment_logs`, `medical_incidents`, `medical_follow_ups`, `medical_visits`, `medical_restrictions`, `behavioral_profiles`, `personal_care_plans`, `diagnoses`, `feeding_plans`, `assistive_devices`, `activity_permissions`, `medical_provider_links`
- `conversations` → cascade deletes to: `conversation_participants`, `messages`
- `messages` → cascade deletes to: `message_reads`, `message_recipients`
- `form_definitions` → cascade to `form_sections` → cascade to `form_fields` → cascade to `form_field_options`
- `camp_sessions` → cascade to `cabins`

### Nullable FKs (nullOnDelete)

- `documents.uploaded_by` → nullified if the uploading user is deleted
- `audit_logs.user_id` → nullified if the user is deleted (audit record preserved)
- `conversations.created_by_id` → nullable (system-generated conversations have no creator)
- `messages.sender_id` → nullable (system messages have no sender)

---

## 5. Naming Conventions

| Convention | Rule | Example |
|---|---|---|
| Table names | `snake_case`, plural nouns | `camp_sessions`, `medical_records` |
| Column names | `snake_case` | `created_at`, `camp_session_id` |
| Primary keys | `id` (bigint, auto-increment) on all tables | `id` |
| Foreign keys | `{referenced_table_singular}_id` | `camper_id`, `user_id` |
| Named FK columns | Descriptive prefix when multiple FKs to same table | `recorded_by`, `created_by`, `assigned_to`, `revoked_by` |
| Timestamps | Laravel convention: `created_at`, `updated_at` | Standard on all tables |
| Soft deletes | `deleted_at` (nullable timestamp) | `campers.deleted_at` |
| Boolean flags | `is_` prefix | `is_active`, `is_draft`, `is_read` |
| Enum columns | `snake_case` string/enum | `status`, `recipient_type`, `severity` |
| Polymorphic pairs | `{name}_type` / `{name}_id` | `documentable_type`, `documentable_id` |
| JSON columns | Descriptive noun | `metadata`, `old_values`, `new_values`, `vitals` |
| Migration filenames | `YYYY_MM_DD_HHMMSS_{verb}_{description}.php` | `2026_03_25_000009_create_personal_care_plans_table.php` |
