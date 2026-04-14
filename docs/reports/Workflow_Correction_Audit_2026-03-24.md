# Workflow Correction Audit Report

**System:** Camp Burnt Gin
**Report Date:** 2026-03-24
**Scope:** Application approval, reversal, re-approval, camper activation/deactivation, medical record lifecycle
**Classification:** Internal Engineering

---

## 1. Executive Summary

A formal audit of the application review workflow identified eight substantive gaps between the intended authoritative architecture and the implemented system behavior. The gaps collectively meant that:

- Reversing an approved application left the camper and medical record fully active in all operational views.
- Medical staff saw campers whose enrollments had been cancelled or reversed.
- No database transaction protected the approval workflow against partial failure.
- Any status could be transitioned to any other status without validation.
- Application review decisions were not written to the audit log.

All eight gaps have been remediated. This report documents what was wrong, what was changed, why each change was made, and the final enforced behavior.

---

## 2. Audit Findings

### Finding 1 — No Operational Activation State on Camper

**Severity:** Critical

**Description:** The `campers` table had no `is_active` column. There was no mechanism for the system to distinguish between a camper who is actively enrolled in a current session versus a camper whose application was rejected, reversed, or has never been approved.

**Impact:** Campers with no current approved application appeared on all admin and medical rosters. Medical staff could access clinical records for campers who had been removed from camp operations. The system violated the principle that medical staff work only with admitted participants.

**Remediation:**
- Migration `2026_03_24_000002_add_is_active_to_campers_table.php` adds `is_active boolean NOT NULL DEFAULT false` to `campers`.
- `Camper::scopeActive()` provides a reusable query scope for filtering active campers.
- `ApplicationService` sets `is_active = true` on approval and `is_active = false` on reversal (if no other approved application exists).
- Existing rows backfilled at migration time: campers with at least one approved application are set to `is_active = true`.

---

### Finding 2 — No Operational Activation State on Medical Record

**Severity:** Critical

**Description:** The `medical_records` table had no `is_active` column. Once a medical record was created upon first approval, it remained visible to medical staff regardless of whether the underlying application was later reversed.

**Impact:** Medical staff could see and work with clinical records for campers who were no longer enrolled. This is both a privacy concern and an operational hazard — clinical queues included records for individuals not present at camp.

**Remediation:**
- Migration `2026_03_24_000003_add_is_active_to_medical_records_table.php` adds `is_active boolean NOT NULL DEFAULT false` to `medical_records`.
- `MedicalRecord::scopeActive()` provides a reusable query scope.
- `ApplicationService` sets `is_active = true` on approval and `is_active = false` on reversal.
- `MedicalRecordController::index()` now applies `active()` scope so medical staff see only active records.
- Existing rows backfilled at migration time.

---

### Finding 3 — No Database Transaction in ApplicationService

**Severity:** Critical

**Description:** `ApplicationService::reviewApplication()` performed multiple database writes (create medical record, update application status) with no surrounding `DB::transaction()`. If an exception occurred between any two writes, the system could enter a partially consistent state — for example, a medical record created but the application status not yet updated, or vice versa.

**Impact:** Partial failures could leave the system in an inconsistent state that would require manual intervention to correct. Under HIPAA, inconsistent PHI record state is a compliance concern.

**Remediation:**
- All database writes in `reviewApplication()` (application update, camper activation/deactivation, medical record creation/deactivation, audit log) are now wrapped in a single `DB::transaction()`.
- Notifications and letters are dispatched only after the transaction commits.
- If the transaction rolls back for any reason, no notifications are sent and the system remains in its prior consistent state.

---

### Finding 4 — No Deactivation Logic on Reversal

**Severity:** Critical

**Description:** When an approved application was transitioned to `rejected` (a reversal), `ApplicationService` did not update `camper.is_active` or `medical_record.is_active`. Both records remained active. The enrolled count decremented correctly (dynamic query), but operational visibility was unchanged.

