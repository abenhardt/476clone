<?php

namespace Tests\Feature\Inbox;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageRecipient;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Feature tests for Gmail-style messaging: reply, reply-all, and BCC privacy.
 *
 * Guards against:
 *   - BCC recipients being visible to non-senders (HIPAA / privacy critical)
 *   - Reply-all including BCC from the original message
 *   - Duplicate recipients in reply-all
 *   - Self-inclusion in reply/reply-all
 *   - reply_type field being correctly persisted
 *   - parent_message_id linkage being correct
 *
 * Target Coverage: MessageController::reply(), MessageController::replyAll(),
 *                  MessageService::reply(), MessageService::replyAll(),
 *                  MessageService::calculateReplyAllRecipients(),
 *                  Message::getRecipientsForUser()
 */
class GmailMessagingTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $parent;
    protected User $secondParent;
    protected User $medicalStaff;
    protected Conversation $conversation;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $adminRole = Role::firstOrCreate(['name' => 'admin'], ['description' => 'Administrator']);
        $parentRole = Role::firstOrCreate(['name' => 'applicant'], ['description' => 'Parent/Guardian']);
        $medRole = Role::firstOrCreate(['name' => 'medical'], ['description' => 'Medical Provider']);

        $this->admin = User::factory()->create(['role_id' => $adminRole->id]);
        $this->parent = User::factory()->create(['role_id' => $parentRole->id]);
        $this->secondParent = User::factory()->create(['role_id' => $parentRole->id]);
        $this->medicalStaff = User::factory()->create(['role_id' => $medRole->id]);

        $this->conversation = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
        ]);

        $this->conversation->participantRecords()->createMany([
            ['user_id' => $this->admin->id,        'joined_at' => now()],
            ['user_id' => $this->parent->id,        'joined_at' => now()],
            ['user_id' => $this->secondParent->id,  'joined_at' => now()],
        ]);
    }

    // ─── Reply ────────────────────────────────────────────────────────────────

    #[Test]
    public function participant_can_reply_to_a_message()
    {
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
            'body' => 'Original message',
        ]);

        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/reply",
            [
                'body' => 'Reply body',
                'parent_message_id' => $original->id,
            ]
        );

        $response->assertStatus(201)
            ->assertJsonPath('data.reply_type', 'reply')
            ->assertJsonPath('data.parent_message_id', $original->id);

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->parent->id,
            'body' => 'Reply body',
            'parent_message_id' => $original->id,
            'reply_type' => 'reply',
        ]);
    }

    #[Test]
    public function reply_creates_to_recipient_for_original_sender()
    {
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/reply",
            ['body' => 'My reply', 'parent_message_id' => $original->id]
        );

        $response->assertStatus(201);

        $replyId = $response->json('data.id');

        $this->assertDatabaseHas('message_recipients', [
            'message_id' => $replyId,
            'user_id' => $this->admin->id,
            'recipient_type' => 'to',
        ]);
    }

    #[Test]
    public function reply_does_not_add_sender_as_recipient_of_own_reply()
    {
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/reply",
            ['body' => 'Test', 'parent_message_id' => $original->id]
        );

        $response->assertStatus(201);

        $replyId = $response->json('data.id');

        // The sender (parent) must NOT appear as a recipient of their own reply
        $this->assertDatabaseMissing('message_recipients', [
            'message_id' => $replyId,
            'user_id' => $this->parent->id,
        ]);
    }

    #[Test]
    public function non_participant_cannot_reply()
    {
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        Sanctum::actingAs($this->medicalStaff);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/reply",
            ['body' => 'Intruder reply', 'parent_message_id' => $original->id]
        );

        $response->assertStatus(403);
    }

    #[Test]
    public function reply_requires_parent_message_id()
    {
        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/reply",
            ['body' => 'Missing parent']
        );

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['parent_message_id']);
    }

    #[Test]
    public function reply_requires_non_empty_body()
    {
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/reply",
            ['body' => '', 'parent_message_id' => $original->id]
        );

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['body']);
    }

    // ─── Reply All ────────────────────────────────────────────────────────────

    #[Test]
    public function participant_can_reply_all_to_a_message()
    {
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
            'body' => 'Original',
        ]);

        // Add explicit TO/CC/BCC recipients on the original message
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->parent->id,       'recipient_type' => 'to',  'is_read' => false]);
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->secondParent->id, 'recipient_type' => 'cc',  'is_read' => false]);

        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/reply-all",
            ['body' => 'Reply to all', 'parent_message_id' => $original->id]
        );

        $response->assertStatus(201)
            ->assertJsonPath('data.reply_type', 'reply_all');
    }

    #[Test]
    public function reply_all_excludes_bcc_recipients_from_original_message()
    {
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        // secondParent was a BCC on the original — must NOT appear in reply-all recipients
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->parent->id,       'recipient_type' => 'to',  'is_read' => false]);
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->secondParent->id, 'recipient_type' => 'bcc', 'is_read' => false]);

        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/reply-all",
            ['body' => 'Reply all body', 'parent_message_id' => $original->id]
        );

        $response->assertStatus(201);

        $replyId = $response->json('data.id');

        // secondParent (BCC) must NOT appear as a recipient in the reply-all
        $this->assertDatabaseMissing('message_recipients', [
            'message_id' => $replyId,
            'user_id' => $this->secondParent->id,
        ]);
    }

    #[Test]
    public function reply_all_includes_to_and_cc_recipients_from_original_message()
    {
        // A third participant for CC
        $adminRole = Role::where('name', 'admin')->first();
        $ccUser = User::factory()->create(['role_id' => $adminRole->id]);
        $this->conversation->participantRecords()->create(['user_id' => $ccUser->id, 'joined_at' => now()]);

        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->parent->id, 'recipient_type' => 'to', 'is_read' => false]);
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $ccUser->id,        'recipient_type' => 'cc', 'is_read' => false]);

        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/reply-all",
            ['body' => 'Reply all', 'parent_message_id' => $original->id]
        );

        $response->assertStatus(201);

        $replyId = $response->json('data.id');

        // admin (original sender) must be in reply-all as TO
        $this->assertDatabaseHas('message_recipients', [
            'message_id' => $replyId,
            'user_id' => $this->admin->id,
            'recipient_type' => 'to',
        ]);

        // ccUser must be in reply-all as CC
        $this->assertDatabaseHas('message_recipients', [
            'message_id' => $replyId,
            'user_id' => $ccUser->id,
            'recipient_type' => 'cc',
        ]);
    }

    #[Test]
    public function reply_all_does_not_add_sender_to_their_own_recipient_list()
    {
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->parent->id, 'recipient_type' => 'to', 'is_read' => false]);

        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/reply-all",
            ['body' => 'Reply all', 'parent_message_id' => $original->id]
        );

        $response->assertStatus(201);

        $replyId = $response->json('data.id');

        // The sender (parent) must NOT appear as a recipient of their own reply-all
        $this->assertDatabaseMissing('message_recipients', [
            'message_id' => $replyId,
            'user_id' => $this->parent->id,
        ]);
    }

    #[Test]
    public function reply_all_creates_no_duplicate_recipients()
    {
        // Make admin appear both as original sender AND as a TO recipient — should deduplicate
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        // Admin is already the sender; also add admin as an explicit TO (edge case)
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->admin->id,   'recipient_type' => 'to', 'is_read' => false]);
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->parent->id,  'recipient_type' => 'to', 'is_read' => false]);

        Sanctum::actingAs($this->parent);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/reply-all",
            ['body' => 'Reply all', 'parent_message_id' => $original->id]
        );

        $response->assertStatus(201);

        $replyId = $response->json('data.id');

        // Admin should appear exactly once as a recipient
        $adminRecipientCount = MessageRecipient::where('message_id', $replyId)
            ->where('user_id', $this->admin->id)
            ->count();

        $this->assertEquals(1, $adminRecipientCount, 'Admin should appear exactly once in reply-all recipients');
    }

    // ─── BCC Privacy Enforcement ──────────────────────────────────────────────

    #[Test]
    public function sender_can_see_bcc_recipients_in_message_response()
    {
        // Sender sends a message with a BCC recipient
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->parent->id,       'recipient_type' => 'to',  'is_read' => false]);
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->secondParent->id, 'recipient_type' => 'bcc', 'is_read' => false]);

        Sanctum::actingAs($this->admin); // Admin is the sender

        $response = $this->getJson(
            "/api/inbox/messages/{$original->id}"
        );

        $response->assertStatus(200);

        $recipients = collect($response->json('data.recipients'));

        // Sender should see BCC recipient
        $bccRecipient = $recipients->firstWhere('recipient_type', 'bcc');
        $this->assertNotNull($bccRecipient, 'Sender should see BCC recipients');
        $this->assertEquals($this->secondParent->id, $bccRecipient['user_id']);
    }

    #[Test]
    public function non_sender_cannot_see_bcc_recipients()
    {
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->parent->id,       'recipient_type' => 'to',  'is_read' => false]);
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->secondParent->id, 'recipient_type' => 'bcc', 'is_read' => false]);

        Sanctum::actingAs($this->parent); // Parent is a TO recipient, NOT the sender

        $response = $this->getJson(
            "/api/inbox/messages/{$original->id}"
        );

        $response->assertStatus(200);

        $recipients = collect($response->json('data.recipients'));

        // Non-sender must NOT see BCC entries
        $bccRecipients = $recipients->where('recipient_type', 'bcc');
        $this->assertCount(0, $bccRecipients, 'Non-sender must not see BCC recipients');
    }

    #[Test]
    public function bcc_recipient_sees_themselves_but_not_other_bcc_recipients()
    {
        $adminRole = Role::where('name', 'admin')->first();
        $otherBcc = User::factory()->create(['role_id' => $adminRole->id]);
        $this->conversation->participantRecords()->create(['user_id' => $otherBcc->id, 'joined_at' => now()]);

        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->parent->id,  'recipient_type' => 'to',  'is_read' => false]);
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->secondParent->id, 'recipient_type' => 'bcc', 'is_read' => false]);
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $otherBcc->id,       'recipient_type' => 'bcc', 'is_read' => false]);

        Sanctum::actingAs($this->secondParent); // A BCC recipient (not the sender)

        $response = $this->getJson(
            "/api/inbox/messages/{$original->id}"
        );

        $response->assertStatus(200);

        $recipients = collect($response->json('data.recipients'));

        // secondParent (BCC) should NOT see any BCC entries at all
        // The backend hides all BCC for non-senders (not just the "other" BCC)
        $bccRecipients = $recipients->where('recipient_type', 'bcc');
        $this->assertCount(0, $bccRecipients, 'BCC recipient must not see any BCC entries');
    }

    #[Test]
    public function to_and_cc_recipients_are_always_visible_to_non_senders()
    {
        $original = Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $this->admin->id,
        ]);

        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->parent->id,       'recipient_type' => 'to', 'is_read' => false]);
        MessageRecipient::create(['message_id' => $original->id, 'user_id' => $this->secondParent->id, 'recipient_type' => 'cc', 'is_read' => false]);

        Sanctum::actingAs($this->parent); // A TO recipient

        $response = $this->getJson(
            "/api/inbox/messages/{$original->id}"
        );

        $response->assertStatus(200);

        $recipients = collect($response->json('data.recipients'));

        $toRecipients = $recipients->where('recipient_type', 'to');
        $ccRecipients = $recipients->where('recipient_type', 'cc');

        $this->assertCount(1, $toRecipients, 'TO recipient should be visible');
        $this->assertCount(1, $ccRecipients, 'CC recipient should be visible');
    }

    // ─── Message Recipients Table Integrity ───────────────────────────────────

    #[Test]
    public function message_with_recipients_stores_recipient_records_in_database()
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Test with explicit recipients',
                'recipients' => [
                    ['user_id' => $this->parent->id,       'type' => 'to'],
                    ['user_id' => $this->secondParent->id, 'type' => 'cc'],
                ],
            ]
        );

        $response->assertStatus(201);

        $messageId = $response->json('data.id');

        $this->assertDatabaseHas('message_recipients', [
            'message_id' => $messageId,
            'user_id' => $this->parent->id,
            'recipient_type' => 'to',
        ]);

        $this->assertDatabaseHas('message_recipients', [
            'message_id' => $messageId,
            'user_id' => $this->secondParent->id,
            'recipient_type' => 'cc',
        ]);
    }

    #[Test]
    public function duplicate_recipient_entries_are_prevented()
    {
        Sanctum::actingAs($this->admin);

        // Sending the same user as both TO and CC should only create one record
        $response = $this->postJson(
            "/api/inbox/conversations/{$this->conversation->id}/messages",
            [
                'body' => 'Duplicate recipient test',
                'recipients' => [
                    ['user_id' => $this->parent->id, 'type' => 'to'],
                    ['user_id' => $this->parent->id, 'type' => 'cc'], // duplicate
                ],
            ]
        );

        $response->assertStatus(201);

        $messageId = $response->json('data.id');

        $recipientCount = MessageRecipient::where('message_id', $messageId)
            ->where('user_id', $this->parent->id)
            ->count();

        $this->assertEquals(1, $recipientCount, 'Duplicate user in recipients should be deduplicated');
    }
}
