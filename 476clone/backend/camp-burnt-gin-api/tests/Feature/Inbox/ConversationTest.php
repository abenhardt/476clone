<?php

namespace Tests\Feature\Inbox;

use App\Models\Conversation;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Feature tests for Conversation management.
 *
 * Tests conversation creation, retrieval, archiving, participant management,
 * and RBAC enforcement across all user roles.
 *
 * Target Coverage: ConversationController, InboxService, ConversationPolicy
 */
class ConversationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $parent;
    protected User $medicalProvider;
    protected Role $adminRole;
    protected Role $parentRole;
    protected Role $medicalRole;

    protected function setUp(): void
    {
        parent::setUp();

        // Create or get roles
        $this->adminRole = Role::firstOrCreate(['name' => 'admin'], ['description' => 'Administrator']);
        $this->parentRole = Role::firstOrCreate(['name' => 'applicant'], ['description' => 'Parent/Guardian']);
        $this->medicalRole = Role::firstOrCreate(['name' => 'medical'], ['description' => 'Medical Provider']);

        // Create users with roles
        $this->admin = User::factory()->create(['role_id' => $this->adminRole->id, 'mfa_enabled' => true]);
        $this->parent = User::factory()->create(['role_id' => $this->parentRole->id]);
        $this->medicalProvider = User::factory()->create(['role_id' => $this->medicalRole->id, 'mfa_enabled' => true]);
    }

    #[Test]
    public function admin_can_create_conversation_with_parent()
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/inbox/conversations', [
            'subject' => 'Application Review Discussion',
            'participant_ids' => [$this->parent->id],
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'data' => ['id', 'subject', 'created_by_id', 'participants'],
                'message',
            ]);

        $this->assertDatabaseHas('conversations', [
            'subject' => 'Application Review Discussion',
            'created_by_id' => $this->admin->id,
        ]);

        $this->assertDatabaseHas('conversation_participants', [
            'user_id' => $this->admin->id,
        ]);

        $this->assertDatabaseHas('conversation_participants', [
            'user_id' => $this->parent->id,
        ]);
    }

    #[Test]
    public function parent_can_create_conversation_with_admin()
    {
        Sanctum::actingAs($this->parent);

        $response = $this->postJson('/api/inbox/conversations', [
            'subject' => 'Question about Application',
            'participant_ids' => [$this->admin->id],
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('conversations', [
            'subject' => 'Question about Application',
            'created_by_id' => $this->parent->id,
        ]);
    }

    #[Test]
    public function parent_cannot_create_conversation_with_another_parent()
    {
        $anotherParent = User::factory()->create(['role_id' => $this->parentRole->id]);

        Sanctum::actingAs($this->parent);

        $response = $this->postJson('/api/inbox/conversations', [
            'subject' => 'Parent to Parent',
            'participant_ids' => [$anotherParent->id],
        ]);

        $response->assertStatus(403);
    }

    #[Test]
    public function parent_cannot_create_conversation_with_medical_provider()
    {
        Sanctum::actingAs($this->parent);

        $response = $this->postJson('/api/inbox/conversations', [
            'subject' => 'Medical Question',
            'participant_ids' => [$this->medicalProvider->id],
        ]);

        $response->assertStatus(403);
    }

    #[Test]
    public function medical_provider_can_create_conversation_with_admin()
    {
        Sanctum::actingAs($this->medicalProvider);

        $response = $this->postJson('/api/inbox/conversations', [
            'subject' => 'Medical Update',
            'participant_ids' => [$this->admin->id],
        ]);

        $response->assertStatus(201);
    }

    #[Test]
    public function medical_provider_cannot_create_conversation_with_non_admin()
    {
        Sanctum::actingAs($this->medicalProvider);

        $response = $this->postJson('/api/inbox/conversations', [
            'subject' => 'Medical Update',
            'participant_ids' => [$this->parent->id],
        ]);

        $response->assertStatus(403);
    }

    #[Test]
    public function user_can_list_their_conversations()
    {
        Sanctum::actingAs($this->parent);

        $conversation = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
        ]);

        $conversation->participantRecords()->create([
            'user_id' => $this->parent->id,
            'joined_at' => now(),
        ]);

        $response = $this->getJson('/api/inbox/conversations');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => ['id', 'subject', 'created_by_id', 'last_message_at'],
                ],
                'meta' => ['current_page', 'last_page', 'per_page', 'total', 'unread_count'],
            ]);
    }

    #[Test]
    public function user_cannot_view_conversation_they_are_not_part_of()
    {
        Sanctum::actingAs($this->parent);

        $conversation = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
        ]);

        // Don't add parent as participant

        $response = $this->getJson("/api/inbox/conversations/{$conversation->id}");

        $response->assertStatus(403);
    }

    #[Test]
    public function participant_can_view_conversation_details()
    {
        Sanctum::actingAs($this->parent);

        $conversation = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
        ]);

        $conversation->participantRecords()->create([
            'user_id' => $this->parent->id,
            'joined_at' => now(),
        ]);

        $response = $this->getJson("/api/inbox/conversations/{$conversation->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => ['id', 'subject', 'participants', 'creator'],
                'meta' => ['unread_count'],
            ]);
    }

    #[Test]
    public function creator_can_archive_conversation()
    {
        Sanctum::actingAs($this->admin);

        $conversation = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
            'is_archived' => false,
        ]);

        $response = $this->postJson("/api/inbox/conversations/{$conversation->id}/archive");

        $response->assertStatus(200);

        $this->assertDatabaseHas('conversations', [
            'id' => $conversation->id,
            'is_archived' => true,
        ]);
    }

    #[Test]
    public function non_creator_cannot_archive_conversation()
    {
        Sanctum::actingAs($this->parent);

        $conversation = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
        ]);

        $conversation->participantRecords()->create([
            'user_id' => $this->parent->id,
            'joined_at' => now(),
        ]);

        $response = $this->postJson("/api/inbox/conversations/{$conversation->id}/archive");

        $response->assertStatus(403);
    }

    #[Test]
    public function only_admin_can_add_participants()
    {
        Sanctum::actingAs($this->admin);

        $conversation = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
        ]);

        $newParticipant = User::factory()->create(['role_id' => $this->parentRole->id]);

        $response = $this->postJson("/api/inbox/conversations/{$conversation->id}/participants", [
            'user_id' => $newParticipant->id,
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('conversation_participants', [
            'conversation_id' => $conversation->id,
            'user_id' => $newParticipant->id,
        ]);
    }

    #[Test]
    public function parent_cannot_add_participants()
    {
        Sanctum::actingAs($this->parent);

        $conversation = Conversation::factory()->create([
            'created_by_id' => $this->parent->id,
        ]);

        $conversation->participantRecords()->create([
            'user_id' => $this->parent->id,
            'joined_at' => now(),
        ]);

        $newParticipant = User::factory()->create(['role_id' => $this->adminRole->id]);

        $response = $this->postJson("/api/inbox/conversations/{$conversation->id}/participants", [
            'user_id' => $newParticipant->id,
        ]);

        $response->assertStatus(403);
    }

    #[Test]
    public function only_admin_can_soft_delete_conversation()
    {
        Sanctum::actingAs($this->admin);

        $conversation = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
        ]);

        $response = $this->deleteJson("/api/inbox/conversations/{$conversation->id}");

        $response->assertStatus(200);

        $this->assertSoftDeleted('conversations', [
            'id' => $conversation->id,
        ]);
    }

    #[Test]
    public function parent_cannot_delete_conversation()
    {
        Sanctum::actingAs($this->parent);

        $conversation = Conversation::factory()->create([
            'created_by_id' => $this->parent->id,
        ]);

        $response = $this->deleteJson("/api/inbox/conversations/{$conversation->id}");

        $response->assertStatus(403);
    }

    #[Test]
    public function conversation_creation_is_rate_limited()
    {
        Sanctum::actingAs($this->parent);

        // Attempt to create 6 conversations within a minute (limit is 5)
        for ($i = 0; $i < 6; $i++) {
            $response = $this->postJson('/api/inbox/conversations', [
                'subject' => "Test Conversation {$i}",
                'participant_ids' => [$this->admin->id],
            ]);

            if ($i < 5) {
                $response->assertStatus(201);
            } else {
                $response->assertStatus(429); // Too Many Requests
            }
        }
    }

    #[Test]
    public function validation_fails_with_empty_participant_list()
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/inbox/conversations', [
            'subject' => 'Test',
            'participant_ids' => [],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['participant_ids']);
    }

    #[Test]
    public function validation_fails_with_invalid_user_id()
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/inbox/conversations', [
            'subject' => 'Test',
            'participant_ids' => [99999], // Non-existent user
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['participant_ids.0']);
    }
}
