<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 2 — add 8 narrative response columns to applications (Section "About Your Camper").
 *
 * Narratives are application-cycle-specific free-text responses from the parent.
 * They are stored as named columns (not JSON) for queryability and type clarity.
 *
 * These are NOT encrypted: they do not contain clinical PHI — they are subjective
 * parent narratives about camp suitability, goals, and preferences.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->text('narrative_rustic_environment')->nullable()->after('notes');
            $table->text('narrative_staff_suggestions')->nullable()->after('narrative_rustic_environment');
            $table->text('narrative_participation_concerns')->nullable()->after('narrative_staff_suggestions');
            $table->text('narrative_camp_benefit')->nullable()->after('narrative_participation_concerns');
            $table->text('narrative_heat_tolerance')->nullable()->after('narrative_camp_benefit');
            $table->text('narrative_transportation')->nullable()->after('narrative_heat_tolerance');
            $table->text('narrative_additional_info')->nullable()->after('narrative_transportation');
            $table->text('narrative_emergency_protocols')->nullable()->after('narrative_additional_info');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn([
                'narrative_rustic_environment', 'narrative_staff_suggestions',
                'narrative_participation_concerns', 'narrative_camp_benefit',
                'narrative_heat_tolerance', 'narrative_transportation',
                'narrative_additional_info', 'narrative_emergency_protocols',
            ]);
        });
    }
};
