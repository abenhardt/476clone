# Data Model

This document describes the database schema, entity relationships, and data model for the Camp Burnt Gin API backend.

---

## Database Tables

The system implements 39 database tables:

| Table | Records | Description |
|-------|---------|-------------|
| `users` | Variable | User accounts and authentication |
| `roles` | 4 | Role definitions (super_admin, admin, applicant, medical) with hierarchical authority model |
| `camps` | Variable | Camp program definitions |
| `camp_sessions` | Variable | Individual camp session schedules |
| `campers` | Variable | Camper profiles linked to parents |
| `applications` | Variable | Camp applications with status tracking |
| `medical_records` | Variable | Medical information for campers |
| `allergies` | Variable | Allergy records with severity |
| `medications` | Variable | Medication records |
| `emergency_contacts` | Variable | Emergency contact information |
| `documents` | Variable | File upload metadata (polymorphic - includes message attachments) |
| `medical_provider_links` | Variable | Secure provider access tokens |
| `treatment_logs` | Variable | On-site treatment and intervention records (PHI encrypted) |
| `medical_incidents`    | Variable | Medical incident reports and escalation tracking             |
| `medical_follow_ups`   | Variable | Follow-up task queue linked to incidents and campers         |
| `medical_visits`       | Variable | Health office visit records with vitals and dispositions     |
| `medical_restrictions` | Variable | Camper activity, dietary, and environmental restrictions      |
| `conversations` | Variable | Message thread containers |
| `conversation_participants` | Variable | User-conversation membership tracking |
| `messages` | Variable | Individual messages (immutable) |
| `message_reads` | Variable | Message read receipt tracking |
| `notifications` | Variable | User notification history |
| `personal_access_tokens` | Variable | Sanctum API tokens |
| `sessions` | Variable | Laravel session storage |
| `password_reset_tokens` | Temporary | Password reset tokens |
| `document_requests` | Variable | Admin-initiated requests for applicants to submit specific documents |
| `applicant_documents` | Variable | Documents sent from admins to applicants and their submission status |
| `form_definitions` | Variable | Versioned application form definitions managed by super administrators |
| `form_sections` | Variable | Sections grouping related fields within a form definition |
| `form_fields` | Variable | Individual input fields within a form section |
| `form_field_options` | Variable | Selectable options for select, checkbox, and radio form fields |
| `announcements` | Variable | Admin-created announcements shown to users in portal dashboards |
| `calendar_events` | Variable | Camp-related calendar events |
| `user_emergency_contacts` | Variable | Emergency contacts linked to user profiles (distinct from camper emergency_contacts) |
| `required_document_rules` | Variable | Defines which documents are required for application submission |

---

## Entity Relationship Diagram

```
┌─────────┐
│  roles  │
└────┬────┘
     │
     │ 1:N
     ▼
┌─────────────┐        1:N         ┌──────────┐
│   users     │◄────────────────────│ campers  │
└──────┬──────┘                     └────┬─────┘
       │                                 │
       │ 1:N                            │ 1:N
       ▼                                 ▼
┌──────────────────┐            ┌──────────────────┐
│ notifications    │            │  applications    │
└──────────────────┘            └────────┬─────────┘
                                         │
       ┌─────────────────────────────────┤
       │                                 │
       │ 1:N                            │ N:1
       ▼                                 ▼
┌──────────────────┐            ┌──────────────────┐
│ medical_records  │            │  camp_sessions   │
└────────┬─────────┘            └────────┬─────────┘
         │                               │
         │                               │ N:1
         │                               ▼
         │                         ┌────────────┐
         │                         │   camps    │
         │                         └────────────┘
         │
         ├─── 1:N ────┐
         │            │
         ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────────────────┐
   │allergies │ │medications│ │ emergency_contacts   │
   └──────────┘ └──────────┘ └──────────────────────┘

        (campers also have)
                │
                ├─── 1:N ──► documents (polymorphic)
                │
                ├─── 1:N ──► medical_provider_links
                │
                ├─── 1:N ──► treatment_logs (recorded_by → users)
                │
                ├─── 1:N ──► medical_incidents (recorded_by → users)
                │
                ├─── 1:N ──► medical_follow_ups (created_by → users)
                │
                ├─── 1:N ──► medical_visits (recorded_by → users)
                │
                └─── 1:N ──► medical_restrictions (created_by → users)


        Inbox Messaging System Entities:

┌─────────────┐        1:N         ┌──────────────────┐
│   users     │◄────────────────────│ conversations    │
└──────┬──────┘                     └────────┬─────────┘
       │                                     │
       │ N:M                                │ 1:N
       ▼                                     ▼
┌──────────────────────┐            ┌──────────────────┐
│ conversation_        │            │  messages        │
│ participants         │            └────────┬─────────┘
└──────────────────────┘                     │
                                             │ 1:N
                                             ▼
                                      ┌──────────────┐
                                      │ message_reads│
                                      └──────────────┘

        (conversations can link to)
                │
                ├─── N:1 ──► applications (optional FK)
                ├─── N:1 ──► campers (optional FK)
                └─── N:1 ──► camp_sessions (optional FK)

        (messages can have)
                │
                └─── 1:N ──► documents (polymorphic attachments)
```

