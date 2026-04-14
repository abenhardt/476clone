<?php

namespace Tests\Unit\Services;

use App\Enums\DocumentVerificationStatus;
use App\Enums\SupervisionLevel;
use App\Models\Camper;
use App\Models\Document;
use App\Services\Document\DocumentEnforcementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Unit tests for DocumentEnforcementService.
 *
 * Tests the document compliance enforcement logic that prevents
 * application approval without required medical documentation.
 */
class DocumentEnforcementServiceTest extends TestCase
{
    use RefreshDatabase;

    protected DocumentEnforcementService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);
        $this->service = app(DocumentEnforcementService::class);
    }

    public function test_camper_with_no_conditions_requires_universal_documents(): void
    {
        // Create camper with no medical conditions
        $camper = Camper::factory()->create();

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);
        $this->assertNotEmpty($compliance['required_documents']);

        // Should require all three universal documents: medical exam form, immunization, insurance
        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');
        $this->assertContains('official_medical_form', $requiredTypes);
        $this->assertContains('immunization_record', $requiredTypes);
        $this->assertContains('insurance_card', $requiredTypes);
    }

    public function test_camper_with_seizures_requires_seizure_documents(): void
    {
        $camper = Camper::factory()->create();
        $camper->medicalRecord()->create([
            'has_seizures' => true,
            'seizure_description' => 'Test seizure description',
        ]);

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);

        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');
        $this->assertContains('seizure_action_plan', $requiredTypes);
        $this->assertContains('seizure_medication_authorization', $requiredTypes);
    }

    public function test_camper_with_g_tube_requires_feeding_documents(): void
    {
        $camper = Camper::factory()->create();
        $camper->feedingPlan()->create([
            'g_tube' => true,
            'formula' => 'Test formula',
            'amount_per_feeding' => '200ml',
            'feedings_per_day' => 4,
        ]);

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);

        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');
        $this->assertContains('feeding_action_plan', $requiredTypes);
        $this->assertContains('feeding_equipment_list', $requiredTypes);
    }

    public function test_camper_with_one_to_one_supervision_requires_behavioral_documents(): void
    {
        $camper = Camper::factory()->create();

        // Create conditions that result in OneToOne supervision (score > 41)
        // Seizures (20) + G-tube (20) + Wandering (15) = 55 points
        $camper->medicalRecord()->create([
            'has_seizures' => true,
        ]);
        $camper->feedingPlan()->create([
            'g_tube' => true,
            'formula' => 'Test formula',
            'amount_per_feeding' => '200ml',
            'feedings_per_day' => 4,
        ]);
        $camper->behavioralProfile()->create([
            'wandering_risk' => true,
        ]);

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);

        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');
        $this->assertContains('behavioral_support_plan', $requiredTypes);
        $this->assertContains('staffing_accommodation_request', $requiredTypes);
    }

    public function test_camper_with_high_complexity_requires_additional_documents(): void
    {
        $camper = Camper::factory()->create([
            'supervision_level' => SupervisionLevel::OneToOne,
        ]);

        // Force high complexity by creating multiple risk factors
        $camper->medicalRecord()->create(['has_seizures' => true]);
        $camper->feedingPlan()->create([
            'g_tube' => true,
            'formula' => 'Test',
            'amount_per_feeding' => '200ml',
            'feedings_per_day' => 4,
        ]);
        $camper->behavioralProfile()->create([
            'wandering_risk' => true,
            'one_to_one_supervision' => true,
        ]);

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);

        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');
        // High complexity tier requires these documents
        $this->assertContains('medical_management_plan', $requiredTypes);
        $this->assertContains('physician_clearance', $requiredTypes);
        $this->assertContains('emergency_protocol', $requiredTypes);
    }

    public function test_camper_is_compliant_when_all_documents_uploaded_and_verified(): void
    {
        $camper = Camper::factory()->create();
        $camper->medicalRecord()->create([]);

        // Get required documents
        $compliance = $this->service->checkCompliance($camper);
        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');

        // Upload and verify all required documents; submitted_at required so enforcement sees them
        foreach ($requiredTypes as $docType) {
            Document::create([
                'documentable_type' => Camper::class,
                'documentable_id' => $camper->id,
                'uploaded_by' => $camper->user_id,
                'original_filename' => "test_{$docType}.pdf",
                'stored_filename' => "stored_{$docType}.pdf",
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
                'disk' => 'local',
                'path' => '/test/path',
                'document_type' => $docType,
                'is_scanned' => true,
                'scan_passed' => true,
                'verification_status' => DocumentVerificationStatus::Approved,
                'submitted_at' => now(),
            ]);
        }

        $compliance = $this->service->checkCompliance($camper);

        $this->assertTrue($compliance['is_compliant']);
        $this->assertEmpty($compliance['missing_documents']);
        $this->assertEmpty($compliance['expired_documents']);
        $this->assertEmpty($compliance['unverified_documents']);
    }

    public function test_camper_not_compliant_with_unverified_documents(): void
    {
        $camper = Camper::factory()->create();

        // Upload document but leave it unverified; submitted_at required so enforcement sees it
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'uploaded_by' => $camper->user_id,
            'original_filename' => 'test.pdf',
            'stored_filename' => 'stored.pdf',
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

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);
        $this->assertNotEmpty($compliance['unverified_documents']);
    }

    public function test_camper_not_compliant_with_expired_documents(): void
    {
        $camper = Camper::factory()->create();

        // Upload expired document; submitted_at required so enforcement service sees it
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'uploaded_by' => $camper->user_id,
            'original_filename' => 'test.pdf',
            'stored_filename' => 'stored.pdf',
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

        $compliance = $this->service->checkCompliance($camper);

        $this->assertFalse($compliance['is_compliant']);
        $this->assertNotEmpty($compliance['expired_documents']);
    }

    public function test_service_returns_structured_compliance_data_without_phi(): void
    {
        $camper = Camper::factory()->create();

        $compliance = $this->service->checkCompliance($camper);

        // Verify structure
        $this->assertArrayHasKey('is_compliant', $compliance);
        $this->assertArrayHasKey('required_documents', $compliance);
        $this->assertArrayHasKey('missing_documents', $compliance);
        $this->assertArrayHasKey('expired_documents', $compliance);
        $this->assertArrayHasKey('unverified_documents', $compliance);

        // Verify no PHI in response
        $json = json_encode($compliance);
        $this->assertStringNotContainsStringIgnoringCase('seizure', $json);
        $this->assertStringNotContainsStringIgnoringCase('medication', $json);
        $this->assertStringNotContainsStringIgnoringCase('diagnosis', $json);
    }

    public function test_multiple_condition_flags_compound_requirements(): void
    {
        $camper = Camper::factory()->create();
        $camper->medicalRecord()->create([
            'has_seizures' => true,
            'has_neurostimulator' => true,
        ]);
        $camper->behavioralProfile()->create([
            'wandering_risk' => true,
            'aggression' => true,
        ]);

        $compliance = $this->service->checkCompliance($camper);

        $requiredTypes = collect($compliance['required_documents'])->pluck('document_type');

        // Should require documents for ALL flags
        $this->assertContains('seizure_action_plan', $requiredTypes);
        $this->assertContains('device_management_plan', $requiredTypes);
        $this->assertContains('elopement_prevention_plan', $requiredTypes);
        $this->assertContains('crisis_intervention_plan', $requiredTypes);
    }
}
