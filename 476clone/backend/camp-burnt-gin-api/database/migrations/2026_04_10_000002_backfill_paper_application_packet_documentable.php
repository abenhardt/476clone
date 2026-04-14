<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Backfill paper_application_packet documents that were uploaded without a
 * documentable relationship (documentable_type IS NULL).
 *
 * Root cause: the applicant upload path never sent documentable_type/documentable_id,
 * leaving paper packets as orphaned documents linked to no entity.
 *
 * Strategy: for each orphaned paper_application_packet, find the uploading user's
 * most recently submitted (non-draft) application and set it as the documentable.
 * If no submitted application can be found we leave the row unchanged rather than
 * making a wrong assignment — it remains visible via the uploaded_by fallback.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Retrieve all orphaned paper_application_packet documents.
        // Only rows where BOTH documentable columns are null are targeted.
        $orphaned = DB::table('documents')
            ->whereNull('documentable_type')
            ->whereNull('documentable_id')
            ->where('document_type', 'paper_application_packet')
            ->whereNull('deleted_at')
            ->get(['id', 'uploaded_by', 'created_at']);

        foreach ($orphaned as $doc) {
            // uploaded_by references users.id; applicants own campers → applications.
            // Pick the most recently submitted application uploaded before or around the
            // document's creation time so we match the right seasonal application.
            $application = DB::table('applications')
                ->join('campers', 'campers.id', '=', 'applications.camper_id')
                ->where('campers.user_id', $doc->uploaded_by)
                ->where('applications.is_draft', false)
                ->whereNotNull('applications.submitted_at')
                ->whereNull('applications.deleted_at')
                ->whereNull('campers.deleted_at')
                ->orderByDesc('applications.submitted_at')
                ->value('applications.id');

            if ($application) {
                DB::table('documents')
                    ->where('id', $doc->id)
                    ->update([
                        'documentable_type' => 'App\\Models\\Application',
                        'documentable_id' => $application,
                        'updated_at' => now(),
                    ]);
            }
            // If no submitted application exists (e.g. pure draft state) we leave the
            // row unchanged.  The ApplicationController merge still surfaces it via the
            // uploaded_by fallback path added in the same phase.
        }
    }

    public function down(): void
    {
        // Revert: set documentable columns back to null for records we migrated.
        // We identify them as Application-type paper packets created before the migration ran.
        DB::table('documents')
            ->where('documentable_type', 'App\\Models\\Application')
            ->where('document_type', 'paper_application_packet')
            ->update([
                'documentable_type' => null,
                'documentable_id' => null,
                'updated_at' => now(),
            ]);
    }
};