---

## Table Schemas

### users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | User identifier |
| `name` | varchar(255) | not null | Full name |
| `email` | varchar(255) | unique, not null | Email address |
| `email_verified_at` | timestamp | nullable | Email verification timestamp |
| `password` | varchar(255) | not null | bcrypt password hash |
| `role_id` | bigint | FK to roles, not null | User role |
| `mfa_enabled` | boolean | default false | MFA enabled status |
| `mfa_secret` | varchar(255) | nullable | TOTP secret (hidden) |
| `mfa_verified_at` | timestamp | nullable | MFA verification timestamp |
| `failed_login_attempts` | integer | default 0 | Failed login counter |
| `lockout_until` | timestamp | nullable | Account lockout expiration |
| `remember_token` | varchar(100) | nullable | Remember token |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`email`)
- KEY (`role_id`)

**Relationships:**
- belongs to: `roles`
- has many: `campers`, `notifications`, `personal_access_tokens`

### campers

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Camper identifier |
| `user_id` | bigint | FK to users, not null | Parent user |
| `first_name` | varchar(255) | not null | First name |
| `last_name` | varchar(255) | not null | Last name |
| `date_of_birth` | date | not null | Birth date |
| `gender` | varchar(50) | nullable | Gender |
| `tshirt_size` | varchar(20) | nullable | T-shirt size |
| `supervision_level` | varchar(50) | nullable | Supervision level enum |
| `is_active` | boolean | not null, default false | Operational activation flag — true when at least one approved application exists |
| `record_retention_until` | date | nullable | Date after which permanent deletion is permitted |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |
| `deleted_at` | timestamp | nullable | Soft delete timestamp (record retention) |

**`is_active` lifecycle:** Set to `true` by `ApplicationService` when an application is approved. Set to `false` when an approved application is reversed and no other approved application exists for this camper. Never set by direct API calls.

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`user_id`)
- KEY (`date_of_birth`)
- KEY (`is_active`)
- KEY (`deleted_at`)

**Relationships:**
- belongs to: `users`
- has many: `applications`, `medical_records`, `allergies`, `medications`, `emergency_contacts`, `medical_provider_links`, `treatment_logs`, `medical_incidents`, `medical_follow_ups`, `medical_visits`, `medical_restrictions`
- has many (polymorphic): `documents`

### applications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Application identifier |
| `camper_id` | bigint | FK to campers, not null | Camper |
| `camp_session_id` | bigint | FK to camp_sessions, not null | Session |
| `status` | enum | not null | pending/approved/rejected/waitlisted |
| `is_draft` | boolean | default true | Draft status |
| `submitted_at` | timestamp | nullable | Submission timestamp |
| `reviewed_at` | timestamp | nullable | Review timestamp |
| `reviewed_by` | bigint | FK to users, nullable | Reviewer user |
| `notes` | text | nullable | Admin notes |
| `signature_data` | text | nullable | Digital signature data |
| `signature_name` | varchar(255) | nullable | Signer name |
| `signed_at` | timestamp | nullable | Signature timestamp |
| `signed_ip_address` | varchar(45) | nullable | Signer IP |
| `form_definition_id` | bigint | FK to form_definitions, nullable | Form version used to create this application (Phase 14) |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`camper_id`, `camp_session_id`)
- KEY (`camp_session_id`)
- KEY (`status`)
- KEY (`is_draft`)
- KEY (`reviewed_at`)
- KEY (`form_definition_id`)

