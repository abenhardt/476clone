<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Capacity enforcement tests for camp session approval.
 *
 * Verifies that:
 *  - Approvals are blocked when a session is at capacity.
 *  - The enrolled_count is correctly computed as approved applications.
 *  - A session with capacity = 1 allows exactly one approval.
 *  - Waitlisted applications do NOT consume capacity.
 *  - Reversing an approval (→ rejected/cancelled) frees capacity for the next approval.
 */
class ApplicationCapacityEnforcementTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_approval_succeeds_when_session_has_capacity(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 5]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'is_draft' => false,
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => ApplicationStatus::Approved->value,
            'override_incomplete' => true,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('applications', [
            'id' => $application->id,
            'status' => ApplicationStatus::Approved->value,
        ]);
    }

    public function test_approval_blocked_when_session_is_at_capacity(): void
    {
        $admin = $this->createAdmin();
        $session = CampSession::factory()->create(['capacity' => 1]);

        // Fill the session to capacity with an approved application.
        $existingParent = $this->createParent();
        $existingCamper = Camper::factory()->create(['user_id' => $existingParent->id]);
        Application::factory()->create([
            'camper_id' => $existingCamper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Approved,
            'is_draft' => false,
        ]);

        // Attempt to approve a second application for the now-full session.
        $newParent = $this->createParent();
        $newCamper = Camper::factory()->create(['user_id' => $newParent->id]);
        $newApplication = Application::factory()->create([
            'camper_id' => $newCamper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'is_draft' => false,
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$newApplication->id}/review", [
            'status' => ApplicationStatus::Approved->value,
            'override_incomplete' => true,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.capacity', 'Session is at capacity.');

        // Verify the application status was NOT changed.
        $this->assertDatabaseHas('applications', [
            'id' => $newApplication->id,
            'status' => ApplicationStatus::Submitted->value,
        ]);
    }

    public function test_waitlisted_application_does_not_consume_capacity(): void
    {
        $admin = $this->createAdmin();
        $session = CampSession::factory()->create(['capacity' => 1]);

        // Fill the session to capacity.
        $parent1 = $this->createParent();
        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        Application::factory()->create([
            'camper_id' => $camper1->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Approved,
            'is_draft' => false,
        ]);

        // Waitlist a second application.
        $parent2 = $this->createParent();
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);
        $waitlistedApp = Application::factory()->create([
            'camper_id' => $camper2->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'is_draft' => false,
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$waitlistedApp->id}/review", [
            'status' => ApplicationStatus::Waitlisted->value,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('applications', [
            'id' => $waitlistedApp->id,
            'status' => ApplicationStatus::Waitlisted->value,
        ]);

        // Enrolled count should still be 1 (only the approved application counts).
        $session->refresh();
        $this->assertEquals(1, $session->enrolled_count);
    }

    public function test_reversal_frees_capacity_for_subsequent_approval(): void
    {
        $admin = $this->createAdmin();
        $session = CampSession::factory()->create(['capacity' => 1]);

        // Approve one application, filling the session.
        $parent1 = $this->createParent();
        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        $approvedApp = Application::factory()->create([
            'camper_id' => $camper1->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Approved,
            'is_draft' => false,
        ]);

        // Reverse the approval.
        $this->actingAs($admin)->postJson("/api/applications/{$approvedApp->id}/review", [
            'status' => ApplicationStatus::Rejected->value,
        ])->assertStatus(200);

        // Now attempt to approve a different application — session has space again.
        $parent2 = $this->createParent();
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);
        $newApp = Application::factory()->create([
            'camper_id' => $camper2->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'is_draft' => false,
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$newApp->id}/review", [
            'status' => ApplicationStatus::Approved->value,
            'override_incomplete' => true,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('applications', [
            'id' => $newApp->id,
            'status' => ApplicationStatus::Approved->value,
        ]);
    }

    public function test_enrolled_count_counts_only_approved_applications(): void
    {
        $session = CampSession::factory()->create(['capacity' => 10]);
        $parent = $this->createParent();

        $statuses = [
            ApplicationStatus::Submitted,
            ApplicationStatus::UnderReview,
            ApplicationStatus::Approved,
            ApplicationStatus::Waitlisted,
            ApplicationStatus::Rejected,
        ];

        foreach ($statuses as $status) {
            $camper = Camper::factory()->create(['user_id' => $parent->id]);
            Application::factory()->create([
                'camper_id' => $camper->id,
                'camp_session_id' => $session->id,
                'status' => $status,
                'is_draft' => false,
            ]);
        }

        // Only the one Approved application should count toward enrolled_count.
        $this->assertEquals(1, $session->enrolled_count);
        $this->assertFalse($session->isAtCapacity());
    }
}
