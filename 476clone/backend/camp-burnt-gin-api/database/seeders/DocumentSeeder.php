<?php

namespace Database\Seeders;

use App\Enums\DocumentVerificationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeder — document metadata records.
 *
 * Creates Document model records without actual files on disk.
 * All stored_filename and path values are synthetic UUIDs.
 *
 * Part 1 — Application documents (uploaded by admin/medical for compliance review):
 *   Ethan, Sofia, Ava, Noah, Lucas, Mia — medical_exam, insurance_card, etc.
 *
 * Part 2 — Applicant-uploaded documents (attached to Campers, uploaded by parent):
 *   Sarah Johnson  → Ethan: immunization_record (pending), photo_id (approved)
 *   Sarah Johnson  → Lily:  medical_waiver (pending)
 *   David Martinez → Sofia: allergy_action_plan (pending)
 *   Michael Williams → Ava: insulin_protocol (approved), emergency_contacts (approved)
 *
 * These exercise the applicant /documents page and the admin Documents inbox.
 */
class DocumentSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();
        $medical = User::where('email', 'medical@example.com')->firstOrFail();

        $session1Past = CampSession::where('name', 'Session 1 — Summer 2025')->firstOrFail();
        $session1Upcoming = CampSession::where('name', 'Session 1 — Summer 2026')->firstOrFail();
        $session2Upcoming = CampSession::where('name', 'Session 2 — Summer 2026')->firstOrFail();

        $ethan = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        $sofia = Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail();
        $noah = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();
        $ava = Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail();
        $lucas = Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail();
        $mia = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();

        $appEthan = Application::where('camper_id', $ethan->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appSofia = Application::where('camper_id', $sofia->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appNoah = Application::where('camper_id', $noah->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appAva = Application::where('camper_id', $ava->id)->where('camp_session_id', $session2Upcoming->id)->first();
        $appLucas = Application::where('camper_id', $lucas->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appMia = Application::where('camper_id', $mia->id)->where('camp_session_id', $session1Past->id)->first();

        // Ethan — approved, full verified set
        if ($appEthan && ! Document::where('documentable_id', $appEthan->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appEthan, 'official_medical_form', 'Ethan_Johnson_Medical_Exam_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(15), now()->addYear());
            $this->makeDoc($appEthan, 'insurance_card', 'Ethan_Johnson_BCBS_Insurance_Card.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(15));
            $this->makeDoc($appEthan, 'physician_clearance', 'Ethan_Johnson_Dr_Hill_Clearance_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(12), now()->addYear());
        }

        // Sofia — under review: insurance approved, immunization record pending verification
        if ($appSofia && ! Document::where('documentable_id', $appSofia->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appSofia, 'insurance_card', 'Sofia_Martinez_Aetna_Insurance_Card.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(20));
            $this->makeDoc($appSofia, 'immunization_record', 'Sofia_Martinez_Immunizations.pdf', $admin, DocumentVerificationStatus::Pending, now()->subDays(3));
        }

        // Noah — rejected, documents were on file before rejection
        if ($appNoah && ! Document::where('documentable_id', $appNoah->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appNoah, 'official_medical_form', 'Noah_Thompson_Medical_Exam_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(25), now()->addYear());
            $this->makeDoc($appNoah, 'insurance_card', 'Noah_Thompson_UHC_Insurance_Card.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(25));
            $this->makeDoc($appNoah, 'physician_clearance', 'Noah_Thompson_Dr_Kim_Clearance_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(20), now()->addYear());
        }

        // Ava — approved, full set including pump care plan uploaded by medical staff
        if ($appAva && ! Document::where('documentable_id', $appAva->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appAva, 'official_medical_form', 'Ava_Williams_Medical_Exam_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(18), now()->addYear());
            $this->makeDoc($appAva, 'insurance_card', 'Ava_Williams_Cigna_Insurance_Card.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(18));
            $this->makeDoc($appAva, 'physician_clearance', 'Ava_Williams_Dr_Gonzalez_Clearance_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(15), now()->addYear());
            $this->makeDoc($appAva, 'medical_care_plan', 'Ava_Williams_OmniPod_Insulin_Protocol.pdf', $medical, DocumentVerificationStatus::Approved, now()->subDays(8));
        }

        // Lucas — pending, only insurance card uploaded so far
        if ($appLucas && ! Document::where('documentable_id', $appLucas->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appLucas, 'insurance_card', 'Lucas_Williams_Cigna_Insurance_Card.pdf', $admin, DocumentVerificationStatus::Pending, now()->subDays(3));
        }

        // Mia — past session, older approved documents
        if ($appMia && ! Document::where('documentable_id', $appMia->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appMia, 'official_medical_form', 'Mia_Davis_Medical_Exam_2025.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(340), now()->subDays(5));
            $this->makeDoc($appMia, 'insurance_card', 'Mia_Davis_Medicaid_Card_2025.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(340));
        }

        // ── Part 2: Applicant-uploaded documents (attached to Campers) ─────────────
        // These are documents that parents upload themselves in the Applicant portal.

        $sarah = User::where('email', 'sarah.johnson@example.com')->firstOrFail();
        $david = User::where('email', 'david.martinez@example.com')->firstOrFail();
        $michael = User::where('email', 'michael.williams@example.com')->firstOrFail();

        $lily = Camper::where('first_name', 'Lily')->where('last_name', 'Johnson')->firstOrFail();

        // Sarah → Ethan: immunization record (pending) + photo ID (approved)
        if (! Document::where('documentable_type', Camper::class)->where('documentable_id', $ethan->id)->where('uploaded_by', $sarah->id)->exists()) {
            $this->makeCamperDoc($ethan, 'immunization_record', 'Ethan_Johnson_Immunization_Record.pdf', $sarah, DocumentVerificationStatus::Pending, now()->subDays(4));
            $this->makeCamperDoc($ethan, 'photo_id', 'Ethan_Johnson_State_ID.pdf', $sarah, DocumentVerificationStatus::Approved, now()->subDays(10));
        }

        // Sarah → Lily: medical waiver (pending)
        if (! Document::where('documentable_type', Camper::class)->where('documentable_id', $lily->id)->where('uploaded_by', $sarah->id)->exists()) {
            $this->makeCamperDoc($lily, 'medical_waiver', 'Lily_Johnson_Medical_Waiver.pdf', $sarah, DocumentVerificationStatus::Pending, now()->subDays(2));
        }

        // David → Sofia: allergy action plan (pending)
        if (! Document::where('documentable_type', Camper::class)->where('documentable_id', $sofia->id)->where('uploaded_by', $david->id)->exists()) {
            $this->makeCamperDoc($sofia, 'allergy_action_plan', 'Sofia_Martinez_Allergy_Plan.pdf', $david, DocumentVerificationStatus::Pending, now()->subDays(6));
        }

        // Michael → Ava: insulin protocol (approved) + emergency contacts form (approved)
        if (! Document::where('documentable_type', Camper::class)->where('documentable_id', $ava->id)->where('uploaded_by', $michael->id)->exists()) {
            $this->makeCamperDoc($ava, 'insulin_protocol', 'Ava_Williams_Insulin_Protocol.pdf', $michael, DocumentVerificationStatus::Approved, now()->subDays(14));
            $this->makeCamperDoc($ava, 'emergency_contacts', 'Ava_Williams_Emergency_Contacts.pdf', $michael, DocumentVerificationStatus::Approved, now()->subDays(14));
        }
    }

    private function makeCamperDoc(
        Camper $camper,
        string $documentType,
        string $originalFilename,
        User $uploader,
        DocumentVerificationStatus $verificationStatus,
        \DateTimeInterface $uploadedAt
    ): void {
        $isApproved = $verificationStatus === DocumentVerificationStatus::Approved;
        $storedFilename = Str::uuid()->toString().'.pdf';

        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'message_id' => null,
            'uploaded_by' => $uploader->id,
            'original_filename' => $originalFilename,
            'stored_filename' => $storedFilename,
            'mime_type' => 'application/pdf',
            'file_size' => rand(30000, 600000),
            'disk' => 'local',
            'path' => 'dev/documents/'.$storedFilename,
            'document_type' => $documentType,
            'is_scanned' => true,
            'scan_passed' => true,
            'scanned_at' => $uploadedAt,
            'verification_status' => $verificationStatus,
            'verified_by' => $isApproved ? 2 : null, // admin id=2
            'verified_at' => $isApproved ? $uploadedAt : null,
            'expiration_date' => null,
            'submitted_at' => $uploadedAt,
            'created_at' => $uploadedAt,
            'updated_at' => $uploadedAt,
        ]);
    }

    private function makeDoc(
        Application $application,
        string $documentType,
        string $originalFilename,
        User $uploader,
        DocumentVerificationStatus $verificationStatus,
        \DateTimeInterface $uploadedAt,
        ?\DateTimeInterface $expirationDate = null
    ): void {
        $isApproved = $verificationStatus === DocumentVerificationStatus::Approved;
        $storedFilename = Str::uuid()->toString().'.pdf';

        Document::create([
            'documentable_type' => Application::class,
            'documentable_id' => $application->id,
            'message_id' => null,
            'uploaded_by' => $uploader->id,
            'original_filename' => $originalFilename,
            'stored_filename' => $storedFilename,
            'mime_type' => 'application/pdf',
            'file_size' => rand(40000, 800000),
            'disk' => 'local',
            'path' => 'dev/documents/'.$storedFilename,
            'document_type' => $documentType,
            'is_scanned' => true,
            'scan_passed' => true,
            'scanned_at' => $uploadedAt,
            'verification_status' => $verificationStatus,
            'verified_by' => $isApproved ? $uploader->id : null,
            'verified_at' => $isApproved ? $uploadedAt : null,
            'expiration_date' => $expirationDate,
            'submitted_at' => $uploadedAt,
            'created_at' => $uploadedAt,
            'updated_at' => $uploadedAt,
        ]);
    }
}
