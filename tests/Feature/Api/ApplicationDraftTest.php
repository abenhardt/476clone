<?php

namespace Tests\Feature\Api;

use App\Models\ApplicationDraft;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for the ApplicationDraft CRUD resource.
 *
 * Drafts are applicant-only save slots — admins have no business reading
 * another parent's unsanitised form state. The owns-only policy ensures
 * cross-user access is blocked even between applicants.
 */
class ApplicationDraftTest extends TestCase
{
    use RefreshDatabase;
    use WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    // ─── Authentication ────────────────────────────────────────────────────────

    public function test_unauthenticated_user_cannot_list_drafts(): void
    {
        $this->getJson('/api/application-drafts')->assertStatus(401);
    }

    public function test_unauthenticated_user_cannot_create_draft(): void
    {
        $this->postJson('/api/application-drafts')->assertStatus(401);
    }

    // ─── Create ────────────────────────────────────────────────────────────────

    public function test_applicant_can_create_draft(): void
    {
        $parent = $this->createParent();

        $response = $this->actingAs($parent)
            ->postJson('/api/application-drafts', ['label' => 'Jane Smith']);

        $response->assertStatus(201)
            ->assertJsonPath('data.label', 'Jane Smith')
            ->assertJsonPath('data.user_id', $parent->id);

        $this->assertDatabaseHas('application_drafts', [
            'user_id' => $parent->id,
            'label' => 'Jane Smith',
        ]);
    }

    public function test_draft_label_defaults_to_new_application(): void
    {
        $parent = $this->createParent();

        $response = $this->actingAs($parent)->postJson('/api/application-drafts', []);

        $response->assertStatus(201)
            ->assertJsonPath('data.label', 'New Application');
    }

    public function test_admin_cannot_create_draft(): void
    {
        $admin = $this->createAdmin();

        $this->actingAs($admin)
            ->postJson('/api/application-drafts', ['label' => 'Test'])
            ->assertStatus(403);
    }

    public function test_applicant_cannot_exceed_draft_limit(): void
    {
        $parent = $this->createParent();

        // Create exactly 10 drafts (the limit)
        ApplicationDraft::factory()->count(10)->create(['user_id' => $parent->id]);

        // 11th creation must be rejected
        $this->actingAs($parent)
            ->postJson('/api/application-drafts', ['label' => 'One Too Many'])
            ->assertStatus(429)
            ->assertJsonPath('message', 'Draft limit reached. Please delete an existing draft before creating a new one.');
    }

    public function test_applicant_can_create_draft_at_limit_boundary(): void
    {
        $parent = $this->createParent();

        // 9 existing drafts → 10th should succeed
        ApplicationDraft::factory()->count(9)->create(['user_id' => $parent->id]);

        $this->actingAs($parent)
            ->postJson('/api/application-drafts', ['label' => 'Tenth Draft'])
            ->assertStatus(201);
    }

    // ─── List ──────────────────────────────────────────────────────────────────

    public function test_applicant_only_sees_their_own_drafts(): void
    {
        $parentA = $this->createParent();
        $parentB = $this->createParent();

        ApplicationDraft::factory()->create(['user_id' => $parentA->id, 'label' => 'Draft A']);
        ApplicationDraft::factory()->create(['user_id' => $parentB->id, 'label' => 'Draft B']);

        $response = $this->actingAs($parentA)
            ->getJson('/api/application-drafts');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Draft A', $data[0]['label']);
    }

    public function test_list_response_does_not_include_draft_data(): void
    {
        $parent = $this->createParent();
        ApplicationDraft::factory()->create([
            'user_id' => $parent->id,
            'draft_data' => ['section1' => ['first_name' => 'Jane']],
        ]);

        $response = $this->actingAs($parent)->getJson('/api/application-drafts');

        // List endpoint omits draft_data to keep responses small
        $data = $response->json('data');
        $this->assertArrayNotHasKey('draft_data', $data[0]);
    }

    // ─── Show ──────────────────────────────────────────────────────────────────

    public function test_owner_can_retrieve_draft_with_data(): void
    {
        $parent = $this->createParent();
        $draft = ApplicationDraft::factory()->create([
            'user_id' => $parent->id,
            'draft_data' => ['camper' => ['first_name' => 'Alice']],
        ]);

        $response = $this->actingAs($parent)
            ->getJson("/api/application-drafts/{$draft->id}");

        $response->assertStatus(200)
            ->assertJsonPath('data.id', $draft->id)
            ->assertJsonPath('data.draft_data.camper.first_name', 'Alice');
    }

    public function test_other_applicant_cannot_view_draft(): void
    {
        $owner = $this->createParent();
        $other = $this->createParent();
        $draft = ApplicationDraft::factory()->create(['user_id' => $owner->id]);

        $this->actingAs($other)
            ->getJson("/api/application-drafts/{$draft->id}")
            ->assertStatus(403);
    }

    public function test_admin_cannot_view_applicant_draft(): void
    {
        $parent = $this->createParent();
        $admin = $this->createAdmin();
        $draft = ApplicationDraft::factory()->create(['user_id' => $parent->id]);

        $this->actingAs($admin)
            ->getJson("/api/application-drafts/{$draft->id}")
            ->assertStatus(403);
    }

    // ─── Update ────────────────────────────────────────────────────────────────

