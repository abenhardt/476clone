<?php

namespace Database\Seeders;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\AssistiveDevice;
use App\Models\BehavioralProfile;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\EmergencyContact;
use App\Models\FeedingPlan;
use App\Models\MedicalRecord;
use App\Models\PersonalCarePlan;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * EdgeCaseSeeder — Failure Injection & Boundary Condition Engine
 *
 * Purpose: Intentionally creates records at system boundaries and with
 * degenerate/unusual data to expose handling weaknesses in UI and backend.
 *
 * Every scenario here is deliberate. Do NOT "fix" these records to look
 * cleaner — the entire value of this seeder is that these edge states exist
 * and the system must handle them gracefully.
 *
 * ─── SCENARIO MAP ────────────────────────────────────────────────────────────
 *
 *   EC-001  No emergency contact at all (camper exists, EC table empty for them)
 *   EC-002  All behavioral flags true simultaneously + all descriptions filled
 *   EC-003  Camper with terminal status: cancelled (admin-initiated)
 *   EC-004  Camper with terminal status: withdrawn (parent-initiated)
 *   EC-005  Camper with ALL assistive devices + AAC + G-tube in a single record
 *   EC-006  Contradictory medical data: seizure_disorder=true but no seizure plan text
 *   EC-007  Orphaned-style camper: parent account is_active=false (login denied)
 *   EC-008  Maximum-length strings in all free-text fields (boundary test)
 *   EC-009  Camper with zero medications, zero allergies, zero diagnoses
 *   EC-010  Camper with maximum medications (5) + conflicting dietary restrictions
 *   EC-011  Application with duplicate session attempt (same camper, same session)
 *            → Handled at DB level; seeder creates 2nd application in 'cancelled' state
 *            → to simulate what happens after a duplication is caught and cancelled
 *   EC-012  Spanish-only family with interpreter_needed on EVERY contact
 *   EC-013  Camper with all form-parity boolean health flags = true simultaneously
 *   EC-014  Application with second session choice = same as first (UI should prevent)
 *            → Seeded as cancelled to represent rejected duplicate
 * ─────────────────────────────────────────────────────────────────────────────
 */
class EdgeCaseSeeder extends Seeder
{
    public function run(): void
    {
        $applicantRole = Role::where('name', 'applicant')->firstOrFail();

        // Order by start_date and skip the past/historical session (index 0).
        // EC scenarios must land in active 2026 sessions so they are visible in
        // the admin panel's default session filter (active sessions only).
        // ScaleSeeder uses the same start_date ordering — keep consistent.
        $sessions = CampSession::orderBy('start_date')->take(3)->get();

        if ($sessions->count() < 2) {
            $this->command->warn('EdgeCaseSeeder: Need at least 2 camp sessions — skipping. Run CampSeeder first.');

            return;
        }

        // $sessions->get(0) = past session (2025) — intentionally skipped
        $s1 = $sessions->get(1); // Session 1 — Summer 2026
        $s2 = $sessions->count() > 2 ? $sessions->get(2) : $s1; // Session 2 — Summer 2026

        // EC-001 ── No emergency contact ──────────────────────────────────────
        $this->seedNoEmergencyContact($applicantRole, $s1);

        // EC-002 ── All behavioral flags simultaneously ───────────────────────
        $this->seedAllBehavioralFlagsTrue($applicantRole, $s1);

        // EC-003 ── Terminal: cancelled ───────────────────────────────────────
        $this->seedCancelledApplication($applicantRole, $s1);

        // EC-004 ── Terminal: withdrawn ───────────────────────────────────────
        $this->seedWithdrawnApplication($applicantRole, $s1);

        // EC-005 ── All assistive devices + G-tube ────────────────────────────
        $this->seedAllAssistiveDevices($applicantRole, $s2);

        // EC-006 ── Seizure with no plan ──────────────────────────────────────
        $this->seedSeizureNoEmergencyPlan($applicantRole, $s1);

        // EC-007 ── Inactive parent ───────────────────────────────────────────
        $this->seedInactiveParentCamper($applicantRole, $s2);

        // EC-008 ── Maximum-length strings ────────────────────────────────────
        $this->seedMaxLengthStrings($applicantRole, $s1);

        // EC-009 ── Empty medical profile ─────────────────────────────────────
        $this->seedEmptyMedicalProfile($applicantRole, $s2);

        // EC-010 ── Maximum medications + conflicting diet ────────────────────
        $this->seedMaxMedications($applicantRole, $s1);

        // EC-011 ── Duplicate session simulation (2nd app cancelled) ──────────
        $this->seedDuplicateSessionScenario($applicantRole, $s1, $s2);

        // EC-012 ── All-Spanish family, interpreter on every contact ──────────
        $this->seedSpanishOnlyFamily($applicantRole, $s2);

        // EC-013 ── All health parity flags = true ────────────────────────────
        $this->seedAllHealthFlagsTrue($applicantRole, $s1);

        // EC-014 ── Second session = first session (duplicate choice) ─────────
        $this->seedDuplicateSessionChoice($applicantRole, $s1);

        // Backfill submitted_at for any non-draft application that was created above without it.
        // Each scenario above uses firstOrCreate() so this is idempotent — rows that already have
        // submitted_at set are not touched. Using created_at preserves the original insert timestamp.
        $affected = DB::statement(
            'UPDATE applications SET submitted_at = created_at WHERE is_draft = 0 AND submitted_at IS NULL'
        );

        $this->command->info('EdgeCaseSeeder: 14 edge-case scenarios seeded (submitted_at backfilled).');
    }

