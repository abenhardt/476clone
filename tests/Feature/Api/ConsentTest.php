<?php

namespace Tests\Feature\Api;

use App\Models\Application;
use App\Models\ApplicationConsent;
use App\Models\Camper;
use App\Models\CampSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for the /api/applications/{id}/consents endpoint.
 *
 * Verifies that all 7 consent types are accepted, persisted, and
 * idempotent, and that unauthorized callers are blocked.
 */
class ConsentTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    private function makeConsentPayload(string $type): array
    {
        return [
            'consent_type' => $type,
            'guardian_name' => 'Test Guardian',
            'guardian_relationship' => 'Parent',
            'guardian_signature' => 'data:image/png;base64,fake',
            'signed_at' => now()->toISOString(),
        ];
    }

    private function createApplicationForParent(): array
    {
        $parent = $this->createParent();
        $camper = Camper::factory()->create(['user_id' => $parent->id]);
        $session = CampSession::factory()->create();
        $application = Application::factory()->create([
            'camper_id' => $camper->id,
            'camp_session_id' => $session->id,
            'is_draft' => false,
        ]);

        return [$parent, $application];
    }

    public function test_all_seven_consent_types_are_accepted(): void
    {
        [$parent, $application] = $this->createApplicationForParent();

        $types = ['general', 'photos', 'liability', 'activity', 'authorization', 'medication', 'hipaa'];

        $response = $this->actingAs($parent)->postJson(
            "/api/applications/{$application->id}/consents",
            ['consents' => array_map([$this, 'makeConsentPayload'], $types)]
        );

        $response->assertStatus(200);
        $this->assertCount(7, ApplicationConsent::where('application_id', $application->id)->get());
    }

    public function test_medication_consent_is_persisted(): void
    {
        [$parent, $application] = $this->createApplicationForParent();

        $this->actingAs($parent)->postJson(
            "/api/applications/{$application->id}/consents",
            ['consents' => [$this->makeConsentPayload('medication')]]
        )->assertStatus(200);

        $this->assertDatabaseHas('application_consents', [
            'application_id' => $application->id,
            'consent_type' => 'medication',
        ]);
    }

    public function test_hipaa_consent_is_persisted(): void
    {
        [$parent, $application] = $this->createApplicationForParent();

        $this->actingAs($parent)->postJson(
            "/api/applications/{$application->id}/consents",
            ['consents' => [$this->makeConsentPayload('hipaa')]]
        )->assertStatus(200);

        $this->assertDatabaseHas('application_consents', [
            'application_id' => $application->id,
            'consent_type' => 'hipaa',
        ]);
    }

    public function test_unknown_consent_type_is_rejected(): void
    {
        [$parent, $application] = $this->createApplicationForParent();

        $this->actingAs($parent)->postJson(
            "/api/applications/{$application->id}/consents",
            ['consents' => [$this->makeConsentPayload('unknown_type')]]
        )->assertStatus(422)
            ->assertJsonValidationErrors(['consents.0.consent_type']);
    }

    public function test_resubmitting_consents_is_idempotent(): void
    {
        [$parent, $application] = $this->createApplicationForParent();

        $payload = ['consents' => [$this->makeConsentPayload('general')]];

        // First submission
        $this->actingAs($parent)->postJson(
            "/api/applications/{$application->id}/consents",
            $payload
        )->assertStatus(200);

        // Second submission — should update, not create a second row
        $this->actingAs($parent)->postJson(
            "/api/applications/{$application->id}/consents",
            $payload
        )->assertStatus(200);

        $this->assertCount(1, ApplicationConsent::where([
            'application_id' => $application->id,
            'consent_type' => 'general',
        ])->get(), 'Resubmitting the same consent type should update, not duplicate.');
    }

    public function test_other_parent_cannot_submit_consents(): void
    {
        [, $application] = $this->createApplicationForParent();
        $otherParent = $this->createParent();

        $this->actingAs($otherParent)->postJson(
            "/api/applications/{$application->id}/consents",
            ['consents' => [$this->makeConsentPayload('general')]]
        )->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_submit_consents(): void
    {
        [, $application] = $this->createApplicationForParent();

        $this->postJson(
            "/api/applications/{$application->id}/consents",
            ['consents' => [$this->makeConsentPayload('general')]]
        )->assertStatus(401);
    }

    public function test_guardian_name_is_required(): void
    {
        [$parent, $application] = $this->createApplicationForParent();

        $this->actingAs($parent)->postJson(
            "/api/applications/{$application->id}/consents",
            ['consents' => [[
                'consent_type' => 'general',
                'guardian_relationship' => 'Parent',
                'guardian_signature' => 'sig',
                'signed_at' => now()->toISOString(),
            ]]]
        )->assertStatus(422)
            ->assertJsonValidationErrors(['consents.0.guardian_name']);
    }
}
