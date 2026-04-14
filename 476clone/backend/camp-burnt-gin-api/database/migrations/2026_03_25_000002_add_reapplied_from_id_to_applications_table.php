<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds reapplied_from_id to the applications table.
 *
 * When a parent re-applies for camp using the clone endpoint, the new draft
 * application records which previous application it was created from. This
 * provides a reapplication audit trail and lets staff see the camper's history.
 *
 * nullOnDelete: if the source application is ever hard-deleted (admin action),
 * the linkage is cleared rather than cascading to delete the new application.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->foreignId('reapplied_from_id')
                ->nullable()
                ->after('form_definition_id')
                ->constrained('applications')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropForeign(['reapplied_from_id']);
            $table->dropColumn('reapplied_from_id');
        });
    }
};
