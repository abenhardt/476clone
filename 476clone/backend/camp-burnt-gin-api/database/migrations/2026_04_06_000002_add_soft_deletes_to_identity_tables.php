<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds soft-delete support to core identity tables.
 *
 * HIPAA 45 CFR § 164.530(j) requires that covered entities retain PHI for at
 * least six years after the date of its creation or the date when it was last
 * in effect. Hard-deleting user records would violate this requirement.
 *
 * Tables covered:
 *  - users                   — account records (never hard-delete an account)
 *  - user_emergency_contacts — emergency contact PII linked to users
 *
 * Note: applicant_documents and document_requests (FK to users) use
 * nullOnDelete/no-cascade so existing records survive user soft-deletion.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'deleted_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        if (Schema::hasTable('user_emergency_contacts') && ! Schema::hasColumn('user_emergency_contacts', 'deleted_at')) {
            Schema::table('user_emergency_contacts', function (Blueprint $table) {
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'deleted_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }

        if (Schema::hasColumn('user_emergency_contacts', 'deleted_at')) {
            Schema::table('user_emergency_contacts', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};
