<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\BehavioralProfile;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\EmergencyContact;
use App\Models\MedicalRecord;
use Illuminate\Database\Seeder;

/**
 * FormParitySeeder — populates all new form parity fields on existing records.
 *
 * This seeder runs AFTER FamilySeeder, ApplicationSeeder, MedicalSeeder, and
 * CamperProfileSeeder. It is a non-destructive update layer: it only fills
 * in new columns that previous seeders were written before these fields existed.
 *
 * Fields populated:
 *
 *   Camper:
 *     applicant_address, applicant_city, applicant_state, applicant_zip
 *
 *   EmergencyContact:
 *     phone_work, primary_language, interpreter_needed
 *
 *   BehavioralProfile:
 *     sexual_behaviors, interpersonal_behavior, social_emotional,
 *     follows_instructions, group_participation, attends_school, classroom_type,
 *     aggression_description, self_abuse_description, wandering_description,
 *     one_to_one_description, follows_instructions_description,
 *     group_participation_description, social_emotional_description,
 *     interpersonal_behavior_description
 *
 *   Application:
 *     narrative_rustic_environment, narrative_staff_suggestions,
 *     narrative_participation_concerns, narrative_camp_benefit,
 *     narrative_heat_tolerance, narrative_transportation,
 *     narrative_additional_info, narrative_emergency_protocols,
 *     first_application, attended_before, camp_session_id_second
 *
 *   MedicalRecord:
 *     tubes_in_ears, has_contagious_illness, contagious_illness_description,
 *     has_recent_illness, recent_illness_description
 *
 * Safe to re-run — uses whereNull() guards on most sections. BehavioralProfile
 * patches use fill()->save() (always idempotent; data is deterministic per camper).
 * Medical record patches use whereNull('tubes_in_ears') as guard.
 * Application narrative patches use whereNull('narrative_rustic_environment') as guard.
 */
class FormParitySeeder extends Seeder
{
    public function run(): void
    {
        $this->patchCamperAddresses();
        $this->patchEmergencyContactLanguages();
        $this->patchBehavioralProfiles();
        $this->patchApplicationNarratives();
        $this->patchMedicalRecordHealthFlags();
        $this->command->line('  Form parity fields backfilled on all core campers.');
    }

    // ─── Camper applicant mailing addresses ───────────────────────────────────

    private function patchCamperAddresses(): void
    {
        $patches = [
            // Addresses may differ from guardian address — field captures the camper's household
            'Ethan Johnson' => ['2847 Devine Street',     'Columbia',    'SC', '29205'],
            'Lily Johnson' => ['2847 Devine Street',     'Columbia',    'SC', '29205'],
            'Sofia Martinez' => ['518 Henderson Street',   'Sumter',      'SC', '29150'],
            'Noah Thompson' => ['3920 Forest Drive',      'Orangeburg',  'SC', '29115'],
            'Ava Williams' => ['741 Belfair Oaks Blvd',  'Bluffton',    'SC', '29910'],
            'Lucas Williams' => ['741 Belfair Oaks Blvd',  'Bluffton',    'SC', '29910'],
            'Mia Davis' => ['112 Old Chapin Road',    'Lexington',   'SC', '29072'],
            'Tyler Wilson' => ['6200 Garners Ferry Rd',  'Columbia',    'SC', '29209'],
            'Henry Carter' => ['882 Main Street',        'Greenwood',   'SC', '29646'],
            'Olivia Robinson' => ['301 Ashley Hall Road',   'Charleston',  'SC', '29407'],
        ];

        foreach ($patches as $fullName => $addr) {
            [$first, $last] = explode(' ', $fullName, 2);
            // Use model instance so the 'encrypted' cast on applicant_address fires on write.
            $camper = Camper::where('first_name', $first)
                ->where('last_name', $last)
                ->whereNull('applicant_address')
                ->first();
            if ($camper) {
                $camper->fill([
                    'applicant_address' => $addr[0],
                    'applicant_city' => $addr[1],
                    'applicant_state' => $addr[2],
                    'applicant_zip' => $addr[3],
                ])->save();
            }
        }
    }

