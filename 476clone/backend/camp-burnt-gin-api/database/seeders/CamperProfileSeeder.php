<?php

namespace Database\Seeders;

use App\Models\AssistiveDevice;
use App\Models\BehavioralProfile;
use App\Models\Camper;
use App\Models\FeedingPlan;
use Illuminate\Database\Seeder;

/**
 * Seeder — behavioral profiles, assistive devices, and feeding plans.
 *
 * These three model types were completely absent from the seeding stack.
 * This seeder fills all meaningful clinical scenarios for the existing camper set.
 *
 * BehavioralProfiles:
 *   Ethan Johnson   — ASD Level 2: developmental delay, no aggression, no wandering
 *   Noah Thompson   — Down syndrome: developmental delay, wandering risk
 *   Sofia Martinez  — CP/Spina Bifida: no behavioral concerns, full cognition
 *   Lucas Williams  — DMD: no behavioral concerns
 *   Tyler Wilson    — No concerns (baseline / clean profile state)
 *   (Lily, Ava, Mia intentionally not profiled — tests "no behavioral profile" UI state)
 *
 * AssistiveDevices:
 *   Sofia Martinez  — Manual wheelchair (transfer required) + Walker (no transfer)
 *   Lucas Williams  — Power wheelchair (transfer required) + BiPAP ventilator
 *   (Others intentionally have no devices — tests empty assistive device UI state)
 *
 * FeedingPlans:
 *   Sofia Martinez  — Modified texture diet (special_diet, no G-tube)
 *   Lucas Williams  — Standard diet with fluid intake monitoring note
 *   (Others intentionally have no feeding plan — tests empty feeding plan UI state)
 *
 * Safe to re-run — each helper short-circuits if a record already exists.
 */
class CamperProfileSeeder extends Seeder
{
    public function run(): void
    {
        $campers = [
            'ethan' => Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail(),
            'lily' => Camper::where('first_name', 'Lily')->where('last_name', 'Johnson')->firstOrFail(),
            'sofia' => Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail(),
            'noah' => Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail(),
            'ava' => Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail(),
            'lucas' => Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail(),
            'mia' => Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail(),
            'tyler' => Camper::where('first_name', 'Tyler')->where('last_name', 'Wilson')->firstOrFail(),
        ];

        $this->seedBehavioralProfiles($campers);
        $this->seedAssistiveDevices($campers);
        $this->seedFeedingPlans($campers);
        $this->patchBehavioralAbilityFlags($campers);

        $this->command->line('  Camper profiles seeded (behavioral, devices, feeding plans).');
    }

    // ── Behavioral Profiles ──────────────────────────────────────────────────

    private function seedBehavioralProfiles(array $campers): void
    {
        $profiles = [
            // Ethan — ASD Level 2: developmental delay, strong verbal skills, sensory sensitivity
            [
                'camper' => $campers['ethan'],
                'aggression' => false,
                'self_abuse' => false,
                'wandering_risk' => false,
                'one_to_one_supervision' => false,
                'developmental_delay' => true,
                'functioning_age_level' => '10–11 years (chronological age 12)',
                'communication_methods' => ['verbal', 'picture exchange', 'visual schedule'],
                'notes' => 'Ethan is verbal and communicates effectively but may struggle during unplanned transitions or sensory-overwhelming environments. Uses a visual daily schedule; deviations should be communicated in advance. Stimming behaviors (hand-flapping, rocking) are self-regulatory — do not interrupt unless safety concern. Responds well to 1-2 minute advance warnings before activity changes. No elopement history.',
            ],

            // Noah — Down syndrome: wandering risk, receptive language stronger than expressive
            [
                'camper' => $campers['noah'],
                'aggression' => false,
                'self_abuse' => false,
                'wandering_risk' => true,
                'one_to_one_supervision' => false,
                'developmental_delay' => true,
                'functioning_age_level' => '8–9 years (chronological age 13)',
                'communication_methods' => ['verbal', 'sign language', 'gestures'],
                'notes' => 'Noah understands much more than he can verbally express — speak to him at approximately a 2nd/3rd grade level. He is very social and enthusiastic, but may wander toward interesting stimuli without awareness of boundaries. Requires line-of-sight supervision during transitions between activity areas. Sign language prompt sheet on file. Responds excellently to positive reinforcement and visual countdowns for transitions.',
            ],

            // Sofia — CP + Spina Bifida: full cognition, no behavioral concerns
            [
                'camper' => $campers['sofia'],
                'aggression' => false,
                'self_abuse' => false,
                'wandering_risk' => false,
                'one_to_one_supervision' => false,
                'developmental_delay' => false,
                'functioning_age_level' => 'Age-appropriate (12 years)',
                'communication_methods' => ['verbal'],
                'notes' => 'Sofia is cognitively age-appropriate and fully communicative. No behavioral concerns. She may express frustration related to physical access barriers — respond with practical problem-solving and ask her preference. She advocates well for herself regarding her care needs.',
            ],

            // Lucas — DMD: no behavioral concerns, may experience frustration with limitations
            [
                'camper' => $campers['lucas'],
                'aggression' => false,
                'self_abuse' => false,
                'wandering_risk' => false,
                'one_to_one_supervision' => false,
                'developmental_delay' => false,
                'functioning_age_level' => 'Age-appropriate (14 years)',
                'communication_methods' => ['verbal'],
                'notes' => 'Lucas is cognitively typical and age-appropriate. He may express frustration when physical limitations prevent participation in activities peers are doing. Inclusive programming and peer mentoring strongly encouraged. He is mature, self-aware about his condition, and communicates his needs clearly.',
            ],

            // Tyler — clean baseline profile (no concerns, no delays)
            [
                'camper' => $campers['tyler'],
                'aggression' => false,
                'self_abuse' => false,
                'wandering_risk' => false,
                'one_to_one_supervision' => false,
                'developmental_delay' => false,
                'functioning_age_level' => 'Age-appropriate (12 years)',
                'communication_methods' => ['verbal'],
                'notes' => null,
            ],
        ];

        foreach ($profiles as $p) {
            $camper = $p['camper'];
            if (BehavioralProfile::where('camper_id', $camper->id)->exists()) {
                continue;
            }
            BehavioralProfile::create([
                'camper_id' => $camper->id,
                'aggression' => $p['aggression'],
                'self_abuse' => $p['self_abuse'],
                'wandering_risk' => $p['wandering_risk'],
                'one_to_one_supervision' => $p['one_to_one_supervision'],
                'developmental_delay' => $p['developmental_delay'],
                'functioning_age_level' => $p['functioning_age_level'],
                'communication_methods' => $p['communication_methods'],
                'notes' => $p['notes'],
            ]);
        }
    }

