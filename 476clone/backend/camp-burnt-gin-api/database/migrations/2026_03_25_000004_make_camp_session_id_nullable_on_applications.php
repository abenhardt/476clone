<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Allow cloned/draft applications to exist without a session.
 *
 * When a parent reapplies (cloneApplication), the new draft has no session yet —
 * the parent selects one before submitting. This migration makes camp_session_id
 * nullable to support that flow.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->foreignId('camp_session_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->foreignId('camp_session_id')->nullable(false)->change();
        });
    }
};
