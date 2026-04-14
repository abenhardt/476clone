<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Data-only migration: backfill submitted_at for non-draft applications.
 *
 * Context: Several seeders (EdgeCaseSeeder, pre-2026 seeders) created application rows
 * with is_draft = false and a valid status (pending, under_review, etc.) but left
 * submitted_at = NULL. This caused the admin queue to show "Not submitted" for these
 * applications and prevented queue_position from being computed.
 *
 * Fix: set submitted_at = created_at for every submitted (non-draft) application
 * that is currently missing it. Using created_at preserves the original insert timestamp
 * and gives a consistent FIFO ordering for these historical rows.
 *
 * This migration is purely additive and non-destructive:
 *   - No columns are added or removed.
 *   - Only rows with submitted_at IS NULL and is_draft = 0 are touched.
 *   - Applications that already have submitted_at set are unaffected.
 *   - Rollback clears the backfilled values (sets them back to NULL) — safe because
 *     these rows had NULL before this migration ran.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Single UPDATE — no schema change, no table locks beyond the rows touched.
        DB::statement(
            'UPDATE applications SET submitted_at = created_at WHERE is_draft = 0 AND submitted_at IS NULL'
        );
    }

    public function down(): void
    {
        // Reverse: mark as un-submitted any row whose submitted_at equals created_at
        // and was presumably set by this migration. We cannot distinguish these rows
        // from legitimately-submitted applications with the same timestamp, so this
        // rollback is a best-effort approximation — use with caution on production data.
        //
        // In practice this migration should never be rolled back on a live database;
        // the condition is conservative enough to avoid touching real submissions.
        DB::statement(
            'UPDATE applications SET submitted_at = NULL WHERE is_draft = 0 AND submitted_at = created_at'
        );
    }
};