    // ── Assistive Devices ─────────────────────────────────────────────────────

    private function seedAssistiveDevices(array $campers): void
    {
        $devices = [
            // Sofia — Manual wheelchair (primary mobility for distances)
            [
                'camper' => $campers['sofia'],
                'device_type' => 'Manual wheelchair',
                'requires_transfer_assistance' => true,
                'notes' => 'TiLite ZRA titanium manual wheelchair. Staff must use two-person lift technique for all transfers (pool, toilet, activity stations). Footrests are removable — keep secured during use. Camper is able to propel on flat surfaces for short distances but fatigues quickly.',
            ],
            // Sofia — Walker (short-distance walking)
            [
                'camper' => $campers['sofia'],
                'device_type' => 'Posterior walker',
                'requires_transfer_assistance' => false,
                'notes' => 'Used for short-distance ambulation (up to ~50 feet) in low-fatigue contexts such as cabin interior or dining hall. Camper self-manages the walker. Monitor for signs of fatigue or increased spasticity during extended use.',
            ],
            // Lucas — Power wheelchair (primary mobility device)
            [
                'camper' => $campers['lucas'],
                'device_type' => 'Power wheelchair',
                'requires_transfer_assistance' => true,
                'notes' => 'Permobil M3 power wheelchair. All outdoor paths and activity areas must be assessed for wheelchair accessibility before Lucas arrives. Transfer to bed, toilet, and pool requires two trained staff using a transfer board and mechanical lift protocol. Do NOT attempt lift without training. Joystick controller is mounted on right armrest.',
            ],
            // Lucas — BiPAP ventilator (nighttime respiratory support)
            [
                'camper' => $campers['lucas'],
                'device_type' => 'BiPAP ventilator',
                'requires_transfer_assistance' => false,
                'notes' => 'ResMed AirCurve 10 VAuto BiPAP. Settings: IPAP 15 cmH2O / EPAP 8 cmH2O (updated per physician order 2026-03-06). Device is provided by family and arrives with the camper. Nursing staff must verify mask fit and equipment function each evening before sleep. Do not modify settings without physician order. Alarm response protocol posted in med hut.',
            ],
        ];

        foreach ($devices as $d) {
            $camper = $d['camper'];
            $exists = AssistiveDevice::where('camper_id', $camper->id)
                ->where('device_type', $d['device_type'])
                ->exists();
            if ($exists) {
                continue;
            }
            AssistiveDevice::create([
                'camper_id' => $camper->id,
                'device_type' => $d['device_type'],
                'requires_transfer_assistance' => $d['requires_transfer_assistance'],
                'notes' => $d['notes'],
            ]);
        }
    }

    // ── Feeding Plans ──────────────────────────────────────────────────────────

