<?php

namespace Database\Seeders;

use App\Models\CampSession;
use App\Models\Deadline;
use App\Models\DocumentRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

/**
 * DeadlineSeeder — realistic deadline scenarios for the Camp Burnt Gin system.
 *
 * All deadlines are seeded via Deadline::create(), which fires DeadlineObserver
 * automatically. The observer calls DeadlineCalendarSyncService::sync(), so each
 * deadline below automatically generates a corresponding CalendarEvent at seed time.
 * No manual CalendarEvent creation is needed here.
 *
 * ─── SCENARIO COVERAGE ────────────────────────────────────────────────────────
 *
 *   Session-wide deadlines (entity_id = null):
 *     1.  Application Submission Deadline    — safe        (35 days out)
 *     2.  Medical Form Upload Deadline       — approaching (5 days out)
 *     3.  Emergency Contact Verification     — safe        (21 days out)
 *     4.  Enrollment Deposit Payment         — completed   (paid, admin override)
 *     5.  Camper Information Form Due        — safe        (28 days out, S2)
 *
 *   Document-request-scoped deadlines (entity_type = document_request):
 *     6.  IEP / Special Education Plan       — safe        (Ethan, 7 days, soft)
 *     7.  CGM Calibration Log                — overdue     (Ava, 3 days past, hard)
 *     8.  Audiologist Report                 — approaching (Noah, 3 days, soft)
 *     9.  Seasonal Allergy Action Plan       — approaching (Lily, 6 days, soft)
 *     10. BiPAP Certification                — completed   (Lucas, admin cleared)
 *
 *   Application-scoped deadlines (entity_type = application):
 *     11. Consent Review Required            — safe        (Sofia, 14 days, soft)
 *     12. Health History Update Required     — overdue     (Noah S1, 5 days past, hard)
 *
 *   Session-wide internal deadlines (not visible to applicants):
 *     13. Staff Briefing Packet              — approaching (4 days, internal admin)
 *     14. Clinical Roster Audit              — overdue     (2 days past, internal)
 *     15. Session Capacity Freeze            — extended    (was overdue, extended 14 days)
 *
 * All due dates use Carbon::now() offsets so urgency levels stay accurate
 * whenever the database is freshly seeded.
 *
 * Safe to re-run — idempotency guard on (camp_session_id, entity_type, title).
 */
class DeadlineSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();

        $s1 = CampSession::where('name', 'Session 1 — Summer 2026')->firstOrFail();
        $s2 = CampSession::where('name', 'Session 2 — Summer 2026')->firstOrFail();

        // ── Session-wide deadlines — S1 ───────────────────────────────────────

        // 1. Application Submission — safe (35 days)
        $this->seed($admin, [
            'camp_session_id' => $s1->id,
            'entity_type' => 'session',
            'entity_id' => null,
            'title' => 'Application Submission Deadline',
            'description' => 'All families must submit a complete application (digital form + medical form upload) before this date. Applications received after this deadline will be placed on the waitlist.',
            'due_date' => Carbon::now()->addDays(35),
            'grace_period_days' => 3,
            'status' => 'pending',
            'is_enforced' => true,
            'enforcement_mode' => 'soft',
            'is_visible_to_applicants' => true,
        ]);

        // 2. Medical Form Upload — approaching (5 days)
        $this->seed($admin, [
            'camp_session_id' => $s1->id,
            'entity_type' => 'session',
            'entity_id' => null,
            'title' => 'Medical Form Upload Deadline',
            'description' => 'DPH Form 4523-ENG must be completed by your child\'s physician and uploaded to the portal. Camp cannot accept campers without a completed medical form on file.',
            'due_date' => Carbon::now()->addDays(5),
            'grace_period_days' => 0,
            'status' => 'pending',
            'is_enforced' => true,
            'enforcement_mode' => 'hard',
            'is_visible_to_applicants' => true,
        ]);

        // 3. Emergency Contact Verification — safe (21 days)
        $this->seed($admin, [
            'camp_session_id' => $s1->id,
            'entity_type' => 'session',
            'entity_id' => null,
            'title' => 'Emergency Contact Verification',
            'description' => 'Please verify that all emergency contact information is current and accurate. Our staff will call the primary emergency contact prior to the session start date.',
            'due_date' => Carbon::now()->addDays(21),
            'grace_period_days' => 2,
            'status' => 'pending',
            'is_enforced' => false,
            'enforcement_mode' => 'soft',
            'is_visible_to_applicants' => true,
        ]);

        // 4. Enrollment Deposit — completed (paid / admin override)
        $this->seed($admin, [
            'camp_session_id' => $s1->id,
            'entity_type' => 'session',
            'entity_id' => null,
            'title' => 'Enrollment Deposit Payment',
            'description' => 'A $150 non-refundable enrollment deposit secures your camper\'s spot. Spots are not held until the deposit is received.',
            'due_date' => Carbon::now()->subDays(5),
            'grace_period_days' => 0,
            'status' => 'completed',
            'is_enforced' => true,
            'enforcement_mode' => 'hard',
            'is_visible_to_applicants' => true,
            'override_note' => 'All enrolled families have completed payment. Deadline closed 2026-03-22.',
        ]);

        // 5. Camper Information Form — safe (S2, 28 days)
        $this->seed($admin, [
            'camp_session_id' => $s2->id,
            'entity_type' => 'session',
            'entity_id' => null,
            'title' => 'Camper Information Form Due',
            'description' => 'Complete the online Camper Information Form including dietary preferences, activity interests, roommate requests, and any updated support needs since your initial application.',
            'due_date' => Carbon::now()->addDays(28),
            'grace_period_days' => 5,
            'status' => 'pending',
            'is_enforced' => false,
            'enforcement_mode' => 'soft',
            'is_visible_to_applicants' => true,
        ]);

        // ── Document-request-scoped deadlines ─────────────────────────────────

        // Resolve existing DocumentRequest IDs from DocumentRequestSeeder
        $docRequestIds = $this->resolveDocRequestIds();

        // 6. IEP — safe (Ethan, 7 days, soft)
        if ($docRequestIds['ethan_iep']) {
            $this->seed($admin, [
                'camp_session_id' => $s1->id,
                'entity_type' => 'document_request',
                'entity_id' => $docRequestIds['ethan_iep'],
                'title' => 'IEP / Special Education Plan — Ethan Johnson',
                'description' => 'Required for clinical team planning. Must be dated within the last 12 months.',
                'due_date' => Carbon::now()->addDays(7),
                'grace_period_days' => 2,
                'status' => 'pending',
                'is_enforced' => true,
                'enforcement_mode' => 'soft',
                'is_visible_to_applicants' => true,
            ]);
        }

        // 7. CGM Calibration Log — overdue (Ava, 3 days past, hard)
        if ($docRequestIds['ava_cgm']) {
            $this->seed($admin, [
                'camp_session_id' => $s1->id,
                'entity_type' => 'document_request',
                'entity_id' => $docRequestIds['ava_cgm'],
                'title' => 'CGM Calibration Log — Ava Williams',
                'description' => 'Dexcom Clarity 2-week Time in Range export. Required before nursing can finalize the glucose monitoring plan.',
                'due_date' => Carbon::now()->subDays(3),
                'grace_period_days' => 0,
                'status' => 'overdue',
                'is_enforced' => true,
                'enforcement_mode' => 'hard',
                'is_visible_to_applicants' => true,
            ]);
        }

        // 8. Audiologist Report — approaching (Noah, 3 days, soft)
        if ($docRequestIds['noah_audio']) {
            $this->seed($admin, [
                'camp_session_id' => $s1->id,
                'entity_type' => 'document_request',
                'entity_id' => $docRequestIds['noah_audio'],
                'title' => 'Audiologist Report — Noah Thompson',
                'description' => 'Most recent audiologist evaluation (within last 2 years). Needed to brief activity staff on communication preferences.',
                'due_date' => Carbon::now()->addDays(3),
                'grace_period_days' => 1,
                'status' => 'pending',
                'is_enforced' => true,
                'enforcement_mode' => 'soft',
                'is_visible_to_applicants' => true,
            ]);
        }

        // 9. Seasonal Allergy Action Plan — approaching (Lily, 6 days, soft)
        if ($docRequestIds['lily_allergy']) {
            $this->seed($admin, [
                'camp_session_id' => $s1->id,
                'entity_type' => 'document_request',
                'entity_id' => $docRequestIds['lily_allergy'],
                'title' => 'Seasonal Allergy Action Plan — Lily Johnson',
                'description' => 'Previously rejected — illegible scan. Applicant must resubmit a clear, high-resolution version.',
                'due_date' => Carbon::now()->addDays(6),
                'grace_period_days' => 0,
                'status' => 'pending',
                'is_enforced' => true,
                'enforcement_mode' => 'soft',
                'is_visible_to_applicants' => true,
            ]);
        }

        // 10. BiPAP Certification — completed (Lucas, admin cleared)
        if ($docRequestIds['lucas_bipap']) {
            $this->seed($admin, [
                'camp_session_id' => $s1->id,
                'entity_type' => 'document_request',
                'entity_id' => $docRequestIds['lucas_bipap'],
                'title' => 'BiPAP/Ventilator Certification — Lucas Williams',
                'description' => 'Physician or respiratory therapist certification for ResMed AirCurve 10 VAuto. Clinical letterhead required.',
                'due_date' => Carbon::now()->subDays(5),
                'grace_period_days' => 0,
                'status' => 'completed',
                'is_enforced' => true,
                'enforcement_mode' => 'hard',
                'is_visible_to_applicants' => true,
                'override_note' => 'Document approved by admin@example.com on 2026-03-19. No further action required.',
            ]);
        }

        // ── Application-scoped deadlines ──────────────────────────────────────

        $appIds = $this->resolveApplicationIds();

        // 11. Consent Review — safe (Sofia, 14 days, soft)
        if ($appIds['sofia']) {
            $this->seed($admin, [
                'camp_session_id' => $s1->id,
                'entity_type' => 'application',
                'entity_id' => $appIds['sofia'],
                'title' => 'Consent Review Required — Sofia Martinez',
                'description' => 'Application is under review. Admin has flagged the consent section for re-confirmation. Parent must log in and confirm all consents are current before final approval can be granted.',
                'due_date' => Carbon::now()->addDays(14),
                'grace_period_days' => 3,
                'status' => 'pending',
                'is_enforced' => false,
                'enforcement_mode' => 'soft',
                'is_visible_to_applicants' => true,
            ]);
        }

        // 12. Health History Update — overdue (Noah S1, 5 days past, hard)
        if ($appIds['noah']) {
            $this->seed($admin, [
                'camp_session_id' => $s1->id,
                'entity_type' => 'application',
                'entity_id' => $appIds['noah'],
                'title' => 'Health History Update Required — Noah Thompson',
                'description' => 'Medical team has flagged a discrepancy in the health history section. Parent must contact admin to clarify before this application can advance.',
                'due_date' => Carbon::now()->subDays(5),
                'grace_period_days' => 0,
                'status' => 'overdue',
                'is_enforced' => true,
                'enforcement_mode' => 'hard',
                'is_visible_to_applicants' => true,
            ]);
        }

        // ── Internal-only deadlines (not visible to applicants) ───────────────

        // 13. Staff Briefing Packet — approaching (4 days, internal)
        $this->seed($admin, [
            'camp_session_id' => $s1->id,
            'entity_type' => 'session',
            'entity_id' => null,
            'title' => 'Staff Briefing Packet Finalized',
            'description' => 'All individual camper support summaries, medication schedules, and behavioral intervention plans must be compiled and distributed to assigned counselors before this date.',
            'due_date' => Carbon::now()->addDays(4),
            'grace_period_days' => 1,
            'status' => 'pending',
            'is_enforced' => true,
            'enforcement_mode' => 'soft',
            'is_visible_to_applicants' => false,
        ]);

        // 14. Clinical Roster Audit — overdue (2 days past, internal)
        $this->seed($admin, [
            'camp_session_id' => $s1->id,
            'entity_type' => 'session',
            'entity_id' => null,
            'title' => 'Clinical Roster Audit',
            'description' => 'Medical director must audit approved camper rosters against incoming medical forms. Any camper with a missing or unreviewed medical form must be flagged for follow-up before the session opens.',
            'due_date' => Carbon::now()->subDays(2),
            'grace_period_days' => 0,
            'status' => 'overdue',
            'is_enforced' => true,
            'enforcement_mode' => 'soft',
            'is_visible_to_applicants' => false,
        ]);

        // 15. Session Capacity Freeze — extended (was overdue, now 14 days out)
        $this->seed($admin, [
            'camp_session_id' => $s1->id,
            'entity_type' => 'session',
            'entity_id' => null,
            'title' => 'Session Capacity Freeze',
            'description' => 'No new applications may be accepted after this date. The enrollment roster is locked for logistics planning (transportation, cabin assignments, staff ratios).',
            'due_date' => Carbon::now()->addDays(14),
            'grace_period_days' => 0,
            'status' => 'extended',
            'is_enforced' => true,
            'enforcement_mode' => 'hard',
            'is_visible_to_applicants' => false,
            'override_note' => 'Extended from 2026-03-20 due to 3 late waitlist promotions. New freeze date confirmed by Camp Director.',
        ]);

        $total = Deadline::count();
        $this->command->line("  Deadlines seeded ({$total} deadlines, calendar events auto-synced via observer).");
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Idempotent create — skips if a deadline with the same session + entity type + title exists.
     *
     * @param  array<string, mixed>  $data
     */
    private function seed(User $admin, array $data): void
    {
        $exists = Deadline::where('camp_session_id', $data['camp_session_id'])
            ->where('entity_type', $data['entity_type'])
            ->where('title', $data['title'])
            ->exists();

        if ($exists) {
            return;
        }

        Deadline::create(array_merge($data, [
            'created_by' => $admin->id,
            'updated_by' => null,
        ]));
    }

    /**
     * Resolves DocumentRequest IDs from DocumentRequestSeeder by document_type.
     * Returns null for each key if the seeder hasn't run or the record doesn't exist.
     *
     * @return array<string, int|null>
     */
    private function resolveDocRequestIds(): array
    {
        return [
            'ethan_iep' => DocumentRequest::where('document_type', 'Updated IEP / Special Education Plan')->value('id'),
            'ava_cgm' => DocumentRequest::where('document_type', 'Continuous Glucose Monitor Calibration Log')->value('id'),
            'noah_audio' => DocumentRequest::where('document_type', 'Audiologist Report')->value('id'),
            'lily_allergy' => DocumentRequest::where('document_type', 'Seasonal Allergy Action Plan')->value('id'),
            'lucas_bipap' => DocumentRequest::where('document_type', 'BiPAP/Ventilator Operation Certification')->value('id'),
        ];
    }

    /**
     * Resolves Application IDs for scoped deadlines.
     *
     * @return array<string, int|null>
     */
    private function resolveApplicationIds(): array
    {
        $sofia = \App\Models\Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->first();
        $noah = \App\Models\Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->first();

        return [
            'sofia' => $sofia
                ? \App\Models\Application::where('camper_id', $sofia->id)
                    ->where('status', 'under_review')
                    ->value('id')
                : null,
            'noah' => $noah
                ? \App\Models\Application::where('camper_id', $noah->id)
                    ->where('status', 'pending')
                    ->value('id')
                : null,
        ];
    }
}
