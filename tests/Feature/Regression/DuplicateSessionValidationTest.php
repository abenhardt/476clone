<?php

namespace Tests\Feature\Regression;

use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Duplicate session choice validation regression tests.
 *
 * Verifies that:
 *  - Submitting the same session for both first and second choice is rejected (422).
 *  - The rejection message explicitly identifies the second choice as invalid.
 *  - Submitting distinct sessions is accepted.
 *  - Submitting no second choice (null) is accepted.
 *
 * Root cause this tests: Previously StoreApplicationRequest had no rule preventing
 * camp_session_id_second === camp_session_id. Frontend filtering prevented the UI
 * from producing this combination, but the backend accepted it if submitted directly.
 */
class DuplicateSessionValidationTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_duplicate_session_choice_is_rejected(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->create(['portal_open' => true, 'capacity' => 10]);

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'camp_session_id_second' => $session->id, // same as first — must be rejected
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.camp_session_id_second', [
            'Your second session choice must be different from your first choice.',
        ]);
    }

    public function test_distinct_session_choices_are_accepted(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session1 = CampSession::factory()->create(['portal_open' => true, 'capacity' => 10]);
        $session2 = CampSession::factory()->create(['portal_open' => true, 'capacity' => 10]);

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session1->id,
            'camp_session_id_second' => $session2->id,
        ]);

        // 201 Created or 200 OK — not a 422
        $this->assertContains($response->status(), [200, 201]);
    }

    public function test_null_second_session_is_accepted(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->create(['portal_open' => true, 'capacity' => 10]);

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'camp_session_id_second' => null,
        ]);

        $this->assertNotEquals(422, $response->status());
        $response->assertJsonMissing(['errors' => ['camp_session_id_second']]);
    }

    public function test_omitting_second_session_is_accepted(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->create(['portal_open' => true, 'capacity' => 10]);

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $this->assertNotEquals(422, $response->status());
    }
}