    // ─── Emergency contact phone_work + language ──────────────────────────────

    private function patchEmergencyContactLanguages(): void
    {
        // Martinez family — Spanish primary language, interpreter needed
        $this->patchEc('Sofia Martinez', 'Carlos Martinez', [
            'phone_work' => '803-555-0134',
            'primary_language' => 'Spanish',
            'interpreter_needed' => true,
        ]);
        $this->patchEc('Sofia Martinez', 'Rosa Martinez', [
            'primary_language' => 'Spanish',
            'interpreter_needed' => true,
        ]);

        // Johnson family — standard English, work phone added
        $this->patchEc('Ethan Johnson', 'Robert Johnson', [
            'phone_work' => '803-555-0125',
        ]);

        // Thompson — grandmother work phone
        $this->patchEc('Noah Thompson', 'Margaret Thompson', [
            'phone_work' => '803-555-0143',
        ]);

        // Williams — work phone for emergency contact
        $this->patchEc('Lucas Williams', 'Michelle Williams', [
            'phone_work' => '843-555-0192',
        ]);
    }

    private function patchEc(string $camperFullName, string $ecName, array $data): void
    {
        [$first, $last] = explode(' ', $camperFullName, 2);
        $camper = Camper::where('first_name', $first)->where('last_name', $last)->first();
        if (! $camper) {
            return;
        }
        // Use model instance so the 'encrypted' cast on phone_work (and other EC PHI fields) fires on write.
        $contact = EmergencyContact::where('camper_id', $camper->id)
            ->where('name', $ecName)
            ->first();
        if ($contact) {
            $contact->fill($data)->save();
        }
    }

    // ─── Behavioral profile new flags + descriptions ──────────────────────────

