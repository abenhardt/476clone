<?php

namespace Database\Seeders;

use App\Enums\ActivityPermissionLevel;
use App\Models\ActivityPermission;
use App\Models\Camper;
use App\Models\MedicalRecord;
use Illuminate\Database\Seeder;

/**
 * Seeder — extended medical record fields and activity permission overrides.
 *
 * The base MedicalSeeder creates medical records but leaves several fields
 * NULL that are populated on the MedicalRecord model:
 *
 *   has_seizures, last_seizure_date, seizure_description, has_neurostimulator
 *   special_needs, dietary_restrictions
 *
 * This seeder fills those fields for campers where they are clinically relevant,
 * and also corrects activity permission records to reflect real clinical restrictions
 * rather than the default "yes to everything" set by ActivityPermissionSeeder.
 *
 * MedicalRecord field updates:
 *   Ethan  → has_seizures=true, last_seizure_date, seizure_description
 *   Sofia  → special_needs (catheterization protocol), dietary_restrictions (texture)
 *   Noah   → special_needs (Down syndrome guidance)
 *   Lucas  → special_needs (BiPAP, cardiac precautions)
 *   Mia    → special_needs (SCD heat/hydration), dietary_restrictions (no NSAIDs cross-contamination)
 *   Ava    → special_needs (CGM/insulin pump, hypoglycemia protocol)
 *
 * Activity permission overrides (correct the default "yes" entries):
 *   Ethan  → Swimming: restricted (1:1 lifeguard required), Boating: restricted
 *   Sofia  → Swimming: restricted (adaptive staff required), Sports: restricted
 *   Lucas  → Sports: no (no high-impact), Boating: no, Swimming: restricted
 *   Mia    → Camp Out: restricted (heat protocol applies overnight)
 *   Noah   → Sports: restricted (all equipment latex-free required)
 *
 * Safe to re-run — uses update() for MedicalRecord (only updates null fields)
 * and skips ActivityPermission if already restricted/denied.
 */
