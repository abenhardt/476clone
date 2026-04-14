<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to extend medical records table for CYSHCN support.
 *
 * Adds seizure tracking and neurostimulator fields to support children
 * and youth with special health care needs, enabling appropriate safety
 * protocols and medical supervision during camp activities.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->boolean('has_seizures')->default(false)->after('notes');
            $table->date('last_seizure_date')->nullable()->after('has_seizures');
            $table->text('seizure_description')->nullable()->after('last_seizure_date');
            $table->boolean('has_neurostimulator')->default(false)->after('seizure_description');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->dropColumn([
                'has_seizures',
                'last_seizure_date',
                'seizure_description',
                'has_neurostimulator',
            ]);
        });
    }
};
