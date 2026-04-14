<?php

namespace Database\Seeders;

use App\Enums\AllergySeverity;
use App\Enums\DiagnosisSeverity;
use App\Enums\TreatmentType;
use App\Models\Allergy;
use App\Models\Camper;
use App\Models\Diagnosis;
use App\Models\MedicalRecord;
use App\Models\Medication;
use App\Models\TreatmentLog;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * MedicalSeeder — medical records for the 8 core demo campers.
 *
 * ─── MEDICAL STATE COVERAGE ─────────────────────────────────────────────────
 *
 *   Complete record (physician + insurance + diagnoses + allergies + medications):
 *     Ethan Johnson   — ASD + Epilepsy, Penicillin allergy, 2 medications, 3 treatment logs
 *     Lily Johnson    — Asthma, pollen allergy, 2 medications, 1 treatment log
 *     Sofia Martinez  — CP + Spina Bifida, 2 medications, no treatment logs (clean record)
 *     Noah Thompson   — Down Syndrome + Hypothyroidism, latex allergy, 1 medication, 2 logs
 *     Ava Williams    — Type 1 Diabetes, amoxicillin allergy, insulin pump, 4 treatment logs
 *     Lucas Williams  — DMD, 2 medications, BiPAP, 3 treatment logs
 *     Mia Davis       — Sickle Cell Disease + AVN, NSAIDs allergy, 2 medications, 2 logs
 *
 *   Minimal record (physician + insurance, no diagnoses, no allergies, no meds):
 *     Tyler Wilson    — tests "clean medical record" UI state (no clinical complexity)
 *
 *   No record (intentional):
 *     Families 8–30  — no medical records seeded; tests "camper without record" admin view
 *     Henry Carter   — record seeded in ApplicationSeeder (mild intellectual disability)
 *
 * ─── CLINICAL COMPLEXITY TIERS ──────────────────────────────────────────────
 *
 *   Tier 1 (Mild)       : Tyler — no diagnoses/allergies/meds
 *   Tier 2 (Mild+)      : Lily — 1 allergy, 1 diagnosis, standard medications
 *   Tier 3 (Moderate)   : Ethan, Noah — multiple diagnoses + allergies, seizure risk
 *   Tier 4 (Severe)     : Sofia, Mia — complex multi-system conditions
 *   Tier 5 (Critical)   : Ava, Lucas — life-threatening conditions, devices required
 *
 * All PHI fields are encrypted at rest via the model's encrypted cast.
 * Plaintext values written here are encrypted automatically by Laravel.
 */
class MedicalSeeder extends Seeder
{
    public function run(): void
    {
        $medical = User::where('email', 'medical@example.com')->firstOrFail();

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

        $this->seedEthan($campers['ethan'], $medical);
        $this->seedLily($campers['lily'], $medical);
        $this->seedSofia($campers['sofia'], $medical);
        $this->seedNoah($campers['noah'], $medical);
        $this->seedAva($campers['ava'], $medical);
        $this->seedLucas($campers['lucas'], $medical);
        $this->seedMia($campers['mia'], $medical);
        $this->seedTyler($campers['tyler']);

        // Backfill extension fields added by 2026-03 migrations.
        // Uses whereNull guards so existing records are patched without overwriting
        // deliberate nulls (e.g., records that have been manually updated).
        $this->patchMissingMedicalFields($campers);
    }

