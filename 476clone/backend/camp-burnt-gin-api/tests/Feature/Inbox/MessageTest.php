<?php

namespace Tests\Feature\Inbox;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Feature tests for Message operations.
 *
 * Tests message sending, retrieval, attachments, read receipts,
 * idempotency, and RBAC enforcement.
 *
 * Target Coverage: MessageController, MessageService, MessagePolicy
 */
class MessageTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $parent;
    protected Conversation $conversation;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::firstOrCreate(['name' => 'admin'], ['description' => 'Administrator']);
        $parentRole = Role::firstOrCreate(['name' => 'applicant'], ['description' => 'Parent/Guardian']);

        $this->admin = User::factory()->create(['role_id' => $adminRole->id, 'mfa_enabled' => true]);
        $this->parent = User::factory()->create(['role_id' => $parentRole->id]);

        $this->conversation = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
        ]);

        $this->conversation->participantRecords()->createMany([
            ['user_id' => $this->admin->id, 'joined_at' => now()],
            ['user_id' => $this->parent->id, 'joined_at' => now()],
        ]);

        Storage::fake('local');
    }

    #[Test]
    public function participant_can_send_message_in_conversation()
    {
        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'This is a test message']
        );

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'data' => ['id', 'conversation_id', 'sender_id', 'body', 'created_at'],
                'message',
            ]);

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->parent->id,
            'body' => 'This is a test message',
        ]);
    }

    #[Test]
    public function non_participant_cannot_send_message()
    {
        $parentRole = Role::firstOrCreate(['name' => 'applicant'], ['description' => 'Parent/Guardian']);
        $outsider = User::factory()->create(['role_id' => $parentRole->id]);

        Sanctum::actingAs($outsider);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => 'Unauthorized message']
        );

        $response->assertStatus(403);
    }

    #[Test]
    public function message_can_include_attachments()
    {
        Sanctum::actingAs($this->parent);

        // Use a minimal valid PDF so the DocumentService magic-byte MIME check passes.
        // UploadedFile::fake()->create() generates random bytes which finfo detects
        // as application/octet-stream, not application/pdf.
        $tempPath = tempnam(sys_get_temp_dir(), 'test_pdf_');
        file_put_contents($tempPath, "%PDF-1.4\n1 0 obj\n<< >>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n20\n%%EOF\n");
        $file = new \Illuminate\Http\UploadedFile($tempPath, 'document.pdf', 'application/pdf', null, true);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Message with attachment',
                'attachments' => [$file],
            ]
        );

        $response->assertStatus(201);

        $message = Message::where('body', 'Message with attachment')->first();
        $this->assertNotNull($message);
        $this->assertTrue($message->hasAttachments());
    }

    #[Test]
    public function attachment_size_limit_is_enforced()
    {
        Sanctum::actingAs($this->parent);

        // 11MB file (exceeds 10MB limit)
        $file = UploadedFile::fake()->create('large.pdf', 11000, 'application/pdf');

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Message with large attachment',
                'attachments' => [$file],
            ]
        );

        $response->assertStatus(422);
    }

    #[Test]
    public function attachment_mime_type_restriction_is_enforced()
    {
        Sanctum::actingAs($this->parent);

        $file = UploadedFile::fake()->create('malicious.exe', 100, 'application/x-msdownload');

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Message with disallowed file',
                'attachments' => [$file],
            ]
        );

        $response->assertStatus(422);
    }

    #[Test]
    public function idempotency_key_prevents_duplicate_messages()
    {
        Sanctum::actingAs($this->parent);

        $idempotencyKey = 'unique-key-123';

        // Send first message
        $response1 = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Idempotent message',
                'idempotency_key' => $idempotencyKey,
            ]
        );

        $response1->assertStatus(201);
        $messageId1 = $response1->json('data.id');

        // Send duplicate with same key
        $response2 = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Idempotent message',
                'idempotency_key' => $idempotencyKey,
            ]
        );

        $response2->assertStatus(201);
        $messageId2 = $response2->json('data.id');

        // Should return same message
        $this->assertEquals($messageId1, $messageId2);

        // Only one message should exist
        $this->assertEquals(1, Message::where('idempotency_key', $idempotencyKey)->count());
    }

    #[Test]
    public function participant_can_retrieve_messages()
    {
        Sanctum::actingAs($this->parent);

        Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
            'body' => 'Test message',
        ]);

        $response = $this->getJson("/api/inbox/conversations/{$this->conversation->id}/messages");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => ['id', 'conversation_id', 'sender_id', 'body', 'created_at'],
                ],
                'meta' => ['current_page', 'total', 'unread_count'],
            ]);
    }

    #[Test]
    public function message_is_marked_as_read_when_retrieved()
    {
        Sanctum::actingAs($this->parent);

        $message = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
            'body' => 'Unread message',
        ]);

        $this->assertFalse($message->isReadBy($this->parent));

        $this->getJson("/api/inbox/conversations/{$this->conversation->id}/messages");

        $message->refresh();
        $this->assertTrue($message->isReadBy($this->parent));

        $this->assertDatabaseHas('message_reads', [
            'message_id' => $message->id,
            'user_id' => $this->parent->id,
        ]);
    }

    #[Test]
    public function sender_message_is_not_marked_as_read()
    {
        Sanctum::actingAs($this->parent);

        $message = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->parent->id,
            'body' => 'Own message',
        ]);

        $this->getJson("/api/inbox/conversations/{$this->conversation->id}/messages");

        // Sender's own messages should not create read receipts
        $this->assertEquals(0, $message->reads()->count());
    }

    #[Test]
    public function unread_message_count_is_accurate()
    {
        Sanctum::actingAs($this->parent);

        Message::factory()->count(3)->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        $response = $this->getJson('/api/inbox/messages/unread-count');

        $response->assertStatus(200)
            ->assertJson(['success' => true, 'unread_count' => 3]);
    }

    #[Test]
    public function message_send_is_rate_limited()
    {
        Sanctum::actingAs($this->parent);

        // Attempt to send 21 messages (limit is 20 per minute)
        for ($i = 0; $i < 21; $i++) {
            $response = $this->postJson(
                "/api/inbox/conversations/{$this->conversation->id}/messages",
                ['body' => "Message {$i}"]
            );

            if ($i < 20) {
                $response->assertStatus(201);
            } else {
                $response->assertStatus(429);
            }
        }
    }

    #[Test]
    public function only_admin_can_delete_message()
    {
        Sanctum::actingAs($this->admin);

        $message = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->parent->id,
        ]);

        $response = $this->deleteJson("/api/inbox/messages/{$message->id}");

        $response->assertStatus(200);

        $this->assertSoftDeleted('messages', ['id' => $message->id]);
    }

    #[Test]
    public function parent_cannot_delete_their_own_message()
    {
        Sanctum::actingAs($this->parent);

        $message = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->parent->id,
        ]);

        $response = $this->deleteJson("/api/inbox/messages/{$message->id}");

        $response->assertStatus(403);
    }

    #[Test]
    public function validation_fails_with_empty_message_body()
    {
        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            ['body' => '']
        );

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['body']);
    }

    #[Test]
    public function validation_fails_with_excessive_attachments()
    {
        Sanctum::actingAs($this->parent);

        $files = [];
        for ($i = 0; $i < 6; $i++) {
            $files[] = UploadedFile::fake()->create("file{$i}.pdf", 100, 'application/pdf');
        }

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Too many attachments',
                'attachments' => $files,
            ]
        );

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['attachments']);
    }
}