**Relationships:**
- belongs to: `campers`, `camp_sessions`, `users` (reviewer)
- belongs to: `form_definitions` (optional — links the application to the dynamic form version used at submission time)

### medical_records

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Record identifier |
| `camper_id` | bigint | FK to campers, not null, unique | Camper |
| `is_active` | boolean | not null, default false | Operational activation flag — true when associated camper has an approved application |
| `physician_name` | varchar(255) | nullable, encrypted | Physician name (PHI) |
| `physician_phone` | varchar(20) | nullable, encrypted | Physician phone (PHI) |
| `insurance_provider` | varchar(255) | nullable, encrypted | Insurance provider (PHI) |
| `insurance_policy_number` | varchar(100) | nullable, encrypted | Policy number (PHI) |
| `special_needs` | text | nullable, encrypted | Special needs notes (PHI) |
| `dietary_restrictions` | text | nullable, encrypted | Dietary restrictions (PHI) |
| `notes` | text | nullable, encrypted | General medical notes (PHI) |
| `has_seizures` | boolean | default false | Seizure history flag |
| `last_seizure_date` | date | nullable | Date of most recent known seizure |
| `seizure_description` | text | nullable, encrypted | Seizure presentation description (PHI) |
| `has_neurostimulator` | boolean | default false | Neurostimulator presence flag |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**`is_active` lifecycle:** Set to `true` by `ApplicationService` when a medical record is created or reactivated upon approval. Set to `false` when an approved application is reversed and no other approved application exists for the associated camper. Never set by direct API calls. Medical staff operational views are filtered to `is_active = true` only.

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`camper_id`)
- KEY (`is_active`)

**Relationships:**
- belongs to: `campers`

### allergies

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Allergy identifier |
| `camper_id` | bigint | FK to campers, not null | Camper |
| `allergen` | varchar(255) | not null | Allergen name |
| `severity` | enum | not null | mild/moderate/severe |
| `reaction` | text | nullable | Reaction description |
| `treatment` | text | nullable | Treatment protocol |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`camper_id`)

**Relationships:**
- belongs to: `campers`

### medications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Medication identifier |
| `camper_id` | bigint | FK to campers, not null | Camper |
| `name` | varchar(255) | not null | Medication name |
| `dosage` | varchar(100) | not null | Dosage |
| `frequency` | varchar(100) | not null | Frequency |
| `prescribing_physician` | varchar(255) | nullable | Physician |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`camper_id`)

**Relationships:**
- belongs to: `campers`

### `medical_incidents`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint (PK) | Auto-increment |
| `camper_id` | bigint (FK) | References `campers.id`, cascade delete |
| `recorded_by` | bigint (FK) | References `users.id` |
| `treatment_log_id` | bigint (FK, nullable) | References `treatment_logs.id`, null on delete |
| `type` | enum | `behavioral`, `medical`, `injury`, `environmental`, `emergency`, `other` |
| `severity` | enum | `minor`, `moderate`, `severe`, `critical` |
| `location` | text (encrypted, nullable) | Where incident occurred |
| `title` | text (encrypted) | Brief incident title |
| `description` | text (encrypted) | Full incident narrative |
| `witnesses` | text (encrypted, nullable) | Witness names |
| `escalation_required` | boolean | Default false |
| `escalation_notes` | text (encrypted, nullable) | Escalation details and actions taken |
| `incident_date` | date | Date of occurrence |
| `incident_time` | time (nullable) | Time of occurrence |
| `created_at` / `updated_at` | timestamp | Standard Laravel timestamps |

**Indexes:** `camper_id`, `recorded_by`, `(camper_id, incident_date)`, `type`, `severity`

---

