<?php

namespace Database\Seeders;

use App\Enums\ApplicationStatus;
use App\Enums\DocumentRequestStatus;
use App\Models\Application;
use App\Models\AuditLog;
use App\Models\Camper;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\DocumentRequest;
use App\Models\Message;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Seeder — document request lifecycle records covering all 7 states.
 *
 * Creates one DocumentRequest per camper, one for each DocumentRequestStatus value:
 *   awaiting_upload  — Ethan Johnson   (Updated IEP / Special Education Plan; due in 7 days)
 *   uploaded         — Sofia Martinez  (Physician's Letter — Catheterization Protocol; uploaded 2 days ago)
 *   scanning         — Tyler Wilson    (Proof of Identity; uploaded yesterday, pending scan)
 *   under_review     — Noah Thompson   (Audiologist Report; uploaded 3 days ago, not yet decided)
 *   approved         — Lucas Williams  (BiPAP/Ventilator Operation Certification; fully approved)
 *   rejected         — Lily Johnson    (Seasonal Allergy Action Plan; illegible scan)
 *   overdue          — Ava Williams    (CGM Calibration Log; due date passed, no upload)
 *
 * Each request gets a system-generated inbox Conversation. Structure mirrors the
 * convention used by SystemNotificationService:
 *   - created_by_id = null           (no human creator)
 *   - is_system_generated = true
 *   - system_event_type = 'document.requested'
 *   - system_event_category = 'Document'
 *   - related_entity_type = DocumentRequest class name
 *   - Message 1: sender_id = null    (automated system notification body)
 *   - Message 2: sender_id = admin   (human follow-up to produce a realistic thread)
 *
 * After DocumentRequest creation, conversation.related_entity_id is back-filled with
 * the new DocumentRequest ID. document_requests.conversation_id is set at creation time.
 *
 * An AuditLog entry (event_type = admin_action) is written for each request.
 *
 * Safe to re-run — duplicate detection on (camper_id, document_type).
 */
class DocumentRequestSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();
        $admin2 = User::where('email', 'admin2@campburntgin.org')->firstOrFail();

        $sarah = User::where('email', 'sarah.johnson@example.com')->firstOrFail();
        $david = User::where('email', 'david.martinez@example.com')->firstOrFail();
        $jennifer = User::where('email', 'jennifer.thompson@example.com')->firstOrFail();
        $michael = User::where('email', 'michael.williams@example.com')->firstOrFail();
        $grace = User::where('email', 'grace.wilson@example.com')->firstOrFail();

        $campers = [
            'ethan' => Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail(),
            'sofia' => Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail(),
            'noah' => Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail(),
            'lucas' => Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail(),
            'lily' => Camper::where('first_name', 'Lily')->where('last_name', 'Johnson')->firstOrFail(),
            'ava' => Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail(),
            'tyler' => Camper::where('first_name', 'Tyler')->where('last_name', 'Wilson')->firstOrFail(),
        ];

        // Resolve linked applications — nullable if the expected state is not present
        $appEthan = Application::where('camper_id', $campers['ethan']->id)
            ->where('status', ApplicationStatus::Approved->value)
            ->first();

        $appSofia = Application::where('camper_id', $campers['sofia']->id)
            ->where('status', ApplicationStatus::UnderReview->value)
            ->first();

        $appNoah = Application::where('camper_id', $campers['noah']->id)
            ->where('status', ApplicationStatus::Submitted->value)
            ->first();

        $appLucas = Application::where('camper_id', $campers['lucas']->id)
            ->where('status', ApplicationStatus::Submitted->value)
            ->first();

        $appLily = Application::where('camper_id', $campers['lily']->id)
            ->where('status', ApplicationStatus::Submitted->value)
            ->first();

        $appAva = Application::where('camper_id', $campers['ava']->id)
            ->where('status', ApplicationStatus::Approved->value)
            ->first();

        $appTyler = Application::where('camper_id', $campers['tyler']->id)->first();

        $requests = [

            // ── 1. awaiting_upload — Ethan, IEP ─────────────────────────────────
            [
                'applicant' => $sarah,
                'camper' => $campers['ethan'],
                'application' => $appEthan,
                'document_type' => 'Updated IEP / Special Education Plan',
                'instructions' => 'Please upload the most recent Individualized Education Program (IEP) or Special Education Plan for Ethan (must be dated within the last 12 months). This document is required for our clinical team to plan appropriate behavioral support and transition accommodations during camp. Upload a clear, legible PDF or image scan.',
                'status' => DocumentRequestStatus::AwaitingUpload,
                'due_date' => Carbon::now()->addDays(7)->toDateString(),
                'uploaded_at' => null,
                'reviewed_by_id' => null,
                'reviewed_at' => null,
                'rejection_reason' => null,
                'uploaded_path' => null,
                'uploaded_file_name' => null,
                'uploaded_mime' => null,
                'created_at_offset' => Carbon::now()->subDays(2),
                'system_body' => '<p>Hello Sarah,</p><p>Camp Burnt Gin has requested a document for Ethan\'s enrollment: <strong>Updated IEP / Special Education Plan</strong>.</p><p>The document is due by <strong>'.Carbon::now()->addDays(7)->format('F j, Y').'</strong>. You can upload it from the Documents section of your applicant portal.</p><p><em>Instructions: Please upload the most recent IEP or Special Education Plan for Ethan (dated within the last 12 months). This is required for our clinical team to plan appropriate behavioral support. Upload a clear, legible PDF or image scan.</em></p>',
                'admin_body' => "Hi Sarah — just a heads-up that this IEP document is needed before Ethan's session begins. If you have any trouble locating or uploading it, please don't hesitate to reach out and we'll walk you through it.",
                'admin_sender' => $admin,
            ],

            // ── 2. uploaded — Sofia, Catheterization Protocol ────────────────────
            [
                'applicant' => $david,
                'camper' => $campers['sofia'],
                'application' => $appSofia,
                'document_type' => "Physician's Letter — Catheterization Protocol",
                'instructions' => "A letter from Sofia's urologist or primary care physician specifying the intermittent catheterization schedule, technique, and any special instructions for camp nursing staff. The letter must be signed and dated within the last 6 months.",
                'status' => DocumentRequestStatus::Uploaded,
                'due_date' => Carbon::now()->addDays(5)->toDateString(),
                'uploaded_at' => Carbon::now()->subDays(2),
                'reviewed_by_id' => null,
                'reviewed_at' => null,
                'rejection_reason' => null,
                'uploaded_path' => 'document_requests/sofia_martinez_cath_protocol_2026.pdf',
                'uploaded_file_name' => 'sofia_catheterization_protocol_signed.pdf',
                'uploaded_mime' => 'application/pdf',
                'created_at_offset' => Carbon::now()->subDays(6),
                'system_body' => "<p>Hello David,</p><p>Camp Burnt Gin has requested a document for Sofia's enrollment: <strong>Physician's Letter — Catheterization Protocol</strong>.</p><p>The document is due by <strong>".Carbon::now()->addDays(5)->format('F j, Y')."</strong>. You can upload it from the Documents section of your applicant portal.</p><p><em>Instructions: A letter from Sofia's urologist or primary care physician specifying the catheterization schedule, technique, and any special instructions for camp nursing staff. Must be signed and dated within the last 6 months.</em></p>",
                'admin_body' => 'Hi David — thank you for uploading the catheterization protocol letter so quickly. Our nursing team will review it within 2 business days. If Dr. Owens has any questions in the meantime, they can contact us at medical@campburntgin.org.',
                'admin_sender' => $admin,
            ],

            // ── 3. under_review — Noah, Audiologist Report ──────────────────────
            [
                'applicant' => $jennifer,
                'camper' => $campers['noah'],
                'application' => $appNoah,
                'document_type' => 'Audiologist Report',
                'instructions' => "Please provide a copy of Noah's most recent audiologist evaluation report (within the last 2 years). This helps our team understand his current hearing status and communication preferences so we can ensure all activity staff are appropriately briefed before his arrival.",
                'status' => DocumentRequestStatus::UnderReview,
                'due_date' => Carbon::now()->addDays(3)->toDateString(),
                'uploaded_at' => Carbon::now()->subDays(3),
                'reviewed_by_id' => null,
                'reviewed_at' => null,
                'rejection_reason' => null,
                'uploaded_path' => 'document_requests/noah_thompson_audiologist_2024.pdf',
                'uploaded_file_name' => 'noah_audiologist_report_2024.pdf',
                'uploaded_mime' => 'application/pdf',
                'created_at_offset' => Carbon::now()->subDays(8),
                'system_body' => "<p>Hello Jennifer,</p><p>Camp Burnt Gin has requested a document for Noah's enrollment: <strong>Audiologist Report</strong>.</p><p>The document is due by <strong>".Carbon::now()->addDays(3)->format('F j, Y')."</strong>. You can upload it from the Documents section of your applicant portal.</p><p><em>Instructions: Please provide a copy of Noah's most recent audiologist evaluation report (within the last 2 years). This helps our team understand his current hearing status and communication preferences.</em></p>",
                'admin_body' => "Hi Jennifer — we've received Noah's audiologist report and our clinical team has started the review. We'll let you know the outcome shortly. Thank you for getting this to us so promptly!",
                'admin_sender' => $admin,
            ],

            // ── 4. approved — Lucas, BiPAP Certification ─────────────────────────
            [
                'applicant' => $michael,
                'camper' => $campers['lucas'],
                'application' => $appLucas,
                'document_type' => 'BiPAP/Ventilator Operation Certification',
                'instructions' => "A physician or respiratory therapist certification confirming that camp nursing staff are cleared to operate Lucas's ResMed AirCurve 10 VAuto BiPAP device. Must include current settings (IPAP/EPAP), alarm parameters, and emergency disconnection procedure. Must be on clinical letterhead.",
                'status' => DocumentRequestStatus::Approved,
                'due_date' => Carbon::now()->subDays(5)->toDateString(),
                'uploaded_at' => Carbon::now()->subDays(10),
                'reviewed_by_id' => $admin->id,
                'reviewed_at' => Carbon::now()->subDays(8),
                'rejection_reason' => null,
                'uploaded_path' => 'document_requests/lucas_williams_bipap_cert_2026.pdf',
                'uploaded_file_name' => 'lucas_bipap_operation_certification.pdf',
                'uploaded_mime' => 'application/pdf',
                'created_at_offset' => Carbon::now()->subDays(14),
                'system_body' => "<p>Hello Michael,</p><p>Camp Burnt Gin has requested a document for Lucas's enrollment: <strong>BiPAP/Ventilator Operation Certification</strong>.</p><p>The document was due by <strong>".Carbon::now()->subDays(5)->format('F j, Y')."</strong>. You can upload it from the Documents section of your applicant portal.</p><p><em>Instructions: A physician or respiratory therapist certification confirming camp nursing staff are cleared to operate Lucas's BiPAP device. Must include current settings, alarm parameters, and emergency disconnection procedure. Must be on clinical letterhead.</em></p>",
                'admin_body' => "Hi Michael — great news! We've reviewed the BiPAP operation certification and everything looks complete. This document has been approved and filed in Lucas's record. You're all set on this item. Thank you for getting it to us so quickly!",
                'admin_sender' => $admin,
            ],

            // ── 5. rejected — Lily, Allergy Action Plan ───────────────────────────
            [
                'applicant' => $sarah,
                'camper' => $campers['lily'],
                'application' => $appLily,
                'document_type' => 'Seasonal Allergy Action Plan',
                'instructions' => "An allergy action plan from Lily's allergist or primary care provider specifying triggers (pollen, dust, mold), current medications, and a step-by-step emergency response for an allergic reaction. Must include medication names, dosages, and circumstances for administration.",
                'status' => DocumentRequestStatus::Rejected,
                'due_date' => Carbon::now()->addDays(10)->toDateString(),
                'uploaded_at' => Carbon::now()->subDays(4),
                'reviewed_by_id' => $admin->id,
                'reviewed_at' => Carbon::now()->subDays(3),
                'rejection_reason' => 'Document was illegible — the scan was too dark to read the medication dosages or physician signature. Please resubmit a clear, high-resolution scan or photograph in good lighting.',
                'uploaded_path' => null,
                'uploaded_file_name' => null,
                'uploaded_mime' => null,
                'created_at_offset' => Carbon::now()->subDays(9),
                'system_body' => "<p>Hello Sarah,</p><p>Camp Burnt Gin has requested a document for Lily's enrollment: <strong>Seasonal Allergy Action Plan</strong>.</p><p>The document is due by <strong>".Carbon::now()->addDays(10)->format('F j, Y')."</strong>. You can upload it from the Documents section of your applicant portal.</p><p><em>Instructions: An allergy action plan from Lily's allergist or primary care provider specifying triggers, current medications, and a step-by-step emergency response. Must include medication names, dosages, and circumstances for administration.</em></p>",
                'admin_body' => 'Hi Sarah — unfortunately the allergy action plan you uploaded for Lily had to be rejected. The scan was too dark to read the medication dosages and physician signature. Could you please rescan or re-photograph it in better lighting and resubmit? The portal will let you upload a new copy now. Let us know if you need help!',
                'admin_sender' => $admin,
            ],

            // ── 6. overdue — Ava, CGM Calibration Log ───────────────────────────
            [
                'applicant' => $michael,
                'camper' => $campers['ava'],
                'application' => $appAva,
                'document_type' => 'Continuous Glucose Monitor Calibration Log',
                'instructions' => "Please provide a 2-week export from the Dexcom Clarity app showing Ava's CGM calibration history and Time in Range data. Our nursing staff use this to calibrate their monitoring plan and understand her typical glucose patterns. Export as PDF from the Dexcom Clarity app under Reports > Time in Range.",
                'status' => DocumentRequestStatus::Overdue,
                'due_date' => Carbon::now()->subDays(3)->toDateString(),
                'uploaded_at' => null,
                'reviewed_by_id' => null,
                'reviewed_at' => null,
                'rejection_reason' => null,
                'uploaded_path' => null,
                'uploaded_file_name' => null,
                'uploaded_mime' => null,
                'created_at_offset' => Carbon::now()->subDays(12),
                'system_body' => "<p>Hello Michael,</p><p>Camp Burnt Gin has requested a document for Ava's enrollment: <strong>Continuous Glucose Monitor Calibration Log</strong>.</p><p>This document was due by <strong>".Carbon::now()->subDays(3)->format('F j, Y')."</strong> and has not yet been received. Please upload it as soon as possible from the Documents section of your applicant portal.</p><p><em>Instructions: Please provide a 2-week export from the Dexcom Clarity app showing Ava's CGM calibration history and Time in Range data. Export as PDF from Dexcom Clarity under Reports.</em></p>",
                'admin_body' => "Hi Michael — this is a gentle reminder that the CGM calibration log for Ava is now past due. We know things get busy! Please upload it when you can — our nursing team needs it before the session to finalize Ava's monitoring plan. Thank you!",
                'admin_sender' => $admin2,
            ],

            // ── 7. scanning — Tyler, Proof of Identity ───────────────────────────
            [
                'applicant' => $grace,
                'camper' => $campers['tyler'],
                'application' => $appTyler,
                'document_type' => 'Proof of Identity',
                'instructions' => 'Please upload a copy of a government-issued ID for Tyler (birth certificate, passport, or school-issued ID accepted). This is required as part of our enrollment verification process for all new campers.',
                'status' => DocumentRequestStatus::Scanning,
                'due_date' => Carbon::now()->addDays(14)->toDateString(),
                'uploaded_at' => Carbon::now()->subDays(1),
                'reviewed_by_id' => null,
                'reviewed_at' => null,
                'rejection_reason' => null,
                'uploaded_path' => 'document_requests/tyler_wilson_proof_of_identity.jpg',
                'uploaded_file_name' => 'tyler_birth_certificate.jpg',
                'uploaded_mime' => 'image/jpeg',
                'created_at_offset' => Carbon::now()->subDays(5),
                'system_body' => "<p>Hello Grace,</p><p>Camp Burnt Gin has requested a document for Tyler's enrollment: <strong>Proof of Identity</strong>.</p><p>The document is due by <strong>".Carbon::now()->addDays(14)->format('F j, Y').'</strong>. You can upload it from the Documents section of your applicant portal.</p><p><em>Instructions: Please upload a copy of a government-issued ID for Tyler (birth certificate, passport, or school ID accepted). Required for enrollment verification for all new campers.</em></p>',
                'admin_body' => "Hi Grace — thank you for uploading Tyler's proof of identity. The document is currently going through our automated scanning process, which typically completes within 24 hours. We'll update you once the review is complete!",
                'admin_sender' => $admin,
            ],
        ];

        foreach ($requests as $row) {
            $this->seedRequest($row, $row['admin_sender']);
        }

        $this->command->line('  Document requests seeded (7 lifecycle states, system inbox conversations created).');
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function seedRequest(array $row, User $admin): void
    {
        $camper = $row['camper'];

        // Idempotency — skip if this (camper_id, document_type) pair already exists
        if (DocumentRequest::where('camper_id', $camper->id)
            ->where('document_type', $row['document_type'])
            ->exists()) {
            return;
        }

        $createdAt = $row['created_at_offset'];

        // ── Step 1: Create the system-generated inbox conversation ─────────────
        $conversation = Conversation::create([
            'created_by_id' => null,
            'subject' => 'Document Request: '.$row['document_type'],
            'category' => 'system',
            'is_system_generated' => true,
            'system_event_type' => 'document.requested',
            'system_event_category' => 'Document',
            'related_entity_type' => 'App\\Models\\DocumentRequest',
            'related_entity_id' => null,  // Back-filled after DocumentRequest is created
            'last_message_at' => $createdAt->clone()->addMinutes(45),
            'is_archived' => false,
        ]);

        // Add the applicant as the primary participant
        ConversationParticipant::create([
            'conversation_id' => $conversation->id,
            'user_id' => $row['applicant']->id,
            'joined_at' => $createdAt,
            'is_starred' => false,
            'is_important' => false,
        ]);

        // Add the requesting admin as a participant so they can see status replies
        ConversationParticipant::create([
            'conversation_id' => $conversation->id,
            'user_id' => $admin->id,
            'joined_at' => $createdAt,
            'is_starred' => false,
            'is_important' => false,
        ]);

        // ── Step 2: System notification message (no human sender) ─────────────
        Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => null,
            'body' => $row['system_body'],
            'idempotency_key' => Str::uuid()->toString(),
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);

        // ── Step 3: Admin follow-up message (human sender) ────────────────────
        $adminMsgAt = $createdAt->clone()->addMinutes(rand(25, 90));
        Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $row['admin_sender']->id,
            'body' => $row['admin_body'],
            'idempotency_key' => Str::uuid()->toString(),
            'created_at' => $adminMsgAt,
            'updated_at' => $adminMsgAt,
        ]);

        // Ensure placeholder file exists on disk for uploaded requests
        if ($row['uploaded_path']) {
            $this->ensurePlaceholderFile($row['uploaded_path'], $row['uploaded_file_name'] ?? 'uploaded_document');
        }

        // ── Step 4: Create the DocumentRequest record ─────────────────────────
        $docRequest = DocumentRequest::create([
            'applicant_id' => $row['applicant']->id,
            'application_id' => $row['application'] ? $row['application']->id : null,
            'camper_id' => $camper->id,
            'requested_by_admin_id' => $admin->id,
            'document_type' => $row['document_type'],
            'instructions' => $row['instructions'],
            'status' => $row['status'],
            'due_date' => $row['due_date'],
            'uploaded_document_path' => $row['uploaded_path'],
            'uploaded_file_name' => $row['uploaded_file_name'],
            'uploaded_mime_type' => $row['uploaded_mime'],
            'uploaded_at' => $row['uploaded_at'],
            'reviewed_by_admin_id' => $row['reviewed_by_id'],
            'reviewed_at' => $row['reviewed_at'],
            'rejection_reason' => $row['rejection_reason'],
            'conversation_id' => $conversation->id,
        ]);

        // ── Step 5: Back-fill related_entity_id on the conversation ───────────
        $conversation->update(['related_entity_id' => $docRequest->id]);

        // ── Step 6: Write an audit log entry for the request creation ──────────
        AuditLog::create([
            'request_id' => Str::uuid()->toString(),
            'user_id' => $admin->id,
            'event_type' => 'admin_action',
            'auditable_type' => DocumentRequest::class,
            'auditable_id' => $docRequest->id,
            'action' => 'document_request.created',
            'description' => "Document request created: \"{$row['document_type']}\" for {$camper->first_name} {$camper->last_name}",
            'old_values' => null,
            'new_values' => [
                'document_type' => $row['document_type'],
                'status' => $row['status']->value,
                'due_date' => $row['due_date'],
                'applicant_id' => $row['applicant']->id,
                'camper_id' => $camper->id,
            ],
            'metadata' => null,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'DatabaseSeeder',
            'created_at' => $createdAt,
        ]);
    }

    private function ensurePlaceholderFile(string $path, string $label): void
    {
        if (Storage::disk('local')->exists($path)) {
            return;
        }

        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        if (in_array($ext, ['jpg', 'jpeg', 'png'])) {
            $content = base64_decode(
                '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U'.
                'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN'.
                'DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy'.
                'MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA'.
                'AAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/'.
                'aAAwDAQACEQMRAD8AJQAB/9k='
            );
        } else {
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
