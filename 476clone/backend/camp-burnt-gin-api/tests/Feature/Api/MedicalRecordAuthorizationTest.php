<?php

namespace Tests\Feature\Api;

use App\Models\Camper;
use App\Models\MedicalRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for MedicalRecord resource authorization.
 *
 * Verifies HIPAA-compliant access control for medical records
 * based on user roles and ownership.
 */
class MedicalRecordAuthorizationTest extends TestCase
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

    public function test_unauthenticated_user_cannot_access_medical_records(): void
    {
        $response = $this->getJson('/api/medical-records');

        $response->assertStatus(401);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin Access Tests
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_view_all_medical_records(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create(['is_active' => true]);
        MedicalRecord::factory()->forCamper($camper)->create(['is_active' => true]);

        $response = $this->actingAs($admin)->getJson('/api/medical-records');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }

    public function test_admin_can_view_any_medical_record(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $record = MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($admin)->getJson("/api/medical-records/{$record->id}");

        $response->assertStatus(200);
    }

    public function test_admin_can_create_medical_record(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($admin)->postJson('/api/medical-records', [
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Test',
            'physician_phone' => '555-1234',
        ]);

        $response->assertStatus(201);
    }

    public function test_admin_can_update_any_medical_record(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $record = MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($admin)->putJson("/api/medical-records/{$record->id}", [
            'physician_name' => 'Dr. Updated',
        ]);

        $response->assertStatus(200);
    }

    public function test_admin_can_delete_medical_record(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $record = MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($admin)->deleteJson("/api/medical-records/{$record->id}");

        $response->assertStatus(200);
    }

    /*
    |--------------------------------------------------------------------------
    | Medical Provider Access Tests
    |--------------------------------------------------------------------------
    */

    public function test_medical_provider_can_view_all_medical_records(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create(['is_active' => true]);
        MedicalRecord::factory()->forCamper($camper)->create(['is_active' => true]);

        $response = $this->actingAs($medical)->getJson('/api/medical-records');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }

    public function test_medical_provider_can_view_any_medical_record(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create(['is_active' => true]);
        $record = MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->getJson("/api/medical-records/{$record->id}");

        $response->assertStatus(200);
    }

    public function test_medical_provider_cannot_create_medical_record(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($medical)->postJson('/api/medical-records', [
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Test',
        ]);

        $response->assertStatus(403);
    }

    public function test_medical_provider_can_update_medical_record(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create(['is_active' => true]);
        $record = MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->putJson("/api/medical-records/{$record->id}", [
            'special_needs' => 'Updated by medical staff',
        ]);

        $response->assertStatus(200);
    }

    public function test_medical_provider_cannot_delete_medical_record(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $record = MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->deleteJson("/api/medical-records/{$record->id}");

        $response->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Parent Ownership Tests
    |--------------------------------------------------------------------------
    */

    public function test_parent_cannot_view_medical_records_list(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->getJson('/api/medical-records');

        $response->assertStatus(403);
    }

    public function test_parent_can_view_own_campers_medical_record(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $record = MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->getJson("/api/medical-records/{$record->id}");

        $response->assertStatus(200);
    }

    public function test_parent_cannot_view_other_campers_medical_record(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $record = MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent1)->getJson("/api/medical-records/{$record->id}");

        $response->assertStatus(403);
    }

    public function test_parent_cannot_create_medical_record_directly(): void
    {
        // Medical records are created by the system at approval time (admin-only policy).
        // Parents cannot create them directly via the API.
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/medical-records', [
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Test',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_cannot_create_medical_record_for_other_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();

        $response = $this->actingAs($parent1)->postJson('/api/medical-records', [
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Test',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_can_update_own_campers_medical_record(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $record = MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->putJson("/api/medical-records/{$record->id}", [
            'physician_name' => 'Dr. Updated',
        ]);

        $response->assertStatus(200);
    }

    public function test_parent_cannot_update_other_campers_medical_record(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $record = MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent1)->putJson("/api/medical-records/{$record->id}", [
            'physician_name' => 'Dr. Hacked',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_cannot_delete_medical_record(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $record = MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->deleteJson("/api/medical-records/{$record->id}");

        $response->assertStatus(403);
    }
}
