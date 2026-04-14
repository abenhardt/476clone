<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Make conversations.created_by_id nullable.
 *
 * System-generated notifications have no human creator.
 * Re-maps the FK to SET NULL on delete so soft-deleted users do not
 * orphan system conversations.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            // Drop the existing NOT NULL + cascade FK
            $table->dropForeign(['created_by_id']);

            // Make nullable (doctrine/dbal needed for column changes)
            $table->unsignedBigInteger('created_by_id')->nullable()->change();

            // Re-add FK with SET NULL on delete
            $table->foreign('created_by_id')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropForeign(['created_by_id']);
            $table->unsignedBigInteger('created_by_id')->nullable(false)->change();
            $table->foreign('created_by_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
