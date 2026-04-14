<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Widen encrypted string columns in medical_records to TEXT.
 *
 * Laravel's 'encrypted' cast wraps values in a JSON envelope (IV + ciphertext + MAC)
 * and base64-encodes the result. Even a short plaintext like "Blue Cross Insurance"
 * produces 300+ characters of ciphertext — far exceeding the VARCHAR(255) limit.
 *
 * Affected columns (all use the 'encrypted' cast on the MedicalRecord model):
 *   - physician_name
 *   - physician_phone
 *   - insurance_provider
 *   - insurance_policy_number
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->text('physician_name')->nullable()->change();
            $table->text('physician_phone')->nullable()->change();
            $table->text('insurance_provider')->nullable()->change();
            $table->text('insurance_policy_number')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->string('physician_name')->nullable()->change();
            $table->string('physician_phone')->nullable()->change();
            $table->string('insurance_provider')->nullable()->change();
            $table->string('insurance_policy_number')->nullable()->change();
        });
    }
};
