<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\DocumentVerificationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Document;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature tests for application approval document enforcement.
 *
 * Verifies that the document enforcement layer prevents approval
 * of applications without complete, verified medical documentation.
 */
class ApplicationApprovalEnforcementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Camper $camper;
    protected Application $application;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);

        // Create roles
        $adminRole = Role::create(['name' => 'admin', 'description' => 'Administrator']);
        $parentRole = Role::create(['name' => 'applicant', 'description' => 'Parent/Guardian']);

        // Create users with roles
        $this->admin = User::factory()->create(['role_id' => $adminRole->id, 'mfa_enabled' => true]);
        $this->grantMfaStepUp($this->admin);
        $parent = User::factory()->create(['role_id' => $parentRole->id]);

        $this->camper = Camper::factory()->for($parent)->create();
        $this->camper->medicalRecord()->create([]);

        $session = CampSession::factory()->create();
        $this->application = Application::factory()
            ->for($this->camper)
            ->for($session, 'campSession')
            ->create([
                'status' => ApplicationStatus::Submitted,
                'is_draft' => false,
                'submitted_at' => now(),
            ]);
    }

    public function test_approval_blocked_when_required_documents_missing(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Approved->value,
                'notes' => 'Approving application',
            ]);

        $response->assertStatus(422);
        $response->assertJsonStructure([
            'message',
            'errors',
            'compliance_details' => [
                'missing_documents',
                'expired_documents',
                'unverified_documents',
            ],
        ]);

        // Verify application was NOT approved
        $this->application->refresh();
        $this->assertEquals(ApplicationStatus::Submitted, $this->application->status);
    }

    public function test_approval_blocked_when_documents_unverified(): void
    {
        // Upload required document but don't verify it
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->camper->user_id,
            'original_filename' => 'medical_form.pdf',
            'stored_filename' => 'stored_medical_form.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'official_medical_form',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Pending,
        ]);

        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->camper->user_id,
            'original_filename' => 'immunization.pdf',
            'stored_filename' => 'stored_immunization.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'immunization_record',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Pending,
        ]);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Approved->value,
                'notes' => 'Approving application',
            ]);

        $response->assertStatus(422);
        $response->assertJson([
            'message' => 'Application cannot be approved due to incomplete medical documentation.',
        ]);

        $this->application->refresh();
        $this->assertEquals(ApplicationStatus::Submitted, $this->application->status);
    }

    public function test_approval_blocked_when_documents_expired(): void
    {
        // Upload expired document; submitted_at required so enforcement service sees it
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->camper->user_id,
            'original_filename' => 'medical_form.pdf',
            'stored_filename' => 'stored_medical_form.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'official_medical_form',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Approved,
            'expiration_date' => now()->subDay(),
            'submitted_at' => now(),
        ]);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Approved->value,
                'notes' => 'Approving application',
            ]);

        $response->assertStatus(422);
        $response->assertJsonPath('compliance_details.expired_documents', function ($expired) {
            return count($expired) > 0;
        });

        $this->application->refresh();
        $this->assertEquals(ApplicationStatus::Submitted, $this->application->status);
    }

    public function test_approval_succeeds_when_all_documents_valid(): void
    {
        // Upload and verify all three universal required documents; submitted_at required so enforcement sees them
        foreach ([
            ['official_medical_form', 'medical_form.pdf', 'stored_medical_form.pdf'],
            ['immunization_record',   'immunization.pdf', 'stored_immunization.pdf'],
            ['insurance_card',        'insurance.pdf',    'stored_insurance.pdf'],
        ] as [$type, $orig, $stored]) {
            Document::create([
                'documentable_type' => Camper::class,
                'documentable_id' => $this->camper->id,
                'uploaded_by' => $this->camper->user_id,
                'original_filename' => $orig,
                'stored_filename' => $stored,
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
                'disk' => 'local',
                'path' => '/test/path',
                'document_type' => $type,
                'is_scanned' => true,
                'scan_passed' => true,
                'verification_status' => DocumentVerificationStatus::Approved,
                'submitted_at' => now(),
            ]);
        }

        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Approved->value,
                'notes' => 'All documents verified, approving',
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'message' => 'Application reviewed successfully.',
        ]);

        $this->application->refresh();
        $this->assertEquals(ApplicationStatus::Approved, $this->application->status);
        $this->assertNotNull($this->application->reviewed_at);
        $this->assertEquals($this->admin->id, $this->application->reviewed_by);
    }

    public function test_rejection_not_blocked_by_missing_documents(): void
    {
        // Rejections should NOT be blocked by document compliance
        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Rejected->value,
                'notes' => 'Rejecting due to capacity',
            ]);

        $response->assertStatus(200);

        $this->application->refresh();
        $this->assertEquals(ApplicationStatus::Rejected, $this->application->status);
    }

    /**
     * Regression: official_medical_form uploaded to Camper must NOT appear in missing_documents.
     * It will appear in unverified_documents (pending review) but must not be "missing".
     * This guards against the DocumentEnforcementService using a stale document_type key
     * that doesn't match what the Official Forms page actually stores.
     */
    public function test_completeness_check_recognises_official_medical_form_on_camper(): void
    {
        // Upload official_medical_form attached to the Camper (matching what the Official Forms page does).
        // submitted_at required so enforcement service sees it.
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $this->camper->id,
            'uploaded_by' => $this->camper->user_id,
            'original_filename' => 'medical_form.pdf',
            'stored_filename' => 'stored_medical_form.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'disk' => 'local',
            'path' => '/test/path',
            'document_type' => 'official_medical_form',
            'is_scanned' => true,
            'scan_passed' => true,
            'verification_status' => DocumentVerificationStatus::Pending,
            'submitted_at' => now(),
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/applications/{$this->application->id}/completeness");

        $response->assertStatus(200);

        $data = $response->json('data');

        // The medical form must NOT appear in missing_documents — it was uploaded.
        // (It will appear in unverified_documents since verification_status is Pending.)
        $missingDocKeys = collect($data['missing_documents'])->pluck('key')->all();
        $this->assertNotContains('doc_official_medical_form', $missingDocKeys, 'official_medical_form uploaded to Camper must not appear in missing_documents');

        // The uploaded-but-unverified document IS expected in unverified_documents.
        $this->assertArrayHasKey('unverified_documents', $data);
    }

    /**
     * Regression: unverified_documents must be returned as a separate field from
     * missing_documents. Uploaded files that have not been verified by an admin are
     * a different state than files that were never submitted.
     */
    public function test_completeness_check_separates_unverified_from_missing(): void
    {
        // Upload all three universal required documents, all pending verification.
        // submitted_at required so enforcement service sees them.
        foreach (['official_medical_form', 'immunization_record', 'insurance_card'] as $type) {
            Document::create([
                'documentable_type' => Camper::class,
                'documentable_id' => $this->camper->id,
                'uploaded_by' => $this->camper->user_id,
                'original_filename' => "{$type}.pdf",
                'stored_filename' => "stored_{$type}.pdf",
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
                'disk' => 'local',
                'path' => '/test/path',
                'document_type' => $type,
                'is_scanned' => true,
                'scan_passed' => true,
                'verification_status' => DocumentVerificationStatus::Pending,
                'submitted_at' => now(),
            ]);
        }

        $response = $this->actingAs($this->admin)
            ->getJson("/api/applications/{$this->application->id}/completeness");

        $response->assertStatus(200);
        $data = $response->json('data');

        // Both fields must be present in the response.
        $this->assertArrayHasKey('missing_documents', $data);
        $this->assertArrayHasKey('unverified_documents', $data);

        // Universal documents were uploaded — must NOT appear as missing.
        $missingDocKeys = collect($data['missing_documents'])->pluck('key')->all();
        $this->assertNotContains('doc_official_medical_form', $missingDocKeys);
        $this->assertNotContains('doc_immunization_record', $missingDocKeys);
        $this->assertNotContains('doc_insurance_card', $missingDocKeys);

        // Unverified documents should list the two pending uploads.
        $unverifiedKeys = collect($data['unverified_documents'])->pluck('key')->all();
        $this->assertNotEmpty($unverifiedKeys, 'Pending documents must appear in unverified_documents');
    }

    /**
     * Confirms that a fully complete application (fields, consents, docs all present
     * and verified) returns is_complete = true with empty unverified_documents.
     */
    public function test_completeness_check_is_true_when_all_documents_verified(): void
    {
        // Add required camper fields and consents.
        $this->camper->update([
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'date_of_birth' => '2010-06-15',
            'gender' => 'Female',
            'tshirt_size' => 'M',
            'county' => 'Richland',
        ]);
        $this->application->update([
            'signed_at' => now(),
            'signature_name' => 'Parent Name',
        ]);
        $this->camper->emergencyContacts()->create([
            'name' => 'Guardian', 'relationship' => 'Parent', 'phone_primary' => '555-0100',
        ]);
        foreach (['general', 'photos', 'liability', 'activity', 'authorization'] as $type) {
            $this->application->consents()->create([
                'consent_type' => $type,
                'guardian_name' => 'Parent Name',
                'guardian_relationship' => 'Parent',
                'guardian_signature' => 'signature',
                'signed_at' => now(),
            ]);
        }

        // Upload and verify all three universal required documents.
        // submitted_at required so enforcement service sees them.
        foreach (['official_medical_form', 'immunization_record', 'insurance_card'] as $type) {
            Document::create([
                'documentable_type' => Camper::class,
                'documentable_id' => $this->camper->id,
                'uploaded_by' => $this->camper->user_id,
                'original_filename' => "{$type}.pdf",
                'stored_filename' => "stored_{$type}.pdf",
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
                'disk' => 'local',
                'path' => '/test/path',
                'document_type' => $type,
                'is_scanned' => true,
                'scan_passed' => true,
                'verification_status' => DocumentVerificationStatus::Approved,
                'submitted_at' => now(),
            ]);
        }

        $response = $this->actingAs($this->admin)
            ->getJson("/api/applications/{$this->application->id}/completeness");

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertTrue($data['is_complete'], 'Application with all required data and verified docs must be complete');
        $this->assertEmpty($data['missing_documents']);
        $this->assertEmpty($data['unverified_documents']);
    }

    public function test_high_complexity_camper_requires_additional_documents(): void
    {
        // Create high complexity camper
        $this->camper->medicalRecord()->update([
            'has_seizures' => true,
        ]);
        $this->camper->feedingPlan()->create([
            'g_tube' => true,
            'formula' => 'Test',
            'amount_per_feeding' => '200ml',
            'feedings_per_day' => 4,
        ]);
        $this->camper->behavioralProfile()->create([
            'wandering_risk' => true,
            'one_to_one_supervision' => true,
        ]);

        // Upload only the universal documents (missing condition-specific required docs)
        foreach ([
            ['official_medical_form', 'medical_form.pdf', 'stored_medical_form.pdf'],
            ['immunization_record',   'immunization.pdf', 'stored_immunization.pdf'],
            ['insurance_card',        'insurance.pdf',    'stored_insurance.pdf'],
        ] as [$type, $orig, $stored]) {
            Document::create([
                'documentable_type' => Camper::class,
                'documentable_id' => $this->camper->id,
                'uploaded_by' => $this->camper->user_id,
                'original_filename' => $orig,
                'stored_filename' => $stored,
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
                'disk' => 'local',
                'path' => '/test/path',
                'document_type' => $type,
                'is_scanned' => true,
                'scan_passed' => true,
                'verification_status' => DocumentVerificationStatus::Approved,
            ]);
        }

        $response = $this->actingAs($this->admin)
            ->postJson("/api/applications/{$this->application->id}/review", [
                'status' => ApplicationStatus::Approved->value,
                'notes' => 'Approving',
            ]);

        $response->assertStatus(422);

        // Should require seizure, feeding, behavioral, and high-complexity documents
        $missingTypes = collect($response->json('compliance_details.missing_documents'))
            ->pluck('document_type');

        $this->assertContains('seizure_action_plan', $missingTypes);
        $this->assertContains('feeding_action_plan', $missingTypes);
        $this->assertContains('behavioral_support_plan', $missingTypes);
        $this->assertContains('physician_clearance', $missingTypes);
    }
}