### `medical_follow_ups`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint (PK) | Auto-increment |
| `camper_id` | bigint (FK) | References `campers.id`, cascade delete |
| `created_by` | bigint (FK) | References `users.id` |
| `assigned_to` | bigint (FK, nullable) | References `users.id` |
| `treatment_log_id` | bigint (FK, nullable) | References `treatment_logs.id`, null on delete |
| `title` | string | Follow-up task title |
| `notes` | text (nullable) | Additional context |
| `status` | enum | `pending`, `in_progress`, `completed`, `cancelled` |
| `priority` | enum | `low`, `medium`, `high`, `urgent` |
| `due_date` | date | Task due date |
| `completed_at` | timestamp (nullable) | When status moved to `completed` |
| `completed_by` | bigint (FK, nullable) | References `users.id` |
| `created_at` / `updated_at` | timestamp | Standard Laravel timestamps |

**Indexes:** `camper_id`, `created_by`, `assigned_to`, `status`, `due_date`

---

### `medical_visits`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint (PK) | Auto-increment |
| `camper_id` | bigint (FK) | References `campers.id`, cascade delete |
| `recorded_by` | bigint (FK) | References `users.id` |
| `visit_date` | date | Date of visit |
| `visit_time` | time (nullable) | Time of visit |
| `chief_complaint` | text (encrypted) | Primary reason for visit |
| `symptoms` | text (encrypted) | Observed symptoms |
| `vitals` | JSON (nullable) | `{ temp, pulse, bp, spo2, weight }` |
| `treatment_provided` | text (encrypted, nullable) | Treatment administered |
| `medications_administered` | text (encrypted, nullable) | Medications given during visit |
| `disposition` | enum | `returned_to_activity`, `monitoring`, `sent_home`, `emergency_transfer`, `other` |
| `disposition_notes` | text (encrypted, nullable) | Notes on outcome |
| `follow_up_required` | boolean | Default false |
| `follow_up_notes` | text (encrypted, nullable) | Follow-up instructions |
| `created_at` / `updated_at` | timestamp | Standard Laravel timestamps |

**Indexes:** `camper_id`, `recorded_by`, `(camper_id, visit_date)`

---

### `medical_restrictions`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint (PK) | Auto-increment |
| `camper_id` | bigint (FK) | References `campers.id`, cascade delete |
| `created_by` | bigint (FK) | References `users.id` |
| `restriction_type` | string | e.g., `activity`, `dietary`, `environmental`, `equipment` |
| `description` | text (encrypted) | Restriction details |
| `start_date` | date | Effective from |
| `end_date` | date (nullable) | Null = indefinite |
| `is_active` | boolean | Default true |
| `notes` | text (encrypted, nullable) | Additional clinical notes |
| `created_at` / `updated_at` | timestamp | Standard Laravel timestamps |

**Indexes:** `camper_id`, `created_by`, `(camper_id, is_active)`

---

### conversations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Conversation identifier |
| `created_by_id` | bigint | FK to users, not null | Conversation creator |
| `subject` | varchar(255) | not null | Conversation subject |
| `application_id` | bigint | FK to applications, nullable | Linked application |
| `camper_id` | bigint | FK to campers, nullable | Linked camper |
| `camp_session_id` | bigint | FK to camp_sessions, nullable | Linked session |
| `last_message_at` | timestamp | not null | Last message timestamp |
| `is_archived` | boolean | default false | Archive status |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |
| `deleted_at` | timestamp | nullable | Soft delete timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`created_by_id`)
- KEY (`application_id`)
- KEY (`camper_id`)
- KEY (`camp_session_id`)
- KEY (`is_archived`)
- KEY (`last_message_at`)
- KEY (`deleted_at`)
- COMPOSITE KEY (`is_archived`, `deleted_at`, `last_message_at`)

**Relationships:**
- belongs to: `users` (creator)
- belongs to: `applications` (optional)
- belongs to: `campers` (optional)
- belongs to: `camp_sessions` (optional)
- has many: `messages`
- has many: `conversation_participants`
- has many through: `participants` (users via conversation_participants)

### conversation_participants

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Participant record identifier |
| `conversation_id` | bigint | FK to conversations, not null | Conversation |
| `user_id` | bigint | FK to users, not null | Participant user |
| `joined_at` | timestamp | not null | Join timestamp |
| `left_at` | timestamp | nullable | Leave timestamp |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`conversation_id`, `user_id`)
- KEY (`user_id`)
- KEY (`left_at`)

**Relationships:**
- belongs to: `conversations`
- belongs to: `users`

