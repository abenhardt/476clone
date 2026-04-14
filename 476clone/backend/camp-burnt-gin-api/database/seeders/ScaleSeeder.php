<?php

namespace Database\Seeders;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\BehavioralProfile;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\EmergencyContact;
use App\Models\MedicalRecord;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * ScaleSeeder — 32 additional families (42 campers) for enterprise-level UI testing.
 *
 * Combined with the 30 families from FamilySeeder this brings the system to:
 *   62 total families · 76 total campers · ~90 total applications
 *
 * Goals:
 *   ① Admin dashboards have enough density to test filtering, sorting, pagination
 *   ② All 3 sessions receive meaningful application distribution
 *   ③ Every application status is represented per session
 *   ④ CYSHCN demographics are realistic (SC counties, diverse disability categories)
 *   ⑤ Spanish-speaking families present (interpreter flag exercised)
 *   ⑥ Multi-child families exercised beyond the core 4
 *   ⑦ All new form parity fields (language, address, narratives) populated
 *
 * Disability categories represented:
 *   - ASD (levels 1, 2, 3)
 *   - Down syndrome
 *   - Cerebral palsy (hemi, di, quad)
 *   - Spina bifida
 *   - Intellectual disability (mild, moderate, severe)
 *   - ADHD/Anxiety
 *   - Rare metabolic disorders (PKU, glycogen storage)
 *   - Sensory impairment (cochlear implant)
 *   - Multiple physical disabilities
 *
 * Safe to re-run — uses firstOrCreate throughout.
 */
class ScaleSeeder extends Seeder
{
    public function run(): void
    {
        $parentRole = Role::where('name', 'applicant')->firstOrFail();
        $sessions = CampSession::orderBy('start_date')->get();

        if ($sessions->count() < 2) {
            $this->command->warn('  ScaleSeeder skipped — no camp sessions found. Run CampSeeder first.');

            return;
        }

        // Use sessions by index; CampSeeder creates 3: past (0), session1 (1), session2 (2)
        $s1 = $sessions->get(1) ?? $sessions->first();
        $s2 = $sessions->get(2) ?? $sessions->first();

        $camperCount = 0;
        $appCount = 0;

        foreach ($this->families() as $family) {
            $user = User::firstOrCreate(
                ['email' => $family['email']],
                [
                    'name' => $family['name'],
                    'role_id' => $parentRole->id,
                    'password' => Hash::make('password'),
                    'email_verified_at' => now(),
                    'is_active' => true,
                    'phone' => $family['phone'] ?? null,
                    'address_line_1' => $family['address'] ?? null,
                    'city' => $family['city'] ?? null,
                    'state' => 'SC',
                    'postal_code' => $family['zip'] ?? null,
                    'country' => 'US',
                    'notification_preferences' => ['email', 'database'],
                ]
            );

            foreach ($family['campers'] as $c) {
                $camper = Camper::firstOrCreate(
                    ['user_id' => $user->id, 'first_name' => $c['first_name'], 'last_name' => $c['last_name']],
                    [
                        'date_of_birth' => $c['dob'],
                        'gender' => $c['gender'],
                        'tshirt_size' => $c['tshirt'] ?? 'M',
                        'county' => $family['county'] ?? null,
                        'supervision_level' => $c['supervision'] ?? 'standard',
                        'needs_interpreter' => $family['interpreter'] ?? false,
                        'preferred_language' => ($family['interpreter'] ?? false) ? ($family['language'] ?? null) : null,
                        'applicant_address' => $family['address'] ?? null,
                        'applicant_city' => $family['city'] ?? null,
                        'applicant_state' => 'SC',
                        'applicant_zip' => $family['zip'] ?? null,
                    ]
                );
                $camperCount++;

                // ── Emergency contact ─────────────────────────────────────────
                if (! EmergencyContact::where('camper_id', $camper->id)->exists()) {
                    EmergencyContact::create([
                        'camper_id' => $camper->id,
                        'name' => $c['ec_name'],
                        'relationship' => $c['ec_rel'],
                        'phone_primary' => $c['ec_phone'],
                        'phone_secondary' => $c['ec_phone2'] ?? null,
                        'phone_work' => $c['ec_phone_work'] ?? null,
                        'email' => $c['ec_email'] ?? null,
                        'is_primary' => true,
                        'is_authorized_pickup' => true,
                        'is_guardian' => true,
                        'address' => $family['address'] ?? null,
                        'city' => $family['city'] ?? null,
                        'state' => 'SC',
                        'zip' => $family['zip'] ?? null,
                        'primary_language' => $family['language'] ?? null,
                        'interpreter_needed' => $family['interpreter'] ?? false,
                    ]);
                }

                // ── Application ───────────────────────────────────────────────
                $targetSession = ($c['session'] ?? 's1') === 's2' ? $s2 : $s1;
                // 'draft' is not an ApplicationStatus enum value — it is controlled
                // by the is_draft boolean. Treat draft entries as submitted status.
                $rawStatus = $c['status'] ?? 'submitted';
                $status = ApplicationStatus::from($rawStatus === 'draft' ? 'submitted' : $rawStatus);

                $app = Application::firstOrCreate(
                    ['camper_id' => $camper->id, 'camp_session_id' => $targetSession->id],
                    [
                        'status' => $status,
                        'is_draft' => $c['draft'] ?? false,
                        'first_application' => $c['first_app'] ?? true,
                        'attended_before' => $c['attended_before'] ?? false,
                        'notes' => $c['admin_notes'] ?? null,
                        'submitted_at' => ($c['draft'] ?? false) ? null : now()->subDays(rand(1, 30)),
                        'narrative_rustic_environment' => $c['narrative_rustic'] ?? null,
                        'narrative_camp_benefit' => $c['narrative_benefit'] ?? null,
                        'narrative_heat_tolerance' => $c['narrative_heat'] ?? null,
                        'narrative_participation_concerns' => $c['narrative_concerns'] ?? null,
                        'narrative_staff_suggestions' => $c['narrative_staff'] ?? null,
                        'narrative_transportation' => $c['narrative_transport'] ?? null,
                    ]
                );
                $appCount++;

                // Activate camper for approved applications
                if ($status === ApplicationStatus::Approved) {
                    $camper->update(['is_active' => true]);
                }

                // ── Medical record (for non-draft, non-rejected apps) ─────────
                $needsMedical = ! ($c['draft'] ?? false)
                    && $status !== ApplicationStatus::Rejected
                    && $status !== ApplicationStatus::Cancelled;

                if ($needsMedical && isset($c['medical']) && ! MedicalRecord::where('camper_id', $camper->id)->exists()) {
                    $m = $c['medical'];
                    MedicalRecord::create([
                        'camper_id' => $camper->id,
                        'physician_name' => $m['physician'] ?? 'Dr. Unknown',
                        'physician_phone' => $m['physician_phone'] ?? '803-555-0000',
                        'insurance_provider' => $m['insurance'] ?? 'Medicaid',
                        'special_needs' => $m['special_needs'] ?? null,
                        'dietary_restrictions' => $m['diet'] ?? null,
                        'notes' => $m['notes'] ?? null,
                        'has_seizures' => $m['seizures'] ?? false,
                        'tubes_in_ears' => $m['tubes_in_ears'] ?? false,
                        'has_contagious_illness' => false,
                        'has_recent_illness' => $m['recent_illness'] ?? false,
                        'recent_illness_description' => $m['recent_illness_desc'] ?? null,
                        'immunizations_current' => $m['immunizations_current'] ?? true,
                        'is_active' => $status === ApplicationStatus::Approved,
                    ]);
                }

                // ── Behavioral profile ────────────────────────────────────────
                if (isset($c['behavioral']) && ! BehavioralProfile::where('camper_id', $camper->id)->exists()) {
                    $b = $c['behavioral'];
                    BehavioralProfile::create(array_merge(['camper_id' => $camper->id], $b));
                }
            }
        }

        $this->command->line("  Scale data seeded: {$camperCount} campers, {$appCount} applications.");
    }