    /**
     * Patch the 6 medical record extension fields that were added by
     * 2026_03_25_000003 and 2026_03_25_000007 but were not present in the
     * original MedicalRecord::create() calls.
     *
     * Safe to re-run — uses whereNull() guards on date_of_medical_exam to
     * detect unpatched records. Once patched, subsequent runs are no-ops.
     */
    private function patchMissingMedicalFields(array $campers): void
    {
        $patches = [
            'ethan' => [
                'date_of_medical_exam' => '2026-01-15',
                'insurance_group' => 'GRP-BCB-1001',
                'physician_address' => '803 Medical Plaza, Columbia, SC 29201',
                'immunizations_current' => true,
                'tetanus_date' => '2024-09-10',
                'mobility_notes' => null,
            ],
            'lily' => [
                'date_of_medical_exam' => '2026-02-20',
                'insurance_group' => 'GRP-BCB-2002',
                'physician_address' => '1200 Pediatric Way, Columbia, SC 29201',
                'immunizations_current' => true,
                'tetanus_date' => '2023-11-05',
                'mobility_notes' => null,
            ],
            'sofia' => [
                'date_of_medical_exam' => '2026-01-28',
                'insurance_group' => null, // Medicaid — no group number
                'physician_address' => '2100 Rehabilitation Blvd, Columbia, SC 29203',
                'immunizations_current' => true,
                'tetanus_date' => '2024-06-12',
                'mobility_notes' => 'Transfers require two-person assist. Manual wheelchair for distances; posterior walker for short indoor ambulation. Lower extremity spasticity. Elevate legs during prolonged sitting. Pressure relief tilt every 30 min.',
            ],
            'noah' => [
                'date_of_medical_exam' => '2026-03-05',
                'insurance_group' => 'GRP-UHC-7789',
                'physician_address' => '450 Children\'s Medical Center, Greenville, SC 29601',
                'immunizations_current' => true,
                'tetanus_date' => '2025-02-18',
                'mobility_notes' => null,
            ],
            'ava' => [
                'date_of_medical_exam' => '2026-02-14',
                'insurance_group' => 'GRP-CIG-3312',
                'physician_address' => '900 Endocrinology Drive, Columbia, SC 29201',
                'immunizations_current' => true,
                'tetanus_date' => '2024-07-23',
                'mobility_notes' => null,
            ],
            'lucas' => [
                'date_of_medical_exam' => '2026-01-10',
                'insurance_group' => null, // Medicaid — no group number
                'physician_address' => '2500 Neuromuscular Center, Charlotte, NC 28203',
                'immunizations_current' => true,
                'tetanus_date' => '2024-03-30',
                'mobility_notes' => 'Full-time power wheelchair user. All transfers require two trained staff with mechanical lift. Upper extremity strength limited. Respiratory compromise — BiPAP required nightly. No prone positioning permitted.',
            ],
            'mia' => [
                'date_of_medical_exam' => '2026-02-07',
                'insurance_group' => 'GRP-BCB-8821',
                'physician_address' => '1500 Hematology Center, Columbia, SC 29201',
                'immunizations_current' => true,
                'tetanus_date' => '2024-10-15',
                'mobility_notes' => 'Monitor for limping or pain with ambulation — may indicate vaso-occlusive event. Ensure hydration during outdoor activities. Avoid sustained cold temperatures.',
            ],
            'tyler' => [
                'date_of_medical_exam' => '2026-03-10',
                'insurance_group' => 'GRP-BCB-5543',
                'physician_address' => '220 Family Medicine, Lexington, SC 29072',
                'immunizations_current' => true,
                'tetanus_date' => '2025-01-20',
                'mobility_notes' => null,
            ],
        ];

        foreach ($patches as $key => $fields) {
            if (! isset($campers[$key])) {
                continue;
            }
            // Use first() + fill/save so the Eloquent 'encrypted' cast runs on write.
            // Query-builder ->update() bypasses all Eloquent casts, leaving PHI as plaintext.
            $record = MedicalRecord::where('camper_id', $campers[$key]->id)
                ->whereNull('date_of_medical_exam')
                ->first();
            if ($record) {
                $record->fill($fields)->save();
            }
        }
    }

    // ── Per-camper helpers ──────────────────────────────────────────────────