    private function patchBehavioralProfiles(): void
    {
        $patches = [

            'Ethan Johnson' => [
                // Follows instructions well with picture schedule supports
                'follows_instructions' => true,
                'follows_instructions_description' => 'Follows multi-step instructions reliably when they are presented as a visual task list or picture schedule. Verbal-only instructions need to be given one step at a time and may need repetition. Ethan complies without resistance when instructions are clear and expectations are pre-established.',
                // Participates in groups with a preferred peer or small structured setting
                'group_participation' => true,
                'group_participation_description' => 'Participates in structured group activities (2–4 campers) with high success. Large unstructured groups (>8 people) cause sensory overload — redirect to smaller subgroup. Peer buddy system strongly recommended.',
                // No interpersonal behavior concerns
                'interpersonal_behavior' => false,
                'sexual_behaviors' => false,
                'social_emotional' => true,
                'social_emotional_description' => 'Anxiety spikes during unplanned transitions or sensory-loud environments (dining hall at peak volume, outdoor events with PA). Provide advance warning. Sensory break corner available in cabin. Self-regulates with stimming behaviors — do not restrict unless safety concern.',
                // School
                'attends_school' => true,
                'classroom_type' => 'Resource room',
            ],

            'Noah Thompson' => [
                'wandering_risk' => true,
                'wandering_description' => 'Noah wanders toward novel stimuli without awareness of environmental boundaries (waterfront, road edges, neighboring activity areas). Elopement distance has been up to 200ft before staff noticed in past camp setting. Line-of-sight supervision is MANDATORY during any outdoor transitions. Wanders quietly — does not call out.',
                'follows_instructions' => false,
                'follows_instructions_description' => 'Noah understands simple one-step verbal instructions reliably. Two-step instructions require sign language support and visual confirmation. Complex multi-step verbal-only instructions are typically not followed. Pair all instructions with a gesture or sign.',
                'group_participation' => true,
                'group_participation_description' => 'Enthusiastic group participant. Thrives in high-energy group activities. May become overstimulated — watch for increased vocal volume as early sign. Time-out strategy: redirect to quiet buddy walk.',
                'interpersonal_behavior' => false,
                'sexual_behaviors' => false,
                'social_emotional' => false,
                'attends_school' => true,
                'classroom_type' => 'Self-contained',
            ],

            'Sofia Martinez' => [
                // No behavioral concerns — full cognition, self-advocates
                'interpersonal_behavior' => false,
                'sexual_behaviors' => false,
                'social_emotional' => false,
                'follows_instructions' => true,
                'follows_instructions_description' => 'Follows all instructions independently. Advocates for herself when instructions conflict with her care needs or preferences. This is a strength — staff should listen when Sofia raises concerns.',
                'group_participation' => true,
                'group_participation_description' => 'Full group participant with physical accessibility accommodations. Will need accessible seating/positioning at activity stations. Participates at or above peer level cognitively.',
                'attends_school' => true,
                'classroom_type' => 'General education',
            ],

            'Lucas Williams' => [
                'interpersonal_behavior' => false,
                'sexual_behaviors' => false,
                'social_emotional' => true,
                'social_emotional_description' => 'Lucas experiences periodic grief and frustration related to disease progression. He may have moments of sadness or withdrawal, particularly when physical limitations prevent participation in activities his peers can do. Approach with empathy; do not minimize or over-correct. Inclusive programming and peer mentoring strongly recommended. Camp counselor has been briefed.',
                'follows_instructions' => true,
                'follows_instructions_description' => 'Fully independent in following instructions. Mature and self-directed. Communicates any concerns or needs clearly.',
                'group_participation' => true,
                'group_participation_description' => 'Participates in all group activities with physical accessibility accommodations. Power wheelchair must be accessible at all activity stations. High intellectual engagement; may take leadership roles in group discussion activities.',
                'attends_school' => true,
                'classroom_type' => 'General education',
            ],

            'Tyler Wilson' => [
                // Clean profile — all clear
                'interpersonal_behavior' => false,
                'sexual_behaviors' => false,
                'social_emotional' => false,
                'follows_instructions' => true,
                'group_participation' => true,
                'attends_school' => true,
                'classroom_type' => 'General education',
            ],

            'Mia Davis' => [
                'interpersonal_behavior' => false,
                'sexual_behaviors' => false,
                'social_emotional' => true,
                'social_emotional_description' => 'Mild anxiety in large group settings and during activity transitions. Familiar with camp environment from previous year, which significantly reduces anxiety. Provide reassurance and advance notice for schedule changes. Responds very well to a consistent buddy assignment.',
                'follows_instructions' => true,
                'follows_instructions_description' => 'Follows multi-step instructions with verbal prompting. Responds well to visual schedules and photo-based activity boards.',
                'group_participation' => true,
                'group_participation_description' => 'Participating enthusiastically from 2025 experience. Prefers structured group activities over free play. Pair with familiar peers when possible.',
                'attends_school' => true,
                'classroom_type' => 'Resource room',
            ],
        ];

        foreach ($patches as $fullName => $fields) {
            [$first, $last] = explode(' ', $fullName, 2);
            $camper = Camper::where('first_name', $first)->where('last_name', $last)->first();
            if (! $camper) {
                continue;
            }
            // Use model instance so encrypted description fields are properly cast on write.
            // No whereNull guard here — sexual_behaviors defaults to false (not null),
            // so a guard would silently skip all profiles. The fill() is harmless on re-run
            // since the patch data is deterministic per camper.
            $profile = BehavioralProfile::where('camper_id', $camper->id)->first();
            if ($profile) {
                $profile->fill($fields)->save();
            }
        }
    }

    // ─── Application narrative + meta fields ─────────────────────────────────

