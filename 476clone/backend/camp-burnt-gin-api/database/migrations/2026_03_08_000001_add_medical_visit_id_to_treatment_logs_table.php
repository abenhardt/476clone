<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links treatment logs to the medical visit they occurred during.
 *
 * A visit is the top-level clinical encounter; treatments are the
 * individual interventions performed within that encounter. This FK
 * makes the hierarchy explicit: Camper → Visit → Treatments.
 *
 * The column is nullable so that standalone treatment logs (created
 * outside a formal visit context) continue to work.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('treatment_logs', function (Blueprint $table) {
            $table->foreignId('medical_visit_id')
                ->nullable()
                ->after('camper_id')
                ->constrained('medical_visits')
                ->nullOnDelete();

            $table->index('medical_visit_id');
        });
    }

    public function down(): void
    {
        Schema::table('treatment_logs', function (Blueprint $table) {
            $table->dropForeign(['medical_visit_id']);
            $table->dropColumn('medical_visit_id');
        });
    }
};
