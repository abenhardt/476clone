<?php

namespace Tests\Feature\Api;

use App\Models\Allergy;
use App\Models\Camper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for Allergy resource authorization.
 *
 * Verifies access control for allergy information with medical
 * providers having create/update access for safety documentation.
 */
class AllergyAuthorizationTest extends TestCase
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

    public function test_unauthenticated_user_cannot_access_allergies(): void
    {
        $response = $this->getJson('/api/allergies');

        $response->assertStatus(401);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin Access Tests
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_view_all_allergies(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        Allergy::factory()->count(3)->forCamper($camper)->create();

        $response = $this->actingAs($admin)->getJson('/api/allergies');

        $response->assertStatus(200)
            ->assertJsonCount(3, 'data');
    }

    public function test_admin_can_create_allergy(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($admin)->postJson('/api/allergies', [
            'camper_id' => $camper->id,
            'allergen' => 'Peanuts',
            'severity' => 'severe',
        ]);

        $response->assertStatus(201);
    }

    public function test_admin_can_update_allergy(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $allergy = Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($admin)->putJson("/api/allergies/{$allergy->id}", [
            'severity' => 'life_threatening',
        ]);

        $response->assertStatus(200);
    }

    public function test_admin_can_delete_allergy(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $allergy = Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($admin)->deleteJson("/api/allergies/{$allergy->id}");

        $response->assertStatus(200);
    }

    /*
    |--------------------------------------------------------------------------
    | Medical Provider Access Tests
    |--------------------------------------------------------------------------
    */

    public function test_medical_provider_can_view_all_allergies(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        Allergy::factory()->count(2)->forCamper($camper)->create();

        $response = $this->actingAs($medical)->getJson('/api/allergies');

        $response->assertStatus(200)
            ->assertJsonCount(2, 'data');
    }

    public function test_medical_provider_can_view_allergy(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create(['is_active' => true]);
        $allergy = Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->getJson("/api/allergies/{$allergy->id}");

        $response->assertStatus(200);
    }

    public function test_medical_provider_can_create_allergy(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($medical)->postJson('/api/allergies', [
            'camper_id' => $camper->id,
            'allergen' => 'Bee Stings',
            'severity' => 'severe',
            'treatment' => 'Administer EpiPen',
        ]);

        $response->assertStatus(201);
    }

    public function test_medical_provider_can_update_allergy(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create(['is_active' => true]);
        $allergy = Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->putJson("/api/allergies/{$allergy->id}", [
            'treatment' => 'Updated treatment protocol',
        ]);

        $response->assertStatus(200);
    }

    public function test_medical_provider_cannot_delete_allergy(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $allergy = Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->deleteJson("/api/allergies/{$allergy->id}");

        $response->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Parent Ownership Tests
    |--------------------------------------------------------------------------
    */

    public function test_parent_cannot_view_allergies_list(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->getJson('/api/allergies');

        $response->assertStatus(403);
    }

    public function test_parent_can_view_own_campers_allergy(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $allergy = Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->getJson("/api/allergies/{$allergy->id}");

        $response->assertStatus(200);
    }

    public function test_parent_cannot_view_other_campers_allergy(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $allergy = Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent1)->getJson("/api/allergies/{$allergy->id}");

        $response->assertStatus(403);
    }

    public function test_parent_can_create_allergy_for_own_camper(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/allergies', [
            'camper_id' => $camper->id,
            'allergen' => 'Dairy',
            'severity' => 'moderate',
        ]);

        $response->assertStatus(201);
    }

    public function test_parent_cannot_create_allergy_for_other_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();

        $response = $this->actingAs($parent1)->postJson('/api/allergies', [
            'camper_id' => $camper->id,
            'allergen' => 'Dairy',
            'severity' => 'moderate',
        ]);

        $response->assertStatus(422);
    }

    public function test_parent_can_update_own_campers_allergy(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $allergy = Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->putJson("/api/allergies/{$allergy->id}", [
            'reaction' => 'Updated reaction description',
        ]);

        $response->assertStatus(200);
    }

    public function test_parent_cannot_update_other_campers_allergy(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $allergy = Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent1)->putJson("/api/allergies/{$allergy->id}", [
            'reaction' => 'Hacked',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_can_delete_own_campers_allergy(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $allergy = Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->deleteJson("/api/allergies/{$allergy->id}");

        $response->assertStatus(200);
    }

    public function test_parent_cannot_delete_other_campers_allergy(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $allergy = Allergy::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent1)->deleteJson("/api/allergies/{$allergy->id}");

        $response->assertStatus(403);
    }
}