    private function patchApplicationNarratives(): void
    {
        $sessions = CampSession::orderBy('start_date')->get()->keyBy('name');

        $patches = [

            // ── Ethan Johnson — approved, returning (attended before) ─────────
            'Ethan Johnson' => [
                'first_application' => false,
                'attended_before' => true,
                'narrative_rustic_environment' => 'Ethan attended camp last summer and had an outstanding experience. He adapted to the rustic outdoor environment well after the first evening. The consistent routine at camp actually supports him better than many structured programs. He is familiar with the outdoor setting and has expressed excitement about returning.',
                'narrative_staff_suggestions' => 'Ethan requires one staff member to remain primarily paired with him during transitions and unstructured time. Staff should use Ethan\'s visual schedule system consistently. His assigned counselor from last year (when possible, request Marcus Hall) achieved strong rapport. Any schedule deviations should be communicated in advance.',
                'narrative_participation_concerns' => 'Large, loud group settings (full camp assembly, pool events with PA announcements) cause sensory overload. We have found that pre-positioning Ethan at the edge of the group with an exit strategy dramatically reduces meltdown frequency. Swimming is his favorite activity — no concerns there.',
                'narrative_camp_benefit' => 'Camp has been transformative for Ethan\'s social development. He formed his first genuine peer friendships here. The structured peer interactions and supportive staff give him a social context that is difficult to replicate elsewhere. He talks about camp year-round.',
                'narrative_heat_tolerance' => 'Moderate. Needs regular water breaks and shade rest every 30-40 minutes. Does not self-identify when overheated — staff must monitor proactively. Warning signs: increased stimming, verbal repetition, refusal to comply.',
                'narrative_transportation' => 'Mother (Sarah Johnson) will drop off and pick up. No bus transportation needed. Drop-off morning: Sarah will walk Ethan to his counselor to ensure handoff anxiety is minimized.',
                'narrative_additional_info' => 'Ethan is an excellent swimmer — do not restrict pool time. He is a talented artist; visual arts activities are highly motivating. He does not do well with competitive team games where there are clear winners and losers.',
                'narrative_emergency_protocols' => 'In case of any behavioral emergency (meltdown, self-injury risk), contact parent immediately (cell: 803-555-0121). Father (Robert) is secondary contact. Ethan responds to deep pressure — firm bear hug from behind if he consents. Do not attempt physical restraint without explicit parent authorization.',
            ],

            // ── Sofia Martinez — under review, first application ──────────────
            'Sofia Martinez' => [
                'first_application' => true,
                'attended_before' => false,
                'narrative_rustic_environment' => 'Sofia has attended accessible day camps in the Sumter area but this will be her first overnight camp experience. She is highly adaptable and has expressed great excitement. We have reviewed the facility accessibility map and are confident she can navigate the main activity areas. Our primary concern is ensuring shower/bathroom facilities are wheelchair accessible with transfer equipment. We have attached a detailed needs assessment from her OT.',
                'narrative_staff_suggestions' => 'Sofia requires staff with CIC (clean intermittent catheterization) training — this is non-negotiable. Her catheterization schedule is every 4 hours. Beyond the clinical needs, Sofia is fully self-directing and highly independent cognitively. Staff should treat her as they would any 12-year-old while providing physical assistance only as needed. She dislikes being talked over or about in front of peers.',
                'narrative_participation_concerns' => 'Physical accessibility is the primary barrier — not cognitive or behavioral. We need assurance that all activity areas can be navigated by manual wheelchair and that the aquatic program has pool lift equipment. Sofia is a strong swimmer when using her adaptive swim ring.',
                'narrative_camp_benefit' => 'Sofia has very few peers with similar physical needs in our home community. Camp is an opportunity for her to be in a setting where her needs are understood, she is not an outlier, and she can form friendships with peers who have similar experiences. This social-emotional benefit is just as important as the programming.',
                'narrative_heat_tolerance' => 'Sofia has reduced sensation in her lower extremities which means she may not perceive heat/cold at skin level. Air temperature tolerance is normal but direct sun exposure needs monitoring for skin integrity. Sunscreen every 2 hours.',
                'narrative_transportation' => 'Father (David Martinez) will transport. Vehicle is adapted (hand controls + wheelchair tie-downs). ETA drop-off: 8:00am.',
                'narrative_additional_info' => 'Sofia is bilingual (Spanish/English) and code-switches freely. Several family members (grandfather, aunt) are Spanish-dominant — interpreter may be needed for family communication.',
                'narrative_emergency_protocols' => 'Medical: any catheterization complications or signs of UTI (fever, cloudy urine, increased spasticity) → nursing immediately → call parents. Positioning emergency (fell from wheelchair, unintended transfer): do not attempt to move independently, call nursing and 911 if injury suspected.',
            ],

            // ── Noah Thompson — pending second application ────────────────────
            'Noah Thompson' => [
                'first_application' => false,
                'attended_before' => false,
                'narrative_rustic_environment' => 'Noah has been on several outdoor day excursions through his school program and tolerates natural environments well. He loves water and would be thrilled by the waterfront. Our main concern is the open perimeter — Noah has a documented wandering history and any gaps in fencing or low-visibility boundary areas are a concern.',
                'narrative_staff_suggestions' => 'Noah communicates via speech and basic ASL. All staff working directly with Noah should have at least basic ASL or be provided with the communication card we will supply. He responds extremely well to enthusiastic praise and visual countdowns. He does not respond well to negative commands — always redirect to a positive alternative.',
                'narrative_participation_concerns' => 'Noah\'s wandering is our primary safety concern. He must be in line-of-sight of a staff member at all times during outdoor activities. He does not elope in distress — he wanders out of curiosity. A consistent buddy assignment helps significantly.',
                'narrative_camp_benefit' => 'Noah is deeply social and thrives in peer settings. His social and language skills improve dramatically in high-engagement environments. Previous school-based camp experiences have produced measurable language gains that generalize to home. Camp represents weeks of social-skill and communication development.',
                'narrative_heat_tolerance' => 'Good heat tolerance generally. Ensure adequate hydration — Noah does not self-request water reliably. Offer water every 30 minutes proactively.',
                'narrative_transportation' => 'Mother (Jennifer Thompson) will transport.',
                'narrative_additional_info' => 'Noah loves music and dancing. Any activity with music is a high motivator. He also loves animals — animal-based activities would be highly rewarding for him.',
                'narrative_emergency_protocols' => 'Medical: seizure protocol on file (complex partial seizures, history). Contact parents immediately for any seizure event. Behavioral: if Noah becomes dysregulated (high volume vocalizations, physical agitation), remove from stimulating environment to quiet 1:1 space with preferred item (small fidget toy in bag he carries).',
            ],

            // ── Henry Carter — approved, paper application ────────────────────
            'Henry Carter' => [
                'first_application' => false,
                'attended_before' => true,
                'narrative_rustic_environment' => 'Henry attended two years ago as part of a group from his school. He loved the outdoor environment, particularly the nature trail activities. He adapts well after initial transition anxiety on day 1.',
                'narrative_staff_suggestions' => 'Henry benefits from a predictable daily schedule. Morning brief on the day\'s schedule (verbal + written board) makes a significant difference. He is very food-motivated — meal timing matters.',
                'narrative_participation_concerns' => 'Unstructured free time is the most challenging for Henry. He needs a staff member to suggest activities or he will become anxious and seek out an adult repeatedly. Providing a visual activity menu for free time eliminates this issue.',
                'narrative_camp_benefit' => 'Henry struggles to form peer connections at school due to behavioral differences. Camp provides a structured, supportive peer environment where he has historically found friendships. The 1:3 supervision ratio at camp provides a level of support impossible to replicate in typical school settings.',
                'narrative_heat_tolerance' => 'Average. Standard hydration reminders. No known heat-related medical concerns.',
                'narrative_transportation' => 'Father (James Carter) provides transport. Henry is familiar with the route.',
                'narrative_additional_info' => 'Henry is interested in woodworking and building activities. Nature crafts, building structures, or any hands-on constructive activity will be highly engaging.',
                'narrative_emergency_protocols' => 'Henry does not have complex medical needs. In behavioral distress, contact James Carter (primary) at 864-555-0162. Henry responds to removal from group and 5-10 minutes of 1:1 quiet conversation with a trusted adult.',
            ],

            // ── Mia Davis — draft second application (attending before) ────────
            'Mia Davis' => [
                'first_application' => false,
                'attended_before' => true,
                'narrative_rustic_environment' => 'Mia is a returning camper and is fully comfortable in the camp environment. She actually found the cabin setting easier than home because of the consistent routine. No concerns about rustic accommodations.',
                'narrative_staff_suggestions' => 'Mia responds very well to the relationship-based approach camp uses. She benefits from consistent staff across the week rather than rotating assignments. Her 2025 counselor notes are on file and recommended reading.',
                'narrative_participation_concerns' => 'None significant. Mia occasionally withdraws during very large group activities but self-regulates and returns without staff intervention. Monitor for signs of sensory overwhelm at peak-noise events.',
                'narrative_camp_benefit' => 'Camp is one of the social highlights of Mia\'s year. She talks about it from January onward. The peer connections formed at camp have been her most meaningful friendships.',
                'narrative_heat_tolerance' => 'Good. Standard precautions. Prefers shade activities; not a pool enthusiast but will participate.',
                'narrative_transportation' => 'Mother (Patricia Davis) transports.',
                'narrative_additional_info' => 'Mia loves art and music. She is extremely talented at watercolor painting. Any opportunity to display her artwork positively impacts her self-esteem and engagement.',
                'narrative_emergency_protocols' => 'No complex medical protocols. Contact Patricia Davis for any behavioral or medical concern.',
            ],
        ];

        foreach ($patches as $fullName => $fields) {
            [$first, $last] = explode(' ', $fullName, 2);
            $camper = Camper::where('first_name', $first)->where('last_name', $last)->first();
            if (! $camper) {
                continue;
            }
            // Update all applications for this camper that don't have narratives yet
            Application::where('camper_id', $camper->id)
                ->whereNull('narrative_rustic_environment')
                ->update($fields);
        }

        // Patch second-session choice for Henry Carter (approved S1, pending S2)
        $s2 = CampSession::where('name', 'like', '%Session 2%')->orWhere('name', 'like', '%session 2%')->first();
        if ($s2) {
            $henry = Camper::where('first_name', 'Henry')->where('last_name', 'Carter')->first();
            if ($henry) {
                Application::where('camper_id', $henry->id)
                    ->whereNull('camp_session_id_second')
                    ->where('camp_session_id', '!=', $s2->id)
                    ->update(['camp_session_id_second' => $s2->id]);
            }
        }
    }

