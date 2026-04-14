<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to add supervision level and retention fields to campers table.
 *
 * Adds supervision level tracking for staff-to-camper ratio planning and
 * record retention date for HIPAA compliance with long-term medical record
 * retention requirements.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            $table->string('supervision_level')->default('standard')->after('gender');
            $table->date('record_retention_until')->nullable()->after('supervision_level');

            $table->index('supervision_level');
            $table->index('record_retention_until');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            $table->dropIndex(['supervision_level']);
            $table->dropIndex(['record_retention_until']);
            $table->dropColumn([
                'supervision_level',
                'record_retention_until',
            ]);
        });
    }
};
