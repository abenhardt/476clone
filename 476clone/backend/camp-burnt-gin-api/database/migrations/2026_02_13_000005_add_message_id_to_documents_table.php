<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extends the documents table to support message attachments.
 *
 * Adds optional foreign key to messages table, allowing documents
 * to be associated with either applications or messages.
 *
 * Reuses existing document upload, scanning, and storage infrastructure.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            // Add message_id column without positioning (MySQL/SQLite compatible)
            $table->foreignId('message_id')->nullable()->constrained()->cascadeOnDelete();

            // Index for message attachment queries
            // Note: deleted_at will be added by separate soft delete migration if needed
            $table->index('message_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign(['message_id']);
            $table->dropIndex(['message_id']);
            $table->dropColumn('message_id');
        });
    }
};
