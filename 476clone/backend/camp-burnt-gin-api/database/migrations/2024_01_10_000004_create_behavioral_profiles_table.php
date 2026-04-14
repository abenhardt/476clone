<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to create the behavioral_profiles table.
 *
 * Behavioral profiles track behavioral and developmental characteristics
 * for each camper, enabling appropriate supervision, safety planning,
 * and staff-to-camper ratio determination.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('behavioral_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')
                ->unique()
                ->constrained('campers')
                ->cascadeOnDelete();
            $table->boolean('aggression')->default(false);
            $table->boolean('self_abuse')->default(false);
            $table->boolean('wandering_risk')->default(false);
            $table->boolean('one_to_one_supervision')->default(false);
            $table->boolean('developmental_delay')->default(false);
            $table->string('functioning_age_level')->nullable();
            $table->json('communication_methods')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('camper_id');
            $table->index('wandering_risk');
            $table->index('one_to_one_supervision');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('behavioral_profiles');
    }
};
