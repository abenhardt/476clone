<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the deadlines table — the single source of truth for all timing, enforcement,
 * and visibility of time-sensitive requirements across sessions.
 *
 * Design decisions:
 *  - entity_type + entity_id form a polymorphic reference WITHOUT a formal Laravel morphTo()
 *    because entity_id is nullable (null = session-wide scope, not a specific record).
 *  - camp_session_id is NOT nullable: every deadline must belong to a session for scoping.
 *  - enforcement_mode separates the concept of "is this enforced" (is_enforced) from
 *    "what does enforcement do" (hard = HTTP 422 block, soft = warning flag only).
 *  - status is a display/filter field; real-time enforcement uses due_date arithmetic,
 *    not this column, so enforcement is always current even before the daily sync job runs.
 *  - softDeletes: deleted deadlines cascade-delete their calendar events via the observer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deadlines', function (Blueprint $table) {
            $table->id();

            // Session scope — all deadlines belong to a specific camp session
            $table->foreignId('camp_session_id')
                ->constrained('camp_sessions')
                ->cascadeOnDelete();

            // Polymorphic target — what this deadline applies to
            // entity_type: 'document_request' | 'application' | 'medical_requirement' | 'session'
            // entity_id: null means session-wide (applies to all entities of entity_type in this session)
            $table->string('entity_type', 40);
            $table->unsignedBigInteger('entity_id')->nullable();

            // Human-readable label shown in calendars, dashboards, and notifications
            $table->string('title');
            $table->text('description')->nullable();

            // Timing
            $table->dateTime('due_date');
            // Grace period added to due_date before enforcement triggers.
            // effectiveDueDate() = due_date + grace_period_days.
            $table->unsignedTinyInteger('grace_period_days')->default(0);

            // Status is updated by the daily SyncDeadlineStatuses job.
            // Enforcement checks use due_date arithmetic directly (not this column)
            // so the system is always accurate between job runs.
            $table->string('status', 20)->default('pending');
            // pending | completed | overdue | extended

            // Enforcement config
            $table->boolean('is_enforced')->default(false);
            // enforcement_mode is only meaningful when is_enforced = true:
            //   hard → HTTP 422 (blocks the action entirely)
            //   soft → HTTP 200 with a warning flag in the response body
            $table->string('enforcement_mode', 10)->default('soft');

            // Visibility control — when false, this deadline is internal to admins only
            $table->boolean('is_visible_to_applicants')->default(true);

            // Admin override notes (set when manually completing or extending a deadline)
            $table->text('override_note')->nullable();

            // Ownership
            $table->foreignId('created_by')->constrained('users');
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->softDeletes();
            $table->timestamps();

            // Indexes for the most common query patterns
            $table->index(['entity_type', 'entity_id'], 'deadlines_entity_idx');
            $table->index('camp_session_id');
            $table->index('due_date');
            $table->index('status');
            $table->index('is_enforced');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deadlines');
    }
};
