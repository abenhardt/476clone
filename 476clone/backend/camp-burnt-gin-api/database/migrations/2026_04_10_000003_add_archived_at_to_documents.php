<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add archived_at to the documents table.
 *
 * Archive is a non-destructive alternative to deletion: admins can hide a
 * document from the active workflow view without permanently removing it.
 * Archived documents remain recoverable via the restore action.
 *
 * NULL means the document is active.
 * A timestamp value means the document was archived at that moment.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            // Nullable timestamp — NULL = active, set = archived.
            // Placed after verified_at for logical grouping of lifecycle timestamps.
            $table->timestamp('archived_at')->nullable()->after('verified_at');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('archived_at');
        });
    }
};
