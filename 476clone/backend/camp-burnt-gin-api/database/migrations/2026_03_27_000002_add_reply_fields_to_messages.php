<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds reply threading fields to the messages table.
 *
 * parent_message_id: links a reply to the specific message it is responding to.
 *   - NULL for root messages (new conversations, or messages sent before this migration).
 *   - Non-null for replies and reply-all messages.
 *   - Set to NULL on delete (nullOnDelete) so deleting the parent message doesn't cascade
 *     and orphan the reply chain.
 *
 * reply_type: tracks whether this message is a reply or reply-all.
 *   - NULL for original (non-reply) messages.
 *   - 'reply'     → sent to original sender only.
 *   - 'reply_all' → sent to original sender + all visible TO/CC recipients (no BCC).
 *
 * These fields enable:
 *   1. Visual grouping / indentation of reply chains in future UI enhancements.
 *   2. Accurate reply-all recipient resolution (look up parent to find visible recipients).
 *   3. Audit-trail clarity (distinguishes a new thread from a reply action).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // Nullable FK — null for root messages, set for replies
            $table->foreignId('parent_message_id')
                ->nullable()
                ->after('sender_id')
                ->constrained('messages')
                ->nullOnDelete();

            // Null for new messages; 'reply' or 'reply_all' for replies
            $table->enum('reply_type', ['reply', 'reply_all'])
                ->nullable()
                ->after('parent_message_id');

            // Index for efficient "give me all replies to message X" queries
            $table->index(['parent_message_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropForeign(['parent_message_id']);
            $table->dropIndex(['parent_message_id', 'created_at']);
            $table->dropColumn(['parent_message_id', 'reply_type']);
        });
    }
};
