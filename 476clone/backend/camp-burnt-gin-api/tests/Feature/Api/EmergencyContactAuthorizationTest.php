<?php

namespace Tests\Feature\Api;

use App\Models\Camper;
use App\Models\EmergencyContact;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for EmergencyContact resource authorization.
 *
 * Verifies access control for emergency contacts with special
 * attention to medical provider read-only access.
 */
class EmergencyContactAuthorizationTest extends TestCase
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

    public function test_unauthenticated_user_cannot_access_emergency_contacts(): void
    {
        $response = $this->getJson('/api/emergency-contacts');

        $response->assertStatus(401);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin Access Tests
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_view_all_emergency_contacts(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        EmergencyContact::factory()->count(3)->forCamper($camper)->create();

        $response = $this->actingAs($admin)->getJson('/api/emergency-contacts');

        $response->assertStatus(200)
            ->assertJsonCount(3, 'data');
    }

    public function test_admin_can_create_emergency_contact(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($admin)->postJson('/api/emergency-contacts', [
            'camper_id' => $camper->id,
            'name' => 'Emergency Person',
            'relationship' => 'Aunt',
            'phone_primary' => '555-1234',
        ]);

        $response->assertStatus(201);
    }

    public function test_admin_can_update_emergency_contact(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $contact = EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($admin)->putJson("/api/emergency-contacts/{$contact->id}", [
            'name' => 'Updated Name',
        ]);

        $response->assertStatus(200);
    }

    public function test_admin_can_delete_emergency_contact(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $contact = EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($admin)->deleteJson("/api/emergency-contacts/{$contact->id}");

        $response->assertStatus(200);
    }

    /*
    |--------------------------------------------------------------------------
    | Medical Provider Access Tests (Read-Only)
    |--------------------------------------------------------------------------
    */

    public function test_medical_provider_can_view_emergency_contacts_list(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        EmergencyContact::factory()->count(2)->forCamper($camper)->create();

        $response = $this->actingAs($medical)->getJson('/api/emergency-contacts');

        $response->assertStatus(200)
            ->assertJsonCount(2, 'data');
    }

    public function test_medical_provider_can_view_emergency_contact(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create(['is_active' => true]);
        $contact = EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->getJson("/api/emergency-contacts/{$contact->id}");

        $response->assertStatus(200);
    }

    public function test_medical_provider_cannot_create_emergency_contact(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($medical)->postJson('/api/emergency-contacts', [
            'camper_id' => $camper->id,
            'name' => 'Emergency Person',
            'relationship' => 'Aunt',
            'phone_primary' => '555-1234',
        ]);

        $response->assertStatus(422);
    }

    public function test_medical_provider_cannot_update_emergency_contact(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $contact = EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->putJson("/api/emergency-contacts/{$contact->id}", [
            'name' => 'Updated by Medical',
        ]);

        $response->assertStatus(403);
    }

    public function test_medical_provider_cannot_delete_emergency_contact(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $contact = EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($medical)->deleteJson("/api/emergency-contacts/{$contact->id}");

        $response->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Parent Ownership Tests
    |--------------------------------------------------------------------------
    */

    public function test_parent_cannot_view_emergency_contacts_list(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->getJson('/api/emergency-contacts');

        $response->assertStatus(403);
    }

    public function test_parent_can_view_own_campers_emergency_contact(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $contact = EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->getJson("/api/emergency-contacts/{$contact->id}");

        $response->assertStatus(200);
    }

    public function test_parent_cannot_view_other_campers_emergency_contact(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $contact = EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent1)->getJson("/api/emergency-contacts/{$contact->id}");

        $response->assertStatus(403);
    }

    public function test_parent_can_create_emergency_contact_for_own_camper(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/emergency-contacts', [
            'camper_id' => $camper->id,
            'name' => 'Emergency Person',
            'relationship' => 'Aunt',
            'phone_primary' => '555-1234',
        ]);

        $response->assertStatus(201);
    }

    public function test_parent_cannot_create_emergency_contact_for_other_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();

        $response = $this->actingAs($parent1)->postJson('/api/emergency-contacts', [
            'camper_id' => $camper->id,
            'name' => 'Emergency Person',
            'relationship' => 'Aunt',
            'phone_primary' => '555-1234',
        ]);

        $response->assertStatus(422);
    }

    public function test_parent_can_update_own_campers_emergency_contact(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $contact = EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->putJson("/api/emergency-contacts/{$contact->id}", [
            'name' => 'Updated Name',
        ]);

        $response->assertStatus(200);
    }

    public function test_parent_cannot_update_other_campers_emergency_contact(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $contact = EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent1)->putJson("/api/emergency-contacts/{$contact->id}", [
            'name' => 'Hacked Name',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_can_delete_own_campers_emergency_contact(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $contact = EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent)->deleteJson("/api/emergency-contacts/{$contact->id}");

        $response->assertStatus(200);
    }

    public function test_parent_cannot_delete_other_campers_emergency_contact(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $contact = EmergencyContact::factory()->forCamper($camper)->create();

        $response = $this->actingAs($parent1)->deleteJson("/api/emergency-contacts/{$contact->id}");

        $response->assertStatus(403);
    }
}
