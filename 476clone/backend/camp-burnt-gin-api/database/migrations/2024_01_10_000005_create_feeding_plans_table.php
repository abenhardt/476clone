<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to create the feeding_plans table.
 *
 * Feeding plans track specialized dietary needs and tube feeding
 * requirements for each camper, ensuring appropriate nutrition
 * support and medical protocols during camp activities.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('feeding_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')
                ->unique()
                ->constrained('campers')
                ->cascadeOnDelete();
            $table->boolean('special_diet')->default(false);
            $table->text('diet_description')->nullable();
            $table->boolean('g_tube')->default(false);
            $table->string('formula')->nullable();
            $table->string('amount_per_feeding')->nullable();
            $table->integer('feedings_per_day')->nullable();
            $table->json('feeding_times')->nullable();
            $table->boolean('bolus_only')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('camper_id');
            $table->index('g_tube');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('feeding_plans');
    }
};
