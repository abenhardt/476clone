<?php

namespace Database\Seeders;

use App\Enums\ApplicationStatus;
use App\Enums\DiagnosisSeverity;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Diagnosis;
use App\Models\MedicalRecord;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * ApplicationSeeder — scenario-driven application workflow coverage.
 *
 * Seeds 15 applications covering every application status, workflow state, and
 * real-world edge case. Every record has a clear reason for existing.
 *
 * ─── STATUS COVERAGE ────────────────────────────────────────────────────────
 *
 *   pending      → Lily Johnson (S1), Lucas Williams (S1), Noah Thompson (S2)
 *   under_review → Sofia Martinez (S1) — awaiting physician clearance
 *   approved     → Ethan Johnson (S1), Ava Williams (S2), Mia Davis (2025 past), Henry Carter (S1)
 *   rejected     → Noah Thompson (S1) — session at capacity, notified to reapply S2
 *   cancelled    → Lucas Williams (S2) — draft abandoned, decided on S1 only
 *   waitlisted   → Tyler Wilson (S1) — session nearing capacity, can be promoted
 *
 * ─── DRAFT APPLICATIONS (is_draft=true, not submitted) ──────────────────────
 *
 *   Mia Davis (S1 2026)    — returning family, parent started but not yet submitted
 *   Henry Carter (S2 2026) — second application started after S1 approval
 *
 * ─── SPECIAL WORKFLOW SCENARIOS ─────────────────────────────────────────────
 *
 *   Paper application       → Henry Carter (S1): signed_ip_address=null (paper sig),
 *                             admin notes indicate manual entry from physical form
 *   Returning applicant     → Mia Davis: has approved 2025 app + in-progress 2026 draft
 *   Multi-session rejection → Noah Thompson: rejected S1 (capacity) → reapplied S2
 *   Multi-session camper    → Lucas Williams: pending S1 + cancelled draft S2
 *   Sibling family          → Ethan (approved) + Lily (pending) under same parent account
 *   Two-children, two sessions → Ava (approved S2) + Lucas (pending S1) under Michael Williams
 *
 * ─── ADMIN NOTES COVERAGE ───────────────────────────────────────────────────
 *
 *   Reviewed with notes     → Ethan, Noah (rejected), Ava, Mia 2025, Henry (paper)
 *   Under review with notes → Sofia (doc request), Tyler (waitlisted)
 *   No notes yet            → Lily, Lucas S1, Noah S2
 *
 * Safe to re-run — all creates use firstOrCreate on (camper_id, camp_session_id).
 */
class ApplicationSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();

        $sessionPast = CampSession::where('name', 'Session 1 — Summer 2025')->firstOrFail();
        $session1 = CampSession::where('name', 'Session 1 — Summer 2026')->firstOrFail();
        $session2 = CampSession::where('name', 'Session 2 — Summer 2026')->firstOrFail();

        // Core 8 campers
        $ethan = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        $lily = Camper::where('first_name', 'Lily')->where('last_name', 'Johnson')->firstOrFail();
        $sofia = Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail();
        $noah = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();
        $ava = Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail();
        $lucas = Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail();
        $mia = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();
        $tyler = Camper::where('first_name', 'Tyler')->where('last_name', 'Wilson')->firstOrFail();
        $henry = Camper::where('first_name', 'Henry')->where('last_name', 'Carter')->firstOrFail();

        // ── Scenario A: Returning family, multi-child, split sessions ─────────
        //
        // Sarah Johnson has two children applying for 2026.
        // Ethan is approved (returning camper, known to medical team).
        // Lily is pending (newer applicant, submitted recently).
        // Tests: sibling family grouping, mixed status family view.

        // A1. Ethan Johnson — Approved, Session 1 2026
        //     Complete application, signed digitally, reviewed and approved.
        Application::firstOrCreate(
            ['camper_id' => $ethan->id, 'camp_session_id' => $session1->id],
            [
                'status' => ApplicationStatus::Approved,
                'is_draft' => false,
                'submitted_at' => now()->subDays(20),
                'reviewed_at' => now()->subDays(10),
                'reviewed_by' => $admin->id,
                'notes' => 'Ethan has attended Camp Burnt Gin twice before. Medical team is fully briefed on his care plan (Epilepsy + ASD). Seizure action plan received from Dr. Hill. All clearances in order. Approved.',
                'signature_name' => 'Sarah Johnson',
                'signed_at' => now()->subDays(20),
                'signed_ip_address' => '192.168.1.100',
            ]
        );

        // A2. Lily Johnson — Pending, Session 1 2026
        //     Submitted recently; not yet reviewed by admin.
        Application::firstOrCreate(
            ['camper_id' => $lily->id, 'camp_session_id' => $session1->id],
            [
                'status' => ApplicationStatus::Submitted,
                'is_draft' => false,
                'submitted_at' => now()->subDays(5),
                'reviewed_at' => null,
                'reviewed_by' => null,
                'notes' => null,
                'signature_name' => 'Sarah Johnson',
                'signed_at' => now()->subDays(5),
                'signed_ip_address' => '192.168.1.100',
            ]
        );

        // ── Scenario B: Under review — docs pending ───────────────────────────
        //
        // Sofia's application is under review but blocked pending physician clearance.
        // Admin has noted what is outstanding. Tests: UnderReview status, admin notes
        // visible in detail view, "awaiting documents" workflow.

        // B1. Sofia Martinez — Under Review, Session 1 2026
        Application::firstOrCreate(
            ['camper_id' => $sofia->id, 'camp_session_id' => $session1->id],
            [
                'status' => ApplicationStatus::UnderReview,
                'is_draft' => false,
                'submitted_at' => now()->subDays(14),
                'reviewed_at' => null,
                'reviewed_by' => null,
                'notes' => 'Application is complete and under review. Awaiting: (1) updated immunization record from Dr. Owens, (2) physician clearance letter confirming Sofia is cleared for camp participation. Follow-up email sent to David Martinez on '.now()->subDays(8)->format('M d').'. Catheterization protocol on file from 2025 pre-camp consultation.',
                'signature_name' => 'David Martinez',
                'signed_at' => now()->subDays(14),
                'signed_ip_address' => '10.0.0.45',
            ]
        );

        // ── Scenario C: Rejected → reapplied ─────────────────────────────────
        //
        // Noah was rejected for Session 1 because that session was at capacity
        // (prioritized returning campers with complex needs). Jennifer Thompson was
        // encouraged to reapply for Session 2, which she did immediately.
        // Tests: Rejected status with reason notes, same camper with two applications
        // in different statuses, multi-application admin view.

        // C1. Noah Thompson — Rejected, Session 1 2026
        Application::firstOrCreate(
            ['camper_id' => $noah->id, 'camp_session_id' => $session1->id],
            [
                'status' => ApplicationStatus::Rejected,
                'is_draft' => false,
                'submitted_at' => now()->subDays(30),
                'reviewed_at' => now()->subDays(22),
                'reviewed_by' => $admin->id,
                'notes' => 'Session 1 is at capacity — returning campers with complex multi-system needs were prioritized. Noah\'s application is strong and he is fully eligible. Family notified by email on '.now()->subDays(22)->format('M d').' and strongly encouraged to apply for Session 2. No issues with the application itself.',
                'signature_name' => 'Jennifer Thompson',
                'signed_at' => now()->subDays(30),
                'signed_ip_address' => '10.0.1.22',
            ]
        );

        // C2. Noah Thompson — Pending, Session 2 2026 (reapplication)
        Application::firstOrCreate(
            ['camper_id' => $noah->id, 'camp_session_id' => $session2->id],
            [
                'status' => ApplicationStatus::Submitted,
                'is_draft' => false,
                'submitted_at' => now()->subDays(2),
                'reviewed_at' => null,
                'reviewed_by' => null,
                'notes' => null,
                'signature_name' => 'Jennifer Thompson',
                'signed_at' => now()->subDays(2),
                'signed_ip_address' => '10.0.1.22',
            ]
        );

        // ── Scenario D: Two children, two sessions, mixed outcomes ────────────
        //
        // Michael Williams has two children (Ava + Lucas) with very different medical
        // profiles. Ava (T1D) is approved for Session 2. Lucas (DMD, complex needs)
        // is pending for Session 1 and cancelled his draft for Session 2.
        // Tests: multi-child family, approved vs pending in same family, cancelled state.

        // D1. Ava Williams — Approved, Session 2 2026
        Application::firstOrCreate(
            ['camper_id' => $ava->id, 'camp_session_id' => $session2->id],
            [
                'status' => ApplicationStatus::Approved,
                'is_draft' => false,
                'submitted_at' => now()->subDays(18),
                'reviewed_at' => now()->subDays(8),
                'reviewed_by' => $admin->id,
                'notes' => 'All documents received and verified. Dexcom CGM and OmniPod pump documentation on file. Medical team briefed on diabetes management protocol. Hypoglycemia treatment plan confirmed with Dr. Gonzalez. Approved.',
                'signature_name' => 'Michael Williams',
                'signed_at' => now()->subDays(18),
                'signed_ip_address' => '172.16.0.5',
            ]
        );

        // D2. Lucas Williams — Pending, Session 1 2026
        Application::firstOrCreate(
            ['camper_id' => $lucas->id, 'camp_session_id' => $session1->id],
            [
                'status' => ApplicationStatus::Submitted,
                'is_draft' => false,
                'submitted_at' => now()->subDays(3),
                'reviewed_at' => null,
                'reviewed_by' => null,
                'notes' => null,
                'signature_name' => 'Michael Williams',
                'signed_at' => now()->subDays(3),
                'signed_ip_address' => '172.16.0.5',
            ]
        );

        // D3. Lucas Williams — Cancelled, Session 2 2026
        //     Parent started a draft for Session 2 but cancelled it — decided to
        //     focus on Session 1 only. Tests: Cancelled status, is_draft=true with
        //     cancelled status (draft that was explicitly cancelled, not abandoned).
        Application::firstOrCreate(
            ['camper_id' => $lucas->id, 'camp_session_id' => $session2->id],
            [
                'status' => ApplicationStatus::Cancelled,
                'is_draft' => true,
                'submitted_at' => null,
                'reviewed_at' => null,
                'reviewed_by' => null,
                'notes' => 'Parent cancelled via portal — decided to apply only for Session 1 due to BiPAP equipment logistics. Draft was never submitted.',
                'signature_name' => null,
                'signed_at' => null,
                'signed_ip_address' => null,
            ]
        );

        // ── Scenario E: Returning family, past approved + current draft ────────
        //
        // Mia attended Summer 2025 (approved). Patricia Davis has started a draft
        // application for Summer 2026 but has not yet submitted it. Mia's medical
        // records from 2025 are already on file.
        // Tests: Returning applicant flow, past session record, draft-in-progress state,
        //        "returning family" badge in admin view.

        // E1. Mia Davis — Approved, Session 1 Summer 2025 (past session)
        Application::firstOrCreate(
            ['camper_id' => $mia->id, 'camp_session_id' => $sessionPast->id],
            [
                'status' => ApplicationStatus::Approved,
                'is_draft' => false,
                'submitted_at' => '2025-04-10 10:00:00',
                'reviewed_at' => '2025-04-20 14:00:00',
                'reviewed_by' => $admin->id,
                'notes' => 'Mia attended 2025 successfully. Heat protocol observed — one heat-check incident documented in treatment log. Sickle cell management excellent. Eligible and encouraged to re-apply for 2026.',
                'signature_name' => 'Patricia Davis',
                'signed_at' => '2025-04-10 10:00:00',
                'signed_ip_address' => '10.0.2.88',
            ]
        );

        // E2. Mia Davis — Draft (is_draft=true), Session 1 2026
        //     Returning applicant. Parent started the 2026 application and saved
        //     progress, but has not yet completed or submitted it.
        Application::firstOrCreate(
            ['camper_id' => $mia->id, 'camp_session_id' => $session1->id],
            [
                'status' => ApplicationStatus::Submitted,  // status is set when submitted
                'is_draft' => true,                         // KEY: not yet submitted
                'submitted_at' => null,
                'reviewed_at' => null,
                'reviewed_by' => null,
                'notes' => null,
                'signature_name' => null,
                'signed_at' => null,
                'signed_ip_address' => null,
            ]
        );

        // ── Scenario F: Waitlisted ─────────────────────────────────────────────
        //
        // Tyler applied for Session 1 but the session is nearing capacity.
        // He was placed on the waitlist — NOT rejected. Staff can promote him to
        // Approved when a slot opens (isPromotable() returns true for Waitlisted).
        // Tests: Waitlisted status, promotable state, waitlist position display.

        // F1. Tyler Wilson — Waitlisted, Session 1 2026
        Application::firstOrCreate(
            ['camper_id' => $tyler->id, 'camp_session_id' => $session1->id],
            [
                'status' => ApplicationStatus::Waitlisted,  // ← explicitly Waitlisted
                'is_draft' => false,
                'submitted_at' => now()->subDays(25),
                'reviewed_at' => now()->subDays(15),
                'reviewed_by' => $admin->id,
                'notes' => 'Application is complete and Tyler is fully eligible. Session 1 is currently at capacity — he has been placed on the waitlist and will be notified immediately if a spot opens. Tyler is #3 on the waitlist. Family contacted by phone on '.now()->subDays(15)->format('M d').'.',
                'signature_name' => 'Grace Wilson',
                'signed_at' => now()->subDays(25),
                'signed_ip_address' => '10.0.3.77',
            ]
        );

        // ── Scenario G: Paper application (admin manual entry) ────────────────
        //
        // The Carter family submitted a physical paper form at the camp office.
        // Admin manually entered the application into the portal.
        // Tests: signed_ip_address=null (paper signature, not digital), admin
        //        manual-entry workflow, paper application note in admin view.

        // G1. Henry Carter — Approved, Session 1 2026 (paper application)
        //     Admin notes explicitly document that this was a paper form.
        //     signed_ip_address is null because the signature was on paper.
        Application::firstOrCreate(
            ['camper_id' => $henry->id, 'camp_session_id' => $session1->id],
            [
                'status' => ApplicationStatus::Approved,
                'is_draft' => false,
                'submitted_at' => now()->subDays(12),
                'reviewed_at' => now()->subDays(7),
                'reviewed_by' => $admin->id,
                'notes' => 'PAPER APPLICATION — Entered manually by admin from physical form received 2026-03-11. Original paper form scanned and filed. All documents verified (immunization record, physician clearance, medication authorization). Guardian signature on paper form, dated 2026-03-09. Family does not yet have portal account — will be contacted to complete portal registration.',
                'signature_name' => 'James Carter',   // guardian who signed the physical form
                'signed_at' => now()->subDays(14),
                'signed_ip_address' => null,              // null = paper signature, not digital
            ]
        );

        // G2. Henry Carter — Pending, Session 2 2026
        //     Second application after S1 approval. Submitted digitally via portal.
        Application::firstOrCreate(
            ['camper_id' => $henry->id, 'camp_session_id' => $session2->id],
            [
                'status' => ApplicationStatus::Submitted,
                'is_draft' => false,
                'submitted_at' => now()->subDays(5),
                'reviewed_at' => null,
                'reviewed_by' => null,
                'notes' => null,
                'signature_name' => 'James Carter',
                'signed_at' => now()->subDays(5),
                'signed_ip_address' => '192.168.10.45',
            ]
        );

        // ── Scenario H: Seed minimal medical record for Henry Carter ──────────
        // The WaitlistedApplicationSeeder used to do this inline. We do it here
        // to ensure Henry's record exists before medical seeders run.
        $this->seedHenryMedicalRecord($henry);

        $this->command->line('  Applications seeded: 10 submitted + 2 drafts + 1 cancelled draft = 13 total.');
        $this->command->line('  Status coverage: pending(3), under_review(1), approved(4), rejected(1), cancelled(1), waitlisted(1), draft(2).');

        // Backfill is_active on campers and medical records to reflect approved applications.
        // ApplicationService sets these flags in production via reviewApplication(); the
        // seeder bypasses that service, so we sync the flags here after all apps are created.
        $this->backfillIsActive();
    }

    /**
     * Activate campers that have at least one approved application.
     * Medical records are backfilled separately in DatabaseSeeder after MedicalSeeder runs,
     * because medical records don't exist yet when ApplicationSeeder runs.
     */
    private function backfillIsActive(): void
    {
        $activeCamperIds = Application::where('status', ApplicationStatus::Approved)
            ->pluck('camper_id')
            ->unique();

        Camper::whereIn('id', $activeCamperIds)->update(['is_active' => true]);

        $this->command->line("  is_active backfill: {$activeCamperIds->count()} camper(s) activated.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Seed Henry Carter's medical record.
     *
     * This cannot live in MedicalSeeder because MedicalSeeder only seeds the
     * original 7 campers (Ethan, Lily, Sofia, Noah, Ava, Lucas, Mia). Henry
     * was added in the extended stack and needs his own minimal record.
     *
     * Scenario: Mild intellectual disability. Complete physician info and
     * insurance on file. No behavioral concerns. Cleared for all camp activities.
     */
    private function seedHenryMedicalRecord(Camper $henry): void
    {
        if (MedicalRecord::where('camper_id', $henry->id)->exists()) {
            return;
        }

        MedicalRecord::create([
            'camper_id' => $henry->id,
            'physician_name' => 'Dr. Lisa Huang',
            'physician_phone' => '803-555-0410',
            'insurance_provider' => 'United Healthcare',
            'insurance_policy_number' => 'UHC-CART-2026-001',
            'special_needs' => 'Mild intellectual disability. Requires simple, direct instructions (1–2 steps maximum). Responds well to visual cues and consistent routine. Enthusiastic and cooperative when instructions are clear.',
            'dietary_restrictions' => null,
            'notes' => 'Henry is a happy, motivated child. No behavioral concerns. No seizure history. No cardiac conditions. Cleared by Dr. Huang for all camp activities. Immunization record and physician clearance letter on file from paper application.',
        ]);

        Diagnosis::create([
            'camper_id' => $henry->id,
            'name' => 'Mild Intellectual Disability',
            'description' => 'IQ range 55–70. Functional adaptive skills for daily living. Attends general education with support. Communicates verbally in full sentences.',
            'severity_level' => DiagnosisSeverity::Mild,
        ]);
    }
}
