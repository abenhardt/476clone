<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds a nullable cabin_id FK to the campers table.
 *
 * This column is the second half of the cabin grouping foundation.
 * While the cabins table defines the cabin structures, this column on
 * campers records WHICH cabin each camper has been assigned to.
 *
 * The column is nullable because:
 *  1. All existing campers should not be broken by this migration.
 *  2. Cabin assignment is optional — not every session uses cabins.
 *  3. Cabin assignment happens AFTER approval, so newly approved campers
 *     will have cabin_id = null until staff assign them.
 *
 * nullOnDelete() means: if a cabin is deleted, the FK on campers becomes
 * NULL (the camper is unassigned) rather than cascade-deleting the camper.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            $table->foreignId('cabin_id')
                ->nullable()
                ->after('id')
                ->constrained('cabins')
                ->nullOnDelete();   // Cabin deleted → camper unassigned, not deleted

            $table->index('cabin_id');
        });
    }

    public function down(): void
    {
        Schema::table('campers', function (Blueprint $table) {
            $table->dropForeign(['cabin_id']);
            $table->dropIndex(['cabin_id']);
            $table->dropColumn('cabin_id');
        });
    }
};
