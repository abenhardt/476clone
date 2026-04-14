<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Re-encrypt plaintext notes in assistive_devices.
 *
 * Root cause: The encrypted cast on AssistiveDevice::notes was added after
 * the initial seeding runs. Records inserted before the cast was in place
 * have raw plaintext notes (e.g. "Emma wears bila..."), which now throw
 * DecryptException when the model tries to read them.
 *
 * Fix: Re-encrypt any row where notes does not start with 'eyJ' (which is
 * the base64 prefix all Laravel encrypted payloads begin with).
 */
return new class extends Migration
{
    public function up(): void
    {
        $encrypter = app('encrypter');

        DB::table('assistive_devices')
            ->whereNotNull('notes')
            ->where('notes', 'not like', 'eyJ%')
            ->orderBy('id')
            ->each(function ($row) use ($encrypter) {
                DB::table('assistive_devices')
                    ->where('id', $row->id)
                    ->update(['notes' => $encrypter->encrypt($row->notes, false)]);
            });
    }

    public function down(): void
    {
        // Re-encryption is one-way — plaintext cannot be restored without the
        // original values. Down() is intentionally a no-op.
    }
};
