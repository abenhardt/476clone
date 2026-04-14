<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the application_consents table.
 *
 * Each application has exactly 5 consent records — one per consent type.
 * Consent is captured at the time of application signing and stored with the
 * guardian's full legal name, their relationship to the camper, and a digital
 * signature (either a typed name or a base64-encoded drawn signature image).
 *
 * Consent types (matching the real CYSHCN paper form):
 *   general       — General consent for camp participation and medical treatment
 *   photos        — Photo / image / media release
 *   liability     — Release of liability
 *   activity      — Activity participation permission
 *   authorization — HIPAA / records release authorization
 *
 * PHI consideration: guardian_name and guardian_signature are personal data
 * but are not clinical PHI. They are stored unencrypted for legal readability.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('application_consents', function (Blueprint $table) {
            $table->id();

            // Foreign key — cascade deletes so orphan consent records cannot exist
            $table->foreignId('application_id')
                ->constrained()
                ->cascadeOnDelete();

            // Which consent this record represents
            $table->string('consent_type', 50); // general | photos | liability | activity | authorization

            // Guardian who provided consent
            $table->string('guardian_name');
            $table->string('guardian_relationship', 100); // e.g. "Parent", "Foster", "Other"

            // Digital signature — typed name or base64-encoded drawn signature
            $table->text('guardian_signature');

            // Camper's own signature (only required if camper is 18 or older)
            $table->text('applicant_signature')->nullable();

            // Exact timestamp when this consent was given
            $table->timestamp('signed_at');

            $table->timestamps();

            // Enforce one consent record per type per application
            $table->unique(['application_id', 'consent_type']);
            $table->index('application_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_consents');
    }
};
