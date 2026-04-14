<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\MedicalRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for waitlist management and promotion workflows.
 *
 * Verifies that:
 *  - An admin can promote a waitlisted application directly to Approved.
 *  - Camper becomes is_active=true upon waitlist promotion.
 *  - MedicalRecord is activated upon waitlist promotion.
 *  - Waitlisted applications can also be moved to Rejected or Cancelled.
 *  - A waitlisted application cannot self-transition (Waitlisted → Waitlisted).
 *  - Capacity is respected when promoting from the waitlist.
 */
class WaitlistPromotionTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
    }

    public function test_waitlisted_application_can_be_promoted_to_approved(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => false]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Waitlisted,
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

    public function test_camper_activated_on_waitlist_promotion(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => false]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Waitlisted,
            'is_draft' => false,
        ]);

        $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => ApplicationStatus::Approved->value,
            'override_incomplete' => true,
        ])->assertStatus(200);

        $this->assertDatabaseHas('campers', ['id' => $camper->id, 'is_active' => true]);
    }

    public function test_medical_record_activated_on_waitlist_promotion(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => false]);
        MedicalRecord::factory()->create(['camper_id' => $camper->id, 'is_active' => false]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Waitlisted,
            'is_draft' => false,
        ]);

        $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => ApplicationStatus::Approved->value,
            'override_incomplete' => true,
        ])->assertStatus(200);

        $this->assertDatabaseHas('medical_records', ['camper_id' => $camper->id, 'is_active' => true]);
    }

    public function test_waitlisted_application_can_be_rejected(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Waitlisted,
            'is_draft' => false,
        ]);

        $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => ApplicationStatus::Rejected->value,
        ])->assertStatus(200);

        $this->assertDatabaseHas('applications', [
            'id' => $application->id,
            'status' => ApplicationStatus::Rejected->value,
        ]);
    }

    public function test_waitlisted_application_can_be_cancelled(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Waitlisted,
            'is_draft' => false,
        ]);

        $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => ApplicationStatus::Cancelled->value,
        ])->assertStatus(200);

        $this->assertDatabaseHas('applications', [
            'id' => $application->id,
            'status' => ApplicationStatus::Cancelled->value,
        ]);
    }

    public function test_waitlisted_application_cannot_self_transition(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Waitlisted,
            'is_draft' => false,
        ]);

        // Attempting Waitlisted → Waitlisted should fail as an invalid transition.
        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => ApplicationStatus::Waitlisted->value,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.status', 'This status transition is not permitted for the application in its current state.');
        // Status must remain unchanged.
        $this->assertDatabaseHas('applications', [
            'id' => $application->id,
            'status' => ApplicationStatus::Waitlisted->value,
        ]);
    }

    public function test_promotion_blocked_when_session_is_at_capacity(): void
    {
        $admin = $this->createAdmin();
        $session = CampSession::factory()->create(['capacity' => 1]);

        // Fill the session.
        $parent1 = $this->createParent();
        $camper1 = Camper::factory()->create(['user_id' => $parent1->id]);
        Application::factory()->create([
            'camper_id' => $camper1->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Approved,
            'is_draft' => false,
        ]);

        // Try to promote a waitlisted application when the session is full.
        $parent2 = $this->createParent();
        $camper2 = Camper::factory()->create(['user_id' => $parent2->id]);
        $waitlisted = Application::factory()->create([
            'camper_id' => $camper2->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Waitlisted,
            'is_draft' => false,
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$waitlisted->id}/review", [
            'status' => ApplicationStatus::Approved->value,
            'override_incomplete' => true,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.capacity', 'Session is at capacity.');

        // Must remain waitlisted.
        $this->assertDatabaseHas('applications', [
            'id' => $waitlisted->id,
            'status' => ApplicationStatus::Waitlisted->value,
        ]);
    }
}
