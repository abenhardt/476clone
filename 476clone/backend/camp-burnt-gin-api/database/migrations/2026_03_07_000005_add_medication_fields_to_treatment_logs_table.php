<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds medication_given and dosage_given columns to treatment_logs.
 *
 * These fields capture the medication name and dosage for any medication
 * administered during a treatment intervention. Both are nullable (medication
 * is not always given) and encrypted at rest for HIPAA compliance.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('treatment_logs', function (Blueprint $table) {
            $table->text('medication_given')->nullable()->after('outcome');
            $table->text('dosage_given')->nullable()->after('medication_given');
        });
    }

    public function down(): void
    {
        Schema::table('treatment_logs', function (Blueprint $table) {
            $table->dropColumn(['medication_given', 'dosage_given']);
        });
    }
};
