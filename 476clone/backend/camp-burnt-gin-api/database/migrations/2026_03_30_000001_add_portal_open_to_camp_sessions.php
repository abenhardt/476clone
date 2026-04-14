<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds `portal_open` to camp_sessions.
 *
 * `portal_open = true`  — admins have manually opened this session for applications;
 *                         it appears in the applicant portal and can be selected.
 * `portal_open = false` — session is not yet accepting applications (default).
 *
 * This is independent of `is_active` (archive flag) and the date-derived status
 * (upcoming/active/completed). A session can be upcoming but portal_open, meaning
 * the admin opened early registration before the camp dates arrive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('camp_sessions', function (Blueprint $table) {
            $table->boolean('portal_open')->default(false)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('camp_sessions', function (Blueprint $table) {
            $table->dropColumn('portal_open');
        });
    }
};