class ExtendedMedicalRecordSeeder extends Seeder
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
        ];

        $this->fillMedicalRecordFields($campers);
        $this->overrideActivityPermissions($campers);

        $this->command->line('  Extended medical record fields and activity permission overrides seeded.');
    }

    // ── Medical Record Field Updates ──────────────────────────────────────────

    private function fillMedicalRecordFields(array $campers): void
    {
        $updates = [
            'ethan' => [
                'has_seizures' => true,
                'last_seizure_date' => '2025-11-14',
                'seizure_description' => 'Absence seizures. Typically 10–30 seconds of staring/blankness with no convulsive activity. Well-controlled on Levetiracetam 500mg BID. Last breakthrough seizure was November 2025 when a dose was missed. Seizure action plan on file — includes: protect from harm, time the event, do NOT restrain, do NOT put anything in mouth. Call 911 if seizure > 5 minutes or multiple in 30 min.',
                'has_neurostimulator' => false,
                'special_needs' => 'ASD Level 2 — see behavioral profile for full guidance. Communication: verbal + visual supports. Transitions: requires advance notice. Do NOT alter routine without briefing staff first.',
            ],
            'lily' => [
                'has_seizures' => false,
                'has_neurostimulator' => false,
            ],
            'sofia' => [
                'has_seizures' => false,
                'has_neurostimulator' => false,
                'special_needs' => 'Intermittent catheterization every 4 hours per neurogenic bladder protocol. Schedule: 8am, 12pm, 4pm, 8pm. Staff must ensure Sofia has privacy and adequate time for self-catheterization. She is trained and manages independently. Bowel program managed in AM.',
                'dietary_restrictions' => 'Modified texture diet — soft and moist foods only. No hard, dry, or crumbly textures. Thin liquids tolerated. See feeding plan for detail.',
            ],
            'noah' => [
                'has_seizures' => false,
                'has_neurostimulator' => false,
                'special_needs' => 'Down syndrome — see behavioral profile. Latex allergy (severe/anaphylaxis risk): ALL equipment, gloves, bandages, and sports gear must be LATEX-FREE. EpiPen on file with nursing staff and at each activity station. Atlantoaxial instability cleared by neurology — full physical activity permitted.',
            ],
            'ava' => [
                'has_seizures' => false,
                'has_neurostimulator' => false,
                'special_needs' => 'Type 1 Diabetes on OmniPod insulin pump + Dexcom G7 CGM. BG target: 80–180 mg/dL. Hypoglycemia protocol: BG < 70 → 15g fast carbs (4 glucose tabs) → recheck 15min. BG > 250 → correction bolus + check ketones. Do NOT remove pump. Correction table on file with nursing. Snack/carb log required for insulin accuracy.',
            ],
            'lucas' => [
                'has_seizures' => false,
                'has_neurostimulator' => false,
                'special_needs' => 'Duchenne Muscular Dystrophy Stage 4. Power wheelchair dependent. BiPAP required nightly (see assistive devices). Respiratory monitoring required — normal SpO2 97%, alert nursing if < 95%. Cardiac precautions: monitor BP, avoid high-sodium foods, notify nursing of any chest tightness or SOB. Transfer requires trained staff and mechanical lift.',
            ],
            'mia' => [
                'has_seizures' => false,
                'has_neurostimulator' => false,
                'special_needs' => 'Sickle Cell Disease (HbSS). Heat restriction: max 30 minutes outdoors when temp > 85°F. Minimum 8oz fluid/hour outdoors. Pain crisis protocol on file — do NOT give ibuprofen or naproxen (see allergy). If camper reports bone/joint pain, fatigue, or fever > 101°F, notify nursing IMMEDIATELY.',
                'dietary_restrictions' => 'NO NSAIDs (ibuprofen, naproxen, aspirin) — severe allergy reaction including worsening renal function. For pain management: acetaminophen only. Read all over-the-counter medication labels before administering.',
            ],
        ];

        foreach ($updates as $key => $fields) {
            if (! isset($campers[$key])) {
                continue;
            }
            $record = MedicalRecord::where('camper_id', $campers[$key]->id)->first();
            if (! $record) {
                continue;
            }
            // Only update fields that are currently null or false-default
            $toUpdate = [];
            foreach ($fields as $field => $value) {
                if (is_null($record->$field) || ($field === 'has_seizures' && $record->$field === false && $value === true)) {
                    $toUpdate[$field] = $value;
                }
            }
            if (! empty($toUpdate)) {
                $record->update($toUpdate);
            }
        }
    }

    // ── Activity Permission Overrides ──────────────────────────────────────────

    private function overrideActivityPermissions(array $campers): void
    {
        $overrides = [
            'ethan' => [
                'Swimming' => [ActivityPermissionLevel::Restricted, 'Seizure risk near water. 1:1 trained lifeguard/aide required at all times during aquatic sessions. Must wear a life jacket at all times in water. No unsupervised water access under any circumstances.'],
                'Boating' => [ActivityPermissionLevel::Restricted, 'Same seizure precautions as swimming. 1:1 support required. Life jacket mandatory. No solo or small-craft boating.'],
            ],
            'sofia' => [
                'Swimming' => [ActivityPermissionLevel::Restricted, 'Adaptive aquatics only. Two trained adaptive staff required: one in water, one poolside. Two-person lift technique required for pool entry/exit. Bladder catheterization schedule must not be disrupted by pool scheduling.'],
                'Sports' => [ActivityPermissionLevel::Restricted, 'Wheelchair-accessible sports only. Contact sports not permitted. Walker or wheelchair use required on athletic surfaces. Spasticity precautions: avoid sudden movements or overexertion.'],
            ],
            'lucas' => [
                'Sports' => [ActivityPermissionLevel::No, 'High-impact physical activity is not medically appropriate. DMD Stage 4 — no running, jumping, or contact sports. Adaptive spectatorship and supportive role activities encouraged instead.'],
                'Boating' => [ActivityPermissionLevel::No, 'Not appropriate — power wheelchair cannot be safely used on watercraft. Respiratory precautions also apply near water.'],
                'Swimming' => [ActivityPermissionLevel::Restricted, 'Aquatic activities require physician clearance on a session-by-session basis. Two-person mechanical lift required for pool entry/exit. Respiratory monitoring essential.'],
                'Camp Out' => [ActivityPermissionLevel::Restricted, 'Overnight camp-out requires BiPAP device access and electrical power. Pre-approval required from nursing director. Ensure accessible shelter and power supply are confirmed before any overnight activity.'],
            ],
            'mia' => [
                'Camp Out' => [ActivityPermissionLevel::Restricted, 'Overnight camping permitted only in temperature-controlled shelter. Outdoor tenting not appropriate due to sickle cell heat sensitivity. Nursing check-in required before and after all overnight activities. Hydration monitoring essential.'],
                'Sports' => [ActivityPermissionLevel::Restricted, 'Sports permitted with hydration monitoring. Max 30 minutes outdoor activity when temp > 85°F. Bring indoors at first sign of fatigue or pain. No NSAID pain relief — acetaminophen only.'],
            ],
            'noah' => [
                'Sports' => [ActivityPermissionLevel::Restricted, 'ALL sports equipment, balls, mats, and gear must be LATEX-FREE. Verify before each activity. Noah may participate fully once latex-free equipment is confirmed.'],
            ],
        ];

        foreach ($overrides as $camperKey => $activities) {
            if (! isset($campers[$camperKey])) {
                continue;
            }
            $camper = $campers[$camperKey];

            foreach ($activities as $activityName => [$level, $notes]) {
                $perm = ActivityPermission::where('camper_id', $camper->id)
                    ->where('activity_name', $activityName)
                    ->first();

                if ($perm) {
                    // Only override if still at default 'yes' level
                    if ($perm->permission_level === ActivityPermissionLevel::Yes) {
                        $perm->update([
                            'permission_level' => $level,
                            'restriction_notes' => $notes,
                        ]);
                    }
                } else {
                    // Create if not seeded by ActivityPermissionSeeder (shouldn't happen, but safe)
                    ActivityPermission::create([
                        'camper_id' => $camper->id,
                        'activity_name' => $activityName,
                        'permission_level' => $level,
                        'restriction_notes' => $notes,
                    ]);
                }
            }
        }
    }
}
