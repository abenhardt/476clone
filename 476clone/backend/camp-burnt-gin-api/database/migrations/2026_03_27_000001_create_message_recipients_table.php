<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the message_recipients table for Gmail-style TO/CC/BCC recipient tracking.
 *
 * This table tracks the recipient type (TO, CC, or BCC) for each user on each
 * individual message. It is distinct from conversation_participants, which is the
 * access-control layer (who can see the thread at all). This table is purely for
 * display and recipient-resolution semantics.
 *
 * BCC privacy enforcement:
 *   - BCC rows exist in this table for all messages where a BCC was used.
 *   - The API layer MUST filter them out before returning responses to anyone
 *     who is not the original sender of that message.
 *   - This table should never be exposed raw to clients.
 *
 * Design notes:
 *   - A user appears at most once per message (UNIQUE constraint).
 *   - is_read/read_at mirror the message_reads table but are scoped per-recipient-type,
 *     which supports future "read receipt by recipient type" reporting.
 *   - Messages that existed before this migration have no rows here; the API falls back
 *     to treating all conversation_participants as implicit TO recipients for those.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // The recipient type determines visibility in API responses and reply-all logic.
            // BCC recipients must never appear in responses to non-senders.
            $table->enum('recipient_type', ['to', 'cc', 'bcc'])->default('to');
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            // A user can only appear once per message (no duplicate TO/CC/BCC rows)
            $table->unique(['message_id', 'user_id']);

            // Composite indexes for efficient recipient queries
            $table->index(['message_id', 'recipient_type']); // "give me all TO recipients of message X"
            $table->index(['user_id', 'is_read']);           // "unread count for user Y"
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_recipients');
    }
};
