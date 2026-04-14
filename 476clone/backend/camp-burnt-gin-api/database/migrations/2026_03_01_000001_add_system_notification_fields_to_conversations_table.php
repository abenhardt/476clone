<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add system notification fields to the conversations table.
 *
 * System notifications are platform-generated, non-interactive messages
 * (application status changes, security events, role changes, etc.).
 * They share the conversation infrastructure but are visually and
 * behaviourally distinct from user-to-user threads.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            // Flag: true = platform-generated, non-replyable notification
            $table->boolean('is_system_generated')->default(false)->after('is_archived');

            // Machine-readable event identifier: 'application.submitted', 'security.password_changed', etc.
            $table->string('system_event_type', 100)->nullable()->after('is_system_generated');

            // Human-readable category shown as badge in UI: 'Application', 'Security', 'Role', 'Medical'
            $table->string('system_event_category', 50)->nullable()->after('system_event_type');

            // Optional polymorphic context (e.g. Application #42, User #7)
            $table->string('related_entity_type', 100)->nullable()->after('system_event_category');
            $table->unsignedBigInteger('related_entity_id')->nullable()->after('related_entity_type');

            // Composite index for System tab queries
            $table->index(['is_system_generated', 'deleted_at'], 'conv_system_generated_idx');
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropIndex('conv_system_generated_idx');
            $table->dropColumn([
                'is_system_generated',
                'system_event_type',
                'system_event_category',
                'related_entity_type',
                'related_entity_id',
            ]);
        });
    }
};
