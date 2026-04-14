<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to create the diagnoses table.
 *
 * Diagnoses track known medical conditions for each camper along with
 * severity levels and clinical notes. This information supports
 * appropriate medical supervision and accommodation planning.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('diagnoses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')
                ->constrained('campers')
                ->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('severity_level');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('camper_id');
            $table->index('severity_level');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('diagnoses');
    }
};
