<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add is_active boolean column to users table.
 *
 * Separates account activation state from email verification state.
 * Previously, deactivation incorrectly cleared email_verified_at —
 * this fixes the design flaw by introducing a dedicated column.
 *
 * Migration is additive and safe to run on existing data:
 * - All existing users default to active (is_active = true)
 * - email_verified_at is restored to its original semantic meaning
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('email_verified_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