**Impact:** Reversed applicants remained on medical rosters, medical dashboards, and session operational views. The system violated the requirement that reversal removes a camper from active operations.

**Remediation:**
- `ApplicationService` detects reversals by comparing `$previousStatus === ApplicationStatus::Approved` with `$newStatus` being `Rejected` or `Cancelled`.
- On reversal, it checks whether any other approved application exists for the same camper.
- If none exists: `camper.is_active = false`, `medical_records.is_active = false`.
- If a concurrent approved application exists (multi-session camper): records remain active.
- Medical records are never deleted.

---

### Finding 5 — No State Transition Validation

**Severity:** High

**Description:** `ApplicationService::reviewApplication()` accepted any `ApplicationStatus` value as `$newStatus` without checking whether it was a valid transition from the current state. This allowed nonsensical transitions such as `Pending → Cancelled → Approved`, `Approved → Pending`, or self-transitions (`Approved → Approved`).

**Impact:** Malformed transitions could corrupt application records, trigger incorrect notifications, and cause the camper activation/deactivation logic to fire incorrectly.

**Remediation:**
- `ApplicationStatus::canTransitionTo(ApplicationStatus $new): bool` added to the enum. It encodes the complete authoritative transition matrix.
- `ApplicationService` calls `canTransitionTo()` as the first check, before any pre-flight gates or database writes.
- Invalid transitions return `['success' => false, 'invalid_transition' => true]`.
- `ApplicationController::review()` returns HTTP 422 with a descriptive message for invalid transitions.

---

### Finding 6 — No Audit Log Entry for Application Review Decisions

**Severity:** High

**Description:** `ApplicationService::reviewApplication()` did not write any audit log entry when an application was approved, rejected, reversed, or moved to any other status. This meant that HIPAA-relevant decisions — approval of a camper for access to a medical environment — were not recorded in the audit trail.

**Impact:** Compliance gap. Application review decisions are administrative actions that affect PHI access. They must be logged with actor, timestamp, previous state, new state, and reason.

**Remediation:**
- `AuditLog::logAdminAction()` is called inside the transaction for every review decision.
- The audit entry records: action name (`application.{newStatus}`), reviewer user ID, description, application ID, camper ID, previous status, new status, and notes.

---

### Finding 7 — Medical Camper Roster Not Filtered by Active State

**Severity:** High

**Description:** `CamperController::index()` for the `isMedicalProvider()` branch queried `Camper::with([...])` with no `is_active` filter. All campers with medical records appeared in the medical roster regardless of enrollment status.

**Impact:** Medical staff saw campers who were not currently enrolled. Clinical workflows operated on a superset of the actual admitted population, increasing cognitive load and potential for misidentification.

**Remediation:**
- The medical branch now uses `Camper::active()->with([...])` which applies the `scopeActive()` filter (`is_active = true`).

---

### Finding 8 — Medical Record List Not Filtered by Active State

**Severity:** High

**Description:** `MedicalRecordController::index()` queried `MedicalRecord::with('camper')->paginate(15)` with no `is_active` filter. All medical records were returned to any authorized viewer.

**Impact:** Medical staff operational views included records for inactive campers, creating the same population accuracy problem as Finding 7.

**Remediation:**
- `MedicalRecordController::index()` now uses `MedicalRecord::active()->with('camper')->paginate(15)`.

---

## 3. Files Changed

### New Migrations

| File | Purpose |
|------|---------|
| `database/migrations/2026_03_24_000002_add_is_active_to_campers_table.php` | Adds `is_active` to `campers`, backfills existing approved campers |
| `database/migrations/2026_03_24_000003_add_is_active_to_medical_records_table.php` | Adds `is_active` to `medical_records`, backfills based on camper state |

### Model Changes

| File | Changes |
|------|---------|
| `app/Models/Camper.php` | Added `is_active` to `$fillable` and `casts()`; added `scopeActive()` |
| `app/Models/MedicalRecord.php` | Added `is_active` to `$fillable` and `casts()`; added `scopeActive()` |

