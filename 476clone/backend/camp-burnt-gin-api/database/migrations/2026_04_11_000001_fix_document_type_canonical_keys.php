<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Canonicalize document_type values and repair submitted_at nulls.
 *
 * Root causes addressed:
 *
 * 1. Seeder used 'medical_exam' as document_type for Form 4523-ENG-DPH uploads.
 *    The canonical key is 'official_medical_form' (matches OfficialFormType::MedicalForm
 *    and the required_document_rules seeded by RequiredDocumentRuleSeeder).
 *    Impact: medical exam documents were invisible in the admin review dedicated row
 *    (docState looks for 'official_medical_form'|'physical_examination') and did not
 *    satisfy the DocumentEnforcementService compliance check before approval.
 *
 * 2. Seeder used display-name strings (title-case with spaces) as document_type values
 *    for camper-level documents: 'Immunization Record', 'Photo ID', 'Medical Waiver',
 *    'Allergy Action Plan', 'Insulin Protocol', 'Emergency Contacts'.
 *    The frontend getDocumentLabel() and isRequiredDocumentType() functions key off
 *    snake_case identifiers; title-case values never matched, producing raw fallback
 *    labels and falsely non-required status for the immunization record.
 *
 * 3. The DocumentSeeder created Document records without setting submitted_at, leaving
 *    all seeded documents as drafts (submitted_at IS NULL).  DocumentController::index()
 *    and DocumentEnforcementService::getUploadedDocuments() both filter on
 *    submitted_at IS NOT NULL for admin/compliance contexts, so every seeded document
 *    was invisible to admins and the compliance gate always reported documents missing.
 *    Fix: set submitted_at = created_at for admin/medical-uploaded records with null
 *    submitted_at (admin uploads are always auto-submitted per DocumentService logic).
 *    Applicant-uploaded drafts that genuinely need applicant submission are excluded.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Rename 'medical_exam' → 'official_medical_form' ─────────────────
        // All documents previously stored as 'medical_exam' are Form 4523-ENG-DPH
        // uploads. The canonical document_type that matches the compliance rules and
        // admin review dedicated row is 'official_medical_form'.
        DB::table('documents')
            ->where('document_type', 'medical_exam')
            ->update(['document_type' => 'official_medical_form']);

        // ── 2. Rename title-case seeder types to snake_case canonical keys ──────
        // These display-name strings were used by the DocumentSeeder's makeCamperDoc()
        // helper before it was corrected. Mapping:
        $titleCaseMap = [
            'Immunization Record' => 'immunization_record',
            'Photo ID' => 'photo_id',
            'Medical Waiver' => 'medical_waiver',
            'Allergy Action Plan' => 'allergy_action_plan',
            'Insulin Protocol' => 'insulin_protocol',
            'Emergency Contacts' => 'emergency_contacts',
        ];

        foreach ($titleCaseMap as $oldType => $newType) {
            DB::table('documents')
                ->where('document_type', $oldType)
                ->update(['document_type' => $newType]);
        }

        // ── 3. Backfill submitted_at for admin/medical-uploaded draft documents ─
        // Seeded documents created by admin or medical-provider users should be
        // auto-submitted (matching DocumentService::upload() logic).  Set
        // submitted_at = created_at for any such record currently NULL.
        // Scope: documentable_type IS NOT NULL (real application/camper documents,
        //        not orphaned records) and uploaded_by is an admin/medical user.
        $adminAndMedicalUserIds = DB::table('users')
            ->whereIn('role', ['admin', 'super_admin', 'medical'])
            ->pluck('id');

        if ($adminAndMedicalUserIds->isNotEmpty()) {
            DB::table('documents')
                ->whereNull('submitted_at')
                ->whereNotNull('documentable_type')
                ->whereIn('uploaded_by', $adminAndMedicalUserIds)
                ->update(['submitted_at' => DB::raw('created_at')]);
        }
    }

    public function down(): void
    {
        // Reverse the document_type renames only — submitted_at backfill is not
        // reversed because we cannot distinguish which NULLs were intentional drafts
        // vs seeder artefacts.  A rollback of this migration leaves submitted_at intact.

        DB::table('documents')
            ->where('document_type', 'official_medical_form')
            ->whereRaw("original_filename REGEXP '_Medical_Exam_'")
            ->update(['document_type' => 'medical_exam']);

        $reverseMap = [
            'immunization_record' => 'Immunization Record',
            'photo_id' => 'Photo ID',
            'medical_waiver' => 'Medical Waiver',
            'allergy_action_plan' => 'Allergy Action Plan',
            'insulin_protocol' => 'Insulin Protocol',
            'emergency_contacts' => 'Emergency Contacts',
        ];

        foreach ($reverseMap as $canonicalType => $oldType) {
            DB::table('documents')
                ->where('document_type', $canonicalType)
                ->update(['document_type' => $oldType]);
        }
    }
};
