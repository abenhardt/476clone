<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: create_document_requests_table
 *
 * Stores the full lifecycle of admin-initiated document requests.
 *
 * Flow:
 *   1. Admin creates request → status = 'awaiting_upload', inbox notification sent to applicant
 *   2. Applicant uploads document → status = 'uploaded' / 'scanning'
 *   3. Admin reviews → status = 'under_review' → 'approved' or 'rejected'
 *   4. If rejected → status returns to 'awaiting_upload' for resubmission
 *   5. If due_date passes with no upload → status = 'overdue' (computed)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_requests', function (Blueprint $table) {
            $table->id();

            // The applicant (parent/guardian) this request is for
            $table->foreignId('applicant_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // Optional links to an application or specific camper
            $table->foreignId('application_id')
                ->nullable()
                ->constrained('applications')
                ->nullOnDelete();

            $table->foreignId('camper_id')
                ->nullable()
                ->constrained('campers')
                ->nullOnDelete();

            // The admin who created this request
            $table->foreignId('requested_by_admin_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // The type of document being requested (e.g. "Immunization Record")
            $table->string('document_type');

            // Optional instructions for the applicant
            $table->text('instructions')->nullable();

            // Full lifecycle status
            $table->enum('status', [
                'awaiting_upload',
                'uploaded',
                'scanning',
                'under_review',
                'approved',
                'rejected',
                'overdue',
            ])->default('awaiting_upload');

            // Optional deadline
            $table->date('due_date')->nullable();

            // Uploaded file information (populated when applicant uploads)
            $table->string('uploaded_document_path')->nullable();
            $table->string('uploaded_file_name')->nullable();
            $table->string('uploaded_mime_type')->nullable();
            $table->timestamp('uploaded_at')->nullable();

            // Review tracking (populated when admin approves or rejects)
            $table->foreignId('reviewed_by_admin_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();

            // Link to the inbox conversation created for this request
            $table->foreignId('conversation_id')
                ->nullable()
                ->constrained('conversations')
                ->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_requests');
    }
};
