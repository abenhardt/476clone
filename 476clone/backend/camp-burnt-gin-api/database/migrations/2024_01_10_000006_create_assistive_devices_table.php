<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to create the assistive_devices table.
 *
 * Assistive devices track mobility aids and other assistive technology
 * used by campers, enabling appropriate accessibility planning and
 * transfer assistance protocols.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('assistive_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')
                ->constrained('campers')
                ->cascadeOnDelete();
            $table->string('device_type');
            $table->boolean('requires_transfer_assistance')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('camper_id');
            $table->index('device_type');
            $table->index('requires_transfer_assistance');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assistive_devices');
    }
};