### messages

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Message identifier |
| `conversation_id` | bigint | FK to conversations, not null | Conversation |
| `sender_id` | bigint | FK to users, not null | Message sender |
| `body` | text | not null | Message content |
| `idempotency_key` | varchar(64) | unique, not null | Duplicate prevention |
| `created_at` | timestamp | not null | Send timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |
| `deleted_at` | timestamp | nullable | Soft delete timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`idempotency_key`)
- KEY (`conversation_id`)
- KEY (`sender_id`)
- KEY (`created_at`)
- KEY (`deleted_at`)

**Relationships:**
- belongs to: `conversations`
- belongs to: `users` (sender)
- has many: `message_reads`
- has many (polymorphic): `documents` (attachments via documentable_type/documentable_id)

### message_reads

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PK, auto-increment | Read receipt identifier |
| `message_id` | bigint | FK to messages, not null | Message |
| `user_id` | bigint | FK to users, not null | Reader user |
| `read_at` | timestamp | not null | Read timestamp |
| `created_at` | timestamp | not null | Creation timestamp |
| `updated_at` | timestamp | not null | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`message_id`, `user_id`)
- KEY (`user_id`)
- KEY (`read_at`)

**Relationships:**
- belongs to: `messages`
- belongs to: `users`

### document_requests

**Purpose:** Tracks admin-initiated requests for applicants to submit specific documents. Drives the Document Request workflow (Phase 13).

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `applicant_id` | bigint FK → users | The applicant receiving the request |
| `application_id` | bigint FK → applications (nullable) | Optional application context |
| `camper_id` | bigint FK → campers (nullable) | Optional camper context |
| `admin_id` | bigint FK → users | Admin who created the request |
| `title` | string | Document name/title requested |
| `description` | text (nullable) | Instructions for the applicant |
| `status` | enum | `awaiting_upload`, `uploaded`, `scanning`, `under_review`, `approved`, `rejected`, `overdue` |
| `due_date` | date (nullable) | Optional deadline |
| `rejection_reason` | text (nullable) | Populated when status = rejected |
| `submitted_at` | timestamp (nullable) | When applicant uploaded |
| `reviewed_at` | timestamp (nullable) | When admin reviewed |
| `document_id` | bigint FK → documents (nullable) | The uploaded document |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `users` (applicant), `users` (admin), `applications` (optional), `campers` (optional), `documents` (optional)

---

### applicant_documents

**Purpose:** Tracks documents sent from admins to applicants and their submission status.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `applicant_id` | bigint FK → users | Receiving applicant |
| `admin_id` | bigint FK → users (nullable) | Sending admin |
| `original_document_id` | bigint FK → documents (nullable) | Template/original file |
| `submitted_document_id` | bigint FK → documents (nullable) | Applicant's submitted file |
| `title` | string | Document title |
| `description` | text (nullable) | Instructions |
| `status` | enum | `pending`, `submitted`, `reviewed` |
| `is_reviewed` | boolean | Whether admin has reviewed submission |
| `reviewed_at` | timestamp (nullable) | When admin reviewed |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `users` (applicant), `users` (admin), `documents` (original), `documents` (submitted)

---

### form_definitions

**Purpose:** Stores versioned application form definitions managed by super administrators. Only one definition may be published at a time. (Phase 14)

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `name` | string | Human-readable form name |
| `version` | integer | Auto-incrementing version number |
| `status` | enum | `draft`, `published` |
| `published_at` | timestamp (nullable) | When the form was published |
| `created_by` | bigint FK → users (nullable) | Super admin who created it |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `users` (creator)
- has many: `form_sections`
- has many: `applications` (via nullable FK)

---

### form_sections

**Purpose:** Defines sections within a form definition. Each section groups related fields. (Phase 14)

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `form_definition_id` | bigint FK → form_definitions | Parent form |
| `title` | string | Section display title |
| `description` | text (nullable) | Optional section instructions |
| `order` | integer | Display order within the form |
| `is_active` | boolean | Whether the section is shown |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `form_definitions`
- has many: `form_fields`

---

### form_fields

