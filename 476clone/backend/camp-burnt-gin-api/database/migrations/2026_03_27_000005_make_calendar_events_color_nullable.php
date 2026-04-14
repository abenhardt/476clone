<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Make calendar_events.color nullable.
 *
 * Deadline-type events intentionally store color=null — the frontend computes
 * the urgency color dynamically from the deadline's due_date at render time.
 * This keeps the color always fresh without a daily re-sync job.
 *
 * Non-deadline events continue to use explicit color strings as before.
 * The default '#22C55E' is removed since callers always provide an explicit value.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->string('color', 20)->nullable()->default(null)->change();
        });
    }

    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->string('color', 20)->default('#22C55E')->change();
        });
    }
};
