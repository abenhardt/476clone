/**
 * business-rules.test.ts
 *
 * Source-structure regression tests for critical business rule enforcement.
 *
 * These tests verify that important business rules are enforced at the right
 * layer (backend) rather than relying on frontend-only validation.  They also
 * verify that the frontend has the corresponding UI-level protection in place
 * as a first line of defence.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve(__dirname, '..');
const BACKEND = resolve(__dirname, '../../../backend/camp-burnt-gin-api');

function read(relPath: string): string {
  return readFileSync(resolve(SRC, relPath), 'utf-8');
}

function readBackend(relPath: string): string {
  return readFileSync(resolve(BACKEND, relPath), 'utf-8');
}

// ── Duplicate session choice ──────────────────────────────────────────────────

describe('Duplicate session choice — backend enforcement', () => {
  const storeRequest = readBackend(
    'app/Http/Requests/Application/StoreApplicationRequest.php'
  );

  test('backend rejects identical first and second session choice', () => {
    // The "different" validation rule prevents camp_session_id_second === camp_session_id
    expect(storeRequest).toContain("'different:camp_session_id'");
  });

  test('backend provides a descriptive validation message for duplicate choice', () => {
    expect(storeRequest).toContain('second session choice must be different');
  });
});

describe('Duplicate session choice — frontend UI guard', () => {
  const formSrc = read('features/parent/pages/ApplicationFormPage.tsx');

  test('second session options filter out the first session choice', () => {
    // The filter prevents showing the same session in the second-choice list
    expect(formSrc).toContain('s.id !== data.session_id');
  });
});

// ── Family workspace endpoint payload bounding ────────────────────────────────

describe('Family workspace endpoint — application history bounded', () => {
  const familyController = readBackend(
    'app/Http/Controllers/Api/Family/FamilyController.php'
  );

  test('family index limits applications to 5 per camper', () => {
    // Prevents unbounded historical data on the list page
    expect(familyController).toContain('->limit(5)');
  });

  test('family workspace (show) limits applications to 50 per camper', () => {
    // Prevents unbounded historical data on the detail page
    expect(familyController).toContain('->limit(50)');
  });
});

// ── Application ownership — clone/reapply ────────────────────────────────────

describe('Application clone — ownership validation', () => {
  const appService = readBackend(
    'app/Services/Camper/ApplicationService.php'
  );

  test('cloneApplication validates ownership before creating draft', () => {
    // Non-admins must not be able to reapply for someone else's camper
    expect(appService).toContain('requestedBy');
    expect(appService).toContain('ownerUserId');
  });

  test('cloneApplication emits an audit log entry', () => {
    expect(appService).toContain('AuditLog::logAdminAction');
    expect(appService).toContain('application.reapply');
  });
});

// ── PHI access scoping — DocumentController ──────────────────────────────────

describe('Medical staff document access — scoped to active campers', () => {
  const docController = readBackend(
    'app/Http/Controllers/Api/Document/DocumentController.php'
  );

  test("medical staff IDs are scoped to active records (not all records)", () => {
    expect(docController).toContain("where('is_active', true)");
  });
});

// ── Soft delete on PHI tables ─────────────────────────────────────────────────

describe('PHI tables — soft deletes enforced (HIPAA retention)', () => {
  const medicalRecord  = readBackend('app/Models/MedicalRecord.php');
  const emergencyContact = readBackend('app/Models/EmergencyContact.php');
  const allergy        = readBackend('app/Models/Allergy.php');

  test('MedicalRecord uses SoftDeletes trait', () => {
    // Matches both "use SoftDeletes;" and "use HasFactory, SoftDeletes;"
    expect(medicalRecord).toContain('SoftDeletes');
    // And imports the trait class
    expect(medicalRecord).toContain('Illuminate\\Database\\Eloquent\\SoftDeletes');
  });

  test('EmergencyContact uses SoftDeletes trait', () => {
    expect(emergencyContact).toContain('SoftDeletes');
    expect(emergencyContact).toContain('Illuminate\\Database\\Eloquent\\SoftDeletes');
  });

  test('Allergy uses SoftDeletes trait', () => {
    expect(allergy).toContain('SoftDeletes');
    expect(allergy).toContain('Illuminate\\Database\\Eloquent\\SoftDeletes');
  });
});

// ── Status transition enforcement ─────────────────────────────────────────────

describe('Application status — transitions are backend-validated', () => {
  const appStatus = readBackend('app/Enums/ApplicationStatus.php');
  const appService = readBackend('app/Services/Camper/ApplicationService.php');

  test('ApplicationStatus enum has canTransitionTo method', () => {
    expect(appStatus).toContain('canTransitionTo');
  });

  test('ApplicationService enforces valid transitions before changing status', () => {
    expect(appService).toContain('canTransitionTo');
  });
});
