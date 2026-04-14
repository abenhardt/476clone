<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Jobs\SendNotificationJob;
use App\Models\Application;
use App\Models\AuditLog;
use App\Models\Camper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression tests for application workflows.
 *
 * Verifies that core application submission and review workflows
 * still function correctly after performance optimizations.
 */
class ApplicationWorkflowTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
    }

    public function test_complete_application_submission_workflow(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Submit application
        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
        ]);

        // Verify response
        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Application submitted successfully.');
        $response->assertJsonStructure(['data' => ['id', 'status', 'submitted_at']]);

        // Verify database state
        $this->assertDatabaseHas('applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted->value,
            'is_draft' => false,
        ]);

        $application = Application::where('camper_id', $camper->id)->first();
        $this->assertNotNull($application->submitted_at);

        // Verify notification was queued
        Queue::assertPushed(SendNotificationJob::class);

        // Verify audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $parent->id,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'create',
        ]);
    }

    public function test_draft_workflow_maintains_correct_state(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Save as draft
        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => true,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Application draft saved.');

        // Verify draft state
        $this->assertDatabaseHas('applications', [
            'camper_id' => $camper->id,
            'is_draft' => true,
        ]);

        $application = Application::where('camper_id', $camper->id)->first();
        $this->assertNull($application->submitted_at);

        // Verify no notification sent for draft
        Queue::assertNotPushed(SendNotificationJob::class);
    }

    public function test_draft_to_submitted_workflow(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);

        // Create draft
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'is_draft' => true,
            'submitted_at' => null,
        ]);

        // Submit draft
        $response = $this->actingAs($parent)->putJson("/api/applications/{$application->id}", [
            'submit' => true,
        ]);

        $response->assertStatus(200);

        // Verify state change
        $application->refresh();
        $this->assertFalse($application->is_draft);
        $this->assertNotNull($application->submitted_at);

        // Verify notification was queued
        Queue::assertPushed(SendNotificationJob::class);
    }

    public function test_complete_application_review_workflow(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Submitted,
        ]);

        // Review application
        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'approved',
            'notes' => 'Application approved',
            'override_incomplete' => true, // workflow test — not testing compliance enforcement
        ]);

        // Verify response
        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Application reviewed successfully.');

        // Verify database state
        $application->refresh();
        $this->assertEquals(ApplicationStatus::Approved, $application->status);
        $this->assertEquals('Application approved', $application->notes);
        $this->assertNotNull($application->reviewed_at);
        $this->assertEquals($admin->id, $application->reviewed_by);

        // Verify notification was queued
        Queue::assertPushed(SendNotificationJob::class);

        // Verify audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'update',
        ]);
    }

    public function test_application_rejection_workflow(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Submitted,
        ]);

        // Reject application
        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'rejected',
            'notes' => 'Insufficient documentation',
        ]);

        $response->assertStatus(200);

        // Verify rejection
        $application->refresh();
        $this->assertEquals(ApplicationStatus::Rejected, $application->status);
        $this->assertEquals('Insufficient documentation', $application->notes);

        // Verify notification was queued
        Queue::assertPushed(SendNotificationJob::class);
    }

    public function test_parent_can_view_own_application_after_submission(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Submitted,
        ]);

        // View application
        $response = $this->actingAs($parent)->getJson("/api/applications/{$application->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.id', $application->id);
        $response->assertJsonPath('data.status', 'submitted');
    }

    public function test_parent_can_edit_pending_application(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Submitted,
        ]);

        // Parents can edit narrative fields but NOT internal admin notes
        $response = $this->actingAs($parent)->putJson("/api/applications/{$application->id}", [
            'narrative_camp_benefit' => 'Camp helps with socialisation.',
        ]);

        $response->assertStatus(200);

        $application->refresh();
        $this->assertEquals('Camp helps with socialisation.', $application->narrative_camp_benefit);
    }

    public function test_parent_cannot_set_admin_notes(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Submitted,
            'notes' => 'Original admin note',
        ]);

        // The notes field is filtered out for non-admin roles — the original value must survive.
        $this->actingAs($parent)->putJson("/api/applications/{$application->id}", [
            'notes' => 'Parent trying to overwrite admin notes',
        ]);

        $application->refresh();
        $this->assertEquals('Original admin note', $application->notes);
    }

    public function test_parent_cannot_edit_approved_application(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => ApplicationStatus::Approved,
        ]);

        // Try to edit approved application
        $response = $this->actingAs($parent)->putJson("/api/applications/{$application->id}", [
            'narrative_camp_benefit' => 'Should not work',
        ]);

        $response->assertStatus(403);
    }

    public function test_admin_can_filter_applications_by_status(): void
    {
        $admin = $this->createAdmin();

        Application::factory()->count(3)->create(['status' => ApplicationStatus::Submitted]);
        Application::factory()->count(2)->create(['status' => ApplicationStatus::Approved]);
        Application::factory()->count(1)->create(['status' => ApplicationStatus::Rejected]);

        // Filter by submitted
        $response = $this->actingAs($admin)->getJson('/api/applications?status=submitted');
        $response->assertStatus(200);
        $this->assertCount(3, $response->json('data'));

        // Filter by approved
        $response = $this->actingAs($admin)->getJson('/api/applications?status=approved');
        $response->assertStatus(200);
        $this->assertCount(2, $response->json('data'));
    }

    public function test_admin_can_filter_applications_by_session(): void
    {
        $admin = $this->createAdmin();

        $session1 = \App\Models\CampSession::factory()->create();
        $session2 = \App\Models\CampSession::factory()->create();

        Application::factory()->count(3)->create(['camp_session_id' => $session1->id]);
        Application::factory()->count(2)->create(['camp_session_id' => $session2->id]);

        // Filter by session 1
        $response = $this->actingAs($admin)->getJson("/api/applications?camp_session_id={$session1->id}");
        $response->assertStatus(200);
        $this->assertCount(3, $response->json('data'));
    }

    public function test_duplicate_applications_are_prevented(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Create first application
        Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
        ]);

        // Try to create duplicate
        $response = $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
        ]);

        $response->assertStatus(422);
    }
}
