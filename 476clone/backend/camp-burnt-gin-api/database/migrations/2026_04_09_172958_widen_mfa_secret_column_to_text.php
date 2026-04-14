<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Widen users.mfa_secret from VARCHAR(255) to TEXT.
 *
 * Laravel's encrypted cast wraps the ciphertext in a base64-encoded JSON
 * envelope containing the IV, the encrypted value, a HMAC, and an
 * authentication tag. For AES-256-CBC with a 32-character TOTP base32 secret,
 * this envelope expands to ~276 characters — exceeding the 255-character limit
 * of the current VARCHAR column and causing a SQL 22001 truncation error on
 * MFA setup.
 *
 * TEXT supports up to 65,535 bytes, which is more than sufficient.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('mfa_secret')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('mfa_secret', 255)->nullable()->change();
        });
    }
};
