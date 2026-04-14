<?php

namespace Tests\Feature\Inbox;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageRead;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * UnreadCountTest
 *
 * Verifies that the inbox unread count is always correct and never shows
 * ghost state (count > 0 when no unread messages exist).
 *
 * Core invariants tested:
 *   - count = 0 when no messages exist
 *   - count = 0 when all messages are read
 *   - count = N when N messages are unread
 *   - sent messages never count as unread for the sender
 *   - fetching messages (GET /conversations/{id}/messages) auto-marks as read
 *   - after auto-mark, unread-count endpoint returns 0
 *   - markRead resets count to 0
 *   - markUnread restores count to 1
 *   - count is scoped to authenticated user only
 */
class UnreadCountTest extends TestCase
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

        $this->admin = User::factory()->create(['role_id' => $adminRole->id,  'mfa_enabled' => true]);
        $this->parent = User::factory()->create(['role_id' => $parentRole->id, 'mfa_enabled' => false]);

        $this->conversation = Conversation::factory()->create([
            'created_by_id' => $this->admin->id,
        ]);

        $this->conversation->participantRecords()->createMany([
            ['user_id' => $this->admin->id,  'joined_at' => now()],
            ['user_id' => $this->parent->id, 'joined_at' => now()],
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /** Creates a message in the conversation from the given sender. */
    private function sendMessage(User $sender, string $body = 'Hello'): Message
    {
        return Message::factory()->create([
            'conversation_id' => $this->conversation->id,
            'sender_id' => $sender->id,
            'body' => $body,
        ]);
    }

    /** Creates a MessageRead record (marks the message as read by $user). */
    private function markRead(Message $message, User $user): void
    {
        MessageRead::firstOrCreate([
            'message_id' => $message->id,
            'user_id' => $user->id,
        ], ['read_at' => now()]);
    }

    private function getUnreadCount(): int
    {
        $res = $this->getJson('/api/inbox/messages/unread-count');
        $res->assertOk();

        return $res->json('unread_count');
    }

    // ─── Count = 0 invariants ─────────────────────────────────────────────────

    #[Test]
    public function unread_count_is_zero_when_no_messages_exist(): void
    {
        Sanctum::actingAs($this->admin);

        $this->assertSame(0, $this->getUnreadCount());
    }

    #[Test]
    public function unread_count_is_zero_when_all_messages_are_read(): void
    {
        Sanctum::actingAs($this->admin);

        $msg = $this->sendMessage($this->parent);
        $this->markRead($msg, $this->admin);

        $this->assertSame(0, $this->getUnreadCount());
    }

    #[Test]
    public function unread_count_is_zero_when_all_messages_sent_by_self(): void
    {
        // Messages the user sent themselves must never inflate their own unread count.
        Sanctum::actingAs($this->admin);

        $this->sendMessage($this->admin);
        $this->sendMessage($this->admin);

        $this->assertSame(0, $this->getUnreadCount());
    }

    // ─── Count = N invariants ─────────────────────────────────────────────────

    #[Test]
    public function unread_count_equals_number_of_unread_messages(): void
    {
        Sanctum::actingAs($this->admin);

        $this->sendMessage($this->parent, 'Message 1');
        $this->sendMessage($this->parent, 'Message 2');
        $this->sendMessage($this->parent, 'Message 3');

        $this->assertSame(3, $this->getUnreadCount());
    }

    #[Test]
    public function unread_count_decrements_as_messages_are_individually_read(): void
    {
        Sanctum::actingAs($this->admin);

        $msg1 = $this->sendMessage($this->parent, 'Msg 1');
        $msg2 = $this->sendMessage($this->parent, 'Msg 2');

        $this->assertSame(2, $this->getUnreadCount());

        $this->markRead($msg1, $this->admin);
        $this->assertSame(1, $this->getUnreadCount());

        $this->markRead($msg2, $this->admin);
        $this->assertSame(0, $this->getUnreadCount());
    }

    // ─── Auto-mark-read via message index fetch ───────────────────────────────

    #[Test]
    public function fetching_conversation_messages_auto_marks_them_as_read(): void
    {
        // Core fix: GET /conversations/{id}/messages marks messages as read on the server
        // BEFORE returning the response. So the unread-count endpoint returns 0 immediately
        // after the message list fetch — no race condition possible.
        Sanctum::actingAs($this->admin);

        $this->sendMessage($this->parent);
        $this->assertSame(1, $this->getUnreadCount());

        // Fetching messages auto-marks them as read.
        $this->getJson("/api/inbox/conversations/{$this->conversation->id}/messages")
            ->assertOk();

        // Count must be 0 immediately — no subsequent call needed.
        $this->assertSame(0, $this->getUnreadCount());
    }

    #[Test]
    public function fetching_messages_does_not_mark_own_sent_messages_as_read(): void
    {
        // The sender's own messages are excluded from unread scope.
        // Fetching them should not create spurious MessageRead rows for the sender.
        Sanctum::actingAs($this->admin);

        $this->sendMessage($this->admin);

        $this->getJson("/api/inbox/conversations/{$this->conversation->id}/messages")
            ->assertOk();

        // Still 0 — own messages were never counted as unread.
        $this->assertSame(0, $this->getUnreadCount());

        // No MessageRead rows created for self-sent messages.
        $this->assertDatabaseCount('message_reads', 0);
    }

    // ─── Mark read / unread API endpoints ────────────────────────────────────

    #[Test]
    public function mark_conversation_as_read_resets_unread_count_to_zero(): void
    {
        Sanctum::actingAs($this->admin);

        $this->sendMessage($this->parent);
        $this->sendMessage($this->parent);
        $this->assertSame(2, $this->getUnreadCount());

        $this->postJson("/api/inbox/conversations/{$this->conversation->id}/read")
            ->assertOk();

        $this->assertSame(0, $this->getUnreadCount());
    }

    #[Test]
    public function mark_conversation_as_unread_restores_count_to_at_least_one(): void
    {
        Sanctum::actingAs($this->admin);

        $msg = $this->sendMessage($this->parent);
        $this->markRead($msg, $this->admin);
        $this->assertSame(0, $this->getUnreadCount());

        $this->postJson("/api/inbox/conversations/{$this->conversation->id}/unread")
            ->assertOk();

        $this->assertGreaterThanOrEqual(1, $this->getUnreadCount());
    }

    // ─── Count is user-scoped ─────────────────────────────────────────────────

    #[Test]
    public function unread_count_is_scoped_to_authenticated_user_only(): void
    {
        // Each participant's read state is independent.
        // Admin sends a message → parent has 1 unread, admin has 0 (own message).
        // Parent sends a message → admin has 1 unread, parent has 0 (own message).

        $adminMsg = $this->sendMessage($this->admin, 'Hello parent');
        $parentMsg = $this->sendMessage($this->parent, 'Hello admin');

        // Admin: has 1 unread (parent's message). Own sent message doesn't count.
        Sanctum::actingAs($this->admin);
        $this->assertSame(1, $this->getUnreadCount());

        // Admin reads the conversation — admin count drops to 0.
        $this->postJson("/api/inbox/conversations/{$this->conversation->id}/read")
            ->assertOk();
        $this->assertSame(0, $this->getUnreadCount());

        // Parent: independently still has 1 unread (admin's message).
        // Admin reading their own copy did NOT touch the parent's read state.
        Sanctum::actingAs($this->parent);
        $this->assertSame(1, $this->getUnreadCount());

        // Parent reads — parent count drops to 0.
        $this->postJson("/api/inbox/conversations/{$this->conversation->id}/read")
            ->assertOk();
        $this->assertSame(0, $this->getUnreadCount());

        // Admin's count is unaffected by the parent reading — still 0.
        Sanctum::actingAs($this->admin);
        $this->assertSame(0, $this->getUnreadCount());
    }

    // ─── No ghost state ───────────────────────────────────────────────────────

    #[Test]
    public function no_ghost_unread_count_after_full_read_cycle(): void
    {
        // Simulate a full read cycle: receive → open (auto-mark) → verify 0.
        Sanctum::actingAs($this->admin);

        // Receive a message.
        $this->sendMessage($this->parent, 'Are you there?');
        $this->assertSame(1, $this->getUnreadCount());

        // Open the thread (auto-marks as read).
        $this->getJson("/api/inbox/conversations/{$this->conversation->id}/messages")
            ->assertOk();

        // Unread count must be exactly 0 — no ghost state.
        $final = $this->getUnreadCount();
        $this->assertSame(0, $final, "Ghost state detected: unread_count is {$final} after all messages were read");
    }

    #[Test]
    public function unread_count_response_structure_is_correct(): void
    {
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/inbox/messages/unread-count')
            ->assertOk()
            ->assertJsonStructure(['success', 'unread_count'])
            ->assertJson(['success' => true]);
    }

    // ─── System-generated conversation exclusion ──────────────────────────────

    #[Test]
    public function system_generated_conversation_messages_do_not_inflate_unread_count(): void
    {
        // Regression test for: unread count badge showed "1 unread message" while
        // the inbox showed 0, because system notification threads were counted by
        // getUnreadMessageCount() but are not displayed in the inbox.
        Sanctum::actingAs($this->admin);

        $systemConv = Conversation::factory()->create([
            'created_by_id' => null,
            'is_system_generated' => true,
        ]);
        $systemConv->participantRecords()->create([
            'user_id' => $this->admin->id,
            'joined_at' => now(),
        ]);
        // Unread system message — no sender, so it looks unread under the raw scope
        Message::factory()->create([
            'conversation_id' => $systemConv->id,
            'sender_id' => null,
            'body' => 'Your application status changed.',
        ]);

        // The system message must NOT inflate the inbox unread count — it lives
        // in the System folder, not the Inbox, so the badge must stay at 0.
        $this->assertSame(0, $this->getUnreadCount());
    }

    #[Test]
    public function trashed_conversation_messages_do_not_inflate_unread_count(): void
    {
        // Messages in conversations the user has trashed must not inflate the badge.
        // Trashed conversations are hidden from inbox, so their messages are unreachable.
        Sanctum::actingAs($this->admin);

        // Send a message into the shared conversation, then trash it for the admin.
        $this->sendMessage($this->parent, 'Trashed message');
        $this->postJson("/api/inbox/conversations/{$this->conversation->id}/trash")
            ->assertOk();

        $this->assertSame(0, $this->getUnreadCount());
    }
}
