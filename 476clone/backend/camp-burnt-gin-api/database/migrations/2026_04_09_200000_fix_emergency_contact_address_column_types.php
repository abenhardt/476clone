<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fix emergency_contacts city/state/zip column types and re-encrypt plaintext data.
 *
 * Root cause: These columns were created as VARCHAR (100/10/20) but the EmergencyContact
 * model casts them as 'encrypted'. Laravel's AES-256-CBC encrypted strings are ~200 chars,
 * so any plaintext values from seeding were stored as-is (VARCHAR was too short to hold
 * encrypted strings, meaning the cast never wrote successfully). Reading them back now
 * triggers DecryptException because the model expects encrypted payloads.
 *
 * Fix: Widen to TEXT, then re-encrypt any row where the value is not already an encrypted
 * payload (encrypted strings always start with 'eyJ' — base64-encoded JSON).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Step 1: Widen columns to TEXT so encrypted payloads can be stored ──
        Schema::table('emergency_contacts', function (Blueprint $table) {
            $table->text('city')->nullable()->change();
            $table->text('state')->nullable()->change();
            $table->text('zip')->nullable()->change();
        });

        // ── Step 2: Re-encrypt any plaintext values ─────────────────────────────
        $encrypter = app('encrypter');

        DB::table('emergency_contacts')->orderBy('id')->each(function ($row) use ($encrypter) {
            $updates = [];

            foreach (['city', 'state', 'zip'] as $field) {
                $value = $row->$field;

                // Null → skip; already encrypted (starts with eyJ) → skip; plaintext → encrypt
                if ($value === null) {
                    continue;
                }

                // Laravel encrypted payloads are base64(JSON{iv,value,mac}) — always start with 'eyJ'
                if (str_starts_with($value, 'eyJ')) {
                    continue;
                }

                $updates[$field] = $encrypter->encrypt($value, false);
            }

            if (! empty($updates)) {
                DB::table('emergency_contacts')
                    ->where('id', $row->id)
                    ->update($updates);
            }
        });
    }

    public function down(): void
    {
        // Widening column types is safe to leave; plaintext data cannot be restored without
        // the original values, so down() only reverts the column types (data stays encrypted).
        Schema::table('emergency_contacts', function (Blueprint $table) {
            $table->string('city', 100)->nullable()->change();
            $table->string('state', 10)->nullable()->change();
            $table->string('zip', 20)->nullable()->change();
        });
    }
};
