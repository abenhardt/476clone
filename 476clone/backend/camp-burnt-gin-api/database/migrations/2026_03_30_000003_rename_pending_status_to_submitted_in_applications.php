<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Renames the 'pending' status value to 'submitted' in the applications table.
 *
 * Background: The status label 'pending' was ambiguous — it could mean either
 * "incomplete" or "waiting for review". Since this state is only set when a
 * parent has fully submitted their application and is awaiting admin review,
 * 'submitted' is the precise, unambiguous term.
 *
 * This migration updates:
 *  1. Existing rows: any application with status='pending' becomes status='submitted'
 *  2. Column default: the string default is updated from 'pending' to 'submitted'
 *
 * Safe to run on live data — it is an atomic UPDATE with no foreign key impact.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Update all existing rows first, before changing the column default.
        DB::statement("UPDATE applications SET status = 'submitted' WHERE status = 'pending'");

        // Update the column default so raw SQL inserts (e.g., tests, scripts) also use 'submitted'.
        Schema::table('applications', function (Blueprint $table) {
            $table->string('status')->default('submitted')->change();
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->string('status')->default('pending')->change();
        });

        DB::statement("UPDATE applications SET status = 'pending' WHERE status = 'submitted'");
    }
};