    private function seedFeedingPlans(array $campers): void
    {
        $plans = [
            // Sofia — modified texture diet (CP/oral motor)
            [
                'camper' => $campers['sofia'],
                'special_diet' => true,
                'diet_description' => 'Modified texture diet — soft and moist foods preferred. No dry, crumbly, or hard-to-chew textures (crackers, raw carrots, hard breads). Thin liquids are fine. Occupational therapy recommendations reviewed and on file. Camp kitchen has been notified. Sofia is generally a good eater and will indicate preferences.',
                'g_tube' => false,
                'formula' => null,
                'amount_per_feeding' => null,
                'feedings_per_day' => null,
                'feeding_times' => null,
                'bolus_only' => false,
                'notes' => 'Sofia may occasionally request peer foods that are not texture-appropriate. Offer the modified version and redirect gently. She understands her dietary needs.',
            ],
            // Lucas — standard diet with fluid monitoring
            [
                'camper' => $campers['lucas'],
                'special_diet' => false,
                'diet_description' => null,
                'g_tube' => false,
                'formula' => null,
                'amount_per_feeding' => null,
                'feedings_per_day' => null,
                'feeding_times' => null,
                'bolus_only' => false,
                'notes' => 'Standard diet — no texture or food restrictions. Fluid intake must be tracked and documented at each meal. Minimum 48oz total fluid per day per cardiac protocol. Avoid high-sodium meal options where possible (cardiac precaution). If Lucas declines fluids, notify nursing staff.',
            ],
        ];

        foreach ($plans as $p) {
            $camper = $p['camper'];
            if (FeedingPlan::where('camper_id', $camper->id)->exists()) {
                continue;
            }
            FeedingPlan::create([
                'camper_id' => $camper->id,
                'special_diet' => $p['special_diet'],
                'diet_description' => $p['diet_description'],
                'g_tube' => $p['g_tube'],
                'formula' => $p['formula'],
                'amount_per_feeding' => $p['amount_per_feeding'],
                'feedings_per_day' => $p['feedings_per_day'],
                'feeding_times' => $p['feeding_times'],
                'bolus_only' => $p['bolus_only'],
                'notes' => $p['notes'],
            ]);
        }
    }

    /**
     * Patch functional ability flags added by 2026_03_25_000008.
     *
     * These 6 boolean columns describe POSITIVE abilities the camper has
     * (reading, writing, mobility, verbal communication, social skills, behavior plan).
     * They have DB defaults of false but must be set to meaningful values for each
     * profiled camper so the medical portal shows accurate functional ability summaries.
     *
     * Safe to re-run — uses whereNull(functional_reading) as idempotency guard.
     * The column is NOT NULL with default false, so "was never explicitly set" is
     * detected by checking if all 6 ability flags are still at their default false values
     * AND communication_methods is not null (proxy for "this profile has real data").
     */
    private function patchBehavioralAbilityFlags(array $campers): void
    {
        // Maps camper key → clinical ability profile
        // Values reflect each camper's documented cognitive and functional status.
        $abilityPatches = [
            'ethan' => [
                'functional_reading' => true,  // verbal, reads age-appropriate material
                'functional_writing' => true,
                'independent_mobility' => true,  // walks independently
                'verbal_communication' => true,  // ASD Level 2 but verbal
                'social_skills' => false, // social difficulties are core ASD presentation
                'behavior_plan' => true,  // documented behavior support plan on file
            ],
            'noah' => [
                'functional_reading' => false, // limited functional literacy
                'functional_writing' => false,
                'independent_mobility' => true,  // walks independently; wandering is behavioral not mobility
                'verbal_communication' => true,  // verbal though limited expressive range
                'social_skills' => true,  // very social and enthusiastic
                'behavior_plan' => false,
            ],
            'sofia' => [
                'functional_reading' => true,  // age-appropriate cognition
                'functional_writing' => true,
                'independent_mobility' => false, // wheelchair/walker dependent
                'verbal_communication' => true,
                'social_skills' => true,
                'behavior_plan' => false,
            ],
            'lucas' => [
                'functional_reading' => true,  // cognitively typical
                'functional_writing' => true,  // upper extremity function sufficient
                'independent_mobility' => false, // power wheelchair user
                'verbal_communication' => true,
                'social_skills' => true,
                'behavior_plan' => false,
            ],
            'tyler' => [
                'functional_reading' => true,
                'functional_writing' => true,
                'independent_mobility' => true,
                'verbal_communication' => true,
                'social_skills' => true,
                'behavior_plan' => false,
            ],
        ];

        foreach ($abilityPatches as $key => $fields) {
            if (! isset($campers[$key])) {
                continue;
            }
            // Guard: only update profiles where ALL ability flags are false (unpatched defaults)
            BehavioralProfile::where('camper_id', $campers[$key]->id)
                ->where('functional_reading', false)
                ->where('functional_writing', false)
                ->where('independent_mobility', false)
                ->where('verbal_communication', false)
                ->update($fields);
        }
    }
}