**Purpose:** Defines individual input fields within a form section. (Phase 14)

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `form_section_id` | bigint FK → form_sections | Parent section |
| `field_key` | string | Stable identifier used in application data. Cannot be changed once applications reference it. |
| `label` | string | Display label |
| `type` | enum | `text`, `textarea`, `select`, `checkbox`, `radio`, `date`, `file`, `number`, `email`, `phone` |
| `placeholder` | string (nullable) | Input placeholder text |
| `help_text` | text (nullable) | Helper text shown below the field |
| `is_required` | boolean | Whether the field is mandatory |
| `is_active` | boolean | Whether the field is shown |
| `validation_rules` | json (nullable) | Additional validation constraints |
| `order` | integer | Display order within the section |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `form_sections`
- has many: `form_field_options`

---

### form_field_options

**Purpose:** Stores selectable options for select, checkbox, and radio form fields. (Phase 14)

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `form_field_id` | bigint FK → form_fields | Parent field |
| `label` | string | Display label |
| `value` | string | Stored value |
| `order` | integer | Display order |
| `created_at`, `updated_at` | timestamps | |

**Relationships:**
- belongs to: `form_fields`

---

### announcements

**Purpose:** Stores admin-created announcements shown to users in their portal dashboards.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `title` | string | Announcement title |
| `body` | text | Announcement content |
| `author_id` | bigint FK → users | Admin who created the announcement |
| `is_pinned` | boolean | Whether the announcement is pinned to the top |
| `created_at`, `updated_at` | timestamps | |

---

### calendar_events

**Purpose:** Stores camp-related calendar events visible to users in the portal.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `title` | string | Event title |
| `description` | text (nullable) | Event details |
| `start_date` | date | Event start date |
| `end_date` | date (nullable) | Event end date |
| `all_day` | boolean | Whether the event spans a full day |
| `created_by` | bigint FK → users | User who created the event |
| `created_at`, `updated_at` | timestamps | |

---

### user_emergency_contacts

**Purpose:** Stores emergency contacts linked to user (applicant) profiles. Distinct from camper-level `emergency_contacts`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `user_id` | bigint FK → users | Owning user |
| `name` | string | Contact name |
| `relationship` | string | Relationship to user |
| `phone_primary` | string | Primary phone number |
| `phone_secondary` | string (nullable) | Secondary phone number |
| `created_at`, `updated_at` | timestamps | |

---

### required_document_rules

**Purpose:** Defines which documents are required for application submission, used to enforce document completeness before an application can be finalized.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment |
| `document_type` | string | Machine-readable document type identifier |
| `label` | string | Human-readable document label |
| `is_required` | boolean | Whether the document is mandatory for submission |
| `created_at`, `updated_at` | timestamps | |

---

### Other Tables

Refer to database migrations in `database/migrations/` for complete schema definitions of:
- `camps`, `camp_sessions`, `emergency_contacts`, `documents`, `medical_provider_links`, `notifications`, `roles`

---

## Data Relationships

### One-to-Many

- User → Campers
- User → Notifications
- User → Conversations (created_by)
- User → Messages (sender)
- User → Message Reads
- User → DocumentRequests (as applicant or admin)
- User → ApplicantDocuments (as applicant or admin)
- User → UserEmergencyContacts
- Camper → Applications
- Camper → Allergies
- Camper → Medications
- Camper → Emergency Contacts
- Camper → MedicalIncident (one camper, many incidents)
- Camper → MedicalFollowUp (one camper, many follow-up tasks)
- Camper → MedicalVisit (one camper, many health office visits)
- Camper → MedicalRestriction (one camper, many restrictions)
- Camp → Camp Sessions
- Camp Session → Applications
- Conversation → Messages
- Conversation → Conversation Participants
- Message → Message Reads
- FormDefinition → FormSections
- FormSection → FormFields
- FormField → FormFieldOptions

### Many-to-Many

- User ↔ Conversation (through conversation_participants)

### One-to-One

- Camper → Medical Record (one record per camper)

### Polymorphic

- Documents → Documentable (camper, application, message, etc.)

---

## Data Integrity

- Foreign key constraints enforced
- Unique constraints on email, camper+session
- Soft deletes on campers (audit trail)
- Cascading deletes where appropriate
- NOT NULL constraints on required fields

---

**Document Status:** Complete and authoritative
**Last Updated:** March 2026
