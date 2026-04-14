<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to create the allergies table.
 *
 * Allergies track known allergens for each camper along with severity,
 * typical reactions, and recommended treatment protocols. This information
 * is critical for camp staff to ensure camper safety.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('allergies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')
                ->constrained('campers')
                ->onDelete('cascade');
            $table->string('allergen');
            $table->string('severity');
            $table->text('reaction')->nullable();
            $table->text('treatment')->nullable();
            $table->timestamps();

            $table->index('camper_id');
            $table->index('severity');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('allergies');
    }
};
