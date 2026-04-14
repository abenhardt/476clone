<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 2 — create personal_care_plans table (Section 6: Personal Care & Sleep).
 *
 * One record per camper. Follows the same 1:1 per-camper pattern as
 * behavioral_profiles and feeding_plans.
 *
 * Assistance levels use short string values (e.g. 'independent', 'verbal_cue',
 * 'physical_assist', 'full_assist') that mirror the options in the form.
 *
 * All notes/description fields are encrypted at rest (PHI — describe clinical
 * care protocols and personal hygiene details for a child with disabilities).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('personal_care_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')
                ->constrained()
                ->cascadeOnDelete();

            // Bathing / showering
            $table->string('bathing_level', 50)->nullable();
            $table->text('bathing_notes')->nullable();          // encrypted

            // Toileting (daytime)
            $table->string('toileting_level', 50)->nullable();
            $table->text('toileting_notes')->nullable();        // encrypted

            // Nighttime toileting
            $table->boolean('nighttime_toileting')->default(false);
            $table->text('nighttime_notes')->nullable();        // encrypted

            // Dressing & undressing
            $table->string('dressing_level', 50)->nullable();
            $table->text('dressing_notes')->nullable();         // encrypted

            // Oral hygiene
            $table->string('oral_hygiene_level', 50)->nullable();
            $table->text('oral_hygiene_notes')->nullable();     // encrypted

            // Positioning & transfers
            $table->text('positioning_notes')->nullable();      // encrypted

            // Sleep routine
            $table->text('sleep_notes')->nullable();            // encrypted
            $table->boolean('falling_asleep_issues')->default(false);
            $table->boolean('sleep_walking')->default(false);
            $table->boolean('night_wandering')->default(false);

            // Bowel & continence
            $table->text('bowel_control_notes')->nullable();    // encrypted
            $table->boolean('urinary_catheter')->default(false);

            // Menstruation support
            $table->boolean('menstruation_support')->default(false);

            $table->timestamps();

            $table->unique('camper_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personal_care_plans');
    }
};
