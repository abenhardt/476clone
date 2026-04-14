<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds date_of_medical_exam to the medical_records table.
 *
 * Stores the date printed on the physician-completed Form 4523 (CYSHCN Medical
 * Examination). This date drives the 12-month validity window enforced by
 * DocumentEnforcementService — a physical_examination document whose
 * date_of_medical_exam is more than 12 months before the session start date
 * is treated as expired.
 *
 * Stored on MedicalRecord (not Application) because it belongs to the camper's
 * longitudinal health record, not to a single application cycle.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->date('date_of_medical_exam')->nullable()->after('has_neurostimulator');
        });
    }

    public function down(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->dropColumn('date_of_medical_exam');
        });
    }
};
