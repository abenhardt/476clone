<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Form Parity — campers applicant mailing address.
 *
 * The official application form and ReadyOp online system both capture the
 * applicant's own mailing address separately from the guardian's address.
 * This is needed when the applicant lives at a different address (e.g. shared
 * custody, group home) or for mailing official correspondence directly.
 *
 * All address fields are encrypted at rest (PHI — residential location of a minor
 * with special health care needs).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            $table->text('applicant_address')->nullable()->after('preferred_language');  // encrypted
            $table->string('applicant_city', 100)->nullable()->after('applicant_address');
            $table->string('applicant_state', 10)->nullable()->after('applicant_city');
            $table->string('applicant_zip', 20)->nullable()->after('applicant_state');
        });
    }

    public function down(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            $table->dropColumn(['applicant_address', 'applicant_city', 'applicant_state', 'applicant_zip']);
        });
    }
};