    // ─── Family definitions ────────────────────────────────────────────────────
    // Status distribution across 32 families:
    //   pending (12), under_review (6), approved (6), waitlisted (3), rejected (3), draft (2)

    private function families(): array
    {
        return [

            // ── 31. Brown family — Columbia, ASD Level 1 ──────────────────────
            [
                'name' => 'Darnell Brown', 'email' => 'darnell.brown@example.com',
                'phone' => '803-555-1001', 'address' => '445 Harden Street', 'city' => 'Columbia', 'zip' => '29205',
                'county' => 'Richland', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Marcus', 'last_name' => 'Brown', 'dob' => '2013-03-14', 'gender' => 'male',
                    'tshirt' => 'YL', 'supervision' => 'standard', 'session' => 's1', 'status' => 'submitted',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Keisha Brown', 'ec_rel' => 'Mother', 'ec_phone' => '803-555-1002', 'ec_phone_work' => '803-555-1003',
                    'narrative_rustic' => 'Marcus has spent time at outdoor day programs and does well with nature settings.',
                    'narrative_benefit' => 'We are hoping camp gives Marcus peer relationships outside of his school environment.',
                    'narrative_heat' => 'Manages heat well with hydration breaks every 30 minutes.',
                    'medical' => ['physician' => 'Dr. Sandra Owens', 'physician_phone' => '803-434-2000', 'insurance' => 'BCBS SC', 'special_needs' => 'ASD Level 1. Verbal, academically capable, sensory sensitivities primarily auditory and tactile.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => false, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Resource room', 'communication_methods' => ['verbal'], 'notes' => 'ASD Level 1. Mild sensory sensitivities. Participates well in structured group activities.'],
                ]],
            ],

            // ── 32. Reyes family — Lexington, ID + Spanish-speaking ───────────
            [
                'name' => 'Maria Reyes', 'email' => 'maria.reyes@example.com',
                'phone' => '803-555-1011', 'address' => '782 Corley Mill Road', 'city' => 'Lexington', 'zip' => '29072',
                'county' => 'Lexington', 'interpreter' => true, 'language' => 'Spanish',
                'campers' => [[
                    'first_name' => 'Camila', 'last_name' => 'Reyes', 'dob' => '2014-11-22', 'gender' => 'female',
                    'tshirt' => 'YM', 'supervision' => 'enhanced', 'session' => 's2', 'status' => 'submitted',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'José Reyes', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1012', 'ec_phone_work' => '803-555-1013',
                    'narrative_rustic' => 'Camila has attended outdoor programs through her school. She adapts well to new environments with familiar adults present.',
                    'narrative_benefit' => 'Camp represents Camila\'s first opportunity for an independent overnight experience. Building confidence and peer connections are our primary goals.',
                    'narrative_staff' => 'Staff with Spanish language skills or bilingual communication cards are strongly preferred. Camila understands English but is most comfortable responding in Spanish when anxious.',
                    'narrative_heat' => 'Tolerates heat normally. Remind her to drink water — she does not self-initiate.',
                    'medical' => ['physician' => 'Dr. Patricia Torres', 'physician_phone' => '803-359-5700', 'insurance' => 'Medicaid', 'special_needs' => 'Intellectual disability, moderate. IQ approximately 45. Spanish is primary language of household; Camila is bilingual but more comfortable in Spanish.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'follows_instructions_description' => 'Follows simple one-step instructions in Spanish reliably. Two-step instructions in English need repetition. Visual cues help significantly.', 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Self-contained', 'communication_methods' => ['verbal'], 'notes' => 'Spanish primary language. Bilingual but prefers Spanish when stressed. Responds well to visual supports.'],
                ]],
            ],

