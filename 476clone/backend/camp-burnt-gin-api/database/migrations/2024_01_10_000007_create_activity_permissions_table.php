<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to create the activity_permissions table.
 *
 * Activity permissions track participation restrictions and accommodations
 * for camp activities based on medical conditions or safety considerations,
 * ensuring appropriate activity planning and risk management.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('activity_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')
                ->constrained('campers')
                ->cascadeOnDelete();
            $table->string('activity_name');
            $table->string('permission_level');
            $table->text('restriction_notes')->nullable();
            $table->timestamps();

            $table->index('camper_id');
            $table->index('activity_name');
            $table->index('permission_level');
            $table->unique(['camper_id', 'activity_name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activity_permissions');
    }
};
