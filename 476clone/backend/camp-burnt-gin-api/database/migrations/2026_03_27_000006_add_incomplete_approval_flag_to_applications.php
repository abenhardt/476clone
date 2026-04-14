<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add is_incomplete_at_approval flag to applications.
 *
 * Records whether an admin chose to approve an application despite missing
 * fields, documents, or consents. This flag is set to true only when an
 * admin explicitly overrides the completeness warning.
 *
 * The flag persists indefinitely so admins reviewing the application later
 * can see it was approved with known gaps — preventing silent data issues
 * from surfacing unexpectedly during camp operations.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->boolean('is_incomplete_at_approval')
                ->default(false)
                ->after('is_draft');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('is_incomplete_at_approval');
        });
    }
};
