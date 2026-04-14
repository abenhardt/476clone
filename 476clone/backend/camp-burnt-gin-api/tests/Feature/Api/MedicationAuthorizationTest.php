<?php

namespace Tests\Feature\Api;

use App\Models\Camper;
use App\Models\Medication;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for Medication resource authorization.
 *
 * Verifies access control for medication information with medical
 * providers having create/update access for care documentation.
 */
class MedicationAuthorizationTest extends TestCase
{
    use RefreshDatabase;
    use WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    /*
    |--------------------------------------------------------------------------
    | Authentication Tests
    |--------------------------------------------------------------------------
    */

    public function test_unauthenticated_user_cannot_access_medications(): void
    {
        $response = $this->getJson('/api/medications');

        $response->assertStatus(401);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin Access Tests
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_view_all_medications(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        Medication::factory()->count(3)->forCamper($camper)->create();

        $response = $this->actingAs($admin)->getJson('/api/medications');

        $response->assertStatus(200)
            ->assertJsonCount(3, 'data');
    }

    public function test_admin_can_create_medication(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($admin)->postJson('/api/medications', [
            'camper_id' => $camper->id,
            'name' => 'Ibuprofen',
            'dosage' => '200mg',
            'frequency' => 'Every 6 hours',
        ]);

        $response->assertStatus(201);
    }

    public function test_admin_can_update_medication(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $medication = Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($admin)->putJson("/api/medications/{$medication->id}", [
            'dosage' => '400mg',
        ]);

        $response->assertStatus(200);
    }

    public function test_admin_can_delete_medication(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $medication = Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($admin)->deleteJson("/api/medications/{$medication->id}");

        $response->assertStatus(200);
    }

    /*
    |--------------------------------------------------------------------------
    | Medical Provider Access Tests
    |--------------------------------------------------------------------------
    */

    public function test_medical_provider_can_view_all_medications(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        Medication::factory()->count(2)->forCamper($camper)->create();

        $response = $this->actingAs($medical)->getJson('/api/medications');

        $response->assertStatus(200)
            ->assertJsonCount(2, 'data');
    }

    public function test_medical_provider_can_view_medication(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create(['is_active' => true]);
        $medication = Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->getJson("/api/medications/{$medication->id}");

        $response->assertStatus(200);
    }

    public function test_medical_provider_can_create_medication(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($medical)->postJson('/api/medications', [
            'camper_id' => $camper->id,
            'name' => 'Acetaminophen',
            'dosage' => '500mg',
            'frequency' => 'As needed',
        ]);

        $response->assertStatus(201);
    }

    public function test_medical_provider_can_update_medication(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create(['is_active' => true]);
        $medication = Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->putJson("/api/medications/{$medication->id}", [
            'notes' => 'Updated by medical staff',
        ]);

        $response->assertStatus(200);
    }

    public function test_medical_provider_cannot_delete_medication(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $medication = Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->deleteJson("/api/medications/{$medication->id}");

        $response->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Parent Ownership Tests
    |--------------------------------------------------------------------------
    */

    public function test_parent_cannot_view_medications_list(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->getJson('/api/medications');

        $response->assertStatus(403);
    }

    public function test_parent_can_view_own_campers_medication(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $medication = Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->getJson("/api/medications/{$medication->id}");

        $response->assertStatus(200);
    }

    public function test_parent_cannot_view_other_campers_medication(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $medication = Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent1)->getJson("/api/medications/{$medication->id}");

        $response->assertStatus(403);
    }

    public function test_parent_can_create_medication_for_own_camper(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/medications', [
            'camper_id' => $camper->id,
            'name' => 'Allergy Medicine',
            'dosage' => '10mg',
            'frequency' => 'Once daily',
        ]);

        $response->assertStatus(201);
    }

    public function test_parent_cannot_create_medication_for_other_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();

        $response = $this->actingAs($parent1)->postJson('/api/medications', [
            'camper_id' => $camper->id,
            'name' => 'Allergy Medicine',
            'dosage' => '10mg',
            'frequency' => 'Once daily',
        ]);

        $response->assertStatus(422);
    }

    public function test_parent_can_update_own_campers_medication(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $medication = Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->putJson("/api/medications/{$medication->id}", [
            'dosage' => '15mg',
        ]);

        $response->assertStatus(200);
    }

    public function test_parent_cannot_update_other_campers_medication(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $medication = Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent1)->putJson("/api/medications/{$medication->id}", [
            'dosage' => 'Hacked',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_can_delete_own_campers_medication(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $medication = Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->deleteJson("/api/medications/{$medication->id}");

        $response->assertStatus(200);
    }

    public function test_parent_cannot_delete_other_campers_medication(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $medication = Medication::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent1)->deleteJson("/api/medications/{$medication->id}");

        $response->assertStatus(403);
    }
}
