<?php

namespace Tests\Feature\Regression;

use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Closed-session submission regression tests.
 *
 * Verifies that applicants cannot submit applications to sessions that have
 * their portal closed or are inactive.  This prevents stale drafts from being
 * submitted after an admin has closed the registration window.
 *
 * Admins are exempt — they can create applications on behalf of families at
 * any time, regardless of portal state.
 *
 * Root cause this tests: StoreApplicationRequest previously only validated
 * `exists:camp_sessions,id` — no portal_open or is_active constraint — meaning
 * a submitted draft pointing at a now-closed session would be accepted silently.
 */
class ClosedSessionSubmissionTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_applicant_cannot_submit_to_portal_closed_session(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->portalClosed()->create();

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.camp_session_id', [
            'The selected camp session is not currently accepting applications.',
        ]);
    }

    public function test_applicant_cannot_submit_to_inactive_session(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->inactive()->create(['portal_open' => false]);

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response->assertStatus(422);
    }

    public function test_applicant_can_submit_to_open_active_session(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->create(); // defaults: portal_open=true, is_active=true

        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        $response->assertStatus(201);
    }

    public function test_admin_can_create_application_to_portal_closed_session(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->portalClosed()->create();

        $response = $this->actingAs($admin)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        // Admin is not blocked by portal state
        $response->assertStatus(201);
    }
}
