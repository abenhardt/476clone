<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the risk_assessments table.
 *
 * This table stores a persistent record of every computed risk assessment for each
 * camper, including the full factor breakdown, medical review state, and any
 * clinician overrides. The previous design computed risk on-demand and discarded
 * the result — this migration introduces a proper audit trail.
 *
 * Key design decisions:
 *
 *  is_current — only one record per camper is marked current. When a recalculation
 *    produces a different score, the old record is demoted and a new one created.
 *    Unchanged scores simply update calculated_at on the existing current record.
 *
 *  review_status — transitions: system_calculated → reviewed | overridden.
 *    A significant score change (>5 pts) resets a reviewed assessment back to
 *    system_calculated so medical staff are prompted to review again.
 *
 *  clinical_notes / override_reason — encrypted PHI because they may contain
 *    camper-identifiable clinical observations.
 *
 *  factor_breakdown — JSON array of objects: { key, label, category, points, present }.
 *    Stored so the history view shows exactly what drove the score at the time
 *    of calculation, even if the algorithm constants change later.
 *
 *  effective_supervision_level — the level staff actually use (override if set,
 *    otherwise system-calculated). Derived at read time, not stored, to avoid
 *    stale denormalization.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_assessments', function (Blueprint $table) {
            $table->id();

            // Which camper this assessment belongs to
            $table->foreignId('camper_id')
                ->constrained()
                ->cascadeOnDelete();

            // ── Computed values ──────────────────────────────────────────────
            $table->timestamp('calculated_at');
            $table->unsignedSmallInteger('risk_score');           // 0–100
            $table->string('supervision_level', 20);              // SupervisionLevel enum value
            $table->string('medical_complexity_tier', 20);        // MedicalComplexityTier enum value
            $table->json('flags')->nullable();                    // ['seizures', 'g_tube', ...]
            $table->json('factor_breakdown')->nullable();         // [{key, label, category, points, present}]

            // ── Current-record marker ────────────────────────────────────────
            // Exactly one record per camper has is_current = true (the latest).
            $table->boolean('is_current')->default(false);

            // ── Medical review state ─────────────────────────────────────────
            // review_status: 'system_calculated' | 'reviewed' | 'overridden'
            $table->string('review_status', 30)->default('system_calculated');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            // Clinical notes may contain PHI observations — encrypted
            $table->text('clinical_notes')->nullable();

            // ── Override fields ──────────────────────────────────────────────
            // Medical staff may override the system-calculated supervision level.
            // The override_reason is mandatory when an override is applied.
            $table->string('override_supervision_level', 20)->nullable();
            // Override reason may contain PHI clinical justification — encrypted
            $table->text('override_reason')->nullable();
            $table->foreignId('overridden_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('overridden_at')->nullable();

            $table->timestamps();

            // ── Indexes ──────────────────────────────────────────────────────
            $table->index('camper_id');
            $table->index(['camper_id', 'is_current']);   // fast lookup of current assessment
            $table->index('calculated_at');
            $table->index('review_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_assessments');
    }
};
