<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the conversations table for the Inbox messaging system.
 *
 * Conversations represent message threads between users, optionally
 * linked to applications, campers, or camp sessions for contextual filtering.
 *
 * Supports HIPAA-compliant internal messaging with full audit trail.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by_id')->constrained('users')->cascadeOnDelete();
            $table->string('subject', 255); // Explicit length constraint
            $table->foreignId('application_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('camper_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('camp_session_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('last_message_at')->nullable()->index(); // Direct index for sorting
            $table->boolean('is_archived')->default(false)->index(); // Direct index for filtering
            $table->timestamps();
            $table->softDeletes();

            // Composite indexes for soft-delete-aware queries
            $table->index(['created_by_id', 'deleted_at']);
            $table->index(['application_id', 'deleted_at']);
            $table->index(['camper_id', 'deleted_at']);
            $table->index(['camp_session_id', 'deleted_at']);
            $table->index(['is_archived', 'deleted_at', 'last_message_at']); // Composite for active conversation listing
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
