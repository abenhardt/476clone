<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds draft status and digital signature fields to applications.
 *
 * Supports FR-4 (save draft) and FR-9 (digital signature) requirements.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->boolean('is_draft')->default(false)->after('camp_session_id');
            $table->text('signature_data')->nullable()->after('notes');
            $table->string('signature_name')->nullable()->after('signature_data');
            $table->timestamp('signed_at')->nullable()->after('signature_name');
            $table->string('signed_ip_address')->nullable()->after('signed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['is_draft', 'signature_data', 'signature_name', 'signed_at', 'signed_ip_address']);
        });
    }
};