    // ─── Medical record other-health-information flags ────────────────────────

    private function patchMedicalRecordHealthFlags(): void
    {
        $patches = [

            'Ethan Johnson' => [
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
            ],

            'Sofia Martinez' => [
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => true,
                'recent_illness_description' => 'Sofia was hospitalized for 3 days in January 2026 for a urinary tract infection (UTI) secondary to catheterization. Fully resolved. Physician clearance provided. No residual effects. UTI prophylaxis antibiotic (Trimethoprim) is now part of her daily medication regimen.',
            ],

            'Noah Thompson' => [
                'tubes_in_ears' => true,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
            ],

            'Ava Williams' => [
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
            ],

            'Lucas Williams' => [
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => true,
                'recent_illness_description' => 'Lucas was hospitalized for 5 days in February 2026 for respiratory infection (bacterial pneumonia) requiring IV antibiotics. Fully resolved per March 2026 follow-up pulmonology visit. Pulmonologist clearance for camp participation attached. BiPAP settings updated following discharge.',
            ],

            'Mia Davis' => [
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
            ],

            'Tyler Wilson' => [
                'tubes_in_ears' => false,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
            ],

            'Henry Carter' => [
                'tubes_in_ears' => true,
                'has_contagious_illness' => false,
                'has_recent_illness' => false,
            ],
        ];

        foreach ($patches as $fullName => $fields) {
            [$first, $last] = explode(' ', $fullName, 2);
            $camper = Camper::where('first_name', $first)->where('last_name', $last)->first();
            if (! $camper) {
                continue;
            }
            // Use model instance so encrypted fields (recent_illness_description, etc.) are cast on write.
            $record = MedicalRecord::where('camper_id', $camper->id)
                ->whereNull('tubes_in_ears')
                ->first();
            if ($record) {
                $record->fill($fields)->save();
            }
        }
    }
}
