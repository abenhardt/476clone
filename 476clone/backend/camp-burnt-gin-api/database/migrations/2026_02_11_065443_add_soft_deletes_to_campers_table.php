<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Add soft delete support to campers table for HIPAA compliance.
     * Soft deletes ensure that camper records and their associated
     * medical information are retained for audit trail purposes.
     */
    public function up(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
