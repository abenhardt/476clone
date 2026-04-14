<?php

namespace Tests\Feature\Regression;

use App\Models\AuditLog;
use App\Models\Camper;
use App\Models\MedicalRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression tests for audit failure resilience.
 *
 * Verifies that audit logging failures do not crash the application
 * and that requests proceed gracefully despite audit failures.
 */
class AuditFailureResilienceTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_request_succeeds_when_audit_log_table_is_broken(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        // Temporarily break the audit_logs table by renaming it
        DB::statement('ALTER TABLE audit_logs RENAME TO audit_logs_backup');

        try {
            // Request should still succeed despite audit failure
            $response = $this->actingAs($admin)->getJson("/api/medical-records/{$medicalRecord->id}");

            $response->assertStatus(200);
            $response->assertJsonPath('data.id', $medicalRecord->id);
        } finally {
            // Restore the table for other tests
            DB::statement('ALTER TABLE audit_logs_backup RENAME TO audit_logs');
        }
    }

    public function test_audit_failure_is_logged_to_error_log(): void
    {
        Log::spy();

        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        // Break audit logs
        DB::statement('ALTER TABLE audit_logs RENAME TO audit_logs_backup');

        try {
            // Make request
            $this->actingAs($admin)->getJson("/api/medical-records/{$medicalRecord->id}");

            // Verify error was logged
            Log::shouldHaveReceived('error')
                ->once()
                ->withArgs(function ($message, $context) use ($admin) {
                    return $message === 'AUDIT LOG FAILED - PHI access not recorded' &&
                           $context['user_id'] === $admin->id &&
                           isset($context['exception']);
                });
        } finally {
            DB::statement('ALTER TABLE audit_logs_backup RENAME TO audit_logs');
        }
    }

    public function test_audit_failure_includes_full_context(): void
    {
        Log::spy();

        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        DB::statement('ALTER TABLE audit_logs RENAME TO audit_logs_backup');

        try {
            $this->actingAs($admin)->getJson("/api/medical-records/{$medicalRecord->id}");

            // Verify logged context includes all necessary info for debugging
            Log::shouldHaveReceived('error')
                ->once()
                ->withArgs(function ($message, $context) {
                    return isset($context['exception']) &&
                           isset($context['user_id']) &&
                           isset($context['route']) &&
                           isset($context['method']) &&
                           isset($context['path']) &&
                           isset($context['ip']);
                });
        } finally {
            DB::statement('ALTER TABLE audit_logs_backup RENAME TO audit_logs');
        }
    }

    public function test_successful_audit_still_works_after_failure(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        // Simulate audit failure by breaking table
        DB::statement('ALTER TABLE audit_logs RENAME TO audit_logs_backup');

        try {
            // This request should succeed but not audit
            $response1 = $this->actingAs($admin)->getJson("/api/medical-records/{$medicalRecord->id}");
            $response1->assertStatus(200);
        } finally {
            // Restore table
            DB::statement('ALTER TABLE audit_logs_backup RENAME TO audit_logs');
        }

        // This request should succeed AND audit
        $response2 = $this->actingAs($admin)->getJson("/api/medical-records/{$medicalRecord->id}");
        $response2->assertStatus(200);

        // Verify audit log was created for second request
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
        ]);
    }

    public function test_multiple_requests_proceed_despite_continuous_audit_failure(): void
    {
        $admin = $this->createAdmin();
        $camper1 = Camper::factory()->create();
        $camper2 = Camper::factory()->create();
        $medicalRecord1 = MedicalRecord::factory()->create(['camper_id' => $camper1->id]);
        $medicalRecord2 = MedicalRecord::factory()->create(['camper_id' => $camper2->id]);

        DB::statement('ALTER TABLE audit_logs RENAME TO audit_logs_backup');

        try {
            // Multiple requests should all succeed
            $response1 = $this->actingAs($admin)->getJson("/api/medical-records/{$medicalRecord1->id}");
            $response2 = $this->actingAs($admin)->getJson("/api/medical-records/{$medicalRecord2->id}");
            $response3 = $this->actingAs($admin)->getJson('/api/medical-records');

            $response1->assertStatus(200);
            $response2->assertStatus(200);
            $response3->assertStatus(200);
        } finally {
            DB::statement('ALTER TABLE audit_logs_backup RENAME TO audit_logs');
        }
    }

    public function test_audit_failure_does_not_expose_internal_errors_to_client(): void
    {
        $admin = $this->createAdmin();
        $camper = Camper::factory()->create();
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $camper->id]);

        DB::statement('ALTER TABLE audit_logs RENAME TO audit_logs_backup');

        try {
            $response = $this->actingAs($admin)->getJson("/api/medical-records/{$medicalRecord->id}");

            // Response should not contain error details about audit failure
            $response->assertStatus(200);
            $response->assertJsonMissing(['audit_error', 'audit_failed']);
            $responseContent = $response->getContent();
            $this->assertStringNotContainsString('audit_logs', $responseContent);
            $this->assertStringNotContainsString('SQLSTATE', $responseContent);
        } finally {
            DB::statement('ALTER TABLE audit_logs_backup RENAME TO audit_logs');
        }
    }

    public function test_authorization_still_enforced_when_audit_fails(): void
    {
        $parent = $this->createParent();
        $otherCamper = Camper::factory()->create();
        $medicalRecord = MedicalRecord::factory()->create(['camper_id' => $otherCamper->id]);

        DB::statement('ALTER TABLE audit_logs RENAME TO audit_logs_backup');

        try {
            // Unauthorized access should still be blocked
            $response = $this->actingAs($parent)->getJson("/api/medical-records/{$medicalRecord->id}");
            $response->assertStatus(403);
        } finally {
            DB::statement('ALTER TABLE audit_logs_backup RENAME TO audit_logs');
        }
    }
}
