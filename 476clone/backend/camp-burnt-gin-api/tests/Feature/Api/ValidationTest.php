<?php

namespace Tests\Feature\Api;

use App\Models\Camper;
use App\Models\CampSession;
use App\Models\MedicalRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for API input validation.
 *
 * Verifies that validation rules are properly enforced for all
 * API endpoints and invalid data is rejected appropriately.
 */
class ValidationTest extends TestCase
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
    | Camper Validation Tests
    |--------------------------------------------------------------------------
    */

    public function test_camper_requires_first_name(): void
    {
        $parent = $this->createParent();

        $response = $this->actingAs($parent)->postJson('/api/campers', [
            'last_name' => 'Test',
            'date_of_birth' => '2015-01-01',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['first_name']);
    }

    public function test_camper_requires_last_name(): void
    {
        $parent = $this->createParent();

        $response = $this->actingAs($parent)->postJson('/api/campers', [
            'first_name' => 'Test',
            'date_of_birth' => '2015-01-01',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['last_name']);
    }

    public function test_camper_requires_date_of_birth(): void
    {
        $parent = $this->createParent();

        $response = $this->actingAs($parent)->postJson('/api/campers', [
            'first_name' => 'Test',
            'last_name' => 'Camper',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['date_of_birth']);
    }

    public function test_camper_date_of_birth_must_be_in_past(): void
    {
        $parent = $this->createParent();

        $response = $this->actingAs($parent)->postJson('/api/campers', [
            'first_name' => 'Test',
            'last_name' => 'Camper',
            'date_of_birth' => now()->addYear()->format('Y-m-d'),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['date_of_birth']);
    }

    public function test_admin_creating_camper_requires_user_id(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)->postJson('/api/campers', [
            'first_name' => 'Test',
            'last_name' => 'Camper',
            'date_of_birth' => '2015-01-01',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['user_id']);
    }

    /*
    |--------------------------------------------------------------------------
    | Application Validation Tests
    |--------------------------------------------------------------------------
    */

    public function test_application_requires_camper_id(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create();

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camp_session_id' => $session->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['camper_id']);
    }

    public function test_application_requires_camp_session_id(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['camp_session_id']);
    }

    public function test_application_camper_must_exist(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create();

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => 99999,
            'camp_session_id' => $session->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['camper_id']);
    }

    public function test_application_session_must_exist(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => 99999,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['camp_session_id']);
    }

    public function test_duplicate_application_rejected(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $session = CampSession::factory()->create();

        $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['camp_session_id']);
    }

    public function test_application_review_requires_valid_status(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        $application = \App\Models\Application::factory()->create([
            'camper_id' => $camper->id,
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'invalid_status',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    /*
    |--------------------------------------------------------------------------
    | Medical Record Validation Tests
    |--------------------------------------------------------------------------
    */

    public function test_medical_record_requires_camper_id(): void
    {
        // POST /api/medical-records requires role:admin,medical — parent cannot reach validation.
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)->postJson('/api/medical-records', [
            'physician_name' => 'Dr. Test',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['camper_id']);
    }

    public function test_medical_record_camper_must_exist(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)->postJson('/api/medical-records', [
            'camper_id' => 99999,
            'physician_name' => 'Dr. Test',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['camper_id']);
    }

    public function test_duplicate_medical_record_rejected(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();
        MedicalRecord::factory()->forCamper($camper)->create();

        $response = $this->actingAs($admin)->postJson('/api/medical-records', [
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Test',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['camper_id']);
    }

    /*
    |--------------------------------------------------------------------------
    | Emergency Contact Validation Tests
    |--------------------------------------------------------------------------
    */

    public function test_emergency_contact_requires_name(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/emergency-contacts', [
            'camper_id' => $camper->id,
            'relationship' => 'Mother',
            'phone_primary' => '555-1234',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_emergency_contact_requires_relationship(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/emergency-contacts', [
            'camper_id' => $camper->id,
            'name' => 'Jane Doe',
            'phone_primary' => '555-1234',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['relationship']);
    }

    public function test_emergency_contact_requires_phone_primary(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/emergency-contacts', [
            'camper_id' => $camper->id,
            'name' => 'Jane Doe',
            'relationship' => 'Mother',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone_primary']);
    }

    /*
    |--------------------------------------------------------------------------
    | Allergy Validation Tests
    |--------------------------------------------------------------------------
    */

    public function test_allergy_requires_allergen(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/allergies', [
            'camper_id' => $camper->id,
            'severity' => 'moderate',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['allergen']);
    }

    public function test_allergy_requires_severity(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/allergies', [
            'camper_id' => $camper->id,
            'allergen' => 'Peanuts',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['severity']);
    }

    public function test_allergy_requires_valid_severity(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/allergies', [
            'camper_id' => $camper->id,
            'allergen' => 'Peanuts',
            'severity' => 'invalid_severity',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['severity']);
    }

    /*
    |--------------------------------------------------------------------------
    | Medication Validation Tests
    |--------------------------------------------------------------------------
    */

    public function test_medication_requires_name(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/medications', [
            'camper_id' => $camper->id,
            'dosage' => '200mg',
            'frequency' => 'Daily',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_medication_requires_dosage(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/medications', [
            'camper_id' => $camper->id,
            'name' => 'Ibuprofen',
            'frequency' => 'Daily',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['dosage']);
    }

    public function test_medication_requires_frequency(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->postJson('/api/medications', [
            'camper_id' => $camper->id,
            'name' => 'Ibuprofen',
            'dosage' => '200mg',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['frequency']);
    }

    /*
    |--------------------------------------------------------------------------
    | JSON Response Structure Tests
    |--------------------------------------------------------------------------
    */

    public function test_validation_errors_return_422(): void
    {
        $parent = $this->createParent();

        $response = $this->actingAs($parent)->postJson('/api/campers', []);

        $response->assertStatus(422)
            ->assertJsonStructure(['message', 'errors']);
    }

    public function test_successful_response_contains_data(): void
    {
        $parent = $this->createParent();

        $response = $this->actingAs($parent)->postJson('/api/campers', [
            'first_name' => 'Test',
            'last_name' => 'Camper',
            'date_of_birth' => '2015-01-01',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['message', 'data']);
    }

    public function test_list_response_contains_pagination_meta(): void
    {
        $parent = $this->createParent();
        Camper::factory()->forUser($parent)->create();

        $response = $this->actingAs($parent)->getJson('/api/campers');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data',
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);
    }
}
