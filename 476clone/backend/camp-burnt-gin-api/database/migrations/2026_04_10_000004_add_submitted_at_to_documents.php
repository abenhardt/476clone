<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->timestamp('submitted_at')->nullable()->after('archived_at');
        });

        // Backfill: treat all existing documents as already submitted.
        // This preserves backward compatibility — admins continue to see
        // all historical uploads without any action required.
        DB::table('documents')
            ->whereNull('deleted_at')
            ->update(['submitted_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('submitted_at');
        });
    }
};