    public function test_owner_can_save_draft_data(): void
    {
        $parent = $this->createParent();
        $draft = ApplicationDraft::factory()->create(['user_id' => $parent->id]);

        $payload = ['draft_data' => ['camper' => ['first_name' => 'Bob']], 'label' => 'Bob Smith'];

        $this->actingAs($parent)
            ->putJson("/api/application-drafts/{$draft->id}", $payload)
            ->assertStatus(200)
            ->assertJsonPath('data.label', 'Bob Smith');

        $this->assertDatabaseHas('application_drafts', [
            'id' => $draft->id,
            'label' => 'Bob Smith',
        ]);
    }

    public function test_update_requires_draft_data(): void
    {
        $parent = $this->createParent();
        $draft = ApplicationDraft::factory()->create(['user_id' => $parent->id]);

        $this->actingAs($parent)
            ->putJson("/api/application-drafts/{$draft->id}", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['draft_data']);
    }

    public function test_other_applicant_cannot_overwrite_draft(): void
    {
        $owner = $this->createParent();
        $other = $this->createParent();
        $draft = ApplicationDraft::factory()->create(['user_id' => $owner->id]);

        $this->actingAs($other)
            ->putJson("/api/application-drafts/{$draft->id}", ['draft_data' => []])
            ->assertStatus(403);
    }

    public function test_draft_data_within_size_limit_is_accepted(): void
    {
        $parent = $this->createParent();
        $draft = ApplicationDraft::factory()->create(['user_id' => $parent->id]);

        // A realistic full form payload is well under 64 KB.
        $smallPayload = ['s1' => ['camper_first_name' => str_repeat('A', 100)]];

        $this->actingAs($parent)
            ->putJson("/api/application-drafts/{$draft->id}", ['draft_data' => $smallPayload])
            ->assertStatus(200);
    }

    public function test_oversized_draft_data_is_rejected(): void
    {
        $parent = $this->createParent();
        $draft = ApplicationDraft::factory()->create(['user_id' => $parent->id]);

        // Build a payload that clearly exceeds 512 KB when JSON-encoded.
        // A string value of 600,000 chars in an object encodes to ~600 KB.
        $oversizedPayload = ['data' => str_repeat('X', 600_000)];

        $this->actingAs($parent)
            ->putJson("/api/application-drafts/{$draft->id}", ['draft_data' => $oversizedPayload])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Draft data exceeds the maximum allowed size of 512 KB.');
    }

    // ─── Optimistic Concurrency Guard ─────────────────────────────────────────

    public function test_save_without_last_known_updated_at_succeeds(): void
    {
        // When the client does not send last_known_updated_at, the guard is
        // skipped and the update succeeds regardless of concurrent modifications.
        $parent = $this->createParent();
        $draft = ApplicationDraft::factory()->create(['user_id' => $parent->id]);

        $this->actingAs($parent)
            ->putJson("/api/application-drafts/{$draft->id}", [
                'draft_data' => ['camper' => ['first_name' => 'Alice']],
            ])
            ->assertStatus(200);
    }

    public function test_save_with_correct_last_known_updated_at_succeeds(): void
    {
        $parent = $this->createParent();
        $draft = ApplicationDraft::factory()->create(['user_id' => $parent->id]);
        $serverTs = $draft->fresh()->updated_at->toISOString();

        $response = $this->actingAs($parent)
            ->putJson("/api/application-drafts/{$draft->id}", [
                'draft_data' => ['camper' => ['first_name' => 'Alice']],
                'last_known_updated_at' => $serverTs,
            ]);

        $response->assertStatus(200);
        // Response must include a refreshed updated_at so the client can track the new value.
        $this->assertNotNull($response->json('data.updated_at'));
    }

    public function test_save_with_stale_last_known_updated_at_returns_409(): void
    {
        // Simulate a lost-update race: another tab already wrote a newer version.
        // The client sends an old timestamp → server must reject with 409 Conflict.
        $parent = $this->createParent();
        $draft = ApplicationDraft::factory()->create(['user_id' => $parent->id]);

        // Advance the draft's updated_at by directly touching it in the DB.
        $staleTs = $draft->updated_at->toISOString();
        $draft->forceFill(['updated_at' => now()->addSeconds(5)])->save();

        $response = $this->actingAs($parent)
            ->putJson("/api/application-drafts/{$draft->id}", [
                'draft_data' => ['camper' => ['first_name' => 'Bob']],
                'last_known_updated_at' => $staleTs,
            ]);

        $response->assertStatus(409)
            ->assertJsonFragment(['conflict' => true])
            ->assertJsonPath('server_updated_at', $draft->fresh()->updated_at->toISOString());

        // The DB must still hold the newer data, not the rejected payload.
        $this->assertDatabaseMissing('application_drafts', [
            'id' => $draft->id,
            'label' => 'Bob',
        ]);
    }

    // ─── Delete ────────────────────────────────────────────────────────────────

    public function test_owner_can_delete_their_draft(): void
    {
        $parent = $this->createParent();
        $draft = ApplicationDraft::factory()->create(['user_id' => $parent->id]);

        $this->actingAs($parent)
            ->deleteJson("/api/application-drafts/{$draft->id}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('application_drafts', ['id' => $draft->id]);
    }

    public function test_other_applicant_cannot_delete_draft(): void
    {
        $owner = $this->createParent();
        $other = $this->createParent();
        $draft = ApplicationDraft::factory()->create(['user_id' => $owner->id]);

        $this->actingAs($other)
            ->deleteJson("/api/application-drafts/{$draft->id}")
            ->assertStatus(403);

        $this->assertDatabaseHas('application_drafts', ['id' => $draft->id]);
    }
}
