<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add deadline_id FK to calendar_events.
 *
 * This makes the calendar a visual layer that reflects the deadlines table.
 * Any calendar event with deadline_id set is "owned" by the deadline system:
 *
 *  - It cannot be created manually (CalendarEventController::store() blocks event_type='deadline')
 *  - It cannot be edited directly (controller rejects updates to deadline-linked events)
 *  - It is deleted automatically when its deadline is soft-deleted (via DeadlineObserver)
 *
 * nullOnDelete (not cascadeOnDelete): when a deadline is deleted, the observer
 * explicitly deletes the calendar event BEFORE the soft-delete fires, so this FK
 * is set to null only as a safety net for orphan prevention — not the primary path.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->foreignId('deadline_id')
                ->nullable()
                ->after('target_session_id')
                ->constrained('deadlines')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->dropForeign(['deadline_id']);
            $table->dropColumn('deadline_id');
        });
    }
};
