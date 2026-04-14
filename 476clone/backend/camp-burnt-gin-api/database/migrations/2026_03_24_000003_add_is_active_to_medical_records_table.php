<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the is_active column to the medical_records table.
 *
 * Operational semantics:
 *   is_active = true  — the associated camper is currently active (has an approved
 *                       application). The medical record appears in medical staff
 *                       queues, dashboards, and all clinical operational views.
 *
 *   is_active = false — the associated camper's application was reversed or cancelled
 *                       and no currently approved application exists. The record is
 *                       retained for HIPAA audit and record-retention compliance but
 *                       is excluded from active medical workflows.
 *
 * Lifecycle management:
 *   Activation   is performed by ApplicationService when an application is approved,
 *                immediately after the medical record is created or found via
 *                firstOrCreate.
 *   Deactivation is performed by ApplicationService when an approved application is
 *                reversed and no other approved application remains for the camper.
 *
 * Data backfill:
 *   Existing rows are backfilled at migration time. Any medical record belonging to
 *   a camper that is already is_active = true receives is_active = true here.
 *   All others remain is_active = false.
 *
 *   Note: this migration depends on 2026_03_24_000002 having been run first so that
 *   campers.is_active is available for the backfill join.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            // Default false: new medical records are inactive until the associated
            // camper's application is approved.
            $table->boolean('is_active')->default(false)->after('camper_id');

            // Index supports efficient filtering in medical roster queries.
            $table->index('is_active');
        });

        // Backfill: activate medical records whose camper is already active.
        // Uses a subquery instead of a JOIN-style UPDATE for SQLite compatibility.
        DB::statement('
            UPDATE medical_records
            SET is_active = TRUE
            WHERE camper_id IN (
                SELECT id FROM campers WHERE is_active = TRUE
            )
        ');
    }

    public function down(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->dropIndex(['is_active']);
            $table->dropColumn('is_active');
        });
    }
};