    private function seedEthan(Camper $camper, User $medical): void
    {
        if (MedicalRecord::where('camper_id', $camper->id)->exists()) {
            return;
        }

        MedicalRecord::create([
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Sandra Hill',
            'physician_phone' => '803-555-0200',
            'insurance_provider' => 'BlueCross BlueShield',
            'insurance_policy_number' => 'BCB123456789',
            'notes' => 'Ethan responds well to routine. Staff should be briefed on his communication preferences.',
        ]);

        Diagnosis::create([
            'camper_id' => $camper->id,
            'name' => 'Autism Spectrum Disorder',
            'description' => 'Level 2 support needs. Verbal but may struggle with transitions.',
            'severity_level' => DiagnosisSeverity::Moderate,
        ]);
        Diagnosis::create([
            'camper_id' => $camper->id,
            'name' => 'Epilepsy',
            'description' => 'Absence seizures, well-controlled on Levetiracetam 500mg twice daily.',
            'severity_level' => DiagnosisSeverity::Moderate,
        ]);

        Allergy::create([
            'camper_id' => $camper->id,
            'allergen' => 'Penicillin',
            'severity' => AllergySeverity::Severe,
            'reaction' => 'Anaphylaxis',
            'treatment' => 'Epinephrine auto-injector',
        ]);

        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Levetiracetam (Keppra)',
            'dosage' => '500mg',
            'frequency' => 'Twice daily (morning and evening)',
            'purpose' => 'Seizure control',
            'prescribing_physician' => 'Dr. Sandra Hill',
            'notes' => 'Do not miss doses. Contact nurse immediately if seizure occurs.',
        ]);
        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Melatonin',
            'dosage' => '3mg',
            'frequency' => 'Nightly, 30 minutes before bedtime',
            'purpose' => 'Sleep support',
            'prescribing_physician' => 'Dr. Sandra Hill',
            'notes' => 'OTC supplement. Helps with sleep onset.',
        ]);

        // 3 treatment logs
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-10',
            'treatment_time' => '08:15:00',
            'type' => TreatmentType::MedicationAdministered,
            'title' => 'Morning Keppra administered',
            'description' => 'Levetiracetam 500mg given with breakfast. Camper cooperative.',
            'outcome' => 'No adverse effects noted.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-11',
            'treatment_time' => '14:30:00',
            'type' => TreatmentType::Observation,
            'title' => 'Behavioral observation — transition difficulty',
            'description' => 'Ethan became distressed during activity switch from swimming to arts & crafts. Staff used visual schedule. Camper self-regulated within 10 minutes.',
            'outcome' => 'Resolved without medical intervention. Noted for staff briefing.',
            'follow_up_required' => true,
            'follow_up_notes' => 'Update activity transition plan. Share visual schedule with all cabin staff.',
        ]);
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-12',
            'treatment_time' => '20:45:00',
            'type' => TreatmentType::MedicationAdministered,
            'title' => 'Evening Keppra and Melatonin administered',
            'description' => 'Levetiracetam 500mg and Melatonin 3mg given. Camper settled within 20 minutes.',
            'outcome' => 'No issues. Slept through the night.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
    }

    private function seedLily(Camper $camper, User $medical): void
    {
        if (MedicalRecord::where('camper_id', $camper->id)->exists()) {
            return;
        }

        MedicalRecord::create([
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Sandra Hill',
            'physician_phone' => '803-555-0200',
            'insurance_provider' => 'BlueCross BlueShield',
            'insurance_policy_number' => 'BCB123456790',
            'notes' => null,
        ]);

        Diagnosis::create([
            'camper_id' => $camper->id,
            'name' => 'Asthma',
            'description' => 'Mild intermittent. Uses albuterol rescue inhaler as needed.',
            'severity_level' => DiagnosisSeverity::Mild,
        ]);

        Allergy::create([
            'camper_id' => $camper->id,
            'allergen' => 'Tree pollen',
            'severity' => AllergySeverity::Mild,
            'reaction' => 'Rhinitis, watery eyes',
            'treatment' => 'Cetirizine 5mg daily',
        ]);

        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Albuterol (ProAir HFA)',
            'dosage' => '90mcg/actuation, 2 puffs',
            'frequency' => 'As needed for shortness of breath or wheezing',
            'purpose' => 'Bronchodilator — acute asthma relief',
            'prescribing_physician' => 'Dr. Sandra Hill',
            'notes' => 'Keep inhaler with camper at all times. Contact nurse if rescue use exceeds twice in one day.',
        ]);
        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Cetirizine (Zyrtec)',
            'dosage' => '5mg',
            'frequency' => 'Once daily in the morning',
            'purpose' => 'Seasonal allergy relief',
            'prescribing_physician' => 'Dr. Sandra Hill',
            'notes' => null,
        ]);

        // 1 treatment log
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-10',
            'treatment_time' => '16:00:00',
            'type' => TreatmentType::FirstAid,
            'title' => 'Albuterol rescue inhaler — mild wheeze after outdoor activity',
            'description' => 'Camper reported mild chest tightness after 30 minutes of outdoor activity in high pollen conditions. Administered 2 puffs albuterol. O2 sat 98% before and after.',
            'outcome' => 'Resolved within 5 minutes. Camper returned to activity.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
    }

    private function seedSofia(Camper $camper, User $medical): void
    {
        if (MedicalRecord::where('camper_id', $camper->id)->exists()) {
            return;
        }

        MedicalRecord::create([
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. James Owens',
            'physician_phone' => '803-555-0211',
            'insurance_provider' => 'Aetna',
            'insurance_policy_number' => 'AET987654321',
            'notes' => 'Sofia uses a manual wheelchair. Bladder management program (intermittent catheterization every 4 hours).',
        ]);

        Diagnosis::create([
            'camper_id' => $camper->id,
            'name' => 'Spastic Cerebral Palsy (Diplegia)',
            'description' => 'GMFCS Level III. Can walk short distances with walker; uses wheelchair for longer distances.',
            'severity_level' => DiagnosisSeverity::Moderate,
        ]);
        Diagnosis::create([
            'camper_id' => $camper->id,
            'name' => 'Spina Bifida (Myelomeningocele, L3)',
            'description' => 'Repaired at birth. Neurogenic bladder and bowel managed on protocol.',
            'severity_level' => DiagnosisSeverity::Severe,
        ]);

        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Baclofen',
            'dosage' => '10mg',
            'frequency' => 'Three times daily with meals',
            'purpose' => 'Spasticity management',
            'prescribing_physician' => 'Dr. James Owens',
            'notes' => 'Do not discontinue abruptly.',
        ]);
        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Oxybutynin (Ditropan)',
            'dosage' => '5mg',
            'frequency' => 'Twice daily',
            'purpose' => 'Neurogenic bladder — reduce bladder spasms',
            'prescribing_physician' => 'Dr. James Owens',
            'notes' => 'Part of catheterization protocol. Monitor for dry mouth and constipation.',
        ]);

        // Sofia has no treatment logs — clean clinical record for this session
    }

    private function seedNoah(Camper $camper, User $medical): void
    {
        if (MedicalRecord::where('camper_id', $camper->id)->exists()) {
            return;
        }

        MedicalRecord::create([
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Rachel Kim',
            'physician_phone' => '803-555-0222',
            'insurance_provider' => 'United Healthcare',
            'insurance_policy_number' => 'UHC456789123',
            'notes' => 'Noah is very social and enthusiastic. Annual cardiac follow-up completed; cleared for physical activity.',
        ]);

        Diagnosis::create([
            'camper_id' => $camper->id,
            'name' => 'Down Syndrome (Trisomy 21)',
            'description' => 'Mosaic presentation. Mild intellectual disability. Atlantoaxial instability cleared by neurology.',
            'severity_level' => DiagnosisSeverity::Moderate,
        ]);
        Diagnosis::create([
            'camper_id' => $camper->id,
            'name' => 'Hypothyroidism',
            'description' => 'On Levothyroxine 50mcg daily. Last TSH normal.',
            'severity_level' => DiagnosisSeverity::Mild,
        ]);

        Allergy::create([
            'camper_id' => $camper->id,
            'allergen' => 'Latex',
            'severity' => AllergySeverity::Severe,
            'reaction' => 'Contact dermatitis and urticaria',
            'treatment' => 'Remove latex; Benadryl for mild reactions; Epipen if systemic',
        ]);

        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Levothyroxine (Synthroid)',
            'dosage' => '50mcg',
            'frequency' => 'Once daily, first thing in the morning on an empty stomach',
            'purpose' => 'Thyroid hormone replacement',
            'prescribing_physician' => 'Dr. Rachel Kim',
            'notes' => 'Must be taken 30–60 minutes before breakfast. Do not take with calcium or iron supplements.',
        ]);

        // 2 treatment logs
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-09',
            'treatment_time' => '07:00:00',
            'type' => TreatmentType::MedicationAdministered,
            'title' => 'Morning Levothyroxine administered',
            'description' => 'Levothyroxine 50mcg given on empty stomach before breakfast.',
            'outcome' => 'No issues. Camper compliant.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-11',
            'treatment_time' => '11:20:00',
            'type' => TreatmentType::FirstAid,
            'title' => 'Minor abrasion — right knee',
            'description' => 'Noah tripped on path near cabin. Small abrasion (~2cm) on right knee. Wound cleaned with saline, Neosporin applied, covered with bandage.',
            'outcome' => 'Wound clean and covered. Camper returned to activity.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
    }

    private function seedAva(Camper $camper, User $medical): void
    {
        if (MedicalRecord::where('camper_id', $camper->id)->exists()) {
            return;
        }

        MedicalRecord::create([
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Maria Gonzalez',
            'physician_phone' => '803-555-0233',
            'insurance_provider' => 'Cigna',
            'insurance_policy_number' => 'CIG321654987',
            'notes' => 'Ava wears a Dexcom CGM and uses an OmniPod insulin pump. Staff must understand pump alarms and how to treat hypoglycemia.',
        ]);

        Diagnosis::create([
            'camper_id' => $camper->id,
            'name' => 'Type 1 Diabetes Mellitus',
            'description' => 'Diagnosed age 5. Continuous glucose monitor + insulin pump. Target BG 80–180 mg/dL.',
            'severity_level' => DiagnosisSeverity::Severe,
        ]);

        Allergy::create([
            'camper_id' => $camper->id,
            'allergen' => 'Amoxicillin',
            'severity' => AllergySeverity::Moderate,
            'reaction' => 'Hives and GI upset',
            'treatment' => 'Avoid; use alternative antibiotics',
        ]);

        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Insulin (OmniPod pump — NovoLog)',
            'dosage' => 'Variable (basal 0.6 U/hr; bolus per correction table)',
            'frequency' => 'Continuous via pump; bolus with meals and corrections',
            'purpose' => 'Blood glucose management — Type 1 Diabetes',
            'prescribing_physician' => 'Dr. Maria Gonzalez',
            'notes' => 'Correction table on file. Low BG (<70): 15g fast carbs, recheck in 15 min. High BG (>250): correction bolus + check ketones. Do NOT remove pump.',
        ]);

        // 4 treatment logs (diabetes requires frequent documentation)
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-09',
            'treatment_time' => '12:30:00',
            'type' => TreatmentType::Observation,
            'title' => 'BG check — pre-lunch',
            'description' => 'Pre-lunch BG 142 mg/dL. Within target range. No intervention required.',
            'outcome' => 'BG within range. Camper proceeded to lunch.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-10',
            'treatment_time' => '15:45:00',
            'type' => TreatmentType::FirstAid,
            'title' => 'Hypoglycemia episode — BG 58 mg/dL',
            'description' => 'Dexcom alarmed at 3:45 PM. BG confirmed at 58 mg/dL via fingerstick. Administered 15g fast-acting carbs (4 glucose tabs). Camper sat quietly in med hut.',
            'outcome' => 'BG rose to 94 mg/dL after 15 minutes. Camper felt well and returned to activity.',
            'follow_up_required' => true,
            'follow_up_notes' => 'Reviewed afternoon activity schedule with parents. Adjusted basal rate slightly during high-activity periods. Documented in Dexcom log.',
        ]);
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-11',
            'treatment_time' => '07:10:00',
            'type' => TreatmentType::Observation,
            'title' => 'BG check — morning fasting',
            'description' => 'Fasting BG 118 mg/dL. Pump running normally. Site change performed (day 3).',
            'outcome' => 'All within normal parameters.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-12',
            'treatment_time' => '21:15:00',
            'type' => TreatmentType::Observation,
            'title' => 'BG check — bedtime',
            'description' => 'Bedtime BG 165 mg/dL. Slightly elevated but within acceptable range for overnight. No correction needed.',
            'outcome' => 'Camper went to bed. Dexcom overnight monitoring in place.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
    }

    private function seedLucas(Camper $camper, User $medical): void
    {
        if (MedicalRecord::where('camper_id', $camper->id)->exists()) {
            return;
        }

        MedicalRecord::create([
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Maria Gonzalez',
            'physician_phone' => '803-555-0233',
            'insurance_provider' => 'Cigna',
            'insurance_policy_number' => 'CIG321654988',
            'notes' => 'Lucas uses a power wheelchair. Nighttime BiPAP support required. Respiratory status should be monitored.',
        ]);

        Diagnosis::create([
            'camper_id' => $camper->id,
            'name' => 'Duchenne Muscular Dystrophy',
            'description' => 'Stage 4 (non-ambulatory). On Deflazacort 18mg daily. Cardiac MRI — mildly reduced EF, on ACE inhibitor.',
            'severity_level' => DiagnosisSeverity::Severe,
        ]);

        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Deflazacort (Emflaza)',
            'dosage' => '18mg',
            'frequency' => 'Once daily in the morning with food',
            'purpose' => 'Corticosteroid — slows DMD disease progression',
            'prescribing_physician' => 'Dr. Maria Gonzalez',
            'notes' => 'Do not skip doses. Monitor blood pressure and weight during stay.',
        ]);
        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Lisinopril',
            'dosage' => '5mg',
            'frequency' => 'Once daily',
            'purpose' => 'ACE inhibitor — cardiac protection',
            'prescribing_physician' => 'Dr. Maria Gonzalez',
            'notes' => 'Monitor for dizziness or hypotension especially during warm weather.',
        ]);

        // 3 treatment logs
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-09',
            'treatment_time' => '21:00:00',
            'type' => TreatmentType::Observation,
            'title' => 'BiPAP setup — first night',
            'description' => 'BiPAP equipment (provided by family) set up in cabin. Mask fit verified. Settings: IPAP 14 / EPAP 8. Lucas wore mask without difficulty.',
            'outcome' => 'Slept through the night. No alarms.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-11',
            'treatment_time' => '14:00:00',
            'type' => TreatmentType::Observation,
            'title' => 'Respiratory check — after morning activities',
            'description' => 'Routine check post-activity. Respiratory rate 18/min, O2 sat 97% on room air. No increased work of breathing noted.',
            'outcome' => 'Within normal parameters. No intervention required.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-12',
            'treatment_time' => '09:30:00',
            'type' => TreatmentType::MedicationAdministered,
            'title' => 'Deflazacort and Lisinopril administered',
            'description' => 'Morning medications given with breakfast. BP 108/68 mmHg. No adverse effects.',
            'outcome' => 'Vitals stable. Camper tolerated medications well.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
    }

    private function seedMia(Camper $camper, User $medical): void
    {
        if (MedicalRecord::where('camper_id', $camper->id)->exists()) {
            return;
        }

        MedicalRecord::create([
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Kevin Patel',
            'physician_phone' => '803-555-0244',
            'insurance_provider' => 'Medicaid',
            'insurance_policy_number' => 'MC789123456',
            'notes' => 'Mia must stay well-hydrated and avoid extreme heat. Hydroxyurea 500mg daily. Pain crisis protocol on file.',
        ]);

        Diagnosis::create([
            'camper_id' => $camper->id,
            'name' => 'Sickle Cell Disease (HbSS)',
            'description' => 'On hydroxyurea. History of 2 acute chest syndrome episodes. Last hospitalization 18 months ago.',
            'severity_level' => DiagnosisSeverity::Severe,
        ]);
        Diagnosis::create([
            'camper_id' => $camper->id,
            'name' => 'Avascular Necrosis (right hip)',
            'description' => 'Mild; managed conservatively. No joint replacement needed at this time.',
            'severity_level' => DiagnosisSeverity::Mild,
        ]);

        Allergy::create([
            'camper_id' => $camper->id,
            'allergen' => 'NSAIDs',
            'severity' => AllergySeverity::Moderate,
            'reaction' => 'Worsening renal function and pain',
            'treatment' => 'Avoid ibuprofen/naproxen; use acetaminophen only',
        ]);

        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Hydroxyurea',
            'dosage' => '500mg',
            'frequency' => 'Once daily',
            'purpose' => 'Reduces frequency of sickle cell crises',
            'prescribing_physician' => 'Dr. Kevin Patel',
            'notes' => 'Must be given daily without interruption. Do NOT substitute or skip.',
        ]);
        Medication::create([
            'camper_id' => $camper->id,
            'name' => 'Folic Acid',
            'dosage' => '1mg',
            'frequency' => 'Once daily',
            'purpose' => 'Supports red blood cell production',
            'prescribing_physician' => 'Dr. Kevin Patel',
            'notes' => null,
        ]);

        // 2 treatment logs
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-10',
            'treatment_time' => '08:00:00',
            'type' => TreatmentType::MedicationAdministered,
            'title' => 'Hydroxyurea and Folic Acid administered',
            'description' => 'Daily medications given with breakfast. Camper well-hydrated (approx 32oz fluid intake by 8am). No complaints.',
            'outcome' => 'No issues. Camper proceeded to morning activity.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
        TreatmentLog::create([
            'camper_id' => $camper->id,
            'recorded_by' => $medical->id,
            'treatment_date' => '2025-06-12',
            'treatment_time' => '13:45:00',
            'type' => TreatmentType::Observation,
            'title' => 'Heat check — high temperature day',
            'description' => 'Outdoor temp reached 91°F. Mia brought inside after 45 min outdoor activity per protocol. Temp 98.6°F, well-hydrated. No pain complaints. Rested with air conditioning for 1 hour.',
            'outcome' => 'No crisis. Camper felt fine after rest and additional fluids.',
            'follow_up_required' => false,
            'follow_up_notes' => null,
        ]);
    }

    private function seedTyler(Camper $camper): void
    {
        if (MedicalRecord::where('camper_id', $camper->id)->exists()) {
            return;
        }

        // Tyler has minimal medical data — no diagnoses, no allergies,
        // no medications, no treatment logs. Tests "clean record" UI state.
        MedicalRecord::create([
            'camper_id' => $camper->id,
            'physician_name' => 'Dr. Anne Bradley',
            'physician_phone' => '803-555-0255',
            'insurance_provider' => 'BlueCross BlueShield',
            'insurance_policy_number' => 'BCB987654321',
            'notes' => null,
        ]);
    }
}