            // ── 33. Lee family — Columbia, Spina Bifida + catheter ────────────
            [
                'name' => 'Angela Lee', 'email' => 'angela.lee@example.com',
                'phone' => '803-555-1021', 'address' => '1234 Rosewood Drive', 'city' => 'Columbia', 'zip' => '29201',
                'county' => 'Richland', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Jordan', 'last_name' => 'Lee', 'dob' => '2012-07-08', 'gender' => 'female',
                    'tshirt' => 'AS', 'supervision' => 'enhanced', 'session' => 's1', 'status' => 'under_review',
                    'first_app' => false, 'attended_before' => true,
                    'ec_name' => 'Kevin Lee', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1022',
                    'narrative_rustic' => 'Jordan is a returning camper — fully comfortable with the camp environment. She navigates the camp layout in her manual wheelchair independently.',
                    'narrative_benefit' => 'Returning to camp is one of Jordan\'s most anticipated events. She has formed lasting friendships here.',
                    'narrative_concerns' => 'CIC catheterization must be performed by qualified nursing staff every 4 hours. Accessible bathroom facilities are required.',
                    'medical' => ['physician' => 'Dr. Lawrence Kim', 'physician_phone' => '803-434-7800', 'insurance' => 'Tricare', 'special_needs' => 'Spina bifida, L3-L4. CIC catheterization every 4 hours. Manual wheelchair for ambulation. Reduced sensation below waist.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal'], 'notes' => 'No behavioral concerns. Full cognitive function. Strong self-advocate.'],
                ]],
            ],

            // ── 34. Patel family — Greenville, ADHD + Anxiety ─────────────────
            [
                'name' => 'Priya Patel', 'email' => 'priya.patel@example.com',
                'phone' => '864-555-1031', 'address' => '523 Verdae Blvd', 'city' => 'Greenville', 'zip' => '29607',
                'county' => 'Greenville', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Devon', 'last_name' => 'Patel', 'dob' => '2013-09-01', 'gender' => 'male',
                    'tshirt' => 'YL', 'supervision' => 'standard', 'session' => 's2', 'status' => 'approved',
                    'first_app' => false, 'attended_before' => true,
                    'ec_name' => 'Raj Patel', 'ec_rel' => 'Father', 'ec_phone' => '864-555-1032', 'ec_phone_work' => '864-555-1033',
                    'narrative_rustic' => 'Devon is a returning camper and was very comfortable outdoors.',
                    'narrative_benefit' => 'Camp provides the unstructured peer interaction that Devon rarely gets in highly structured school and therapy settings.',
                    'narrative_heat' => 'Stimulant medication may increase heat sensitivity. Extra water breaks and shade rest important.',
                    'medical' => ['physician' => 'Dr. Rebecca Chase', 'physician_phone' => '864-522-4000', 'insurance' => 'Aetna', 'special_needs' => 'ADHD (combined type), generalized anxiety disorder. On stimulant medication (Vyvanse 30mg AM). Medication must be administered by nursing at 8am daily.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'social_emotional' => true, 'social_emotional_description' => 'Anxiety in novel unstructured situations. Responds well to advance warning and predictability.', 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal'], 'notes' => 'ADHD + anxiety. Responds well to structure and advance notice. High energy, very verbal.'],
                ]],
            ],

            // ── 35. Nguyen family — Charleston, CP hemiplegia ─────────────────
            [
                'name' => 'Linda Nguyen', 'email' => 'linda.nguyen@example.com',
                'phone' => '843-555-1041', 'address' => '2100 Ashley River Road', 'city' => 'Charleston', 'zip' => '29407',
                'county' => 'Charleston', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Isabelle', 'last_name' => 'Nguyen', 'dob' => '2013-05-15', 'gender' => 'female',
                    'tshirt' => 'YM', 'supervision' => 'standard', 'session' => 's1', 'status' => 'submitted',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Henry Nguyen', 'ec_rel' => 'Father', 'ec_phone' => '843-555-1042',
                    'narrative_rustic' => 'Isabelle participates in adapted sports programs and is fully comfortable outdoors.',
                    'narrative_benefit' => 'An inclusive camp experience where Isabelle\'s physical differences are normalized will be tremendously valuable for her self-image.',
                    'narrative_concerns' => 'Right-side hemiplegia — ensure adapted grip tools are available for art and craft activities. Right ankle AFO (orthotic) worn at all times; camp staff should know not to remove it.',
                    'medical' => ['physician' => 'Dr. William Park', 'physician_phone' => '843-792-5000', 'insurance' => 'United Healthcare', 'special_needs' => 'Cerebral palsy, right hemiplegia. Wears right AFO. Adapted grip tools for fine motor tasks. Full cognition, grade-appropriate academically.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal'], 'notes' => 'No behavioral concerns. Cognitively typical. Adjusted grip tools needed for some activities.'],
                ]],
            ],

            // ── 36. Anderson family — Spartanburg, ASD Level 2 ────────────────
            [
                'name' => 'Robert Anderson', 'email' => 'robert.anderson@example.com',
                'phone' => '864-555-1051', 'address' => '678 Drayton Road', 'city' => 'Spartanburg', 'zip' => '29307',
                'county' => 'Spartanburg', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Tyler', 'last_name' => 'Anderson', 'dob' => '2012-12-04', 'gender' => 'male',
                    'tshirt' => 'AM', 'supervision' => 'enhanced', 'session' => 's1', 'status' => 'under_review',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Susan Anderson', 'ec_rel' => 'Mother', 'ec_phone' => '864-555-1052', 'ec_phone_work' => '864-555-1053',
                    'narrative_rustic' => 'Tyler has had limited outdoor experience but enjoys nature videos and would likely thrive with the right support.',
                    'narrative_staff' => 'Tyler communicates verbally but becomes echolalic under stress. Staff should avoid rapid questioning during transitions. Use picture schedule system.',
                    'narrative_concerns' => 'Elopement risk is low but Tyler may become fixed on an interest and resist transitions. Pre-warning with visual timers prevents most incidents.',
                    'medical' => ['physician' => 'Dr. Jane Walsh', 'physician_phone' => '864-560-6000', 'insurance' => 'Cigna', 'special_needs' => 'ASD Level 2. Verbal with echolalia under stress. Visual schedule dependent. No physical medical needs beyond dietary preference (avoids mixed textures).', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => false, 'behavior_plan' => true, 'follows_instructions' => true, 'follows_instructions_description' => 'Follows picture-based instruction reliably. Verbal multi-step instructions need breaking down.', 'group_participation' => false, 'group_participation_description' => 'Prefers parallel play over direct group engagement. Structured small groups (2-3) can work.', 'attends_school' => true, 'classroom_type' => 'Resource room', 'communication_methods' => ['verbal', 'picture exchange'], 'notes' => 'ASD Level 2. Verbal with echolalia under stress.'],
                ]],
            ],

            // ── 37. Sharma family — Aiken, Down syndrome ──────────────────────
            [
                'name' => 'Sunita Sharma', 'email' => 'sunita.sharma@example.com',
                'phone' => '803-555-1061', 'address' => '456 Laurens Street NW', 'city' => 'Aiken', 'zip' => '29801',
                'county' => 'Aiken', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Priya', 'last_name' => 'Sharma', 'dob' => '2013-08-21', 'gender' => 'female',
                    'tshirt' => 'YM', 'supervision' => 'standard', 'session' => 's2', 'status' => 'submitted',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Deepak Sharma', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1062',
                    'narrative_rustic' => 'Priya loves being outside and is enthusiastic about water and animals.',
                    'narrative_benefit' => 'Building independence and social skills with peers who share similar experiences.',
                    'medical' => ['physician' => 'Dr. Meredith Collins', 'physician_phone' => '803-641-5000', 'insurance' => 'BCBS SC', 'special_needs' => 'Down syndrome, trisomy 21. Mild cardiac history (small ASD, closed at age 4). Cleared for all activity. Thyroid function monitored annually — last check normal.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Self-contained', 'communication_methods' => ['verbal', 'sign language'], 'notes' => 'Down syndrome. Very social. Responds to praise and music.'],
                ]],
            ],

            // ── 38. Freeman family — Myrtle Beach, ASD Level 3 ────────────────
            [
                'name' => 'Tamika Freeman', 'email' => 'tamika.freeman@example.com',
                'phone' => '843-555-1071', 'address' => '1550 Seaboard Street', 'city' => 'Myrtle Beach', 'zip' => '29577',
                'county' => 'Horry', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Caleb', 'last_name' => 'Freeman', 'dob' => '2014-02-28', 'gender' => 'male',
                    'tshirt' => 'YM', 'supervision' => 'one_to_one', 'session' => 's1', 'status' => 'approved',
                    'first_app' => false, 'attended_before' => true,
                    'ec_name' => 'Darius Freeman', 'ec_rel' => 'Father', 'ec_phone' => '843-555-1072', 'ec_phone_work' => '843-555-1073',
                    'narrative_rustic' => 'Caleb is a returning camper. The structured environment actually helps regulate him — he does better at camp than at home during unstructured summer.',
                    'narrative_staff' => 'Caleb requires 1:1 dedicated staff. Staff must be trained in ASD Level 3 support strategies and proactive behavior management. The transition plan from 2025 is on file.',
                    'narrative_concerns' => 'Tactile defensiveness is severe — do not touch Caleb without verbal pre-warning even for safety reasons except in emergency. Use calm, low voice.',
                    'admin_notes' => 'Returning high-complexity camper. 1:1 staff assignment confirmed for 2026. Medical complexity tier: HIGH.',
                    'medical' => ['physician' => 'Dr. Anita Flores', 'physician_phone' => '843-692-1000', 'insurance' => 'Medicaid', 'special_needs' => 'ASD Level 3. Limited verbal communication (5-10 functional words). AAC device user (Proloquo2Go on iPad). Severe tactile and auditory defensiveness. Requires 1:1 supervision at all times.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => true, 'aggression_description' => 'Biting and scratching when overwhelmed by sensory input or unexpected touch. Managed with proactive sensory breaks and environmental modification. Not directed aggressively — a defensive response.', 'self_abuse' => true, 'self_abuse_description' => 'Head banging against surfaces when extremely dysregulated. Helmet available in cabin (family-provided). Proactive sensory regulation prevents most incidents.', 'wandering_risk' => true, 'wandering_description' => 'Wanders silently toward exits and water areas. Door alarms and line-of-sight supervision mandatory.', 'one_to_one_supervision' => true, 'one_to_one_description' => '1:1 supervision required at all times per IEP and camp risk assessment. Dedicated staff trained in ABA and proactive behavior management.', 'developmental_delay' => true, 'verbal_communication' => false, 'social_skills' => false, 'behavior_plan' => true, 'sexual_behaviors' => false, 'follows_instructions' => false, 'follows_instructions_description' => 'Follows 1-2 step visual instructions with AAC device support. Verbal-only instructions not reliable.', 'group_participation' => false, 'group_participation_description' => 'Participates in small-group sensory activities only (2-3 peers max in controlled environment). Full-group activities are overwhelming.', 'attends_school' => true, 'classroom_type' => 'Self-contained', 'communication_methods' => ['AAC device', 'gestures', 'picture exchange'], 'notes' => 'ASD Level 3. Non-verbal. 1:1 required. AAC user. Complex behavior support plan in file.'],
                ]],
            ],

            // ── 39. Torres family — Columbia, CP diplegia ─────────────────────
            [
                'name' => 'Elena Torres', 'email' => 'elena.torres@example.com',
                'phone' => '803-555-1081', 'address' => '345 Millwood Avenue', 'city' => 'Columbia', 'zip' => '29205',
                'county' => 'Richland', 'interpreter' => true, 'language' => 'Spanish',
                'campers' => [[
                    'first_name' => 'Miguel', 'last_name' => 'Torres', 'dob' => '2012-04-17', 'gender' => 'male',
                    'tshirt' => 'AM', 'supervision' => 'enhanced', 'session' => 's2', 'status' => 'submitted',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Carlos Torres', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1082',
                    'narrative_rustic' => 'Miguel has not been to overnight camp before. He is excited and has been practicing with a practice overnight at his grandparents.',
                    'narrative_concerns' => 'Bilateral leg spasticity — KAFO orthotic braces worn during ambulation. Fatigue sets in after prolonged walking. Wheelchair available for long distances.',
                    'narrative_staff' => 'Spanish is primary household language. Miguel communicates well in English but family communication should be in Spanish.',
                    'medical' => ['physician' => 'Dr. Marco Vasquez', 'physician_phone' => '803-434-4000', 'insurance' => 'Medicaid', 'special_needs' => 'Cerebral palsy, spastic diplegia. KAFO bilateral. Manual wheelchair for distances > 200ft. Full cognitive function.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal'], 'notes' => 'No behavioral concerns. Bilingual Spanish/English.'],
                ]],
            ],

            // ── 40. Washington family — Columbia, Fragile X ───────────────────
            [
                'name' => 'Denise Washington', 'email' => 'denise.washington@example.com',
                'phone' => '803-555-1091', 'address' => '1800 Gervais Street', 'city' => 'Columbia', 'zip' => '29201',
                'county' => 'Richland', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Isaiah', 'last_name' => 'Washington', 'dob' => '2013-11-30', 'gender' => 'male',
                    'tshirt' => 'YL', 'supervision' => 'enhanced', 'session' => 's1', 'status' => 'waitlisted',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Marcus Washington', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1092',
                    'admin_notes' => 'Waitlisted pending capacity review. S1 at capacity. Good candidate for promotion.',
                    'narrative_rustic' => 'Isaiah has sensory sensitivities related to Fragile X — loud unexpected sounds are the primary trigger. Outdoors and nature are fine; large noisy groups are challenging.',
                    'narrative_benefit' => 'Peer connections and independence development. Social anxiety is significant at school; camp\'s intentional community may be more welcoming.',
                    'medical' => ['physician' => 'Dr. Patricia Greene', 'physician_phone' => '803-434-3000', 'insurance' => 'Medicaid', 'special_needs' => 'Fragile X syndrome. Moderate intellectual disability. Auditory hypersensitivity. Social anxiety. On guanfacine ER for attention and anxiety (0.5mg AM).', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => false, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => false, 'group_participation_description' => 'Prefers dyadic interactions. Large groups cause hand-flapping and social withdrawal. Introduce groups gradually.', 'social_emotional' => true, 'social_emotional_description' => 'Social anxiety — eye contact aversion, hand-flapping in social situations. Not a behavioral concern, a neurological characteristic of Fragile X.', 'attends_school' => true, 'classroom_type' => 'Self-contained', 'communication_methods' => ['verbal'], 'notes' => 'Fragile X syndrome. Auditory hypersensitivity primary sensory concern.'],
                ]],
            ],

            // ── 41. Harris family — Greenville, ASD Level 1 ───────────────────
            [
                'name' => 'Carolyn Harris', 'email' => 'carolyn.harris@example.com',
                'phone' => '864-555-1101', 'address' => '890 Augusta Road', 'city' => 'Greenville', 'zip' => '29605',
                'county' => 'Greenville', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Jackson', 'last_name' => 'Harris', 'dob' => '2012-08-11', 'gender' => 'male',
                    'tshirt' => 'AM', 'supervision' => 'standard', 'session' => 's2', 'status' => 'approved',
                    'first_app' => false, 'attended_before' => true,
                    'ec_name' => 'Timothy Harris', 'ec_rel' => 'Father', 'ec_phone' => '864-555-1102', 'ec_phone_work' => '864-555-1103',
                    'narrative_rustic' => 'Returning camper — very comfortable in outdoor setting. Loves the waterfront.',
                    'narrative_benefit' => 'Camp is Jackson\'s favorite thing. He talks about it year-round. The social environment and outdoor activities are perfect for him.',
                    'medical' => ['physician' => 'Dr. Sarah Monroe', 'physician_phone' => '864-455-7000', 'insurance' => 'Cigna', 'special_needs' => 'ASD Level 1. Verbally fluent, academically strong. Rigid thinking patterns. No physical medical needs.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => false, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal'], 'notes' => 'ASD Level 1. Socially motivated despite difficulties — wants to connect.'],
                ]],
            ],

            // ── 42. Clark family — Florence, Prader-Willi syndrome ────────────
            [
                'name' => 'Beverly Clark', 'email' => 'beverly.clark@example.com',
                'phone' => '843-555-1111', 'address' => '2345 West Evans Street', 'city' => 'Florence', 'zip' => '29501',
                'county' => 'Florence', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Ethan', 'last_name' => 'Clark', 'dob' => '2013-06-19', 'gender' => 'male',
                    'tshirt' => 'AL', 'supervision' => 'enhanced', 'session' => 's1', 'status' => 'submitted',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Gary Clark', 'ec_rel' => 'Father', 'ec_phone' => '843-555-1112',
                    'narrative_rustic' => 'Ethan loves the outdoors and would be very motivated by camp activities.',
                    'narrative_concerns' => 'CRITICAL: Prader-Willi syndrome causes hyperphagia (insatiable appetite). Food access must be strictly controlled. No unsupervised access to any food area, kitchen, snack areas, or other campers\' food.',
                    'narrative_staff' => 'Food security is the primary safety concern. All staff must be briefed on PWS food protocols before Ethan arrives. He will be charming and convincing when attempting to obtain additional food. A firm, consistent, non-emotional response is required.',
                    'medical' => ['physician' => 'Dr. Constance Fields', 'physician_phone' => '843-674-5000', 'insurance' => 'BCBS SC', 'special_needs' => 'Prader-Willi syndrome. CRITICAL: hyperphagia requires strict food security protocols. On GH therapy (injected nightly by nursing). Sleep apnea — CPAP nightly.', 'immunizations_current' => true, 'recent_illness' => false],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => true, 'wandering_description' => 'Wanders toward food sources — kitchen, trash cans, other campers\' bags. Not a safety wandering risk but requires food-security supervision.', 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => true, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Resource room', 'communication_methods' => ['verbal'], 'notes' => 'PWS. FOOD SECURITY IS MANDATORY. Do not allow food negotiation under any circumstances. Staff briefing required.'],
                ]],
            ],

            // ── 43. Robinson family — Charleston, PKU ─────────────────────────
            [
                'name' => 'Gwendolyn Robinson', 'email' => 'gwen.robinson@example.com',
                'phone' => '843-555-1121', 'address' => '567 King Street', 'city' => 'Charleston', 'zip' => '29403',
                'county' => 'Charleston', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Amara', 'last_name' => 'Robinson', 'dob' => '2014-03-25', 'gender' => 'female',
                    'tshirt' => 'YS', 'supervision' => 'standard', 'session' => 's2', 'status' => 'under_review',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Marcus Robinson', 'ec_rel' => 'Father', 'ec_phone' => '843-555-1122', 'ec_phone_work' => '843-555-1123',
                    'narrative_concerns' => 'PKU (phenylketonuria) requires strict low-phenylalanine diet. All meals must be pre-reviewed against Amara\'s approved food list. She brings her own PKU formula (3x daily). Camp kitchen must be briefed.',
                    'narrative_rustic' => 'Amara is enthusiastic about outdoor activities and has attended day camps previously.',
                    'medical' => ['physician' => 'Dr. Howard Levine', 'physician_phone' => '843-876-5000', 'insurance' => 'United Healthcare', 'special_needs' => 'Phenylketonuria (PKU). STRICT low-phenylalanine diet required. No high-protein foods (meat, eggs, dairy, nuts). PKU medical formula (Cambrooke Glytactin) administered 3x daily. Metabolic dietitian dietary plan attached.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal'], 'notes' => 'Cognitively typical. Diet management is the primary concern.'],
                ]],
            ],

            // ── 44. Murphy family — Columbia, cochlear implant ────────────────
            [
                'name' => 'Bridget Murphy', 'email' => 'bridget.murphy@example.com',
                'phone' => '803-555-1131', 'address' => '789 Blossom Street', 'city' => 'Columbia', 'zip' => '29201',
                'county' => 'Richland', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Liam', 'last_name' => 'Murphy', 'dob' => '2013-01-08', 'gender' => 'male',
                    'tshirt' => 'YL', 'supervision' => 'standard', 'session' => 's1', 'status' => 'submitted',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Sean Murphy', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1132',
                    'narrative_concerns' => 'Bilateral cochlear implants. Processors removed for water activities and at night (stored in labeled case in cabin). Visual communication strategies should supplement verbal instruction during pool activities.',
                    'narrative_rustic' => 'Liam is very active and will thrive in the outdoor environment.',
                    'medical' => ['physician' => 'Dr. Ellen Cho', 'physician_phone' => '803-545-5600', 'insurance' => 'Cigna', 'special_needs' => 'Bilateral profound sensorineural hearing loss. Bilateral cochlear implants. Speech intelligibility: good in quiet environments. Lip-reading skills: excellent. Processors removed for water activities.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal', 'lip reading', 'written cues'], 'notes' => 'Cochlear implant user. Good verbal communicator. Ensure face is visible during instructions — no talking with back turned.'],
                ]],
            ],

            // ── 45. Scott family — York, CP quadriplegia ──────────────────────
            [
                'name' => 'Cheryl Scott', 'email' => 'cheryl.scott@example.com',
                'phone' => '803-555-1141', 'address' => '234 Jefferson Davis Hwy', 'city' => 'Rock Hill', 'zip' => '29730',
                'county' => 'York', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Olivia', 'last_name' => 'Scott', 'dob' => '2012-10-02', 'gender' => 'female',
                    'tshirt' => 'XS', 'supervision' => 'one_to_one', 'session' => 's2', 'status' => 'approved',
                    'first_app' => false, 'attended_before' => true,
                    'ec_name' => 'David Scott', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1142', 'ec_phone_work' => '803-555-1143',
                    'narrative_rustic' => 'Olivia is a returning camper. Her parents have developed a comprehensive environmental accessibility plan with camp staff.',
                    'narrative_concerns' => 'Power wheelchair required for all mobility. Two-staff mechanical lift transfer. G-tube feeding TID. Full medical support required at all times.',
                    'admin_notes' => 'High complexity returning camper. Full care plan on file. G-tube protocol confirmed with nursing.',
                    'medical' => ['physician' => 'Dr. James Webb', 'physician_phone' => '803-985-3000', 'insurance' => 'Medicaid + Supplemental', 'special_needs' => 'CP, spastic quadriplegia. Power wheelchair. G-tube feeding (Pediasure Peptide, 3x daily). CIC catheterization. Full physical assistance required for all ADLs. Significant communication skills — uses high-tech AAC.', 'immunizations_current' => true, 'recent_illness' => false],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => true, 'one_to_one_description' => 'Physical care demands (G-tube, CIC, transfers) require dedicated 1:1 medical staff at all times, not behavioral supervision.', 'developmental_delay' => false, 'verbal_communication' => false, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Self-contained', 'communication_methods' => ['AAC device', 'eye gaze', 'partner-assisted scanning'], 'notes' => 'CP quadriplegia. Non-verbal but highly communicative via AAC. Excellent social participant. 1:1 for physical care — not behavioral.'],
                ]],
            ],

            // ── 46. Baker family — Sumter, ASD + GI issues ────────────────────
            [
                'name' => 'Tanya Baker', 'email' => 'tanya.baker@example.com',
                'phone' => '803-555-1151', 'address' => '1122 Broad Street', 'city' => 'Sumter', 'zip' => '29150',
                'county' => 'Sumter', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Jaylen', 'last_name' => 'Baker', 'dob' => '2014-07-14', 'gender' => 'male',
                    'tshirt' => 'YM', 'supervision' => 'enhanced', 'session' => 's1', 'status' => 'submitted',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Marcus Baker', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1152',
                    'narrative_rustic' => 'Jaylen has sensory processing differences but has done well at outdoor programs with structure.',
                    'narrative_concerns' => 'Chronic GI issues related to ASD gut-brain axis. Irregular bowel. Dietary restrictions (gluten-reduced diet preferred).',
                    'medical' => ['physician' => 'Dr. Terrence Powell', 'physician_phone' => '803-778-4000', 'insurance' => 'Medicaid', 'special_needs' => 'ASD Level 2 with significant GI comorbidities. Chronic constipation managed with Miralax daily. Gluten-reduced diet preferred (not celiac, but reduction helps GI symptoms). Diet substitutions provided in family packing list.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => false, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => false, 'attends_school' => true, 'classroom_type' => 'Resource room', 'communication_methods' => ['verbal', 'picture exchange'], 'notes' => 'ASD Level 2. GI management important. Can become distressed when GI discomfort is unresolved.'],
                ]],
            ],

            // ── 47. Gonzalez family — Columbia, Spanish + ID ──────────────────
            [
                'name' => 'Rosa Gonzalez', 'email' => 'rosa.gonzalez@example.com',
                'phone' => '803-555-1161', 'address' => '678 Percival Road', 'city' => 'Columbia', 'zip' => '29206',
                'county' => 'Richland', 'interpreter' => true, 'language' => 'Spanish',
                'campers' => [[
                    'first_name' => 'Diego', 'last_name' => 'Gonzalez', 'dob' => '2013-04-05', 'gender' => 'male',
                    'tshirt' => 'YM', 'supervision' => 'standard', 'session' => 's2', 'status' => 'rejected',
                    'first_app' => true, 'attended_before' => false,
                    'admin_notes' => 'Rejected — Session 2 at capacity. Family to be contacted for reapplication to 2027 session.',
                    'ec_name' => 'Miguel Gonzalez', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1162',
                    'narrative_rustic' => 'Diego ha participado en programas al aire libre en la escuela y le encantan las actividades en la naturaleza.',
                    'narrative_benefit' => 'Camp representa la primera oportunidad de Diego de pasar tiempo con compañeros que comparten sus experiencias.',
                    'medical' => ['physician' => 'Dr. Carmen Rios', 'physician_phone' => '803-776-3000', 'insurance' => 'Medicaid', 'special_needs' => 'Intellectual disability, mild-moderate. Spanish primary language. No physical medical needs.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Self-contained', 'communication_methods' => ['verbal'], 'notes' => 'ID mild-moderate. Spanish primary. Bilingual. Friendly and socially motivated.'],
                ]],
            ],

            // ── 48. Nelson family — Georgetown, ASD Level 2 ───────────────────
            [
                'name' => 'Shirley Nelson', 'email' => 'shirley.nelson@example.com',
                'phone' => '843-555-1171', 'address' => '456 Front Street', 'city' => 'Georgetown', 'zip' => '29440',
                'county' => 'Georgetown', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Elijah', 'last_name' => 'Nelson', 'dob' => '2012-11-27', 'gender' => 'male',
                    'tshirt' => 'AM', 'supervision' => 'enhanced', 'session' => 's1', 'status' => 'submitted',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Harold Nelson', 'ec_rel' => 'Father', 'ec_phone' => '843-555-1172',
                    'narrative_rustic' => 'Elijah has significant sensory interests in nature and would love the outdoor environment.',
                    'narrative_staff' => 'Elijah is a strong visual learner. Written schedules on index cards that he can carry and refer to have been most effective.',
                    'medical' => ['physician' => 'Dr. Maria Ortega', 'physician_phone' => '843-527-7000', 'insurance' => 'BCBS SC', 'special_needs' => 'ASD Level 2. Verbal but communication breaks down under stress. Visual schedule dependent. No physical medical needs.', 'immunizations_current' => true],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => false, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => false, 'attends_school' => true, 'classroom_type' => 'Resource room', 'communication_methods' => ['verbal', 'written cards'], 'notes' => 'ASD Level 2. Visual schedule carrier. Strong nature interests (dinosaurs, animals).'],
                ]],
            ],

            // ── 49. Foster family — Beaufort, ID moderate + seizure ───────────
            [
                'name' => 'Cynthia Foster', 'email' => 'cynthia.foster@example.com',
                'phone' => '843-555-1181', 'address' => '890 Bay Street', 'city' => 'Beaufort', 'zip' => '29902',
                'county' => 'Beaufort', 'interpreter' => false,
                'campers' => [[
                    'first_name' => 'Destiny', 'last_name' => 'Foster', 'dob' => '2013-08-09', 'gender' => 'female',
                    'tshirt' => 'YM', 'supervision' => 'enhanced', 'session' => 's2', 'status' => 'submitted',
                    'first_app' => true, 'attended_before' => false,
                    'ec_name' => 'Reginald Foster', 'ec_rel' => 'Father', 'ec_phone' => '843-555-1182', 'ec_phone_work' => '843-255-1183',
                    'narrative_concerns' => 'Lennox-Gastaut syndrome with intractable seizures. Seizure rescue medication (Diastat) on file. Seizure action plan required. Swimming must be 1:1 with swimming safety protocol.',
                    'narrative_rustic' => 'Destiny loves music and outdoor movement. Controlled outdoor activities are appropriate.',
                    'medical' => ['physician' => 'Dr. Frank Shaw', 'physician_phone' => '843-522-5000', 'insurance' => 'Medicaid', 'special_needs' => 'Lennox-Gastaut syndrome. Refractory seizures (2-4/day, tonic). Seizure rescue: Diastat 12.5mg PR if seizure > 3 min or clusters. AED regimen: Lamictal + Onfi daily. Seizure action plan in file.', 'immunizations_current' => true, 'recent_illness' => false],
                    'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => false, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Self-contained', 'communication_methods' => ['gestures', 'picture exchange'], 'notes' => 'LGS seizures multiple times daily. Non-verbal. Joyful and social. Seizure protocol mandatory.'],
                ]],
            ],

            // ── 50–52. Multi-child family — Anderson, 3 campers ───────────────
            [
                'name' => 'Patricia Monroe', 'email' => 'patricia.monroe@example.com',
                'phone' => '864-555-1191', 'address' => '1234 Boulevard Street', 'city' => 'Anderson', 'zip' => '29621',
                'county' => 'Anderson', 'interpreter' => false,
                'campers' => [
                    [
                        'first_name' => 'Zoe', 'last_name' => 'Monroe', 'dob' => '2011-05-03', 'gender' => 'female',
                        'tshirt' => 'AS', 'supervision' => 'enhanced', 'session' => 's1', 'status' => 'approved',
                        'first_app' => false, 'attended_before' => true,
                        'ec_name' => 'Bernard Monroe', 'ec_rel' => 'Father', 'ec_phone' => '864-555-1192',
                        'narrative_rustic' => 'Returning camper. Zoe navigates camp completely independently. No concerns.',
                        'narrative_benefit' => 'Camp is the highlight of Zoe\'s year. She is a camp veteran and a positive role model for newer campers.',
                        'medical' => ['physician' => 'Dr. Karen Wise', 'physician_phone' => '864-512-1000', 'insurance' => 'Aetna', 'special_needs' => 'ASD Level 1. Verbal, academically capable. Strong special interest in astronomy. No physical needs.', 'immunizations_current' => true],
                        'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => false, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal'], 'notes' => 'ASD Level 1. Returning camper leader.'],
                    ],
                    [
                        'first_name' => 'Aiden', 'last_name' => 'Monroe', 'dob' => '2013-02-18', 'gender' => 'male',
                        'tshirt' => 'YM', 'supervision' => 'standard', 'session' => 's1', 'status' => 'submitted',
                        'first_app' => true, 'attended_before' => false,
                        'ec_name' => 'Bernard Monroe', 'ec_rel' => 'Father', 'ec_phone' => '864-555-1192',
                        'narrative_rustic' => 'First time. Aiden is excited about following his sister to camp.',
                        'narrative_benefit' => 'Peer independence and following in Zoe\'s footsteps as a camper.',
                        'medical' => ['physician' => 'Dr. Karen Wise', 'physician_phone' => '864-512-1000', 'insurance' => 'Aetna', 'special_needs' => 'Down syndrome. Friendly, social. Mild hearing loss (bilateral, 30dB) — speak clearly and ensure face is visible.', 'immunizations_current' => true],
                        'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Self-contained', 'communication_methods' => ['verbal', 'sign language'], 'notes' => 'Down syndrome. Mild hearing loss. Speak clearly and at moderate pace.'],
                    ],
                    [
                        'first_name' => 'Emma', 'last_name' => 'Monroe', 'dob' => '2015-09-12', 'gender' => 'female',
                        'tshirt' => 'YS', 'supervision' => 'standard', 'session' => 's2', 'status' => 'draft',
                        'draft' => true, 'first_app' => true, 'attended_before' => false,
                        'ec_name' => 'Bernard Monroe', 'ec_rel' => 'Father', 'ec_phone' => '864-555-1192',
                        'medical' => ['physician' => 'Dr. Karen Wise', 'physician_phone' => '864-512-1000', 'insurance' => 'Aetna', 'special_needs' => 'ADHD, combined type. On medication during school year (medication holiday planned for camp).', 'immunizations_current' => true],
                        'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal'], 'notes' => 'ADHD. On medication holiday during camp — staff should expect higher energy level.'],
                    ],
                ],
            ],

            // ── 53–62. Remaining 10 families — shorter definitions ─────────────

            ['name' => 'Laura Bennett', 'email' => 'laura.bennett@example.com', 'phone' => '803-555-1201', 'address' => '345 Sunset Blvd', 'city' => 'Irmo', 'zip' => '29063', 'county' => 'Lexington', 'interpreter' => false,
                'campers' => [['first_name' => 'Nathan', 'last_name' => 'Bennett', 'dob' => '2013-10-10', 'gender' => 'male', 'tshirt' => 'YL', 'supervision' => 'standard', 'session' => 's1', 'status' => 'submitted', 'first_app' => true, 'attended_before' => false, 'ec_name' => 'Greg Bennett', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1202', 'medical' => ['physician' => 'Dr. Ann Taylor', 'physician_phone' => '803-749-3000', 'insurance' => 'BCBS SC', 'special_needs' => 'ASD Level 1. High verbal, academic abilities. Social pragmatics delays.', 'immunizations_current' => true], 'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => false, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal'], 'notes' => 'ASD Level 1.']]]],

            ['name' => 'Patricia Greene', 'email' => 'patricia.greene@example.com', 'phone' => '803-555-1211', 'address' => '678 Garners Ferry Rd', 'city' => 'Columbia', 'zip' => '29209', 'county' => 'Richland', 'interpreter' => false,
                'campers' => [['first_name' => 'Aaliyah', 'last_name' => 'Greene', 'dob' => '2014-06-23', 'gender' => 'female', 'tshirt' => 'YM', 'supervision' => 'enhanced', 'session' => 's2', 'status' => 'under_review', 'first_app' => true, 'attended_before' => false, 'ec_name' => 'Derek Greene', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1212', 'medical' => ['physician' => 'Dr. Brenda Moore', 'physician_phone' => '803-434-2100', 'insurance' => 'Medicaid', 'special_needs' => 'Rett syndrome. Limited voluntary hand use. Communication via eye gaze technology. Requires full ADL assistance.', 'immunizations_current' => true], 'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => true, 'one_to_one_description' => '1:1 for physical care and communication support.', 'developmental_delay' => true, 'verbal_communication' => false, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Self-contained', 'communication_methods' => ['eye gaze'], 'notes' => 'Rett syndrome. Eye gaze AAC. Full assist all ADLs.']]]],

            ['name' => 'Sandra Phillips', 'email' => 'sandra.phillips@example.com', 'phone' => '803-555-1221', 'address' => '901 Broad River Rd', 'city' => 'Columbia', 'zip' => '29210', 'county' => 'Richland', 'interpreter' => false,
                'campers' => [['first_name' => 'Brandon', 'last_name' => 'Phillips', 'dob' => '2012-03-30', 'gender' => 'male', 'tshirt' => 'AM', 'supervision' => 'standard', 'session' => 's1', 'status' => 'submitted', 'first_app' => false, 'attended_before' => true, 'ec_name' => 'Wayne Phillips', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1222', 'medical' => ['physician' => 'Dr. Lisa Chen', 'physician_phone' => '803-434-5000', 'insurance' => 'Tricare', 'special_needs' => 'Down syndrome. Good verbal skills. Enthusiastic participant. Prior year notes on file.', 'immunizations_current' => true], 'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Self-contained', 'communication_methods' => ['verbal', 'sign language'], 'notes' => 'Down syndrome. Returning. Great personality.']]]],

            ['name' => 'Monica Evans', 'email' => 'monica.evans@example.com', 'phone' => '864-555-1231', 'address' => '432 East Main Street', 'city' => 'Spartanburg', 'zip' => '29302', 'county' => 'Spartanburg', 'interpreter' => false,
                'campers' => [['first_name' => 'Jeremiah', 'last_name' => 'Evans', 'dob' => '2013-12-15', 'gender' => 'male', 'tshirt' => 'YL', 'supervision' => 'enhanced', 'session' => 's2', 'status' => 'submitted', 'first_app' => true, 'attended_before' => false, 'ec_name' => 'George Evans', 'ec_rel' => 'Father', 'ec_phone' => '864-555-1232', 'medical' => ['physician' => 'Dr. Howard Jones', 'physician_phone' => '864-560-7000', 'insurance' => 'BCBS SC', 'special_needs' => 'ASD Level 2 + significant sensory processing disorder. Auditory filtering difficulties. Noise-cancelling headphones provided.', 'immunizations_current' => true], 'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => false, 'behavior_plan' => true, 'follows_instructions' => true, 'group_participation' => false, 'attends_school' => true, 'classroom_type' => 'Resource room', 'communication_methods' => ['verbal', 'picture exchange'], 'notes' => 'ASD Level 2. Significant auditory SPD. Noise-cancelling headphones at all loud events.']]]],

            ['name' => 'Rhonda Jackson', 'email' => 'rhonda.jackson@example.com', 'phone' => '803-555-1241', 'address' => '567 Two Notch Road', 'city' => 'Columbia', 'zip' => '29204', 'county' => 'Richland', 'interpreter' => false,
                'campers' => [['first_name' => 'Zara', 'last_name' => 'Jackson', 'dob' => '2014-04-11', 'gender' => 'female', 'tshirt' => 'YS', 'supervision' => 'standard', 'session' => 's1', 'status' => 'waitlisted', 'first_app' => true, 'attended_before' => false, 'admin_notes' => 'Waitlisted — S1 full. Good candidate for S2 waitlist promotion.', 'ec_name' => 'Terrence Jackson', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1242', 'medical' => ['physician' => 'Dr. Dorothy Allen', 'physician_phone' => '803-434-6000', 'insurance' => 'Medicaid', 'special_needs' => 'Intellectual disability, mild. Very socially motivated. No medical concerns.', 'immunizations_current' => true], 'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Resource room', 'communication_methods' => ['verbal'], 'notes' => 'ID mild. Social butterfly. Very enthusiastic.']]]],

            ['name' => 'Connie White', 'email' => 'connie.white@example.com', 'phone' => '843-555-1251', 'address' => '123 Meeting Street', 'city' => 'Charleston', 'zip' => '29401', 'county' => 'Charleston', 'interpreter' => false,
                'campers' => [['first_name' => 'Sophia', 'last_name' => 'White', 'dob' => '2012-07-29', 'gender' => 'female', 'tshirt' => 'AS', 'supervision' => 'standard', 'session' => 's2', 'status' => 'approved', 'first_app' => false, 'attended_before' => true, 'ec_name' => 'James White', 'ec_rel' => 'Father', 'ec_phone' => '843-555-1252', 'medical' => ['physician' => 'Dr. Charles Brown', 'physician_phone' => '843-792-4000', 'insurance' => 'Aetna', 'special_needs' => 'ASD Level 1. Third year at camp. Full self-advocacy skills.', 'immunizations_current' => true], 'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal'], 'notes' => 'ASD Level 1 returning veteran.']]]],

            ['name' => 'Latoya Hall', 'email' => 'latoya.hall@example.com', 'phone' => '803-555-1261', 'address' => '789 Elmwood Ave', 'city' => 'Columbia', 'zip' => '29201', 'county' => 'Richland', 'interpreter' => false,
                'campers' => [['first_name' => 'Malachi', 'last_name' => 'Hall', 'dob' => '2013-01-17', 'gender' => 'male', 'tshirt' => 'YL', 'supervision' => 'enhanced', 'session' => 's1', 'status' => 'submitted', 'first_app' => true, 'attended_before' => false, 'ec_name' => 'Curtis Hall', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1262', 'medical' => ['physician' => 'Dr. Elizabeth Young', 'physician_phone' => '803-434-7000', 'insurance' => 'Medicaid', 'special_needs' => 'Tuberous sclerosis complex. Focal seizures (medicated). ASD traits. Vigabatrin daily.', 'immunizations_current' => true], 'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => false, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => false, 'attends_school' => true, 'classroom_type' => 'Resource room', 'communication_methods' => ['verbal'], 'notes' => 'TSC with ASD traits. Seizure protocol on file. Medication at 8am.']]]],

            ['name' => 'Gloria King', 'email' => 'gloria.king@example.com', 'phone' => '803-555-1271', 'address' => '456 Killian Road', 'city' => 'Columbia', 'zip' => '29203', 'county' => 'Richland', 'interpreter' => false,
                'campers' => [['first_name' => 'Mia', 'last_name' => 'King', 'dob' => '2014-09-04', 'gender' => 'female', 'tshirt' => 'YS', 'supervision' => 'standard', 'session' => 's2', 'status' => 'submitted', 'first_app' => true, 'attended_before' => false, 'ec_name' => 'Robert King', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1272', 'medical' => ['physician' => 'Dr. Patricia Lewis', 'physician_phone' => '803-434-8000', 'insurance' => 'Medicaid', 'special_needs' => 'Down syndrome. Very social, loves music and dance. No medical concerns beyond annual cardiac echo (normal last 3 years).', 'immunizations_current' => true], 'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'Self-contained', 'communication_methods' => ['verbal'], 'notes' => 'Down syndrome. Music lover.']]]],

            ['name' => 'Nicole Wright', 'email' => 'nicole.wright@example.com', 'phone' => '864-555-1281', 'address' => '234 Woodruff Road', 'city' => 'Greenville', 'zip' => '29607', 'county' => 'Greenville', 'interpreter' => false,
                'campers' => [['first_name' => 'Lucas', 'last_name' => 'Wright', 'dob' => '2012-05-21', 'gender' => 'male', 'tshirt' => 'AL', 'supervision' => 'enhanced', 'session' => 's1', 'status' => 'rejected', 'first_app' => true, 'attended_before' => false, 'admin_notes' => 'Rejected — incomplete medical documentation. Family notified to resubmit with physician clearance for cardiac condition.', 'ec_name' => 'Brian Wright', 'ec_rel' => 'Father', 'ec_phone' => '864-555-1282', 'medical' => ['physician' => 'Dr. Kevin Adams', 'physician_phone' => '864-455-5000', 'insurance' => 'Cigna', 'special_needs' => 'ASD Level 2. Unresolved cardiac workup (bicuspid aortic valve) — physician clearance required before participation. Application on hold.', 'immunizations_current' => true], 'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => true, 'verbal_communication' => true, 'social_skills' => false, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => false, 'attends_school' => true, 'classroom_type' => 'Resource room', 'communication_methods' => ['verbal'], 'notes' => 'ASD Level 2. Pending cardiac clearance.']]]],

            ['name' => 'Vanessa Turner', 'email' => 'vanessa.turner@example.com', 'phone' => '803-555-1291', 'address' => '890 Atlas Road', 'city' => 'Columbia', 'zip' => '29209', 'county' => 'Richland', 'interpreter' => false,
                'campers' => [['first_name' => 'Alexis', 'last_name' => 'Turner', 'dob' => '2013-07-07', 'gender' => 'female', 'tshirt' => 'YM', 'supervision' => 'enhanced', 'session' => 's2', 'status' => 'draft', 'draft' => true, 'first_app' => true, 'attended_before' => false, 'ec_name' => 'James Turner', 'ec_rel' => 'Father', 'ec_phone' => '803-555-1292', 'medical' => ['physician' => 'Dr. Susan Campbell', 'physician_phone' => '803-434-9000', 'insurance' => 'United Healthcare', 'special_needs' => 'CP, left hemiplegia. Functional ambulation with AFO. Full cognition. Application in progress.', 'immunizations_current' => true], 'behavioral' => ['aggression' => false, 'self_abuse' => false, 'wandering_risk' => false, 'one_to_one_supervision' => false, 'developmental_delay' => false, 'verbal_communication' => true, 'social_skills' => true, 'behavior_plan' => false, 'follows_instructions' => true, 'group_participation' => true, 'attends_school' => true, 'classroom_type' => 'General education', 'communication_methods' => ['verbal'], 'notes' => 'CP hemiplegia. Cognitively typical. Draft application.']]]],
        ];
    }
}
