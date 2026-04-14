<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add soft-delete support to emergency_contacts.
 *
 * Emergency contacts contain encrypted PHI (names, phone numbers, relationships).
 * Soft deletes ensure this data is never physically removed, which:
 *   1. Preserves the historical contact record for audit and compliance purposes.
 *   2. Allows camp staff to see who was listed as an emergency contact even after
 *      a parent updates or removes a contact.
 *   3. Prevents orphaned record confusion when a parent edits their contact list.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('emergency_contacts', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('emergency_contacts', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
