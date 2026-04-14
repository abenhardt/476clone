<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the application_drafts table.
 *
 * An ApplicationDraft is a server-side save slot for an in-progress form.
 * Unlike the applications table, no camper record is required — the draft
 * is a raw JSON blob of FormState that only materialises into real records
 * on final submission.
 *
 * Design decisions:
 *  - Hard-delete only: a deleted draft leaves no trace (no PHI is stored)
 *  - No camper_id FK: the camper is created during submission, not during drafting
 *  - draft_data stores the full FormState JSON (all sections, no file blobs)
 *  - label is a convenience field derived from the camper name the user typed
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('application_drafts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();  // Deleting a user wipes their drafts
            $table->string('label')->default('New Application');
            $table->longText('draft_data')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_drafts');
    }
};
