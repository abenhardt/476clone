<?php

namespace Tests\Feature\Api;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for Application resource authorization.
 *
 * Verifies that access control is properly enforced for application
 * resources based on user roles and ownership.
 */
class ApplicationAuthorizationTest extends TestCase
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

    public function test_unauthenticated_user_cannot_access_applications(): void
    {
        $response = $this->getJson('/api/applications');

        $response->assertStatus(401);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin Access Tests
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_view_all_applications(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        Application::factory()->count(3)->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($admin)->getJson('/api/applications');

        $response->assertStatus(200)
            ->assertJsonCount(3, 'data');
    }

    public function test_admin_can_view_any_application(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = Application::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($admin)->getJson("/api/applications/{$application->id}");

        $response->assertStatus(200);
    }

    public function test_admin_can_delete_application(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = Application::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($admin)->deleteJson("/api/applications/{$application->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('applications', ['id' => $application->id]);
    }

    public function test_admin_can_review_application(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = Application::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'approved',
            'notes' => 'Approved by admin',
            'override_incomplete' => true, // auth test — not testing compliance enforcement
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('applications', [
            'id' => $application->id,
            'status' => ApplicationStatus::Approved->value,
            'reviewed_by' => $admin->id,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Parent Ownership Tests
    |--------------------------------------------------------------------------
    */

    public function test_parent_can_view_own_applications(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        Application::factory()->count(2)->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($parent)->getJson('/api/applications');

        $response->assertStatus(200)
            ->assertJsonCount(2, 'data');
    }

    public function test_parent_cannot_see_other_parents_applications(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper1 = Camper::factory()->forUser($parent1)->create();
        $camper2 = Camper::factory()->forUser($parent2)->create();
        Application::factory()->create(['camper_id' => $camper1->id]);
        Application::factory()->count(3)->create(['camper_id' => $camper2->id]);

        $response = $this->actingAs($parent1)->getJson('/api/applications');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }

    public function test_parent_can_view_own_application(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = Application::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($parent)->getJson("/api/applications/{$application->id}");

        $response->assertStatus(200);
    }

    public function test_parent_cannot_view_other_parents_application(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $application = Application::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($parent1)->getJson("/api/applications/{$application->id}");

        $response->assertStatus(403);
    }

    public function test_parent_can_create_application_for_own_camper(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create();

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response->assertStatus(201);
    }

    public function test_parent_cannot_create_application_for_other_parents_camper(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $session = CampSession::factory()->create();

        $response = $this->actingAs($parent1)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_can_update_own_pending_application(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Submitted,
        ]);

        $response = $this->actingAs($parent)->putJson("/api/applications/{$application->id}", [
            'notes' => 'Updated notes',
        ]);

        $response->assertStatus(200);
    }

    public function test_parent_cannot_update_approved_application(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = Application::factory()->approved()->create([
            'camper_id' => $camper->id,
        ]);

        $response = $this->actingAs($parent)->putJson("/api/applications/{$application->id}", [
            'notes' => 'Trying to update',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_cannot_update_other_parents_application(): void
    {
        $parent1 = $this->createParent();
        $parent2 = $this->createParent();
        $camper = Camper::factory()->forUser($parent2)->create();
        $application = Application::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($parent1)->putJson("/api/applications/{$application->id}", [
            'notes' => 'Hacked',
        ]);

        $response->assertStatus(403);
    }

    public function test_parent_cannot_delete_application(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = Application::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($parent)->deleteJson("/api/applications/{$application->id}");

        $response->assertStatus(403);
    }

    public function test_parent_cannot_review_application(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = Application::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($parent)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'approved',
        ]);

        $response->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Medical Provider Isolation Tests
    |--------------------------------------------------------------------------
    */

    public function test_medical_provider_gets_empty_applications_list(): void
    {
        // Medical providers are not an application-managing role; the controller returns
        // an empty paginated result rather than 403 for unrecognised roles.
        $medical = $this->createMedicalProvider();

        $response = $this->actingAs($medical)->getJson('/api/applications');

        $response->assertOk();
        $response->assertJsonPath('data', []);
    }

    public function test_medical_provider_cannot_view_application(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = Application::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($medical)->getJson("/api/applications/{$application->id}");

        $response->assertStatus(403);
    }

    public function test_medical_provider_cannot_create_application(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create();

        $response = $this->actingAs($medical)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_medical_provider_cannot_update_application(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = Application::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($medical)->putJson("/api/applications/{$application->id}", [
            'notes' => 'Medical update',
        ]);

        $response->assertStatus(403);
    }

    public function test_medical_provider_cannot_review_application(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = Application::factory()->create(['camper_id' => $camper->id]);

        $response = $this->actingAs($medical)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'approved',
        ]);

        $response->assertStatus(403);
    }
}
