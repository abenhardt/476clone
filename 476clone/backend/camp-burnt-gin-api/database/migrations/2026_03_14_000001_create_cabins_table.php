<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the cabins table — data-model foundation for Phase X cabin management.
 *
 * A cabin belongs to a single session and groups campers together for
 * staff assignments, sleeping arrangements, and daily operational purposes.
 * Typical names: "Cabin A", "Oak", "Birch", "Cabin 1".
 *
 * This migration creates the structure ONLY.
 * The cabin assignment UI, staff-to-cabin assignments, and camper-to-cabin
 * grouping workflows will be built in a future phase.
 *
 * Schema:
 *   camp_session_id  FK → camp_sessions (cascade on delete)
 *   name             Human-readable label, unique per session
 *   capacity         How many campers this cabin can hold (default 10)
 *   notes            Optional staff notes (dietary layout, accessibility needs, etc.)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cabins', function (Blueprint $table) {
            $table->id();

            $table->foreignId('camp_session_id')
                ->constrained('camp_sessions')
                ->onDelete('cascade');     // When a session is deleted, its cabins go too

            $table->string('name', 100);                   // e.g. "Cabin A", "Oak", "Cedar"
            $table->unsignedSmallInteger('capacity')->default(10);
            $table->text('notes')->nullable();             // Special considerations for this cabin

            $table->timestamps();

            // Cabin names should be unique within a session (two sessions can both have "Cabin A")
            $table->unique(['camp_session_id', 'name'], 'cabins_session_name_unique');
            $table->index('camp_session_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cabins');
    }
};
