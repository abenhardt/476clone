<?php

namespace Database\Seeders;

use App\Enums\ApplicantDocumentStatus;
use App\Models\ApplicantDocument;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

/**
 * Seeder — applicant document records covering all 3 lifecycle states.
 *
 * ApplicantDocuments are documents that an admin uploads and sends to an applicant
 * for them to sign, complete, and return. This is the outbound flow (admin → applicant)
 * as opposed to DocumentRequest which is inbound (admin requests from applicant).
 *
 * States exercised:
 *   reviewed  — Sarah Johnson: "Summer 2026 Session Acceptance Letter"
 *               Full lifecycle: admin sent → applicant uploaded → admin reviewed.
 *
 *   submitted — David Martinez: "Medical Complexity Supplemental Form"
 *               Admin sent and applicant uploaded; not yet reviewed by admin.
 *
 *   pending   — Jennifer Thompson: "Special Needs Accommodation Agreement"
 *               Admin sent; applicant has not yet responded.
 *
 *   pending   — Patricia Davis: "Sickle Cell Disease Emergency Protocol"
 *               Admin sent; applicant has not yet responded.
 *
 *   submitted — Grace Wilson: "Waitlist Position Confirmation"
 *               Admin sent and applicant uploaded; not yet reviewed.
 *
 * Safe to re-run — duplicate detection on (applicant_id, original_file_name).
 */
class ApplicantDocumentSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();

        $sarah = User::where('email', 'sarah.johnson@example.com')->firstOrFail();
        $david = User::where('email', 'david.martinez@example.com')->firstOrFail();
        $jennifer = User::where('email', 'jennifer.thompson@example.com')->firstOrFail();
        $patricia = User::where('email', 'patricia.davis@example.com')->firstOrFail();
        $grace = User::where('email', 'grace.wilson@example.com')->firstOrFail();

        $documents = [

            // ── reviewed — Sarah / Ethan: Session Acceptance Letter ─────────────
            [
                'applicant' => $sarah,
                'uploaded_by_admin_id' => $admin->id,
                'original_file_name' => 'ethan_johnson_session1_2026_acceptance_letter.pdf',
                'original_path' => 'applicant_documents/admin/ethan_johnson_acceptance_letter_2026.pdf',
                'original_mime' => 'application/pdf',
                'submitted_file_name' => 'ethan_acceptance_letter_signed_sarah_johnson.pdf',
                'submitted_path' => 'applicant_documents/submitted/ethan_johnson_acceptance_signed.pdf',
                'submitted_mime' => 'application/pdf',
                'status' => ApplicantDocumentStatus::Reviewed,
                'instructions' => 'Please review the attached Session 1 2026 acceptance letter, sign and date the acknowledgment section on page 2, and upload the signed copy using the Documents section of your portal. This confirms Ethan\'s enrollment and your acceptance of the camp participation terms.',
                'reviewed_by' => $admin->id,
                'reviewed_at' => Carbon::now()->subDays(5),
            ],

            // ── submitted — David / Sofia: Medical Complexity Supplemental ───────
            [
                'applicant' => $david,
                'uploaded_by_admin_id' => $admin->id,
                'original_file_name' => 'sofia_martinez_medical_complexity_supplemental_form.pdf',
                'original_path' => 'applicant_documents/admin/sofia_martinez_medical_supplement_2026.pdf',
                'original_mime' => 'application/pdf',
                'submitted_file_name' => 'sofia_medical_supplemental_completed_david_martinez.pdf',
                'submitted_path' => 'applicant_documents/submitted/sofia_martinez_medical_supplement_submitted.pdf',
                'submitted_mime' => 'application/pdf',
                'status' => ApplicantDocumentStatus::Submitted,
                'instructions' => 'Please complete all sections of the Medical Complexity Supplemental Form for Sofia. Sections 3 and 4 (catheterization protocol specifics and emergency contacts for her medical team) must be filled in by a parent or guardian and signed. Return the completed form through your portal.',
                'reviewed_by' => null,
                'reviewed_at' => null,
            ],

            // ── pending — Jennifer / Noah: Special Needs Accommodation Agreement ─
            [
                'applicant' => $jennifer,
                'uploaded_by_admin_id' => $admin->id,
                'original_file_name' => 'noah_thompson_special_needs_accommodation_agreement.pdf',
                'original_path' => 'applicant_documents/admin/noah_thompson_accommodation_agreement_2026.pdf',
                'original_mime' => 'application/pdf',
                'submitted_file_name' => null,
                'submitted_path' => null,
                'submitted_mime' => null,
                'status' => ApplicantDocumentStatus::Pending,
                'instructions' => 'Please review the Special Needs Accommodation Agreement for Noah. This document outlines the specific accommodations and support our team will provide, including latex-free environment protocols, wandering supervision, and sign language communication accommodations. Sign and return through your portal at your earliest convenience.',
                'reviewed_by' => null,
                'reviewed_at' => null,
            ],

            // ── pending — Patricia / Mia: Sickle Cell Emergency Protocol ──────────
            [
                'applicant' => $patricia,
                'uploaded_by_admin_id' => $admin->id,
                'original_file_name' => 'mia_davis_sickle_cell_disease_emergency_protocol.pdf',
                'original_path' => 'applicant_documents/admin/mia_davis_scd_emergency_protocol_2026.pdf',
                'original_mime' => 'application/pdf',
                'submitted_file_name' => null,
                'submitted_path' => null,
                'submitted_mime' => null,
                'status' => ApplicantDocumentStatus::Pending,
                'instructions' => 'Please review the Sickle Cell Disease Emergency Protocol document for Mia. This protocol has been customized for her known triggers (heat exposure, dehydration, physical overexertion) based on her medical record. Confirm that all listed emergency contact information and physician orders are current, sign the acknowledgment on page 3, and return through your portal.',
                'reviewed_by' => null,
                'reviewed_at' => null,
            ],

            // ── submitted — Grace / Tyler: Waitlist Position Confirmation ──────────
            [
                'applicant' => $grace,
                'uploaded_by_admin_id' => $admin->id,
                'original_file_name' => 'tyler_wilson_waitlist_position_confirmation.pdf',
                'original_path' => 'applicant_documents/admin/tyler_wilson_waitlist_confirmation_2026.pdf',
                'original_mime' => 'application/pdf',
                'submitted_file_name' => 'tyler_waitlist_confirmation_signed_grace_wilson.pdf',
                'submitted_path' => 'applicant_documents/submitted/tyler_wilson_waitlist_confirmation_signed.pdf',
                'submitted_mime' => 'application/pdf',
                'status' => ApplicantDocumentStatus::Submitted,
                'instructions' => 'Please review the Waitlist Position Confirmation for Tyler (currently waitlisted for Session 1 2026, position #3). Sign the acknowledgment section confirming that you understand the waitlist process and that you wish to remain on the list. Return the signed copy through your portal.',
                'reviewed_by' => null,
                'reviewed_at' => null,
            ],
        ];

        foreach ($documents as $doc) {
            if (ApplicantDocument::where('applicant_id', $doc['applicant']->id)
                ->where('original_file_name', $doc['original_file_name'])
                ->exists()) {
                continue;
            }

            // Ensure placeholder files exist on the local disk so the download
            // and preview endpoints work in the dev/seed environment.
            $this->ensurePlaceholderFile($doc['original_path'], $doc['original_file_name']);
            if ($doc['submitted_path']) {
                $this->ensurePlaceholderFile($doc['submitted_path'], $doc['submitted_file_name'] ?? 'submitted_document.pdf');
            }

            ApplicantDocument::create([
                'applicant_id' => $doc['applicant']->id,
                'uploaded_by_admin_id' => $doc['uploaded_by_admin_id'],
                'original_document_path' => $doc['original_path'],
                'original_file_name' => $doc['original_file_name'],
                'original_mime_type' => $doc['original_mime'],
                'submitted_document_path' => $doc['submitted_path'],
                'submitted_file_name' => $doc['submitted_file_name'],
                'submitted_mime_type' => $doc['submitted_mime'],
                'status' => $doc['status'],
                'instructions' => $doc['instructions'],
                'reviewed_by' => $doc['reviewed_by'],
                'reviewed_at' => $doc['reviewed_at'],
            ]);
        }

        $this->command->line('  Applicant documents seeded (3 states: pending x2, submitted x2, reviewed x1).');
    }

    /**
     * Write a minimal placeholder file to local storage so the download/preview
     * endpoints return a real response instead of a 404.
     *
     * PDFs get a 1-page minimal PDF; everything else gets a tiny white JPEG.
     */
    private function ensurePlaceholderFile(string $path, string $label): void
    {
        if (Storage::disk('local')->exists($path)) {
            return;
        }

        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        if (in_array($ext, ['jpg', 'jpeg', 'png'])) {
            // Minimal 1×1 white JPEG
            $content = base64_decode(
                '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U'.
                'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN'.
                'DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy'.
                'MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA'.
                'AAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/'.
                'aAAwDAQACEQMRAD8AJQAB/9k='
            );
        } else {
            // Minimal valid 1-page PDF with the label as content
            $safe = preg_replace('/[^A-Za-z0-9 \-]/', '', $label);
            $stream = "BT /F1 14 Tf 50 700 Td ({$safe}) Tj ET";
            $slen = strlen($stream);
            $content = "%PDF-1.4\n"
                ."1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
                ."2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
                .'3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R'
                ."/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
                ."4 0 obj<</Length {$slen}>>\nstream\n{$stream}\nendstream\nendobj\n"
                ."5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
                ."xref\n0 6\n0000000000 65535 f \n"
                ."trailer<</Size 6/Root 1 0 R>>\nstartxref\n0\n%%EOF\n";
        }

        Storage::disk('local')->put($path, $content);
    }
}
