<?php

namespace Database\Seeders;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\MessageRead;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

/**
 * Seeder — message_reads read receipts for realistic inbox unread states.
 *
 * This seeder creates MessageRead records for existing messages so that the inbox
 * displays meaningful unread badge counts rather than every message appearing unread.
 *
 * Strategy:
 *
 *   Pass 1 — System-generated conversations:
 *     All messages in all system conversations are marked read by all participants.
 *     System notifications (document requests, application status, security alerts)
 *     should appear as already-read after normal portal use.
 *
 *   Pass 2 — Unanswered conversations (skip list):
 *     The Patricia Davis / Mia heat concerns thread ("Mia Davis — Heat Protocol Questions")
 *     is intentionally skipped so admin's inbox shows an unread badge for that thread.
 *     This preserves the "waiting for response" UI state seeded by ExtendedMessageSeeder.
 *
 *   Pass 3 — Regular conversations (non-system, not skip-listed):
 *     All messages EXCEPT the most recent are marked read by all non-sender participants.
 *     The most recent message is left unread for the non-sender(s). This produces a
 *     realistic "one unread reply" state for each active conversation without making
 *     every thread look unread.
 *     Exception: for conversations older than 7 days, all messages including the last
 *     are marked read (these threads are resolved/dormant).
 *
 * Note: Senders are never given a MessageRead for their own messages — this mirrors
 * the guard in Message::markAsReadBy() and keeps data consistent with runtime behaviour.
 *
 * Uses MessageRead::firstOrCreate for full idempotency — safe to re-run.
 */
class MessageReadSeeder extends Seeder
{
    /**
     * Conversation subjects that must remain fully unread for admin.
     * These are the "waiting for response" threads that drive unread badge state.
     */
    private const LEAVE_UNREAD_FOR_ADMIN = [
        'Mia Davis — Heat Protocol Questions',
    ];

    public function run(): void
    {
        // ── Pass 1: System-generated conversations — mark all messages read ────
        $systemConversations = Conversation::where('is_system_generated', true)
            ->whereNull('deleted_at')
            ->get();

        foreach ($systemConversations as $conversation) {
            $participantUserIds = ConversationParticipant::where('conversation_id', $conversation->id)
                ->whereNull('left_at')
                ->pluck('user_id')
                ->all();

            $messages = Message::where('conversation_id', $conversation->id)
                ->whereNull('deleted_at')
                ->get();

            foreach ($messages as $message) {
                foreach ($participantUserIds as $userId) {
                    // Never give the sender a receipt for their own message
                    if ($message->sender_id !== null && $message->sender_id === $userId) {
                        continue;
                    }

                    MessageRead::firstOrCreate(
                        ['message_id' => $message->id, 'user_id' => $userId],
                        ['read_at' => $message->created_at->clone()->addMinutes(rand(10, 480))]
                    );
                }
            }
        }

        // ── Pass 2 & 3: Regular conversations ────────────────────────────────
        $regularConversations = Conversation::where(function ($q) {
            $q->where('is_system_generated', false)
                ->orWhereNull('is_system_generated');
        })
            ->whereNull('deleted_at')
            ->get();

        foreach ($regularConversations as $conversation) {
            // Skip — preserve the unanswered thread as unread for admin
            if (in_array($conversation->subject, self::LEAVE_UNREAD_FOR_ADMIN, true)) {
                continue;
            }

            $participantUserIds = ConversationParticipant::where('conversation_id', $conversation->id)
                ->whereNull('left_at')
                ->pluck('user_id')
                ->all();

            if (empty($participantUserIds)) {
                continue;
            }

            $messages = Message::where('conversation_id', $conversation->id)
                ->whereNull('deleted_at')
                ->orderBy('created_at')
                ->get();

            if ($messages->isEmpty()) {
                continue;
            }

            $latestMessageId = $messages->last()->id;
            $conversationAgeDays = (int) Carbon::now()->diffInDays($conversation->created_at);

            // Conversations older than 7 days are treated as resolved — mark everything read
            $markAllRead = $conversationAgeDays > 7;

            foreach ($messages as $message) {
                $isLatestMessage = ($message->id === $latestMessageId);

                foreach ($participantUserIds as $userId) {
                    // Never receipt the sender for their own message
                    if ($message->sender_id !== null && $message->sender_id === $userId) {
                        continue;
                    }

                    // For active conversations (< 7 days), leave the latest message unread
                    // for non-senders to produce a real unread badge in the inbox
                    if (! $markAllRead && $isLatestMessage) {
                        // Only skip if this user is not the sender (already excluded above)
                        // and the message has a human sender (system messages are always read)
                        if ($message->sender_id !== null) {
                            continue;
                        }
                    }

                    MessageRead::firstOrCreate(
                        ['message_id' => $message->id, 'user_id' => $userId],
                        ['read_at' => $message->created_at->clone()->addMinutes(rand(5, 360))]
                    );
                }
            }
        }

        $this->command->line('  Message reads seeded (system conversations fully read; active threads have unread tail; unanswered thread preserved).');
    }
}
