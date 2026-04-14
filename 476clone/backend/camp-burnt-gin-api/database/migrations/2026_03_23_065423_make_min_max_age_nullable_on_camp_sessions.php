<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Make min_age and max_age nullable on camp_sessions.
 *
 * Both columns were created NOT NULL with no default value, but the
 * StoreCampSessionRequest validation marks them nullable and the session
 * creation form does not require them. Any INSERT without these fields
 * caused: SQLSTATE[HY000] 1364 "Field 'min_age' doesn't have a default value"
 *
 * Fix: allow NULL so sessions can be created without age restrictions.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('camp_sessions', function (Blueprint $table) {
            $table->unsignedTinyInteger('min_age')->nullable()->change();
            $table->unsignedTinyInteger('max_age')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('camp_sessions', function (Blueprint $table) {
            $table->unsignedTinyInteger('min_age')->nullable(false)->change();
            $table->unsignedTinyInteger('max_age')->nullable(false)->change();
        });
    }
};
