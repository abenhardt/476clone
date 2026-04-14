<?php

namespace Tests\Feature\Security;

use App\Models\AuditLog;
use App\Models\Camper;
use App\Models\MedicalRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for PHI access auditing.
 *
 * Verifies that all accesses to Protected Health Information are logged
 * for HIPAA compliance.
 */
class PhiAuditingTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_medical_record_access_is_audited(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        // Access medical record
        $response = $this->actingAs($admin)->getJson("/api/medical-records/{$medicalRecord->id}");

        $response->assertStatus(200);

        // Verify audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'view',
        ]);

        $auditLog = AuditLog::where('user_id', $admin->id)->first();
        $this->assertNotNull($auditLog);
        $this->assertNotNull($auditLog->request_id);
        $this->assertNotNull($auditLog->ip_address);
    }

    public function test_application_access_is_audited(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $application = \App\Models\Application::factory()->create(['camper_id' => $camper->id]);

        // Access application
        $response = $this->actingAs($admin)->getJson("/api/applications/{$application->id}");

        $response->assertStatus(200);

        // Verify audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'view',
        ]);
    }

    public function test_camper_access_is_audited(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();

        // Access camper
        $response = $this->actingAs($admin)->getJson("/api/campers/{$camper->id}");

        $response->assertStatus(200);

        // Verify audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'view',
        ]);
    }

    public function test_medical_record_update_is_audited(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        // Update medical record
        $response = $this->actingAs($admin)->putJson("/api/medical-records/{$medicalRecord->id}", [
            'physician_name' => 'Dr. Updated',
            'physician_phone' => '555-9999',
        ]);

        $response->assertStatus(200);

        // Verify audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'update',
        ]);
    }

    public function test_medical_record_creation_is_audited(): void
    {
        // Medical record creation is admin-only (created at application approval time).
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        // Create medical record as admin
        $response = $this->actingAs($admin)->postJson('/api/medical-records', [
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Test',
            'physician_phone' => '555-1234',
        ]);

        $response->assertStatus(201);

        // Verify audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'create',
        ]);
    }

    public function test_audit_log_includes_request_correlation_id(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        $requestId = 'test-request-id-12345';

        // Access medical record with custom request ID
        $response = $this->actingAs($admin)->getJson(
            "/api/medical-records/{$medicalRecord->id}",
            ['X-Request-ID' => $requestId]
        );

        $response->assertStatus(200);
        $response->assertHeader('X-Request-ID', $requestId);

        // Verify audit log includes the request ID
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'request_id' => $requestId,
        ]);
    }

    public function test_audit_log_includes_ip_address_and_user_agent(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        // Access medical record
        $response = $this->actingAs($admin)->getJson(
            "/api/medical-records/{$medicalRecord->id}",
            ['HTTP_USER_AGENT' => 'TestAgent/1.0']
        );

        $response->assertStatus(200);

        // Verify audit log includes IP and user agent
        $auditLog = AuditLog::where('user_id', $admin->id)->first();
        $this->assertNotNull($auditLog->ip_address);
        $this->assertEquals('TestAgent/1.0', $auditLog->user_agent);
    }

    public function test_only_successful_phi_access_is_audited(): void
    {
        $parent = $this->createParent();
        $otherCamper = Camper::factory()->create(['user_id' => User::factory()->create()->id]);
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $otherCamper->id]);

        $initialAuditCount = AuditLog::count();

        // Try to access unauthorized medical record (should fail)
        $response = $this->actingAs($parent)->getJson("/api/medical-records/{$medicalRecord->id}");

        $response->assertStatus(403);

        // Verify NO audit log was created (access denied)
        $this->assertEquals($initialAuditCount, AuditLog::count());
    }

    public function test_document_metadata_view_is_audited(): void
    {
        // Accessing document metadata (including the decrypted original_filename
        // which can contain PHI) must be logged even without downloading the file.
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();

        \Illuminate\Support\Facades\Storage::fake('local');

        $document = \App\Models\Document::factory()->create([
            'uploaded_by' => $admin->id,
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'disk' => 'local',
            'path' => 'private/documents/test.pdf',
            'stored_filename' => 'test.pdf',
            'original_filename' => 'camper_medical.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => \App\Enums\DocumentVerificationStatus::Approved,
        ]);

        $initialCount = \App\Models\AuditLog::count();

        $response = $this->actingAs($admin)->getJson("/api/documents/{$document->id}");

        $response->assertStatus(200);

        // A PHI access audit entry must be created for the metadata view.
        $this->assertGreaterThan($initialCount, \App\Models\AuditLog::count());
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'document_view',
        ]);
    }

    public function test_report_export_is_audited(): void
    {
        // CSV exports of PII/PHI data must be audit-logged so administrators
        // can trace bulk data extractions under HIPAA §164.312(b).
        $admin = $this->createAdmin();

        $initialCount = \App\Models\AuditLog::count();

        $response = $this->actingAs($admin)->getJson('/api/reports/applications');

        $response->assertStatus(200);

        // An admin action audit entry must be created for the export.
        $this->assertGreaterThan($initialCount, \App\Models\AuditLog::count());
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'report_export_applications',
        ]);
    }

    public function test_audit_logs_are_immutable(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        // Access medical record to create audit log
        $this->actingAs($admin)->getJson("/api/medical-records/{$medicalRecord->id}");

        $auditLog = AuditLog::where('user_id', $admin->id)->first();

        // Audit log model should not have timestamps for updates
        $this->assertNull($auditLog->updated_at);
    }
}
