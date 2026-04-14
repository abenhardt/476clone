<?php

namespace Tests\Feature\Regression;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\MedicalRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for camper and medical record activation/deactivation on application status changes.
 *
 * Verifies the "operational activation" lifecycle:
 *  - Camper becomes is_active=true when an application is approved.
 *  - MedicalRecord is created (if absent) and set is_active=true on first approval.
 *  - Camper becomes is_active=false on reversal (Approved → Rejected/Cancelled) when
 *    no other approved application exists for the same camper.
 *  - Camper remains is_active=true on reversal when another approved application exists.
 *  - MedicalRecord follows the same activation rules as the camper.
 *  - Parent withdrawal of an approved application triggers correct deactivation.
 */
class CamperActivationTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_camper_becomes_active_on_approval(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => false]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'is_draft' => false,
        ]);

        $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => ApplicationStatus::Approved->value,
            'override_incomplete' => true,
        ])->assertStatus(200);

        $this->assertDatabaseHas('campers', ['id' => $camper->id, 'is_active' => true]);
    }

    public function test_medical_record_created_and_activated_on_first_approval(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => false]);

        // Ensure no medical record exists before approval.
        $this->assertDatabaseMissing('medical_records', ['camper_id' => $camper->id]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'is_draft' => false,
        ]);

        $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => ApplicationStatus::Approved->value,
            'override_incomplete' => true,
        ])->assertStatus(200);

        $this->assertDatabaseHas('medical_records', [
            'camper_id' => $camper->id,
            'is_active' => true,
        ]);
    }

    public function test_existing_medical_record_activated_on_approval(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => false]);

        // Pre-existing inactive medical record from a prior cycle.
        MedicalRecord::factory()->create(['camper_id' => $camper->id, 'is_active' => false]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'is_draft' => false,
        ]);

        $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => ApplicationStatus::Approved->value,
            'override_incomplete' => true,
        ])->assertStatus(200);

        $this->assertDatabaseHas('medical_records', [
            'camper_id' => $camper->id,
            'is_active' => true,
        ]);
        // Exactly one medical record — firstOrCreate must not duplicate.
        $this->assertEquals(1, MedicalRecord::where('camper_id', $camper->id)->count());
    }

    public function test_camper_deactivated_when_sole_approved_application_is_reversed(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => true]);
        MedicalRecord::factory()->create(['camper_id' => $camper->id, 'is_active' => true]);

        $approvedApp = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Approved,
            'is_draft' => false,
        ]);

        $this->actingAs($admin)->postJson("/api/applications/{$approvedApp->id}/review", [
            'status' => ApplicationStatus::Rejected->value,
        ])->assertStatus(200);

        $this->assertDatabaseHas('campers', ['id' => $camper->id, 'is_active' => false]);
        $this->assertDatabaseHas('medical_records', ['camper_id' => $camper->id, 'is_active' => false]);
    }

    public function test_camper_remains_active_when_reversal_but_other_approved_application_exists(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $session1 = CampSession::factory()->create(['capacity' => 50]);
        $session2 = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => true]);
        MedicalRecord::factory()->create(['camper_id' => $camper->id, 'is_active' => true]);

        // Two approved applications for the same camper in different sessions.
        $app1 = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session1->id,
            'status' => ApplicationStatus::Approved,
            'is_draft' => false,
        ]);
        Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session2->id,
            'status' => ApplicationStatus::Approved,
            'is_draft' => false,
        ]);

        // Reverse only the first application.
        $this->actingAs($admin)->postJson("/api/applications/{$app1->id}/review", [
            'status' => ApplicationStatus::Rejected->value,
        ])->assertStatus(200);

        // Camper should still be active because session2 application is still approved.
        $this->assertDatabaseHas('campers', ['id' => $camper->id, 'is_active' => true]);
        $this->assertDatabaseHas('medical_records', ['camper_id' => $camper->id, 'is_active' => true]);
    }

    public function test_camper_deactivated_on_parent_withdrawal_of_approved_application(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => true]);
        MedicalRecord::factory()->create(['camper_id' => $camper->id, 'is_active' => true]);

        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Approved,
            'is_draft' => false,
        ]);

        $this->actingAs($parent)->postJson("/api/applications/{$application->id}/withdraw")
            ->assertStatus(200);

        $this->assertDatabaseHas('campers', ['id' => $camper->id, 'is_active' => false]);
        $this->assertDatabaseHas('medical_records', ['camper_id' => $camper->id, 'is_active' => false]);
    }

    public function test_camper_not_deactivated_on_withdrawal_of_non_approved_application(): void
    {
        $parent = $this->createParent();
        $session = CampSession::factory()->create(['capacity' => 50]);
        $camper = Camper::factory()->create(['user_id' => $parent->id, 'is_active' => true]);

        // Submitted (not approved) application — withdrawal should not deactivate camper.
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => ApplicationStatus::Submitted,
            'is_draft' => false,
        ]);

        $this->actingAs($parent)->postJson("/api/applications/{$application->id}/withdraw")
            ->assertStatus(200);

        // Camper was already active for another reason; should remain active.
        $this->assertDatabaseHas('campers', ['id' => $camper->id, 'is_active' => true]);
    }
}
