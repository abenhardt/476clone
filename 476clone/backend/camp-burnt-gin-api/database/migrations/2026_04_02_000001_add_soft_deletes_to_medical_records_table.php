<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add soft-delete support to medical_records.
 *
 * HIPAA requires retention of medical records for a minimum of 6 years after
 * the date of service (45 CFR § 164.530(j)). Hard-deleting medical records would
 * violate this requirement and destroy the audit trail needed for compliance.
 *
 * With soft deletes, a "deleted" medical record is only flagged with deleted_at;
 * the data remains in the database and can be restored or audited as required.
 * Eloquent automatically excludes soft-deleted rows from all standard queries.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