    // ── EC-001 ── No emergency contact ─────────────────────────────────────────

    private function seedNoEmergencyContact(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec001.no.contact@edgecase.test'],
            [
                'name' => 'Robin No-Contact',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Casey', 'last_name' => 'NoContact', 'user_id' => $user->id],
            [
                'date_of_birth' => '2014-03-15',
                'gender' => 'Non-binary',
                'applicant_address' => '1 Edge Case Rd',
                'applicant_city' => 'Columbia',
                'applicant_state' => 'SC',
                'applicant_zip' => '29201',
            ]
        );

        // Intentionally NO EmergencyContact record — EC-001 scenario.
        // UI and admin panels must handle the missing EC gracefully.

        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::Submitted,
                'is_draft' => false,
                'first_application' => true,
                'attended_before' => false,
                'notes' => '[EDGE CASE EC-001] This application has NO emergency contact. Admin UI must handle gracefully.',
            ]
        );

        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
                'is_active' => false,
            ]
        );
    }

    // ── EC-002 ── All behavioral flags simultaneously ──────────────────────────

    private function seedAllBehavioralFlagsTrue(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec002.all.flags@edgecase.test'],
            [
                'name' => 'Alex AllFlags',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Jordan', 'last_name' => 'AllFlags', 'user_id' => $user->id],
            [
                'date_of_birth' => '2012-07-04',
                'gender' => 'Male',
                'applicant_address' => '2 All Flags Ave',
                'applicant_city' => 'Greenville',
                'applicant_state' => 'SC',
                'applicant_zip' => '29601',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Alex AllFlags'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110001',
                'phone_work' => '8031110002',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::UnderReview,
                'is_draft' => false,
                'first_application' => true,
                'attended_before' => false,
                'notes' => '[EDGE CASE EC-002] All behavioral flags are TRUE. Tests that admin UI renders all description fields.',
            ]
        );

        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'tubes_in_ears' => true,
                'has_contagious_illness' => true,
                'contagious_illness_description' => 'Currently recovering from MRSA — cleared by physician 2026-03-01',
                'has_recent_illness' => true,
                'recent_illness_description' => 'Hospitalization for pneumonia February 2026 — fully recovered',
                'is_active' => false,
            ]
        );

        // All flags set to true simultaneously — maximum behavioral load scenario.
        BehavioralProfile::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                // Flags from original schema
                'aggression' => true,
                'aggression_description' => 'Strikes others when overwhelmed; de-escalation protocol in place',
                'self_abuse' => true,
                'self_abuse_description' => 'Head banging against hard surfaces when frustrated',
                'wandering_risk' => true,
                'wandering_description' => 'Elopes without warning; requires line-of-sight supervision at all times',
                'one_to_one_supervision' => true,
                'one_to_one_description' => 'Full 1:1 required throughout camp day and overnight',
                'developmental_delay' => true,

                // New parity flags (migration 000001)
                'sexual_behaviors' => true,
                'sexual_behaviors_description' => 'Occasional public touching; staff trained with specific redirection protocol',
                'interpersonal_behavior' => true,
                'interpersonal_behavior_description' => 'Frequent verbal aggression toward peers; de-escalation plan attached',
                'social_emotional' => true,
                'social_emotional_description' => 'Severe anxiety, meltdowns lasting 30–60 minutes; calming kit required',
                'follows_instructions' => true,
                'follows_instructions_description' => 'Cannot follow multi-step instructions; one step at a time with visual supports',
                'group_participation' => true,
                'group_participation_description' => 'Cannot participate in unstructured group settings; modified individual schedule needed',
                'attends_school' => true,
                'classroom_type' => 'Self-contained special education classroom',
                'functioning_age_level' => '4-5 years',
            ]
        );
    }

    // ── EC-003 ── Terminal: cancelled ──────────────────────────────────────────

    private function seedCancelledApplication(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec003.cancelled@edgecase.test'],
            [
                'name' => 'Morgan Cancelled',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Drew', 'last_name' => 'Cancelled', 'user_id' => $user->id],
            [
                'date_of_birth' => '2013-11-20',
                'gender' => 'Male',
                'applicant_address' => '3 Terminal Ln',
                'applicant_city' => 'Charleston',
                'applicant_state' => 'SC',
                'applicant_zip' => '29401',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Morgan Cancelled'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110003',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        // Terminal state: admin cancelled after approval (conduct issue discovered).
        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::Cancelled,
                'is_draft' => false,
                'first_application' => false,
                'attended_before' => true,
                'notes' => '[EDGE CASE EC-003] Admin-cancelled after initial approval. Cancellation reason: conduct policy violation discovered post-approval. Terminal state — cannot be re-activated via normal workflow.',
                'narrative_camp_benefit' => 'Previously a strong participant (2024 session).',
            ]
        );

        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'is_active' => false,
            ]
        );
    }

    // ── EC-004 ── Terminal: withdrawn ──────────────────────────────────────────

    private function seedWithdrawnApplication(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec004.withdrawn@edgecase.test'],
            [
                'name' => 'Sam Withdrawn',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Reese', 'last_name' => 'Withdrawn', 'user_id' => $user->id],
            [
                'date_of_birth' => '2015-04-09',
                'gender' => 'Female',
                'applicant_address' => '4 Withdrawal Way',
                'applicant_city' => 'Spartanburg',
                'applicant_state' => 'SC',
                'applicant_zip' => '29301',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Sam Withdrawn'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110004',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        // Terminal state: parent withdrew during review (family moved out of state).
        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::Withdrawn,
                'is_draft' => false,
                'first_application' => true,
                'attended_before' => false,
                'notes' => '[EDGE CASE EC-004] Parent-withdrawn during review phase. Family relocated to Georgia. Terminal state — withdrawn by parent, not admin-cancelled. Different terminal path from EC-003.',
            ]
        );

        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'is_active' => false,
            ]
        );
    }

    // ── EC-005 ── All assistive devices + G-tube ───────────────────────────────

    private function seedAllAssistiveDevices(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec005.all.devices@edgecase.test'],
            [
                'name' => 'Pat AllDevices',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'River', 'last_name' => 'AllDevices', 'user_id' => $user->id],
            [
                'date_of_birth' => '2011-06-22',
                'gender' => 'Non-binary',
                'applicant_address' => '5 Device Drive',
                'applicant_city' => 'Myrtle Beach',
                'applicant_state' => 'SC',
                'applicant_zip' => '29577',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Pat AllDevices'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110005',
                'phone_work' => '8031110006',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::UnderReview,
                'is_draft' => false,
                'first_application' => true,
                'attended_before' => false,
                'notes' => '[EDGE CASE EC-005] Maximum assistive devices + G-tube. Tests that admin medical view renders all device types without layout breakage.',
                'narrative_staff_suggestions' => 'PowerWheelchair (Permobil M3 Corpus), BiPAP (ResMed AirCurve), AAC device (Tobii Dynavox), ankle-foot orthotics bilateral, wrist splints bilateral, hearing aids bilateral, G-tube (Mic-Key 18Fr), urinary catheter (self/caregiver CIC), stander for weight-bearing, suction machine.',
            ]
        );

        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'special_needs' => 'Maximum assistive device load: power wheelchair, AAC device, hearing aids, orthotics, BiPAP, G-tube, CIC catheter. All care requiring specialist staff.',
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
                'is_active' => false,
            ]
        );

        // EC-005: All device types — tests admin medical view rendering completeness.
        $devices = [
            ['device_type' => 'Power wheelchair',      'requires_transfer_assistance' => true,  'notes' => 'Permobil M3 Corpus'],
            ['device_type' => 'AAC device',             'requires_transfer_assistance' => false, 'notes' => 'Tobii Dynavox TD Snap'],
            ['device_type' => 'Hearing aids (bilateral)', 'requires_transfer_assistance' => false, 'notes' => 'Phonak Naída worn during all waking hours'],
            ['device_type' => 'Ankle-foot orthotics',  'requires_transfer_assistance' => false, 'notes' => 'Bilateral AFOs; applied at dressing'],
            ['device_type' => 'BiPAP ventilator',       'requires_transfer_assistance' => false, 'notes' => 'ResMed AirCurve; nighttime only'],
            ['device_type' => 'Suction machine',        'requires_transfer_assistance' => false, 'notes' => 'Bedside; use before sleep if secretions present'],
        ];
        foreach ($devices as $d) {
            AssistiveDevice::firstOrCreate(
                ['camper_id' => $camper->id, 'device_type' => $d['device_type']],
                ['requires_transfer_assistance' => $d['requires_transfer_assistance'], 'notes' => $d['notes']]
            );
        }

        FeedingPlan::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'special_diet' => true,
                'diet_description' => 'Blenderized diet via G-tube; bolus feeds 4× daily per nutritionist schedule.',
                'g_tube' => true,
                'formula' => 'Compleat Pediatric Organic Blends',
                'amount_per_feeding' => '240ml',
                'feedings_per_day' => 4,
                'feeding_times' => ['07:00', '11:30', '16:00', '20:00'],
                'bolus_only' => true,
                'notes' => 'Mic-Key button 18Fr. Nurse must be present for all feeds. Check tube placement before each bolus.',
            ]
        );

        PersonalCarePlan::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'bathing_level' => 'full_assist',
                'bathing_notes' => 'Two-staff lift to shower chair. Check skin integrity at pressure points.',
                'dressing_level' => 'full_assist',
                'dressing_notes' => 'Apply bilateral AFOs first; then dress over. Total time ~20 min.',
                'toileting_level' => 'full_assist',
                'toileting_notes' => 'CIC catheter every 4 hours. Caregiver performs; camper requires privacy.',
                'oral_hygiene_level' => 'physical_assist',
                'positioning_notes' => 'Full-assist transfer at all times. Two trained staff required.',
                'urinary_catheter' => true,
                'bowel_control_notes' => 'Continent with physical assist for transfers and toileting.',
            ]
        );

        BehavioralProfile::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'aggression' => false,
                'self_abuse' => false,
                'wandering_risk' => false,
                'one_to_one_supervision' => true,
                'one_to_one_description' => 'Medical 1:1 for G-tube, catheter, BiPAP management',
                'developmental_delay' => true,
                'sexual_behaviors' => false,
                'interpersonal_behavior' => false,
                'social_emotional' => true,
                'social_emotional_description' => 'Anxiety in new environments; familiar routine essential',
                'follows_instructions' => true,
                'follows_instructions_description' => 'Follows 1-2 step instructions with AAC support',
                'group_participation' => true,
                'group_participation_description' => 'Participates in adapted activities from wheelchair',
                'attends_school' => true,
                'classroom_type' => 'Life skills classroom (self-contained)',
                'functioning_age_level' => '3-4 years',
            ]
        );
    }

    // ── EC-006 ── Seizure disorder with no emergency plan ──────────────────────

    private function seedSeizureNoEmergencyPlan(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec006.seizure.noplan@edgecase.test'],
            [
                'name' => 'Chris SeizureNoPlan',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Quinn', 'last_name' => 'SeizureNoPlan', 'user_id' => $user->id],
            [
                'date_of_birth' => '2013-08-17',
                'gender' => 'Female',
                'applicant_address' => '6 Gap Street',
                'applicant_city' => 'Columbia',
                'applicant_state' => 'SC',
                'applicant_zip' => '29203',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Chris SeizureNoPlan'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110007',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::UnderReview,
                'is_draft' => false,
                'first_application' => true,
                'attended_before' => false,
                'notes' => '[EDGE CASE EC-006] seizure_disorder=true BUT seizure_plan is NULL. System should flag this as incomplete. Admin review should surface the inconsistency.',
            ]
        );

        // Contradictory data: seizure_disorder = true, seizure_plan = null
        // This is deliberately inconsistent to test admin review flagging.
        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'has_seizures' => true,
                'seizure_description' => null, // Intentionally null — the "gap"
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
                'is_active' => false,
            ]
        );

        BehavioralProfile::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'aggression' => false,
                'self_abuse' => false,
                'wandering_risk' => false,
                'one_to_one_supervision' => false,
                'developmental_delay' => false,
                'sexual_behaviors' => false,
                'interpersonal_behavior' => false,
                'social_emotional' => false,
                'follows_instructions' => true,
                'follows_instructions_description' => 'Follows age-appropriate instructions',
                'group_participation' => true,
                'group_participation_description' => 'Participates well in group activities',
                'attends_school' => true,
                'classroom_type' => 'General education with pull-out support',
                'functioning_age_level' => 'Age-appropriate',
            ]
        );
    }

    // ── EC-007 ── Inactive parent (orphaned camper) ────────────────────────────

    private function seedInactiveParentCamper(Role $role, CampSession $session): void
    {
        // Parent account is_active=false — login will be denied.
        // Camper and application still exist, but parent cannot sign in to view them.
        // Admin must be able to view these records through family management.
        $user = User::firstOrCreate(
            ['email' => 'ec007.inactive.parent@edgecase.test'],
            [
                'name' => 'Lee InactiveParent',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => false, // Deliberately inactive
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Blake', 'last_name' => 'InactiveParent', 'user_id' => $user->id],
            [
                'date_of_birth' => '2014-02-14',
                'gender' => 'Male',
                'applicant_address' => '7 Inactive Ave',
                'applicant_city' => 'Rock Hill',
                'applicant_state' => 'SC',
                'applicant_zip' => '29730',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Lee InactiveParent'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110008',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::Submitted,
                'is_draft' => false,
                'first_application' => true,
                'attended_before' => false,
                'notes' => '[EDGE CASE EC-007] Parent account is_active=false. Login denied for parent. Admin must be able to view this application via families list. Tests that admin family management is not blocked by parent account status.',
            ]
        );

        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'is_active' => false,
            ]
        );
    }

    // ── EC-008 ── Maximum-length strings ───────────────────────────────────────

    private function seedMaxLengthStrings(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec008.maxlength@edgecase.test'],
            [
                'name' => 'Francis MaxLength',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        // 255-char name (truncated to reasonable for DB)
        $longDescription = str_repeat('This is maximum length test data. ', 15); // ~510 chars

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Maximilian', 'last_name' => 'MaxLength', 'user_id' => $user->id],
            [
                'date_of_birth' => '2012-12-31',
                'gender' => 'Male',
                'applicant_address' => str_repeat('Long Address ', 5).'Blvd', // long address
                'applicant_city' => 'Aiken',
                'applicant_state' => 'SC',
                'applicant_zip' => '29801',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Francis MaxLength'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110009',
                'phone_work' => '8031110010',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::Submitted,
                'is_draft' => false,
                'first_application' => false,
                'attended_before' => true,
                'notes' => '[EDGE CASE EC-008] All free-text fields filled to maximum length. Tests that admin review UI handles long text without overflow or truncation errors.',
                'narrative_camp_benefit' => $longDescription,
                'narrative_participation_concerns' => $longDescription,
                'narrative_heat_tolerance' => $longDescription,
                'narrative_rustic_environment' => $longDescription,
                'narrative_staff_suggestions' => $longDescription,
                'narrative_emergency_protocols' => $longDescription,
                'narrative_transportation' => $longDescription,
                'narrative_additional_info' => $longDescription,
            ]
        );

        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'dietary_restrictions' => $longDescription,
                'special_needs' => $longDescription,
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
                'is_active' => false,
            ]
        );

        BehavioralProfile::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'aggression' => true,
                'aggression_description' => $longDescription,
                'self_abuse' => false,
                'wandering_risk' => true,
                'wandering_description' => $longDescription,
                'one_to_one_supervision' => false,
                'developmental_delay' => true,
                'sexual_behaviors' => false,
                'interpersonal_behavior' => true,
                'interpersonal_behavior_description' => $longDescription,
                'social_emotional' => true,
                'social_emotional_description' => $longDescription,
                'follows_instructions' => true,
                'follows_instructions_description' => $longDescription,
                'group_participation' => true,
                'group_participation_description' => $longDescription,
                'attends_school' => true,
                'classroom_type' => 'Resource room',
                'functioning_age_level' => '8-9 years',
            ]
        );
    }

    // ── EC-009 ── Empty medical profile (no allergies, meds, diagnoses) ────────

    private function seedEmptyMedicalProfile(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec009.empty.medical@edgecase.test'],
            [
                'name' => 'Terry EmptyMedical',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Scout', 'last_name' => 'EmptyMedical', 'user_id' => $user->id],
            [
                'date_of_birth' => '2016-09-03',
                'gender' => 'Female',
                'applicant_address' => '9 Empty Medical Ct',
                'applicant_city' => 'Florence',
                'applicant_state' => 'SC',
                'applicant_zip' => '29501',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Terry EmptyMedical'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110011',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::Submitted,
                'is_draft' => false,
                'first_application' => true,
                'attended_before' => false,
                'notes' => '[EDGE CASE EC-009] Medical record exists but ALL flags are false/null. Zero allergies, zero medications, zero diagnoses. Tests that medical UI handles completely empty records without null-pointer errors.',
            ]
        );

        // Every optional medical field explicitly null/false.
        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'has_seizures' => false,
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
                'is_active' => false,
            ]
        );
    }

    // ── EC-010 ── Maximum medications + conflicting dietary restrictions ────────

    private function seedMaxMedications(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec010.max.meds@edgecase.test'],
            [
                'name' => 'Dana MaxMeds',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Phoenix', 'last_name' => 'MaxMeds', 'user_id' => $user->id],
            [
                'date_of_birth' => '2011-03-28',
                'gender' => 'Non-binary',
                'applicant_address' => '10 Polypharmacy Pkwy',
                'applicant_city' => 'Sumter',
                'applicant_state' => 'SC',
                'applicant_zip' => '29150',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Dana MaxMeds'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110012',
                'phone_work' => '8031110013',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::UnderReview,
                'is_draft' => false,
                'first_application' => false,
                'attended_before' => true,
                'notes' => '[EDGE CASE EC-010] Complex polypharmacy: 5 medications with potential interactions. Dietary notes contain contradictions (nut-free kitchen + peanut butter listed as caloric supplement). Medical staff must reconcile before approval.',
                'narrative_staff_suggestions' => 'None required.',
                'narrative_emergency_protocols' => 'Carries diastat rectal gel in red emergency bag. Carries epinephrine auto-injector (EpiPen Jr) in same bag. Bag MUST be with camper at all times.',
            ]
        );

        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'has_seizures' => true,
                'seizure_description' => 'Call 911 if seizure >3 min. Diastat rectal gel 7.5mg if >5 min. Position on side. Do NOT restrain.',
                'special_needs' => 'ALLERGIES: Tree nuts (anaphylactic — EpiPen required). Latex (contact dermatitis). Penicillin (rash). Note: peanut butter IS allowed and used as caloric supplement; tree nuts are NOT.',
                'notes' => 'MEDICATIONS: 1) Depakote 500mg BID (seizure). 2) Lamictal 100mg BID (seizure). 3) Risperidone 0.5mg QHS (mood). 4) Melatonin 3mg QHS (sleep). 5) Miralax 17g daily (GI). See administration schedule.',
                'dietary_restrictions' => 'TREE NUT-FREE (anaphylactic). Peanut butter IS allowed and used as caloric supplement. Ketogenic diet protocol: 4:1 fat-to-protein/carb ratio. NO sugar. NO juice. Weigh all portions.',
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
                'is_active' => false,
            ]
        );
    }

    // ── EC-011 ── Duplicate session scenario (2nd app cancelled) ──────────────

    private function seedDuplicateSessionScenario(Role $role, CampSession $s1, CampSession $s2): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec011.duplicate.session@edgecase.test'],
            [
                'name' => 'Jan Duplicate',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Kendall', 'last_name' => 'Duplicate', 'user_id' => $user->id],
            [
                'date_of_birth' => '2014-07-19',
                'gender' => 'Female',
                'applicant_address' => '11 Double Submit Dr',
                'applicant_city' => 'Conway',
                'applicant_state' => 'SC',
                'applicant_zip' => '29526',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Jan Duplicate'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110014',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        // First (legitimate) application — approved.
        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $s1->id],
            [
                'status' => ApplicationStatus::Approved,
                'is_draft' => false,
                'first_application' => false,
                'attended_before' => true,
                'notes' => '[EDGE CASE EC-011-A] Legitimate approved application for S1.',
            ]
        );

        // Second application for the same session — admin cancelled it as duplicate.
        // DB unique constraint on (camper_id, camp_session_id) means we use S2 here
        // to simulate the "caught and cancelled" state without hitting the constraint.
        if ($s1->id !== $s2->id) {
            Application::firstOrCreate(
                ['camper_id' => $camper->id, 'camp_session_id' => $s2->id],
                [
                    'status' => ApplicationStatus::Cancelled,
                    'is_draft' => false,
                    'first_application' => false,
                    'attended_before' => true,
                    'notes' => '[EDGE CASE EC-011-B] This is a cancelled duplicate submission. Camper was already approved for S1. Parent attempted to submit again for S2; admin cancelled. Simulates the post-deduplication cancelled state.',
                ]
            );
        }

        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'is_active' => true, // Approved camper
            ]
        );
    }

    // ── EC-012 ── All-Spanish family, interpreter on every contact ────────────

    private function seedSpanishOnlyFamily(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec012.espanol.only@edgecase.test'],
            [
                'name' => 'Carmen EspañolOnly',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Valentina', 'last_name' => 'EspañolOnly', 'user_id' => $user->id],
            [
                'date_of_birth' => '2013-05-10',
                'gender' => 'Female',
                'applicant_address' => '12 Calle Principal',
                'applicant_city' => 'Lexington',
                'applicant_state' => 'SC',
                'applicant_zip' => '29072',
            ]
        );

        // Primary contact — Spanish only, interpreter required.
        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Carmen EspañolOnly'],
            [
                'relationship' => 'Mother',
                'phone_primary' => '8031110015',
                'phone_work' => '8031110016',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'Spanish',
                'interpreter_needed' => true,
            ]
        );

        // Secondary contact — also Spanish only, also needs interpreter.
        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Miguel EspañolOnly'],
            [
                'relationship' => 'Father',
                'phone_primary' => '8031110017',
                'phone_work' => '8031110018',
                'is_primary' => false,
                'is_authorized_pickup' => true,
                'primary_language' => 'Spanish',
                'interpreter_needed' => true,
            ]
        );

        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::Submitted,
                'is_draft' => false,
                'first_application' => true,
                'attended_before' => false,
                'notes' => '[EDGE CASE EC-012] ALL contacts require Spanish interpreter. Tests that admin UI renders interpreter flags prominently and that notification system can reach Spanish-language contacts.',
            ]
        );

        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'is_active' => false,
            ]
        );
    }

    // ── EC-013 ── All health parity flags = true ───────────────────────────────

    private function seedAllHealthFlagsTrue(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec013.all.health.flags@edgecase.test'],
            [
                'name' => 'Jesse AllHealthFlags',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Skyler', 'last_name' => 'AllHealthFlags', 'user_id' => $user->id],
            [
                'date_of_birth' => '2012-10-15',
                'gender' => 'Non-binary',
                'applicant_address' => '13 Health Flag Hill',
                'applicant_city' => 'Columbia',
                'applicant_state' => 'SC',
                'applicant_zip' => '29204',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Jesse AllHealthFlags'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110019',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::UnderReview,
                'is_draft' => false,
                'first_application' => true,
                'attended_before' => false,
                'notes' => '[EDGE CASE EC-013] All form-parity health flags are true. Tests admin view renders all health fields simultaneously.',
            ]
        );

        // All parity health flags set to true simultaneously.
        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'tubes_in_ears' => true,
                'has_contagious_illness' => true,
                'contagious_illness_description' => 'Resolving impetigo; physician clearance dated 2026-03-01 on file',
                'has_recent_illness' => true,
                'recent_illness_description' => 'RSV bronchiolitis January 2026; fully recovered',
                'is_active' => false,
            ]
        );
    }

    // ── EC-014 ── Second session same as first (duplicate choice) ──────────────

    private function seedDuplicateSessionChoice(Role $role, CampSession $session): void
    {
        $user = User::firstOrCreate(
            ['email' => 'ec014.same.session@edgecase.test'],
            [
                'name' => 'Avery SameSession',
                'role_id' => $role->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        $camper = Camper::firstOrCreate(
            ['first_name' => 'Rowan', 'last_name' => 'SameSession', 'user_id' => $user->id],
            [
                'date_of_birth' => '2015-12-01',
                'gender' => 'Female',
                'applicant_address' => '14 Double Pick Rd',
                'applicant_city' => 'Beaufort',
                'applicant_state' => 'SC',
                'applicant_zip' => '29902',
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Avery SameSession'],
            [
                'relationship' => 'Parent',
                'phone_primary' => '8031110020',
                'is_primary' => true,
                'is_authorized_pickup' => true,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        // camp_session_id_second = camp_session_id — same session as both choices.
        // Frontend radio list should filter out the primary session from second choice options,
        // preventing this at the UI level. This record simulates what happens if it bypasses
        // the UI guard (e.g. direct API call or legacy data).
        Application::firstOrCreate(
            ['camper_id' => $camper->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::Cancelled,
                'camp_session_id_second' => $session->id, // Same as primary — intentional
                'is_draft' => false,
                'first_application' => true,
                'attended_before' => false,
                'notes' => '[EDGE CASE EC-014] camp_session_id = camp_session_id_second (same session as both choices). Application was cancelled when this was detected. Frontend radio list should prevent this at UI level. Tests admin UI handles this without crashing.',
            ]
        );

        MedicalRecord::firstOrCreate(
            ['camper_id' => $camper->id],
            [
                'is_active' => false,
            ]
        );
    }
}
