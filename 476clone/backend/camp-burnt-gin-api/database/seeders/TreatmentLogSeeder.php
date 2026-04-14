<?php

namespace Database\Seeders;

use App\Enums\TreatmentType;
use App\Models\Camper;
use App\Models\MedicalVisit;
use App\Models\TreatmentLog;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeder — Treatment log entries for all demo campers.
 *
 * Creates 12 treatment log entries spanning all five treatment types
 * (medication_administered, first_aid, observation, emergency, other).
 * Several entries are linked to the MedicalVisit records seeded by
 * MedicalPhase11Seeder; others are standalone records.
 *
 * Safe to re-run — duplicate detection uses non-encrypted columns
 * (camper_id + treatment_date + treatment_time).
 */
class TreatmentLogSeeder extends Seeder
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

        // Resolve visit IDs for linking — nullable if visit not yet seeded
        $visitId = fn (int $camperId, string $date, string $time): ?int => MedicalVisit::where('camper_id', $camperId)
            ->where('visit_date', $date)
            ->where('visit_time', $time)
            ->value('id');

        $logs = [
            // ── Lily — Albuterol rescue inhaler (03/01, linked to health office visit) ──
            [
                'camper' => $campers['lily'],
                'medical_visit_id' => $visitId($campers['lily']->id, '2026-03-01', '11:00:00'),
                'treatment_date' => '2026-03-01',
                'treatment_time' => '11:00',
                'type' => TreatmentType::MedicationAdministered,
                'title' => 'Albuterol rescue inhaler — mild wheeze post trail walk',
                'description' => 'Lily reported chest tightness and audible wheeze 20 minutes into nature trail walk. Pollen count was "very high" per local air quality index. Pre-treatment O2 sat 97%. Administered albuterol via ProAir HFA with spacer.',
                'outcome' => 'Wheeze resolved within 5 minutes of treatment. O2 sat 99% post-treatment. Camper monitored for 15 minutes and cleared to return to cabin.',
                'medication_given' => 'Albuterol HFA (ProAir)',
                'dosage_given' => '2 puffs via spacer (90 mcg/puff)',
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],

            // ── Mia — Heat protocol observation (03/02, linked to health office visit) ──
            [
                'camper' => $campers['mia'],
                'medical_visit_id' => $visitId($campers['mia']->id, '2026-03-02', '13:30:00'),
                'treatment_date' => '2026-03-02',
                'treatment_time' => '13:30',
                'type' => TreatmentType::Observation,
                'title' => 'Heat protocol activation — ambient temp 89°F',
                'description' => 'Ambient temperature reached 89°F at 1:15 PM. Per environmental restriction, Mia was brought indoors after 25 minutes of outdoor activity. Camper reported mild fatigue, denied pain (0/10). Skin warm and dry, no cyanosis. Temp 98.8°F, O2 sat 99%.',
                'outcome' => 'Rested in air-conditioned health office for 45 minutes. Oral hydration encouraged — consumed 16oz water. Cool damp cloth applied to forehead. Pain score remained 0/10 throughout. Cleared for indoor activities.',
                'medication_given' => null,
                'dosage_given' => null,
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],

            // ── Tyler — Headache assessment (03/03) ──
            [
                'camper' => $campers['tyler'],
                'medical_visit_id' => $visitId($campers['tyler']->id, '2026-03-03', '10:15:00'),
                'treatment_date' => '2026-03-03',
                'treatment_time' => '10:15',
                'type' => TreatmentType::Observation,
                'title' => 'Headache — frontal, mild (4/10), suspected dehydration',
                'description' => 'Tyler presented with mild frontal headache rated 4/10. Onset this morning. Denied nausea, photophobia, or vision changes. No fever (98.6°F). Camper had not consumed any water since waking. BP 112/70, pulse 72, O2 sat 99%.',
                'outcome' => 'Encouraged oral hydration and rest. Camper consumed 12oz water over 20-minute rest period. Headache resolved to 1/10. No medication required. Returned to morning activity session.',
                'medication_given' => null,
                'dosage_given' => null,
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],

            // ── Noah — Knee abrasion first aid (03/03) ──
            [
                'camper' => $campers['noah'],
                'medical_visit_id' => null,
                'treatment_date' => '2026-03-03',
                'treatment_time' => '12:10',
                'type' => TreatmentType::FirstAid,
                'title' => 'Abrasion — right knee, latex-free wound care applied',
                'description' => 'Noah tripped on uneven pavement on the path between Cabin 3 and the dining hall. Sustained a 3 cm superficial abrasion on the right knee with minimal bleeding. Latex-free gloves worn throughout per environmental restriction.',
                'outcome' => 'Wound irrigated with sterile saline. Latex-free non-adherent dressing applied with paper tape. No deep tissue involvement. Camper able to walk unassisted. Advised to keep dry. Dressing change scheduled in 48 hours.',
                'medication_given' => null,
                'dosage_given' => null,
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],

            // ── Noah — Dressing change follow-up (03/04) ──
            [
                'camper' => $campers['noah'],
                'medical_visit_id' => $visitId($campers['noah']->id, '2026-03-04', '09:00:00'),
                'treatment_date' => '2026-03-04',
                'treatment_time' => '09:00',
                'type' => TreatmentType::FirstAid,
                'title' => 'Dressing change — right knee abrasion (day 2)',
                'description' => 'Scheduled 48-hour dressing change for right knee abrasion sustained 03/03. Old dressing intact and dry on presentation. No complaints of pain at wound site.',
                'outcome' => 'Old dressing removed atraumatically. Wound irrigated with sterile saline. No signs of infection — edges approximating, no erythema, warmth, or purulent discharge. Latex-free non-adherent dressing reapplied. Return for final recheck in 5 days.',
                'medication_given' => null,
                'dosage_given' => null,
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],

            // ── Ava — Glucose administration (03/04, linked to health office visit) ──
            [
                'camper' => $campers['ava'],
                'medical_visit_id' => $visitId($campers['ava']->id, '2026-03-04', '14:30:00'),
                'treatment_date' => '2026-03-04',
                'treatment_time' => '14:12',
                'type' => TreatmentType::MedicationAdministered,
                'title' => 'Glucose tablets — hypoglycemia BG 52 mg/dL at archery range',
                'description' => 'Dexcom G7 alarmed at archery range at 2:12 PM. Camper appeared pale and diaphoretic. Fingerstick BG confirmed 52 mg/dL (severe low). Camper seated in shade immediately. Rule of 15 protocol initiated.',
                'outcome' => 'Administered 4 glucose tablets (15g carbohydrates). BG rechecked at 2:27 PM — 78 mg/dL. Camper felt better. Escorted to health office for continued monitoring. BG 94 mg/dL at 2:50 PM. Insulin pump basal rate reviewed. Parents notified by phone at 2:45 PM.',
                'medication_given' => 'Glucose tablets',
                'dosage_given' => '15g (4 tablets)',
                'follow_up_required' => true,
                'follow_up_notes' => 'Second hypoglycemia event this session. Endocrinologist (Dr. Gonzalez) must be contacted to review basal rate and correction factor. Flagged for parent follow-up meeting.',
            ],

            // ── Ethan — Evening medication administration (03/05) ──
            [
                'camper' => $campers['ethan'],
                'medical_visit_id' => $visitId($campers['ethan']->id, '2026-03-05', '20:30:00'),
                'treatment_date' => '2026-03-05',
                'treatment_time' => '20:30',
                'type' => TreatmentType::MedicationAdministered,
                'title' => 'Scheduled evening medications — Levetiracetam + Melatonin',
                'description' => 'Ethan presented for scheduled 8:30 PM medication pass. No complaints. Camper calm and cooperative. Brief check-in regarding afternoon behavioral escalation — camper appeared well-regulated. Visual schedule plan for tomorrow reviewed with counselor.',
                'outcome' => 'Both medications administered without difficulty. Camper tolerated well. Returned to cabin for bedtime routine.',
                'medication_given' => 'Levetiracetam (Keppra); Melatonin',
                'dosage_given' => 'Levetiracetam 500mg PO; Melatonin 3mg PO',
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],

            // ── Sofia — Scheduled catheterization (03/05) ──
            [
                'camper' => $campers['sofia'],
                'medical_visit_id' => $visitId($campers['sofia']->id, '2026-03-05', '16:00:00'),
                'treatment_date' => '2026-03-05',
                'treatment_time' => '16:00',
                'type' => TreatmentType::Other,
                'title' => 'Intermittent catheterization — scheduled 4 PM (bladder management protocol)',
                'description' => 'Sofia arrived for scheduled 4 PM intermittent catheterization per bladder management protocol. No urinary complaints. No abdominal discomfort or fever reported.',
                'outcome' => 'Procedure performed per sterile technique protocol. Urine clear, straw-colored, no odor or cloudiness. Approximately 280 mL drained. No complications. Next scheduled catheterization at 8 PM.',
                'medication_given' => null,
                'dosage_given' => null,
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],

            // ── Tyler — Paper cut first aid (03/05) ──
            [
                'camper' => $campers['tyler'],
                'medical_visit_id' => null,
                'treatment_date' => '2026-03-05',
                'treatment_time' => '14:05',
                'type' => TreatmentType::FirstAid,
                'title' => 'Paper cut — right index finger, arts & crafts',
                'description' => 'Tyler sustained a small paper cut on the right index finger during arts and crafts. Minimal bleeding, no deep tissue involvement. Camper cooperative throughout.',
                'outcome' => 'Wound cleansed with antiseptic wipe. Small adhesive bandage applied. No further treatment required. Camper returned to activity immediately.',
                'medication_given' => null,
                'dosage_given' => null,
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],

            // ── Lucas — Respiratory observation (03/06, linked to health office visit) ──
            [
                'camper' => $campers['lucas'],
                'medical_visit_id' => $visitId($campers['lucas']->id, '2026-03-06', '07:40:00'),
                'treatment_date' => '2026-03-06',
                'treatment_time' => '07:20',
                'type' => TreatmentType::Emergency,
                'title' => 'Respiratory distress — O2 sat drop to 94% post-BiPAP',
                'description' => 'Lucas reported chest tightness after morning BiPAP removal at 7:20 AM. RR 22/min (elevated above baseline). O2 sat 94% on room air (baseline 97%). Mild accessory muscle use noted. No cyanosis. Cabin aide Taylor Brooks present.',
                'outcome' => 'Repositioned to 30-degree incline. Cough-assist technique performed x3 cycles. O2 sat improved to 96% within 10 minutes. Physician (Dr. Gonzalez) contacted at 7:45 AM — advised to monitor q30min x2h and consider IPAP increase from 14 to 15 cmH2O. Parents notified.',
                'medication_given' => null,
                'dosage_given' => null,
                'follow_up_required' => true,
                'follow_up_notes' => 'Written notification to cardiologist required. BiPAP setting change (IPAP +1 cmH2O) to be confirmed with family tonight. Monitor O2 sat every 30 minutes through morning.',
            ],

            // ── Ethan — Morning seizure medication (03/06) ──
            [
                'camper' => $campers['ethan'],
                'medical_visit_id' => null,
                'treatment_date' => '2026-03-06',
                'treatment_time' => '08:00',
                'type' => TreatmentType::MedicationAdministered,
                'title' => 'Scheduled morning medication — Levetiracetam',
                'description' => 'Ethan arrived for scheduled 8:00 AM Levetiracetam dose. No overnight incidents reported by cabin staff. Camper alert and oriented. No seizure activity reported.',
                'outcome' => 'Medication administered without difficulty. Camper tolerated well. Counselor briefed on updated visual schedule for the day.',
                'medication_given' => 'Levetiracetam (Keppra)',
                'dosage_given' => '500mg PO',
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],

            // ── Ava — Routine morning BG monitoring (03/07) ──
            [
                'camper' => $campers['ava'],
                'medical_visit_id' => null,
                'treatment_date' => '2026-03-07',
                'treatment_time' => '08:00',
                'type' => TreatmentType::Observation,
                'title' => 'Routine morning BG check — post-hypoglycemia monitoring protocol',
                'description' => 'Ava reported to health office for scheduled morning BG check per enhanced monitoring protocol following two hypoglycemia events this session. Camper alert, no overnight symptoms reported by cabin staff. Insulin pump functioning normally.',
                'outcome' => 'Fingerstick BG 112 mg/dL — within target range. No intervention required. Insulin pump settings reviewed. Camper advised to consume full breakfast before morning activities. BG check to continue daily until endocrinologist consultation completed.',
                'medication_given' => null,
                'dosage_given' => null,
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],
        ];

        foreach ($logs as $row) {
            $camper = $row['camper'];

            if (TreatmentLog::where('camper_id', $camper->id)
                ->where('treatment_date', $row['treatment_date'])
                ->where('treatment_time', $row['treatment_time'])
                ->exists()) {
                continue;
            }

            TreatmentLog::create([
                'camper_id' => $camper->id,
                'medical_visit_id' => $row['medical_visit_id'],
                'recorded_by' => $medical->id,
                'treatment_date' => $row['treatment_date'],
                'treatment_time' => $row['treatment_time'],
                'type' => $row['type'],
                'title' => $row['title'],
                'description' => $row['description'],
                'outcome' => $row['outcome'],
                'medication_given' => $row['medication_given'],
                'dosage_given' => $row['dosage_given'],
                'follow_up_required' => $row['follow_up_required'],
                'follow_up_notes' => $row['follow_up_notes'],
            ]);
        }
    }
}
