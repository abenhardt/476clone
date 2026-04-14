<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 2 — extend campers with demographic/preference fields from Section 1.
 *
 * Fields added:
 *   preferred_name    — camper's nickname or preferred first name
 *   county            — county of residence (used for CYSHCN program eligibility)
 *   needs_interpreter — whether a language interpreter is required at camp
 *   preferred_language — primary language if interpreter is needed
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            $table->string('preferred_name', 100)->nullable()->after('last_name');
            $table->string('county', 100)->nullable()->after('preferred_name');
            $table->boolean('needs_interpreter')->default(false)->after('county');
            $table->string('preferred_language', 100)->nullable()->after('needs_interpreter');
        });
    }

    public function down(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            $table->dropColumn(['preferred_name', 'county', 'needs_interpreter', 'preferred_language']);
        });
    }
};
