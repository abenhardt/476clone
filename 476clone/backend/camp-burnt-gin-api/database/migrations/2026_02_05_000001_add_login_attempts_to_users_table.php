<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to add login attempt tracking and account lockout fields.
 *
 * Implements account lockout security control to prevent brute force attacks.
 * After 5 failed login attempts, account is locked for 15 minutes.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('failed_login_attempts')->default(0)->after('mfa_verified_at');
            $table->timestamp('lockout_until')->nullable()->after('failed_login_attempts');
            $table->timestamp('last_failed_login_at')->nullable()->after('lockout_until');

            $table->index('lockout_until');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['lockout_until']);
            $table->dropColumn(['failed_login_attempts', 'lockout_until', 'last_failed_login_at']);
        });
    }
};
