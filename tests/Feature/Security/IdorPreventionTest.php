<?php

namespace Tests\Feature\Security;

use App\Models\Application;
use App\Models\Camper;
use App\Models\MedicalRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for Insecure Direct Object Reference (IDOR) prevention.
 *
 * Verifies that users cannot access resources belonging to other users
 * by manipulating IDs in requests.
 */
class IdorPreventionTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_parent_cannot_view_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        // Parent1 tries to access Parent2's camper
        $response = $this->actingAs($parent1)->getJson("/api/campers/{$camper2->id}");

        $response->assertStatus(403);
    }

    public function test_parent_cannot_update_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        // Parent1 tries to update Parent2's camper
        $response = $this->actingAs($parent1)->putJson("/api/campers/{$camper2->id}", [
            'first_name' => 'Hacked',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_cannot_delete_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        // Parent1 tries to delete Parent2's camper
        $response = $this->actingAs($parent1)->deleteJson("/api/campers/{$camper2->id}");

        $response->assertStatus(403);
    }

    public function test_parent_cannot_view_other_parents_application(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        $application1 = Application::factory()->create(['camper_id' => $camper1->id]);
        $application2 = Application::factory()->create(['camper_id' => $camper2->id]);

        // Parent1 tries to access Parent2's application
        $response = $this->actingAs($parent1)->getJson("/api/applications/{$application2->id}");

        $response->assertStatus(403);
    }

    public function test_parent_cannot_update_other_parents_application(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        $application1 = Application::factory()->create(['camper_id' => $camper1->id]);
        $application2 = Application::factory()->create(['camper_id' => $camper2->id]);

        // Parent1 tries to update Parent2's application
        $response = $this->actingAs($parent1)->putJson("/api/applications/{$application2->id}", [
            'notes' => 'Hacked',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_cannot_view_other_parents_medical_record(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        $medicalRecord1 = MedicalRecord::factory()->create(['camper_id' => $camper1->id]);
        $medicalRecord2 = MedicalRecord::factory()->create(['camper_id' => $camper2->id]);

        // Parent1 tries to access Parent2's medical record
        $response = $this->actingAs($parent1)->getJson("/api/medical-records/{$medicalRecord2->id}");

        $response->assertStatus(403);
    }

    public function test_parent_cannot_update_other_parents_medical_record(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        $medicalRecord1 = MedicalRecord::factory()->create(['camper_id' => $camper1->id]);
        $medicalRecord2 = MedicalRecord::factory()->create(['camper_id' => $camper2->id]);

        // Parent1 tries to update Parent2's medical record
        $response = $this->actingAs($parent1)->putJson("/api/medical-records/{$medicalRecord2->id}", [
            'physician_name' => 'Hacked',
        ]);

        $response->assertStatus(403);
    }

    public function test_medical_provider_can_access_any_medical_record(): void
    {
        // Phase 6: provider link gates were removed. Medical providers now have
        // direct read/update access to all camper medical records for active clinical care.
        $provider = $this->createMedicalProvider();
        $parent = $this->createParent();

        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => true]);
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($provider)->getJson("/api/medical-records/{$medicalRecord->id}");

        $response->assertOk();
    }

    public function test_parent_cannot_create_application_for_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Parent1 tries to create application for Parent2's camper
        $response = $this->actingAs($parent1)->postJson('/api/applications', [
            'camper_id' => $camper2->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_cannot_create_medical_record_for_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();

        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);

        // Parent1 tries to create medical record for Parent2's camper
        $response = $this->actingAs($parent1)->postJson('/api/medical-records', [
            'camper_id' => $camper2->id,
            'physician_name' => 'Dr. Test',
            'physician_phone' => '555-1234',
        ]);

        $response->assertStatus(403);
    }

    public function test_sequential_id_enumeration_prevented(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        // Try to enumerate IDs by incrementing
        $forbiddenCount = 0;
        for ($id = $camper->id + 1; $id <= $camper->id + 10; $id++) {
            $response = $this->actingAs($parent)->getJson("/api/campers/{$id}");
            if ($response->status() === 403 || $response->status() === 404) {
                $forbiddenCount++;
            }
        }

        // All enumeration attempts should be blocked
        $this->assertEquals(10, $forbiddenCount);
    }
}
