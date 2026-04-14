<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the is_active column to the campers table.
 *
 * Operational semantics:
 *   is_active = true  — the camper has at least one approved application and
 *                       is an active participant in camp operations. The camper
 *                       appears on admin rosters, medical queues, and all
 *                       operational views.
 *
 *   is_active = false — the camper has no currently approved application.
 *                       The record is retained for audit and re-application
 *                       purposes but is excluded from operational rosters.
 *
 * Lifecycle management:
 *   Activation   is performed by ApplicationService when an application is approved.
 *   Deactivation is performed by ApplicationService when an approved application is
 *                reversed (moved to rejected or cancelled) and no other approved
 *                application exists for the same camper.
 *
 * Data backfill:
 *   Existing rows are backfilled at migration time. Any camper that already has
 *   at least one application with status = 'approved' is set to is_active = true.
 *   All other campers remain is_active = false.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            // Default false: new camper profiles are inactive until an application is approved.
            $table->boolean('is_active')->default(false)->after('tshirt_size');

            // Index supports efficient filtering of active campers in roster queries.
            $table->index('is_active');
        });

        // Backfill: activate campers that already have an approved application.
        // Uses a subquery to avoid loading all rows into PHP memory.
        DB::statement("
            UPDATE campers
            SET is_active = TRUE
            WHERE id IN (
                SELECT DISTINCT camper_id
                FROM applications
                WHERE status = 'approved'
            )
        ");
    }

    public function down(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            $table->dropIndex(['is_active']);
            $table->dropColumn('is_active');
        });
    }
};
