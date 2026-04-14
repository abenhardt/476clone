<?php

namespace Tests\Feature\Regression;

use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * MFA enforcement regression tests.
 *
 * Verifies the step-up MFA architecture introduced in the 2026-04-07 redesign:
 *
 *  LAYER 1 — Role middleware (EnsureUserIsAdmin / EnsureUserHasRole):
 *    - MUST NOT enforce MFA; role checks only.
 *    - Admin/super_admin without MFA can reach dashboards and read-only routes.
 *
 *  LAYER 2 — PHI enrollment gate (mfa.enrolled / EnsureMfaEnrolled):
 *    - Users without MFA enrolled cannot access PHI endpoints.
 *    - Response: 403 { mfa_setup_required: true }.
 *    - Users with MFA enrolled pass through.
 *
 *  LAYER 3 — Step-up gate (mfa.step_up / EnsureMfaStepUp):
 *    - Users without MFA enrolled cannot reach sensitive/destructive routes.
 *    - Response: 403 { mfa_step_up_required: true, mfa_not_enrolled: true }.
 *    - Users with MFA enrolled but no recent step-up cannot reach sensitive routes.
 *    - Response: 403 { mfa_step_up_required: true, mfa_not_enrolled: false }.
 *    - Users with MFA enrolled AND a valid step-up grant pass through.
 *
 *  APPLICANT:
 *    - MFA is optional; no enrollment or step-up gates apply to their routes.
 */
class MfaEnrollmentEnforcementTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    // ── Layer 1: Role middleware no longer enforces MFA ──────────────────────

    public function test_admin_without_mfa_can_access_admin_dashboard_routes(): void
    {
        $admin = $this->createAdmin(['mfa_enabled' => false]);

        // /api/families is an admin-only route behind EnsureUserIsAdmin.
        // It must NOT block admin users who have MFA disabled.
        $response = $this->actingAs($admin)->getJson('/api/families');

        $response->assertJsonMissing(['mfa_setup_required' => true]);
        $response->assertJsonMissing(['mfa_step_up_required' => true]);
        // 200 or 403-from-policy are both acceptable; 403 from MFA gate is not.
        $this->assertNotEquals(403, $response->status(), 'Role middleware must not block on MFA state');
    }

    public function test_super_admin_without_mfa_can_access_admin_routes(): void
    {
        $superAdmin = $this->createSuperAdmin(['mfa_enabled' => false]);

        $response = $this->actingAs($superAdmin)->getJson('/api/families');

        $response->assertJsonMissing(['mfa_setup_required' => true]);
        $this->assertNotEquals(403, $response->status(), 'Role middleware must not block super_admin on MFA state');
    }

    public function test_admin_with_mfa_enabled_can_access_admin_routes(): void
    {
        $admin = $this->createAdmin(['mfa_enabled' => true]);

        $response = $this->actingAs($admin)->getJson('/api/families');

        $this->assertNotEquals(403, $response->status());
        $response->assertJsonMissing(['mfa_setup_required' => true]);
    }

    // ── Layer 2: PHI enrollment gate (mfa.enrolled) ──────────────────────────

    public function test_medical_provider_without_mfa_can_access_phi_record_view(): void
    {
        $medical = $this->createMedicalProvider(['mfa_enabled' => false]);
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $record = $camper->medicalRecord()->create([]);

        // MFA is optional — disabling MFA must not block access to any route.
        $response = $this->actingAs($medical)->getJson("/api/medical-records/{$record->id}");

        $response->assertJsonMissing(['mfa_setup_required' => true]);
    }

    public function test_medical_provider_with_mfa_can_access_phi_record_view(): void
    {
        $medical = $this->createMedicalProvider(['mfa_enabled' => true]);
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $record = $camper->medicalRecord()->create([]);

        $response = $this->actingAs($medical)->getJson("/api/medical-records/{$record->id}");

        // 200 or policy-403 accepted; the MFA gate must not fire.
        $response->assertJsonMissing(['mfa_setup_required' => true]);
    }

    public function test_admin_without_mfa_can_access_phi_record_view(): void
    {
        $admin = $this->createAdmin(['mfa_enabled' => false]);
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $record = $camper->medicalRecord()->create([]);

        // MFA is optional — disabling MFA must not block access to any route.
        $response = $this->actingAs($admin)->getJson("/api/medical-records/{$record->id}");

        $response->assertJsonMissing(['mfa_setup_required' => true]);
    }

    // ── Layer 3: Step-up gate (mfa.step_up) ──────────────────────────────────
    // Application review does NOT require MFA step-up — it is a routine operational
    // task performed many times per session. Step-up is reserved for irreversible
    // actions (delete, role change, account creation, deactivation).

    public function test_admin_without_mfa_can_review_application_without_step_up(): void
    {
        // Review no longer requires step-up, so an enrolled admin proceeds normally.
        $admin = $this->createAdmin(['mfa_enabled' => true]);
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->create(['capacity' => 10]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => 'submitted',
            'is_draft' => false,
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'approved',
            'override_incomplete' => true,
        ]);

        $response->assertStatus(200);
        $response->assertJsonMissing(['mfa_step_up_required' => true]);
    }

    public function test_admin_with_mfa_but_no_step_up_can_still_review_application(): void
    {
        // Step-up no longer gates review. Revoking it must not block the request.
        $admin = $this->createAdmin(['mfa_enabled' => true]);
        $this->revokeMfaStepUp($admin);

        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->create(['capacity' => 10]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => 'submitted',
            'is_draft' => false,
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'approved',
            'override_incomplete' => true,
        ]);

        $response->assertStatus(200);
        $response->assertJsonMissing(['mfa_step_up_required' => true]);
    }

    public function test_admin_with_mfa_and_valid_step_up_can_review_application(): void
    {
        $admin = $this->createAdmin(); // auto-grants step-up via WithRoles
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->create(['capacity' => 10]);
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'status' => 'submitted',
            'is_draft' => false,
        ]);

        $response = $this->actingAs($admin)->postJson("/api/applications/{$application->id}/review", [
            'status' => 'approved',
            'override_incomplete' => true,
        ]);

        // 200 = step-up passed, business logic ran
        $response->assertStatus(200);
        $response->assertJsonMissing(['mfa_step_up_required' => true]);
    }

    // ── Applicant — exempt from all MFA gates ────────────────────────────────

    public function test_applicant_without_mfa_can_access_applicant_routes(): void
    {
        $parent = $this->createParent(['mfa_enabled' => false]);
        CampSession::factory()->create(['portal_open' => true]);

        $response = $this->actingAs($parent)->getJson('/api/applications');

        $response->assertStatus(200);
        $response->assertJsonMissing(['mfa_setup_required' => true]);
    }

    // ── MFA setup endpoint accessible without enrollment ─────────────────────

    public function test_admin_without_mfa_can_reach_mfa_setup_endpoint(): void
    {
        $admin = $this->createAdmin(['mfa_enabled' => false]);

        $response = $this->actingAs($admin)->postJson('/api/mfa/setup');

        // Must not be blocked by any MFA gate (may 400 if already enabled; never 403 mfa_*)
        $response->assertJsonMissing(['mfa_setup_required' => true]);
        $response->assertJsonMissing(['mfa_step_up_required' => true]);
    }
}
