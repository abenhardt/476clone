<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add soft-delete support to allergies.
 *
 * Allergy records are health PHI. Removing an allergy from a camper's profile
 * (e.g., after outgrowing it) should never destroy the historical record — a camp
 * health team may need to know what allergies a camper was listed as having in
 * a prior year for liability and safety continuity purposes.
 *
 * Soft deletes allow the operational UI to hide "removed" allergies while
 * retaining the data for audits and legal review.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('allergies', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('allergies', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
