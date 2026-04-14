<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 2 — extend behavioral_profiles and feeding_plans with missing form fields.
 *
 * behavioral_profiles additions (Section 3 gaps):
 *   functional_reading    — can the camper read at a functional level
 *   functional_writing    — can the camper write at a functional level
 *   independent_mobility  — can the camper move independently
 *   verbal_communication  — can the camper communicate verbally
 *   social_skills         — appropriate peer social interaction
 *   behavior_plan         — a formal behavior intervention plan is in place
 *
 *   NOTE: mobility_notes lives in medical_records, not here.
 *
 * feeding_plans additions (Section 5 gaps):
 *   texture_modified  — food texture must be modified
 *   texture_level     — the specific texture level required (e.g. minced, puréed)
 *   fluid_restriction — fluids must be restricted or measured
 *   fluid_details     — description of fluid restriction protocol (encrypted — PHI)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('behavioral_profiles', function (Blueprint $table) {
            $table->boolean('functional_reading')->default(false)->after('developmental_delay');
            $table->boolean('functional_writing')->default(false)->after('functional_reading');
            $table->boolean('independent_mobility')->default(false)->after('functional_writing');
            $table->boolean('verbal_communication')->default(false)->after('independent_mobility');
            $table->boolean('social_skills')->default(false)->after('verbal_communication');
            $table->boolean('behavior_plan')->default(false)->after('social_skills');
        });

        Schema::table('feeding_plans', function (Blueprint $table) {
            $table->boolean('texture_modified')->default(false)->after('bolus_only');
            $table->string('texture_level', 100)->nullable()->after('texture_modified');
            $table->boolean('fluid_restriction')->default(false)->after('texture_level');
            $table->text('fluid_details')->nullable()->after('fluid_restriction'); // encrypted
        });
    }

    public function down(): void
    {
        Schema::table('behavioral_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'functional_reading', 'functional_writing', 'independent_mobility',
                'verbal_communication', 'social_skills', 'behavior_plan',
            ]);
        });

        Schema::table('feeding_plans', function (Blueprint $table) {
            $table->dropColumn(['texture_modified', 'texture_level', 'fluid_restriction', 'fluid_details']);
        });
    }
};
