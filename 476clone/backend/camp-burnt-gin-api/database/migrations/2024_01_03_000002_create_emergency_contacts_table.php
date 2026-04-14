<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to create the emergency_contacts table.
 *
 * Emergency contacts are individuals who can be reached in case of
 * an emergency involving a camper. Each camper may have multiple
 * contacts with different authorization levels for pickup.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('emergency_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')
                ->constrained('campers')
                ->onDelete('cascade');
            $table->string('name');
            $table->string('relationship');
            $table->string('phone_primary');
            $table->string('phone_secondary')->nullable();
            $table->string('email')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->boolean('is_authorized_pickup')->default(false);
            $table->timestamps();

            $table->index('camper_id');
            $table->index('is_primary');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('emergency_contacts');
    }
};
