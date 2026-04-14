<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 2 — extend emergency_contacts to store guardian records.
 *
 * Guardian model decision:
 *   Both Guardian 1 and Guardian 2 are stored as rows in emergency_contacts.
 *   is_guardian = true  identifies guardian rows (vs. plain emergency contacts).
 *   is_primary  = true  identifies the primary guardian (Guardian 1).
 *   is_primary  = false identifies the secondary guardian (Guardian 2).
 *
 * Address fields are added to support Guardian 1's full residential address.
 * Guardian 2 typically has no address on the CYSHCN form — those columns are nullable.
 *
 * All address and contact fields are encrypted at rest (PHI).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('emergency_contacts', function (Blueprint $table) {
            $table->boolean('is_guardian')->default(false)->after('is_authorized_pickup');
            // Residential address — only populated for Guardian 1
            $table->text('address')->nullable()->after('is_guardian');      // encrypted
            $table->string('city', 100)->nullable()->after('address');
            $table->string('state', 10)->nullable()->after('city');
            $table->string('zip', 20)->nullable()->after('state');
        });
    }

    public function down(): void
    {
        Schema::table('emergency_contacts', function (Blueprint $table) {
            $table->dropColumn(['is_guardian', 'address', 'city', 'state', 'zip']);
        });
    }
};
