<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds per-user state tracking to conversation_participants.
 *
 * Phase 8 — Inbox/Messaging Restructure:
 * - is_starred: user-specific star (replaces localStorage-only approach)
 * - is_important: user-specific importance flag
 * - trashed_at: per-user soft delete (move to trash without global deletion)
 *
 * These fields are stored on the pivot table so each participant has
 * independent state for the same conversation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->boolean('is_starred')->default(false)->after('left_at');
            $table->boolean('is_important')->default(false)->after('is_starred');
            $table->timestamp('trashed_at')->nullable()->after('is_important');

            // Indexes for efficient folder queries
            $table->index(['user_id', 'is_starred'], 'cp_user_starred');
            $table->index(['user_id', 'is_important'], 'cp_user_important');
            $table->index(['user_id', 'trashed_at'], 'cp_user_trashed');
        });
    }

    public function down(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->dropIndex('cp_user_starred');
            $table->dropIndex('cp_user_important');
            $table->dropIndex('cp_user_trashed');
            $table->dropColumn(['is_starred', 'is_important', 'trashed_at']);
        });
    }
};
