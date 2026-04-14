<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds form_definition_id to the applications table.
 *
 * This nullable FK version-locks each submitted application to the exact
 * form definition that was active at submission time. This means:
 *  - Historical applications can always be re-rendered with the original schema,
 *    even after an admin has published a new version of the form.
 *  - Null means the application predates this feature (pre-Phase 14 applications).
 *    Those are rendered using the current active form definition for display purposes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->foreignId('form_definition_id')
                ->nullable()
                ->after('id')
                ->constrained('form_definitions')
                ->nullOnDelete();

            $table->index('form_definition_id');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropForeign(['form_definition_id']);
            $table->dropColumn('form_definition_id');
        });
    }
};
