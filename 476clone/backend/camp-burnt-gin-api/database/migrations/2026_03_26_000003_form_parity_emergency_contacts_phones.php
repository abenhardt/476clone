<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Form Parity — emergency_contacts work phone, language, and interpreter fields.
 *
 * The official CYSHCN application form records three phone numbers per contact
 * (home, work, cell) and language/interpreter information. The existing table only
 * has phone_primary and phone_secondary.
 *
 * This migration adds:
 *   phone_work       — work phone number (encrypted — PHI)
 *   primary_language — primary language (e.g. "Spanish", "ASL")
 *   interpreter_needed — whether an interpreter is required for this contact
 *
 * The existing phone_primary / phone_secondary columns continue to map to
 * cell and home numbers respectively to avoid breaking existing data.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('emergency_contacts', function (Blueprint $table) {
            $table->text('phone_work')->nullable()->after('phone_secondary');    // encrypted
            $table->string('primary_language', 100)->nullable()->after('email');
            $table->boolean('interpreter_needed')->default(false)->after('primary_language');
        });
    }

    public function down(): void
    {
        Schema::table('emergency_contacts', function (Blueprint $table) {
            $table->dropColumn(['phone_work', 'primary_language', 'interpreter_needed']);
        });
    }
};