### Enum Changes

| File | Changes |
|------|---------|
| `app/Enums/ApplicationStatus.php` | Added `canTransitionTo(ApplicationStatus $new): bool` method |

### Service Changes

| File | Changes |
|------|---------|
| `app/Services/Camper/ApplicationService.php` | Full rewrite: added `DB::transaction()`, state transition validation, camper/medical record activation on approval, camper/medical record deactivation on reversal, audit log entry; added `AuditLog` and `DB` imports |

### Controller Changes

| File | Changes |
|------|---------|
| `app/Http/Controllers/Api/Camper/ApplicationController.php` | Added `invalid_transition` error case handling before capacity and compliance checks |
| `app/Http/Controllers/Api/Camper/CamperController.php` | Medical provider branch now uses `Camper::active()` scope |
| `app/Http/Controllers/Api/Medical/MedicalRecordController.php` | `index()` now uses `MedicalRecord::active()` scope |

### New Documentation

| File | Purpose |
|------|---------|
| `docs/backend/APPLICATION_LIFECYCLE.md` | Authoritative workflow specification: approval, rejection, reversal, re-approval, state models, invariants, data flow, notifications, authorization, audit |

### Updated Documentation

| File | Changes |
|------|---------|
| `docs/backend/APPLICATION_WORKFLOWS.md` | Corrected state transition matrix; added camper/medical record activation table; corrected review process diagram; added reversal handling to error table |
| `docs/backend/DATA_MODEL.md` | Added `is_active` to campers and medical_records schema; added lifecycle notes |
| `docs/backend/BUSINESS_RULES.md` | Replaced incorrect transition rules; added full transition matrix; added medical record lifecycle section |

---

## 4. Edge Cases Tested and Verified Behaviors

| Scenario | Verified Behavior |
|----------|-------------------|
| Approve a pending application | Camper `is_active = true`; medical record created and `is_active = true`; audit log written; notifications sent |
| Reject a pending application (never approved) | No camper activation; no medical record created; audit log written |
| Reverse an approved application | Camper `is_active = false`; medical record `is_active = false`; audit log written; rejection notifications sent |
| Reverse when camper has other approved application | Camper and medical record remain `is_active = true`; audit log written |
| Re-approve after reversal | Camper `is_active = true`; existing medical record `is_active = true`; no duplicate record created |
| Attempt self-transition (Approved → Approved) | HTTP 422: invalid transition |
| Attempt Cancelled → Approved | HTTP 422: invalid transition |
| Approve session at capacity | HTTP 422: capacity exceeded; no state change |
| Approve with missing documents | HTTP 422: compliance failure; no state change |
| Exception inside transaction | Full rollback; no partial state; no notifications dispatched |

---

## 5. Final Enforced Behavior

After all remediations:

1. Approval creates or reactivates the camper's operational record and medical record within a single atomic transaction.
2. Reversal deactivates both records (if no other approved application exists) within the same transaction.
3. Re-approval reactivates existing records without creating duplicates.
4. Medical staff see only operationally active campers and medical records.
5. All state transitions are validated before any write occurs.
6. Every review decision is written to the audit log.
7. Notifications are dispatched only after the transaction commits successfully.
8. All behavior is formally specified in `APPLICATION_LIFECYCLE.md`.

---

## 6. Required Post-Deployment Step

The two new migrations must be applied to the database before the updated code is deployed:

```bash
php artisan migrate
```

The migrations contain data backfill logic that activates existing approved campers and their medical records. The backfill uses raw SQL queries for performance and executes atomically within the migration transaction.

---

## 7. References

- `docs/backend/APPLICATION_LIFECYCLE.md` — Authoritative workflow specification
- `docs/backend/APPLICATION_WORKFLOWS.md` — Updated workflow overview
- `docs/backend/DATA_MODEL.md` — Updated schema reference
- `docs/backend/BUSINESS_RULES.md` — Updated business rule catalog
- `system/safety-gate.md` — PHI and HIPAA safety constraints
