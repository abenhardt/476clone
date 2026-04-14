<?php

namespace Tests\Feature\Api;

use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Verifies that all form-parity fields (added in migrations 2026_03_26_000001
 * through 2026_03_26_000005) are accepted by the API and persisted correctly.
 *
 * Tests are grouped by the API endpoint they exercise. Each test sends a
 * minimal valid payload that includes the new parity fields and asserts
 * a 201 (or 200) response plus correct database state.
 */
class FormParityTest extends TestCase
{
    use RefreshDatabase;
    use WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    // -------------------------------------------------------------------------
    // Camper — applicant mailing address (migration 000004)
    // -------------------------------------------------------------------------

    public function test_create_camper_accepts_applicant_address_fields(): void
    {
        $parent = $this->createParent();

        $response = $this->actingAs($parent)->postJson('/api/campers', [
            'first_name' => 'Alex',
            'last_name' => 'Test',
            'date_of_birth' => '2015-06-01',
            'gender' => 'Male',
            'applicant_address' => '123 Main St',
            'applicant_city' => 'Columbia',
            'applicant_state' => 'SC',
            'applicant_zip' => '29201',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('campers', [
            'first_name' => 'Alex',
            'applicant_city' => 'Columbia',
            'applicant_state' => 'SC',
            'applicant_zip' => '29201',
        ]);
    }

    // -------------------------------------------------------------------------
    // Emergency contact — work phone, language, interpreter (migration 000003)
    // -------------------------------------------------------------------------

    public function test_create_emergency_contact_accepts_parity_fields(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        $response = $this->actingAs($parent)->postJson('/api/emergency-contacts', [
            'camper_id' => $camper->id,
            'name' => 'Jane Doe',
            'relationship' => 'Aunt',
            'phone_primary' => '8031234567',
            'is_primary' => false,
            'is_authorized_pickup' => false,
            'phone_work' => '8039876543',
            'primary_language' => 'Spanish',
            'interpreter_needed' => true,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('emergency_contacts', [
            'camper_id' => $camper->id,
            'primary_language' => 'Spanish',
            'interpreter_needed' => 1,
        ]);
    }

    // -------------------------------------------------------------------------
    // Application — first_application, attended_before, second session (000002)
    // -------------------------------------------------------------------------

    public function test_create_application_accepts_meta_and_second_session(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session1 = CampSession::factory()->create();
        $session2 = CampSession::factory()->create();

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'session_id' => $session1->id,
            'first_application' => true,
            'attended_before' => false,
            'session_id_second' => $session2->id,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session1->id,
            'camp_session_id_second' => $session2->id,
            'first_application' => 1,
            'attended_before' => 0,
        ]);
    }

    public function test_application_session_id_second_must_exist(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->create();

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'session_id' => $session->id,
            'session_id_second' => 99999,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['session_id_second']);
    }

    // -------------------------------------------------------------------------
    // Behavioral profile — new flags and descriptions (migration 000001)
    // -------------------------------------------------------------------------

    public function test_create_behavioral_profile_accepts_parity_flags(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        $response = $this->actingAs($parent)->postJson('/api/behavioral-profiles', [
            'camper_id' => $camper->id,
            'aggression' => true,
            'aggression_description' => 'Hits when frustrated',
            'self_abuse' => false,
            'wandering_risk' => true,
            'wandering_description' => 'Exits rooms quickly',
            'one_to_one_supervision' => false,
            'developmental_delay' => true,
            'sexual_behaviors' => false,
            'interpersonal_behavior' => true,
            'interpersonal_behavior_description' => 'Occasional verbal outbursts',
            'social_emotional' => true,
            'social_emotional_description' => 'Anxiety in groups',
            'follows_instructions' => true,
            'follows_instructions_description' => 'Needs one-step prompts',
            'group_participation' => true,
            'group_participation_description' => 'Participates with prompting',
            'attends_school' => true,
            'classroom_type' => 'Resource room',
            'functioning_age_level' => '5-6 years',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('behavioral_profiles', [
            'camper_id' => $camper->id,
            'aggression' => 1,
            'interpersonal_behavior' => 1,
            'attends_school' => 1,
            'classroom_type' => 'Resource room',
        ]);
    }

    public function test_behavioral_profile_description_fields_are_nullable(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        // Submit without any description fields — should succeed
        $response = $this->actingAs($parent)->postJson('/api/behavioral-profiles', [
            'camper_id' => $camper->id,
            'aggression' => false,
            'self_abuse' => false,
            'wandering_risk' => false,
            'one_to_one_supervision' => false,
            'developmental_delay' => false,
        ]);

        $response->assertStatus(201);
    }

    // -------------------------------------------------------------------------
    // Personal care plan — irregular bowel (migration 000005)
    // -------------------------------------------------------------------------

    public function test_personal_care_plan_accepts_irregular_bowel_fields(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        $response = $this->actingAs($parent)->postJson(
            "/api/campers/{$camper->id}/personal-care-plan",
            [
                'irregular_bowel' => true,
                'irregular_bowel_notes' => 'Requires scheduled bathroom trips every 2 hours',
            ]
        );

        $response->assertStatus(201);
        $this->assertDatabaseHas('personal_care_plans', [
            'camper_id' => $camper->id,
            'irregular_bowel' => 1,
        ]);
    }

    // -------------------------------------------------------------------------
    // Health profile — contagious illness, recent illness, tubes in ears
    // -------------------------------------------------------------------------

    public function test_health_profile_accepts_other_health_information_fields(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        $response = $this->actingAs($parent)->postJson(
            "/api/campers/{$camper->id}/health-profile",
            [
                'tubes_in_ears' => true,
                'has_contagious_illness' => false,
                'has_recent_illness' => true,
                'recent_illness_description' => 'Hospitalized for pneumonia in January',
            ]
        );

        $response->assertSuccessful();
        $this->assertDatabaseHas('medical_records', [
            'camper_id' => $camper->id,
            'tubes_in_ears' => 1,
            'has_recent_illness' => 1,
        ]);
    }
}
