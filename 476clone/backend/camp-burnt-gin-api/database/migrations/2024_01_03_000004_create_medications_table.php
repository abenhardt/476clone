<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to create the medications table.
 *
 * Medications track prescribed and over-the-counter medications that
 * campers need to take during their stay. This includes dosage schedules
 * and administration instructions for camp medical staff.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('medications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')
                ->constrained('campers')
                ->onDelete('cascade');
            $table->string('name');
            $table->string('dosage');
            $table->string('frequency');
            $table->string('purpose')->nullable();
            $table->string('prescribing_physician')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('camper_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('medications');
    }
};
