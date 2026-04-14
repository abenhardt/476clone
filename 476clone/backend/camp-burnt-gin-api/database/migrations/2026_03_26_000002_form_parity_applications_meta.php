<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Form Parity — applications table meta fields.
 *
 * The official paper application form (0717-ENG-DPH) and the ReadyOp online form
 * both capture:
 *   - Whether this is the applicant's first Camp Burnt Gin application
 *   - Whether the applicant has attended before
 *   - A second-choice session preference
 *
 * These fields were missing from the initial applications schema.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->boolean('first_application')->default(false)->after('is_draft');
            $table->boolean('attended_before')->default(false)->after('first_application');
            $table->foreignId('camp_session_id_second')
                ->nullable()
                ->after('camp_session_id')
                ->constrained('camp_sessions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropForeign(['camp_session_id_second']);
            $table->dropColumn(['first_application', 'attended_before', 'camp_session_id_second']);
        });
    }
};
