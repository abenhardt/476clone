<?php

namespace Tests\Feature\Regression;

use App\Jobs\SendNotificationJob;
use App\Models\Application;
use App\Models\Camper;
use App\Notifications\Camper\ApplicationStatusChangedNotification;
use App\Notifications\Camper\ApplicationSubmittedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression tests for queued notifications.
 *
 * Verifies that notifications are dispatched to the queue instead of
 * being sent synchronously, improving response times.
 */
class QueuedNotificationsTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Queue::fake();
    }

    public function test_application_submission_queues_notification(): void
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

        $response->assertStatus(201);

        // Verify notification was queued (not sent synchronously)
        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->notification instanceof ApplicationSubmittedNotification;
        });
    }

    public function test_draft_application_does_not_queue_notification(): void
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

        // Verify NO notification was queued for draft
        Queue::assertNotPushed(SendNotificationJob::class);
    }

    public function test_converting_draft_to_submitted_queues_notification(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'is_draft' => true,
        ]);

        // Convert draft to submitted
        $response = $this->actingAs($parent)->putJson("/api/applications/{$application->id}", [
            'submit' => true,
        ]);

        $response->assertStatus(200);

        // Verify notification was queued
        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->notification instanceof ApplicationSubmittedNotification;
        });
    }

    public function test_application_review_queues_notification(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'status' => 'submitted',
        ]);

        // Review application
        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'approved',
            'notes' => 'Approved',
            'override_incomplete' => true, // notification test — not testing compliance enforcement
        ]);

        $response->assertStatus(200);

        // Verify notification was queued
        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->notification instanceof ApplicationStatusChangedNotification;
        });
    }

    public function test_notification_job_targets_correct_user(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Submit application
        $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
        ]);

        // Verify job contains the correct notifiable user
        Queue::assertPushed(SendNotificationJob::class, function ($job) use ($parent) {
            return $job->notifiable->id === $parent->id;
        });
    }

    public function test_notification_job_uses_notifications_queue(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Submit application
        $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
        ]);

        // Verify job is queued on 'notifications' queue
        Queue::assertPushedOn('notifications', SendNotificationJob::class);
    }

    public function test_multiple_application_submissions_queue_multiple_notifications(): void
    {
        $parent = $this->createParent();
        $camper1 = Camper::factory()->create(['user_id' => $parent->id]);
        $camper2 = Camper::factory()->create(['user_id' => $parent->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Submit two applications
        $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper1->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
        ]);

        $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper2->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
        ]);

        // Verify two notifications were queued
        Queue::assertPushed(SendNotificationJob::class, 2);
    }

    public function test_notification_job_has_retry_configuration(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = \App\Models\CampSession::factory()->create();

        // Submit application
        $this->actingAs($parent)->postJson('/api/applications', [
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
        ]);

        // Verify job has retry settings
        Queue::assertPushed(SendNotificationJob::class, function ($job) {
            return $job->tries === 3 &&
                   $job->backoff === [60, 300, 900] &&
                   $job->maxExceptions === 3;
        });
    }
}
