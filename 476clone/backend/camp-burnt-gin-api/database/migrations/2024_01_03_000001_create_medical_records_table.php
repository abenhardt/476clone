<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to create the medical_records table.
 *
 * Medical records store essential health information for each camper,
 * including physician details, insurance information, and any special
 * medical needs that staff should be aware of during camp activities.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('medical_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')
                ->unique()
                ->constrained('campers')
                ->onDelete('cascade');
            $table->string('physician_name')->nullable();
            $table->string('physician_phone')->nullable();
            $table->string('insurance_provider')->nullable();
            $table->string('insurance_policy_number')->nullable();
            $table->text('special_needs')->nullable();
            $table->text('dietary_restrictions')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('medical_records');
    }
};
