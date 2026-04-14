<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the messages table for conversation message content.
 *
 * Messages are immutable write-once records. Editing is not supported
 * to maintain audit integrity and HIPAA compliance. Soft deletes only.
 *
 * Idempotency key prevents duplicate message submission on network retry.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->string('idempotency_key', 64)->unique(); // UNIQUE constraint creates index automatically
            $table->timestamps();
            $table->softDeletes();

            // Composite indexes for efficient queries with soft delete filtering
            $table->index(['conversation_id', 'created_at', 'deleted_at']); // Thread retrieval
            $table->index(['conversation_id', 'deleted_at']); // Count queries
            $table->index(['sender_id', 'created_at', 'deleted_at']); // User's sent messages
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
