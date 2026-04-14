<?php

namespace Tests\Feature;

use App\Enums\DocumentVerificationStatus;
use App\Models\Camper;
use App\Models\Document;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature tests for camper compliance status endpoint.
 *
 * Verifies authorization and response structure for the compliance
 * endpoint that shows document requirements and status.
 */
class CamperComplianceEndpointTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(\Database\Seeders\RequiredDocumentRuleSeeder::class);
    }

    protected function createUserWithRole(string $roleName): User
    {
        $role = Role::firstOrCreate(
            ['name' => $roleName],
            ['description' => ucfirst($roleName)]
        );

        return User::factory()->create(['role_id' => $role->id]);
    }

    public function test_parent_can_view_own_camper_compliance_status(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'is_compliant',
                'required_documents',
                'missing_documents',
                'expired_documents',
                'unverified_documents',
            ],
        ]);
    }

    public function test_parent_cannot_view_other_camper_compliance_status(): void
    {
        $parent1 = $this->createUserWithRole('applicant');
        $parent2 = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent2)->create();

        $response = $this->actingAs($parent1)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(403);
    }

    public function test_admin_can_view_any_camper_compliance_status(): void
    {
        $admin = $this->createUserWithRole('admin');
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        $response = $this->actingAs($admin)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
    }

    public function test_unauthenticated_user_cannot_access_compliance_status(): void
    {
        $camper = Camper::factory()->create();

        $response = $this->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(401);
    }

    public function test_compliance_status_shows_missing_documents(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
        $response->assertJson([
            'data' => [
                'is_compliant' => false,
            ],
        ]);

        $missing = $response->json('data.missing_documents');
        $this->assertNotEmpty($missing);

        // Should have all three missing universal documents
        $types = collect($missing)->pluck('document_type');
        $this->assertContains('official_medical_form', $types);
        $this->assertContains('immunization_record', $types);
        $this->assertContains('insurance_card', $types);
    }

    public function test_compliance_status_shows_unverified_documents(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        // Upload document but leave unverified; must be submitted so enforcement service sees it
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'uploaded_by' => $parent->id,
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

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
        $response->assertJson([
            'data' => [
                'is_compliant' => false,
            ],
        ]);

        $unverified = $response->json('data.unverified_documents');
        $this->assertNotEmpty($unverified);
        $this->assertEquals('official_medical_form', $unverified[0]['document_type']);
        $this->assertEquals('pending', $unverified[0]['verification_status']);
    }

    public function test_compliance_status_shows_expired_documents(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        // Upload expired document; must be submitted so enforcement service sees it
        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'uploaded_by' => $parent->id,
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

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
        $response->assertJson([
            'data' => [
                'is_compliant' => false,
            ],
        ]);

        $expired = $response->json('data.expired_documents');
        $this->assertNotEmpty($expired);
        $this->assertEquals('official_medical_form', $expired[0]['document_type']);
    }

    public function test_compliance_status_shows_compliant_when_all_valid(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([]);

        // Upload all three universal required documents; must be submitted so enforcement sees them
        foreach ([
            ['official_medical_form', 'medical_form.pdf', 'stored_medical_form.pdf'],
            ['immunization_record',   'immunization.pdf', 'stored_immunization.pdf'],
            ['insurance_card',        'insurance.pdf',    'stored_insurance.pdf'],
        ] as [$type, $orig, $stored]) {
            Document::create([
                'documentable_type' => Camper::class,
                'documentable_id' => $camper->id,
                'uploaded_by' => $parent->id,
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

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);
        $response->assertJson([
            'data' => [
                'is_compliant' => true,
                'missing_documents' => [],
                'expired_documents' => [],
                'unverified_documents' => [],
            ],
        ]);
    }

    public function test_compliance_response_contains_no_phi(): void
    {
        $parent = $this->createUserWithRole('applicant');
        $camper = Camper::factory()->for($parent)->create();
        $camper->medicalRecord()->create([
            'has_seizures' => true,
            'seizure_description' => 'SENSITIVE PHI DATA',
        ]);

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/compliance-status");

        $response->assertStatus(200);

        // Response should contain document type codes but no PHI
        $content = $response->getContent();
        $this->assertStringNotContainsString('SENSITIVE PHI DATA', $content);
        $this->assertStringNotContainsString('seizure_description', $content);
    }
}
