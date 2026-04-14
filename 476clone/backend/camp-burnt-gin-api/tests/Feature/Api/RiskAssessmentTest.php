<?php

namespace Tests\Feature\Api;

use App\Enums\RiskReviewStatus;
use App\Enums\SupervisionLevel;
use App\Models\Allergy;
use App\Models\BehavioralProfile;
use App\Models\Camper;
use App\Models\MedicalRecord;
use App\Models\RiskAssessment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for the full risk assessment API.
 *
 * Covers:
 *  - GET  /api/campers/{camper}/risk-assessment  (show)
 *  - POST /api/campers/{camper}/risk-assessment/review
 *  - POST /api/campers/{camper}/risk-assessment/override
 *  - GET  /api/campers/{camper}/risk-assessment/history
 *
 * Permission model:
 *  admin      → view, review, history  (cannot override)
 *  medical    → view, review, override, history
 *  super_admin → all
 *  applicant  → none
 */
class RiskAssessmentTest extends TestCase
{
    use RefreshDatabase;
    use WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    // ── Show (GET /risk-assessment) ──────────────────────────────────────────

    public function test_admin_can_view_risk_assessment(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);
        MedicalRecord::factory()->for($camper)->create();

        $response = $this->actingAs($admin)
            ->getJson("/api/campers/{$camper->id}/risk-assessment");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'id', 'camper_id', 'calculated_at',
                    'risk_score', 'risk_level', 'risk_level_color',
                    'supervision_level', 'supervision_label', 'staffing_ratio',
                    'effective_supervision_level', 'effective_supervision_label',
                    'medical_complexity_tier', 'complexity_label',
                    'flags', 'factor_breakdown',
                    'review_status', 'review_status_label', 'is_reviewed_by_staff',
                    'recommendations',
                ],
            ]);
    }

    public function test_medical_staff_can_view_risk_assessment_for_active_camper(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        $response = $this->actingAs($medical)
            ->getJson("/api/campers/{$camper->id}/risk-assessment");

        $response->assertStatus(200);
    }

    public function test_applicant_cannot_view_risk_assessment(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        $response = $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/risk-assessment");

        $response->assertStatus(403);
    }

    public function test_unauthenticated_cannot_view_risk_assessment(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create();

        $response = $this->getJson("/api/campers/{$camper->id}/risk-assessment");

        $response->assertStatus(401);
    }

    public function test_risk_assessment_includes_factor_breakdown(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        // Seed a seizure flag to ensure it appears in the breakdown
        MedicalRecord::factory()->for($camper)->create(['has_seizures' => true]);

        $response = $this->actingAs($admin)
            ->getJson("/api/campers/{$camper->id}/risk-assessment");

        $response->assertStatus(200);

        $factors = $response->json('data.factor_breakdown');
        $this->assertIsArray($factors);

        // Find the seizure factor
        $seizureFactor = collect($factors)->firstWhere('key', 'seizures');
        $this->assertNotNull($seizureFactor, 'seizures factor should be in breakdown');
        $this->assertTrue($seizureFactor['present'], 'seizures should be present');
        $this->assertEquals(20, $seizureFactor['points']);
    }

    public function test_risk_score_includes_life_threatening_allergy(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);
        Allergy::factory()->for($camper)->create(['severity' => 'life_threatening']);

        $response = $this->actingAs($admin)
            ->getJson("/api/campers/{$camper->id}/risk-assessment");

        $response->assertStatus(200);
        // Life-threatening allergy adds 15 points — score should be at least 15
        $this->assertGreaterThanOrEqual(15, $response->json('data.risk_score'));
    }

    public function test_assessment_persists_to_database(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        $this->assertDatabaseCount('risk_assessments', 0);

        $this->actingAs($admin)
            ->getJson("/api/campers/{$camper->id}/risk-assessment")
            ->assertStatus(200);

        $this->assertDatabaseCount('risk_assessments', 1);
        $this->assertDatabaseHas('risk_assessments', [
            'camper_id' => $camper->id,
            'is_current' => true,
        ]);
    }

    // ── Review (POST /risk-assessment/review) ───────────────────────────────

    public function test_medical_staff_can_review_assessment(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        // Create an assessment to review
        RiskAssessment::factory()->for($camper)->create([
            'is_current' => true,
            'review_status' => RiskReviewStatus::SystemCalculated,
        ]);

        $response = $this->actingAs($medical)->postJson(
            "/api/campers/{$camper->id}/risk-assessment/review",
            ['clinical_notes' => 'Reviewed with nursing staff. Assessment is appropriate for this camper.']
        );

        $response->assertStatus(200)
            ->assertJsonPath('data.review_status', 'reviewed')
            ->assertJsonPath('data.is_reviewed_by_staff', true);

        $this->assertDatabaseHas('risk_assessments', [
            'camper_id' => $camper->id,
            'review_status' => 'reviewed',
        ]);
    }

    public function test_admin_can_review_assessment(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        RiskAssessment::factory()->for($camper)->create([
            'is_current' => true,
            'review_status' => RiskReviewStatus::SystemCalculated,
        ]);

        $this->actingAs($admin)->postJson(
            "/api/campers/{$camper->id}/risk-assessment/review",
            []
        )->assertStatus(200);
    }

    public function test_applicant_cannot_review_assessment(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        $this->actingAs($parent)->postJson(
            "/api/campers/{$camper->id}/risk-assessment/review",
            []
        )->assertStatus(403);
    }

    // ── Override (POST /risk-assessment/override) ───────────────────────────

    public function test_medical_staff_can_override_supervision_level(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        RiskAssessment::factory()->for($camper)->create([
            'is_current' => true,
            'supervision_level' => SupervisionLevel::Standard,
            'review_status' => RiskReviewStatus::SystemCalculated,
        ]);

        $response = $this->actingAs($medical)->postJson(
            "/api/campers/{$camper->id}/risk-assessment/override",
            [
                'override_supervision_level' => 'enhanced',
                'override_reason' => 'Camper has newly identified anxiety-related behaviours not yet reflected in profile. Enhanced supervision warranted pending profile update.',
            ]
        );

        $response->assertStatus(200)
            ->assertJsonPath('data.review_status', 'overridden')
            ->assertJsonPath('data.override_supervision_level', 'enhanced')
            ->assertJsonPath('data.is_overridden', true)
            ->assertJsonPath('data.effective_supervision_level', 'enhanced');
    }

    public function test_super_admin_can_override_supervision_level(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        RiskAssessment::factory()->for($camper)->create([
            'is_current' => true,
            'supervision_level' => SupervisionLevel::Standard,
            'review_status' => RiskReviewStatus::SystemCalculated,
        ]);

        $this->actingAs($superAdmin)->postJson(
            "/api/campers/{$camper->id}/risk-assessment/override",
            [
                'override_supervision_level' => 'one_to_one',
                'override_reason' => 'Operational concern: short-staffed this session, upgrading to 1:1 as precaution per director request.',
            ]
        )->assertStatus(200);
    }

    public function test_override_requires_reason_of_at_least_20_characters(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        RiskAssessment::factory()->for($camper)->create([
            'is_current' => true,
        ]);

        $this->actingAs($medical)->postJson(
            "/api/campers/{$camper->id}/risk-assessment/override",
            [
                'override_supervision_level' => 'enhanced',
                'override_reason' => 'Too short',
            ]
        )->assertStatus(422)
            ->assertJsonValidationErrors(['override_reason']);
    }

    public function test_effective_supervision_level_reflects_override(): void
    {
        $medical = $this->createMedicalProvider();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        // System calculates standard — medical overrides to one_to_one
        RiskAssessment::factory()->for($camper)->create([
            'is_current' => true,
            'supervision_level' => SupervisionLevel::Standard,
            'review_status' => RiskReviewStatus::Overridden,
            'override_supervision_level' => SupervisionLevel::OneToOne,
            'override_reason' => 'Clinical justification on file from attending physician.',
        ]);

        $admin = $this->createAdmin();
        $response = $this->actingAs($admin)
            ->getJson("/api/campers/{$camper->id}/risk-assessment/history");

        $response->assertStatus(200);
        $record = $response->json('data.0');
        $this->assertEquals('one_to_one', $record['effective_supervision_level']);
        $this->assertTrue($record['is_overridden']);
    }

    // ── History (GET /risk-assessment/history) ───────────────────────────────

    public function test_admin_can_view_assessment_history(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        RiskAssessment::factory()->for($camper)->count(3)->create(['is_current' => false]);
        RiskAssessment::factory()->for($camper)->create(['is_current' => true]);

        $response = $this->actingAs($admin)
            ->getJson("/api/campers/{$camper->id}/risk-assessment/history");

        $response->assertStatus(200);
        $this->assertCount(4, $response->json('data'));
    }

    public function test_applicant_cannot_view_assessment_history(): void
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/risk-assessment/history")
            ->assertStatus(403);
    }

    // ── Legacy risk-summary backward compatibility ───────────────────────────

    public function test_legacy_risk_summary_still_works(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        $response = $this->actingAs($admin)
            ->getJson("/api/campers/{$camper->id}/risk-summary");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'risk_score', 'supervision_level', 'supervision_label',
                    'staffing_ratio', 'effective_supervision_level',
                    'medical_complexity_tier', 'complexity_label', 'flags',
                    'review_status', 'is_overridden',
                ],
            ]);
    }

    // ── Override — admin is blocked ──────────────────────────────────────────

    public function test_regular_admin_cannot_override_supervision_level(): void
    {
        // Route middleware for override was previously `role:admin,medical`, which
        // allowed regular admins past the route guard only to receive a 403 from the
        // policy. Middleware is now `role:medical,super_admin` so admins are blocked
        // before the controller is reached.
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        RiskAssessment::factory()->for($camper)->create([
            'is_current' => true,
            'supervision_level' => SupervisionLevel::Standard,
        ]);

        $this->actingAs($admin)->postJson(
            "/api/campers/{$camper->id}/risk-assessment/override",
            [
                'override_supervision_level' => 'enhanced',
                'override_reason' => 'This should be blocked for regular admins.',
            ]
        )->assertStatus(403);
    }

    // ── Legacy endpoint — applicant access blocked ───────────────────────────

    public function test_applicant_cannot_access_legacy_risk_summary(): void
    {
        // CamperPolicy::view allows parents to see their own child's camper record,
        // but riskSummary() should explicitly block applicants because risk scores,
        // supervision levels, and flags are operational staff data, not parent-facing.
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        $this->actingAs($parent)
            ->getJson("/api/campers/{$camper->id}/risk-summary")
            ->assertStatus(403);
    }

    // ── AllergyObserver — life-threatening allergy triggers recalculation ────

    public function test_adding_life_threatening_allergy_updates_supervision_level(): void
    {
        // Validates that AllergyObserver fires assessCamper() when an allergy is saved,
        // keeping campers.supervision_level in sync without requiring a page load.
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);

        // Add a life-threatening allergy (+15 pts) — observer should recalculate immediately
        Allergy::factory()->for($camper)->create(['severity' => 'life_threatening']);

        // Observer fires synchronously on Allergy::saved → a risk_assessments row must exist
        $this->assertDatabaseHas('risk_assessments', [
            'camper_id' => $camper->id,
            'is_current' => true,
        ]);

        // Adding seizures (+20 pts) pushes total to 35 pts → Enhanced supervision (21–40)
        // This tests MedicalRecordObserver in combination with the allergy score.
        MedicalRecord::factory()->for($camper)->create(['has_seizures' => true]);

        $camper->refresh();
        $this->assertEquals(
            'enhanced',
            $camper->supervision_level instanceof \App\Enums\SupervisionLevel
                ? $camper->supervision_level->value
                : $camper->supervision_level
        );
    }

    // ── Behavioral profile feeds risk score correctly ────────────────────────

    public function test_one_to_one_supervision_flag_drives_high_risk_score(): void
    {
        // one_to_one_supervision = 30 pts + wandering_risk = 15 pts = 45 pts → OneToOne (41+).
        // All other boolean flags are explicitly false to give a deterministic score.
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $camper = Camper::factory()->for($parent, 'user')->create(['is_active' => true]);
        BehavioralProfile::factory()->for($camper)->create([
            'one_to_one_supervision' => true,
            'wandering_risk' => true,
            'aggression' => false,
            'self_abuse' => false,
            'developmental_delay' => false,
        ]);

        $response = $this->actingAs($admin)
            ->getJson("/api/campers/{$camper->id}/risk-assessment");

        $response->assertStatus(200);
        // 30 (one_to_one) + 15 (wandering) = 45 pts → OneToOne supervision (41+)
        $this->assertGreaterThanOrEqual(45, $response->json('data.risk_score'));
        $this->assertEquals('one_to_one', $response->json('data.supervision_level'));
    }
}
