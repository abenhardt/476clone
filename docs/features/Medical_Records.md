# Medical Records Subsystem

**Version:** 1.0 — 2026-03-29
**Sensitivity:** HIPAA — contains Protected Health Information (PHI)
**Owner:** Camp Burnt Gin Engineering

---

## Table of Contents

1. [Overview](#overview)
2. [Data Structure](#data-structure)
3. [PHI Encryption](#phi-encryption)
4. [Access Model](#access-model)
5. [Medical Provider Link Flow](#medical-provider-link-flow)
6. [Active and Inactive Records](#active-and-inactive-records)
7. [Roster Endpoints](#roster-endpoints)
8. [Behavioral Profiles](#behavioral-profiles)
9. [Personal Care Plans](#personal-care-plans)
10. [Audit Trail](#audit-trail)

---

## Overview

A **medical record** is the primary health document for a single camper. It aggregates physician information, insurance details, immunization status, critical health flags, and clinical narratives required to safely serve campers with disabilities or complex medical needs.

Medical records are HIPAA-protected PHI. Every column that could identify a person or reveal a health condition is stored encrypted at rest. Access is strictly role-gated and every read by an admin or medical provider is written to the immutable audit log.

**Who can access medical records:**

| Role | Access Level |
|---|---|
| `super_admin` | Full read/write via admin endpoints; all access audit-logged |
| `admin` | Full read/write via admin endpoints; all access audit-logged |
| `medical` | Read-only via medical provider portal; access audit-logged |
| `applicant` (parent) | Can view and update the medical record for their own camper only |
| Medical provider (external) | Time-limited read/write via a one-time secure token link |

---

## Data Structure

### Primary Table: `medical_records`

One row per camper. The `camper_id` foreign key enforces the one-to-one relationship.

| Column | Type | Encrypted | Description |
|---|---|---|---|
| `id` | bigint | No | Primary key |
| `camper_id` | bigint | No | Foreign key to `campers.id` |
| `physician_name` | text | **Yes** | Attending physician's full name |
| `physician_phone` | text | **Yes** | Physician contact phone number |
| `physician_address` | text | **Yes** | Physician mailing address |
| `insurance_provider` | text | **Yes** | Insurance company name |
| `insurance_policy_number` | text | **Yes** | Policy number |
| `insurance_group` | text | **Yes** | Group or employer number |
| `medicaid_number` | text | **Yes** | Medicaid recipient ID (PHI) |
| `special_needs` | text | **Yes** | Narrative description of special needs |
| `dietary_restrictions` | text | **Yes** | Food restrictions and allergy context |
| `notes` | text | **Yes** | General clinical notes |
| `mobility_notes` | text | **Yes** | Mobility and transfer observations |
| `seizure_description` | text | **Yes** | Typical seizure presentation description |
| `contagious_illness_description` | text | **Yes** | Description of active contagious condition |
| `recent_illness_description` | text | **Yes** | Description of significant illness in past 6 months |
| `immunizations_current` | boolean | No | Whether immunizations are up to date |
| `tetanus_date` | date | No | Date of most recent tetanus vaccination |
| `has_seizures` | boolean | No | Seizure history flag — triggers mandatory action plan check |
| `last_seizure_date` | date | No | Date of most recent known seizure |
| `has_neurostimulator` | boolean | No | Neurostimulator present (affects defibrillator use) |
| `has_contagious_illness` | boolean | No | Currently has or recently had a contagious illness |
| `tubes_in_ears` | boolean | No | Tympanostomy tubes in place |
| `has_recent_illness` | boolean | No | Significant illness within the past 6 months |
| `date_of_medical_exam` | date | No | Date on physician-completed Form 4523; drives 12-month validity |
| `is_active` | boolean | No | True when the camper has an approved application |
| `created_at` | timestamp | No | Record creation time |
| `updated_at` | timestamp | No | Last modification time |

**Virtual attribute:** `primary_diagnosis` — appended to all serialized responses; returns the first-listed diagnosis name without requiring a separate request. Uses the already-loaded `diagnoses` relation when available to avoid an extra query.

### Related Tables

| Table | Relationship | Description |
|---|---|---|
| `allergies` | `hasMany` via `camper_id` | Allergens, severity levels, reaction descriptions |
| `medications` | `hasMany` via `camper_id` | Prescribed medications, dosages, administration schedules |
| `diagnoses` | `hasMany` via `camper_id` | ICD-coded or free-text diagnoses |
| `behavioral_profiles` | `hasOne` via `camper_id` | Behavioral flags and supervision requirements (see below) |
| `personal_care_plans` | `hasOne` via `camper_id` | ADL assistance levels (see below) |
| `medical_incidents` | `hasMany` via `camper_id` | On-site incident reports |
| `medical_visits` | `hasMany` via `camper_id` | Clinical visit logs |
| `treatment_logs` | `hasMany` via `visit_id` | Per-visit clinical notes from medical staff |
| `medical_follow_ups` | `hasMany` via `incident_id` | Scheduled follow-up actions on incidents |
| `medical_restrictions` | `hasMany` via `camper_id` | Activity participation restrictions |
| `assistive_devices` | `hasMany` via `camper_id` | Wheelchairs, GTubes, hearing aids, etc. |
| `feeding_plans` | `hasOne` via `camper_id` | Tube feeding or special feeding protocols |
| `activity_permissions` | `hasMany` via `camper_id` | Per-activity medical clearance |

**Eager-load pattern for admin review:** `medicalRecord` is loaded together with `allergies`, `medications`, and `diagnoses` via the `camper_id` bridging pattern. `MedicalRecord::allergies()`, `medications()`, and `diagnoses()` all use `hasMany(..., 'camper_id', 'camper_id')` so that the entire medical picture can be assembled from a single eager-load chain off the medical record, without a separate query through the camper.

---

## PHI Encryption

All fields marked **Encrypted** in the table above use Laravel's built-in `encrypted` cast:

```php
'physician_name' => 'encrypted',
'insurance_policy_number' => 'encrypted',
// ...
```

The cast applies AES-256-CBC encryption (via the application `APP_KEY` in `.env`) transparently before writes and decrypts transparently on reads. The raw database rows contain ciphertext; a database breach without the `APP_KEY` cannot recover any PHI value.

### DecryptException on list endpoints

**Never load encrypted medical record fields in list or index endpoints.**

When a list endpoint attempts to iterate over encrypted fields for many rows simultaneously — for example in an N+1 access pattern or when serialising a paginated collection — decryption failures (e.g. a record inserted before encryption was enabled, or a key mismatch) throw a `DecryptException` that manifests as an HTTP 500. The `MedicalRecord::index()` endpoint deliberately returns only `camper` relation data alongside the record shell; it does not serialise encrypted columns in the list response.

Full encrypted field values are returned only on the `show()` (single-record) endpoint, where a single decryption failure can be handled cleanly.

---

## Access Model

### Role-based gate: `MedicalRecordPolicy`

All controller actions call `$this->authorize(...)` before any data access. The policy enforces the following:

- `viewAny` — `admin`, `super_admin`, `medical` roles only
- `view` — admin/super_admin/medical globally; `applicant` role only for their own camper
- `create` — `admin`, `super_admin` only
- `update` — `admin`, `super_admin` only; medical providers may update via the provider-link flow
- `delete` — not permitted (hard deletion of PHI records is forbidden; soft-delete or deactivation only)

### Applicant (parent) access

Applicant-role users submit and manage their camper's medical data through the application form (`ApplicationFormPage.tsx`). They can view but not freely edit a submitted medical record — edits go through the amendment request workflow.

### Medical provider (external) access

External physicians and nurses who are not registered system users access medical records through the provider-link flow described below.

---

## Medical Provider Link Flow

The `medical_provider_links` table and `MedicalProviderLink` model implement secure time-limited access for external medical professionals.

### Token security

1. A 64-character cryptographically random token is generated with `Str::random(64)`.
2. The plaintext token is embedded in the URL sent to the provider's email.
3. **Only the bcrypt hash of the token is stored in the database.** An attacker with database access cannot reconstruct the URL.
4. The `token` column is in `$hidden` so it is never serialised in API responses.
5. At access time, `Hash::check($plainToken, $hashedToken)` is called to verify without re-exposing the plain value.

### Link lifecycle

```
created  →  [emailed to provider]  →  accessed  →  submitted (is_used = true)
                                                OR  revoked   (revoked_at set)
                                                OR  expired   (expires_at in past)
```

**State fields:**

| Field | Meaning |
|---|---|
| `expires_at` | Timestamp after which the link is invalid. Default: 72 hours from creation (`DEFAULT_EXPIRATION_HOURS = 72`). |
| `accessed_at` | First time the provider opened the form URL (single-write; subsequent views do not overwrite). |
| `submitted_at` | Timestamp when the provider successfully submitted the form. |
| `revoked_at` | Set when an admin manually revokes the link before submission. |
| `revoked_by` | ID of the admin who performed the revocation. |
| `is_used` | Boolean; set to `true` after `markAsUsed()` is called on submission. A used link is permanently invalid. |

### Validity check

A link is valid only when all three conditions are true:

- `is_used` is `false`
- `revoked_at` is `null`
- `expires_at` is in the future

The `scopeValid()` query scope enforces the same conditions at the database level for efficient bulk queries.

### Admin workflow

1. Admin navigates to a camper's medical record in the admin portal.
2. Admin creates a provider link, supplying the provider's email address, name, and optional notes.
3. The system generates the token, stores its hash, sets `expires_at = now() + 72h`, and dispatches an email notification containing the access URL.
4. The provider clicks the URL from their email client. The system verifies the token, records `accessed_at`, and displays the medical form.
5. The provider fills and submits the form. The system sets `is_used = true` and `submitted_at = now()`.
6. If the provider has not yet submitted, an admin can revoke the link at any time by calling `revoke(User $user)`.

---

## Active and Inactive Records

### Purpose

The `is_active` flag on `medical_records` tracks whether the record belongs to a camper with a currently approved application. This allows medical staff operational views (dashboards, rosters, medication queues) to exclude campers whose enrolment has been reversed or cancelled without deleting the underlying records.

### Synchronisation

`is_active` on both `campers` and `medical_records` is updated by `ApplicationService::reviewApplication()` inside a database transaction:

- On **approval**: the camper and their medical record are set to `is_active = true`.
- On **reversal to pending/under_review/rejected/waitlisted**: the camper is set to `is_active = false`. If the camper has other active approved applications, `is_active` is preserved (multi-session camper safe).

### Query scopes

```php
// MedicalRecord::scopeActive()
public function scopeActive($query)
{
    return $query->where('is_active', true);
}

// Camper::scopeActive() follows the same pattern
```

Medical staff operational views must always apply `MedicalRecord::active()` to exclude inactive records. Inactive records remain in the database for HIPAA record-retention compliance and audit purposes.

---

## Roster Endpoints

The medical roster is the primary operational view for `medical`-role users. It returns paginated active medical records with basic camper information.

**Endpoint:** `GET /api/medical/records` (maps to `MedicalRecordController::index()`)

**Access:** `admin`, `super_admin`, `medical` roles (enforced by `MedicalRecordPolicy::viewAny`)

**Behaviour:**
- Applies `MedicalRecord::active()` scope — inactive records are excluded.
- Eager-loads `camper` to surface the camper name without a second request.
- Returns 15 records per page with full pagination metadata.
- Encrypted field values are **not** serialised in the list response. Full PHI is available only on the single-record endpoint.

**Pagination response shape:**

```json
{
  "data": [ ... ],
  "meta": {
    "current_page": 1,
    "last_page": 4,
    "per_page": 15,
    "total": 58
  }
}
```

---

## Behavioral Profiles

Each camper has exactly one `BehavioralProfile` record (one-to-one with `campers`). It captures safety-relevant behavioral characteristics and supervision requirements that affect staff-to-camper ratios and activity planning.

### Boolean flags

| Flag | Description |
|---|---|
| `aggression` | Exhibits aggressive behaviour toward others |
| `self_abuse` | Exhibits self-injurious behaviour |
| `wandering_risk` | Prone to wandering or elopement |
| `one_to_one_supervision` | Requires a dedicated staff member at all times |
| `developmental_delay` | Developmental delay present |
| `functional_reading` | Can read at a functional level |
| `functional_writing` | Can write at a functional level |
| `independent_mobility` | Can move independently without assistance |
| `verbal_communication` | Can communicate verbally |
| `social_skills` | Demonstrates appropriate peer social interaction |
| `behavior_plan` | A formal behaviour intervention plan is currently in place |
| `sexual_behaviors` | Exhibits problematic sexual behaviours |
| `interpersonal_behavior` | Exhibits other problematic interpersonal behaviour |
| `social_emotional` | Social or emotional condition affecting behaviour |
| `follows_instructions` | Has difficulty understanding or following instructions |
| `group_participation` | Can participate in group activities |
| `attends_school` | Currently attends school (nullable) |

### Encrypted description fields

Each positive boolean flag has a corresponding `*_description` field that captures the clinical narrative for that flag. All description fields are encrypted at rest using the `encrypted` cast.

| Encrypted field |
|---|
| `aggression_description` |
| `self_abuse_description` |
| `one_to_one_description` |
| `wandering_description` |
| `sexual_behaviors_description` |
| `interpersonal_behavior_description` |
| `social_emotional_description` |
| `follows_instructions_description` |
| `group_participation_description` |
| `notes` |

### Additional fields

- `functioning_age_level` — Approximate functional age level (plain text).
- `communication_methods` — JSON array of communication modalities (e.g. `["verbal", "sign language", "AAC device"]`). Cast to a PHP array automatically on read.
- `classroom_type` — Type of classroom when `attends_school` is `true`.

### Helper methods

- `hasHighRiskBehaviors()` — Returns `true` if any of `aggression`, `self_abuse`, or `wandering_risk` is set. Used to flag enhanced supervision protocols on activity rosters.
- `requiresOneToOne()` — Returns `true` if `one_to_one_supervision` is strictly `true`. Used to determine staffing ratios.

---

## Personal Care Plans

Each camper has exactly one `PersonalCarePlan` record (one-to-one with `campers`). It documents Activities of Daily Living (ADL) assistance requirements across hygiene, continence, sleep, and positioning domains.

### Assistance levels

Each ADL domain has a `*_level` field that takes one of four string values:

| Value | Meaning |
|---|---|
| `independent` | Camper performs the task without staff involvement |
| `verbal_cue` | Camper needs spoken prompts or reminders |
| `physical_assist` | Staff provides hands-on partial assistance |
| `full_assist` | Staff performs the task entirely |

### ADL domains with assist levels

| Domain | Level field | Notes field (encrypted) |
|---|---|---|
| Bathing | `bathing_level` | `bathing_notes` |
| Daytime toileting | `toileting_level` | `toileting_notes` |
| Dressing | `dressing_level` | `dressing_notes` |
| Oral hygiene | `oral_hygiene_level` | `oral_hygiene_notes` |

### Additional fields

| Field | Type | Encrypted | Description |
|---|---|---|---|
| `nighttime_toileting` | boolean | No | Requires assistance with nighttime toileting |
| `nighttime_notes` | text | **Yes** | Nighttime toileting details |
| `positioning_notes` | text | **Yes** | Positioning and transfer protocols |
| `sleep_notes` | text | **Yes** | Sleep routine details |
| `falling_asleep_issues` | boolean | No | Has difficulty falling asleep |
| `sleep_walking` | boolean | No | History of sleepwalking |
| `night_wandering` | boolean | No | Wanders at night |
| `bowel_control_notes` | text | **Yes** | Bowel control clinical notes |
| `urinary_catheter` | boolean | No | Catheter in use |
| `irregular_bowel` | boolean | No | Irregular bowel pattern present |
| `irregular_bowel_notes` | text | **Yes** | Details of irregular bowel condition |
| `menstruation_support` | boolean | No | Requires staff support for menstruation care |

All notes and description fields are encrypted at rest. They describe personal hygiene protocols and clinical care routines — unambiguously PHI under HIPAA.

---

## Audit Trail

Every admin and medical-provider access to PHI is written to the `audit_logs` table via `AuditLog::logPhiAccess()`. This satisfies HIPAA Audit Controls standard §164.312(b).

**What is logged:**

| Event | When |
|---|---|
| PHI access | Every `show()` call on a medical record by an admin or medical provider |
| Content change | Every `update()` on a medical record — `old_values` and `new_values` JSON snapshots included |
| Admin action | Status changes and admin edits that affect the camper record |

**Audit log fields relevant to medical access:**

| Field | Description |
|---|---|
| `request_id` | UUID linking all log entries from the same HTTP request |
| `user_id` | The authenticated user who accessed the record |
| `event_type` | Category constant (e.g. `phi_access`, `content_change`) |
| `auditable_type` / `auditable_id` | Polymorphic reference to the affected model (e.g. `MedicalRecord`, id 42) |
| `action` | Short verb (e.g. `medical_record.viewed`) |
| `old_values` / `new_values` | Before/after JSON snapshots for data-change events |
| `ip_address` | Client IP address for security investigations |
| `user_agent` | Browser/client string |
| `created_at` | Exact event timestamp — immutable after creation |

Audit log rows are never modified after creation (`UPDATED_AT = null`). The log is exportable in CSV and JSON format from the super-admin portal for compliance reporting.
