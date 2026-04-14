<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: create_applicant_documents_table
 *
 * Creates the applicant_documents table which tracks documents sent by admins
 * to applicants for offline completion and subsequent re-upload.
 *
 * Flow:
 *   1. Admin uploads original document → status = 'pending'
 *   2. Applicant downloads, fills out, re-uploads → status = 'submitted'
 *   3. Admin reviews submission → status = 'reviewed'
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('applicant_documents', function (Blueprint $table) {
            $table->id();

            // The applicant this document was sent to
            $table->foreignId('applicant_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // The admin who sent the document
            $table->foreignId('uploaded_by_admin_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // Original document uploaded by admin
            $table->string('original_document_path');
            $table->string('original_file_name');
            $table->string('original_mime_type');

            // Completed document submitted by applicant (nullable until submitted)
            $table->string('submitted_document_path')->nullable();
            $table->string('submitted_file_name')->nullable();
            $table->string('submitted_mime_type')->nullable();

            // Lifecycle status
            $table->enum('status', ['pending', 'submitted', 'reviewed'])->default('pending');

            // Optional instructions from the admin to the applicant
            $table->text('instructions')->nullable();

            // Review tracking (nullable until admin reviews the submission)
            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('applicant_documents');
    }
};
