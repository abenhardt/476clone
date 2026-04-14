<?php

namespace Database\Seeders;

use App\Enums\FollowUpPriority;
use App\Enums\FollowUpStatus;
use App\Enums\IncidentSeverity;
use App\Enums\IncidentType;
use App\Enums\VisitDisposition;
use App\Models\Camper;
use App\Models\MedicalFollowUp;
use App\Models\MedicalIncident;
use App\Models\MedicalRestriction;
use App\Models\MedicalVisit;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeder — Phase 11 medical portal entities.
 *
 * Seeds the four new tables introduced in Phase 11:
 *   medical_incidents    — incident reports across all clinical complexity tiers
 *   medical_visits       — health office visit records with vitals and dispositions
 *   medical_follow_ups   — task queue across all statuses (overdue, due today, pending, in-progress, completed)
 *   medical_restrictions — active and expired activity/dietary/environmental restrictions
 *
 * Follow-up statuses are calibrated to today (2026-03-07) so the dashboard
 * alert strip and command-center widgets show meaningful data immediately:
 *   - 2 overdue (due date in the past, status pending/in_progress)
 *   - 1 due today (due_date = today, status pending)
 *   - 2 pending future tasks
 *   - 1 in_progress
 *   - 1 completed (with completed_at)
 *
 * Safe to re-run — each per-camper helper short-circuits if a record already exists.
 */
class MedicalPhase11Seeder extends Seeder
{
    public function run(): void
    {
        $medical = User::where('email', 'medical@example.com')->firstOrFail();
        $admin = User::where('email', 'admin@example.com')->firstOrFail();

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

        $this->seedRestrictions($campers, $medical);
        $this->seedIncidents($campers, $medical);
        $this->seedVisits($campers, $medical);
        $this->seedFollowUps($campers, $medical, $admin);
    }

    // ── Restrictions ─────────────────────────────────────────────────────────

    private function seedRestrictions(array $campers, User $medical): void
    {
        $data = [
            [
                'camper' => $campers['ethan'],
                'restriction_type' => 'activity',
                'description' => 'No unsupervised swimming or open-water activities. Seizure risk near water. Requires 1:1 trained lifeguard support at all times during aquatic sessions.',
                'start_date' => '2026-03-01',
                'end_date' => null,
                'is_active' => true,
                'notes' => 'Clearance required from neurologist before restriction can be modified.',
            ],
            [
                'camper' => $campers['ava'],
                'restriction_type' => 'dietary',
                'description' => 'No high-sugar snacks or drinks without nurse approval. All carbohydrate-heavy foods must be logged for insulin dosing accuracy.',
                'start_date' => '2026-03-01',
                'end_date' => null,
                'is_active' => true,
                'notes' => 'Camper has Type 1 Diabetes on insulin pump. Parents provided approved snack list on file.',
            ],
            [
                'camper' => $campers['lucas'],
                'restriction_type' => 'activity',
                'description' => 'No high-impact physical activities (running, jumping, contact sports). Power wheelchair use required for all mobility exceeding 50 feet.',
                'start_date' => '2026-03-01',
                'end_date' => null,
                'is_active' => true,
                'notes' => 'DMD Stage 4. Respiratory and cardiac precautions in effect. Monitor for fatigue and shortness of breath.',
            ],
            [
                'camper' => $campers['mia'],
                'restriction_type' => 'environmental',
                'description' => 'Outdoor activity limited to 30 minutes when ambient temperature exceeds 85°F. Must remain well-hydrated (minimum 8oz water per hour outdoors).',
                'start_date' => '2026-03-01',
                'end_date' => null,
                'is_active' => true,
                'notes' => 'Sickle cell disease. Heat exposure increases risk of vaso-occlusive crisis. Bring indoors immediately if camper reports pain or fatigue.',
            ],
            [
                'camper' => $campers['noah'],
                'restriction_type' => 'equipment',
                'description' => 'Latex-free environment required. All gloves, bandages, equipment, and sporting gear in contact with camper must be latex-free.',
                'start_date' => '2026-03-01',
                'end_date' => null,
                'is_active' => true,
                'notes' => 'Severe latex allergy. Anaphylaxis risk. EpiPen on file. Notify all activity staff before each session.',
            ],
            [
                'camper' => $campers['sofia'],
                'restriction_type' => 'activity',
                'description' => 'Swimming and aquatic activities permitted only with trained adaptive aquatics staff present. Transfer to and from pool requires two-person lift technique.',
                'start_date' => '2026-03-01',
                'end_date' => null,
                'is_active' => true,
                'notes' => 'Cerebral palsy GMFCS III + Spina Bifida. Catheterization schedule must not be disrupted by activity scheduling.',
            ],
            // Expired restriction — for testing inactive state
            [
                'camper' => $campers['lily'],
                'restriction_type' => 'activity',
                'description' => 'Reduced outdoor activity duration during high pollen count days (pollen index > 7). Maximum 20 minutes per session.',
                'start_date' => '2025-04-01',
                'end_date' => '2025-10-31',
                'is_active' => false,
                'notes' => 'Seasonal spring/summer restriction. Re-evaluate each spring based on symptom severity.',
            ],
        ];

        foreach ($data as $row) {
            $camper = $row['camper'];
            // Use only non-encrypted columns for duplicate detection
            if (MedicalRestriction::where('camper_id', $camper->id)
                ->where('restriction_type', $row['restriction_type'])
                ->where('start_date', $row['start_date'])
                ->exists()) {
                continue;
            }

            MedicalRestriction::create([
                'camper_id' => $camper->id,
                'created_by' => $medical->id,
                'restriction_type' => $row['restriction_type'],
                'description' => $row['description'],
                'start_date' => $row['start_date'],
                'end_date' => $row['end_date'],
                'is_active' => $row['is_active'],
                'notes' => $row['notes'],
            ]);
        }
    }

    // ── Incidents ─────────────────────────────────────────────────────────────

    private function seedIncidents(array $campers, User $medical): void
    {
        $incidents = [
            // Ava — Hypoglycemia episode (medical, moderate, escalation)
            [
                'camper' => $campers['ava'],
                'type' => IncidentType::Medical,
                'severity' => IncidentSeverity::Moderate,
                'location' => 'Archery Range',
                'title' => 'Hypoglycemia episode — BG 52 mg/dL',
                'description' => 'Dexcom G7 alarmed during archery activity at 2:12 PM. Camper appeared pale and sweaty. Fingerstick confirmed BG 52 mg/dL. Administered 15g glucose tabs (4 tabs). Camper seated in shade. BG rechecked at 2:27 PM — 78 mg/dL. Camper felt better and was able to walk to med hut for monitoring.',
                'witnesses' => 'Activity counselor Jordan Reed; archery instructor Sam Park',
                'escalation_required' => true,
                'escalation_notes' => 'Parents notified by phone at 2:45 PM. Basal insulin rate reviewed and adjusted per endocrinologist protocol. Second low BG event this week — flagged for parent follow-up.',
                'incident_date' => '2026-03-04',
                'incident_time' => '14:12:00',
            ],
            // Ethan — Behavioral/transition meltdown (behavioral, minor)
            [
                'camper' => $campers['ethan'],
                'type' => IncidentType::Behavioral,
                'severity' => IncidentSeverity::Minor,
                'location' => 'Cabin 4 — Common Area',
                'title' => 'Behavioral escalation — unscheduled activity change',
                'description' => 'Ethan became distressed when afternoon swim was cancelled due to weather and replaced without advance notice. Camper began stimming, covered ears, and sat on floor refusing to move. Counselor used visual schedule card and verbal calm-down prompts. Camper self-regulated within 12 minutes. No physical harm to self or others.',
                'witnesses' => 'Cabin counselor Priya Nair; activity coordinator Dan Walsh',
                'escalation_required' => false,
                'escalation_notes' => null,
                'incident_date' => '2026-03-05',
                'incident_time' => '15:30:00',
            ],
            // Noah — Knee abrasion (injury, minor)
            [
                'camper' => $campers['noah'],
                'type' => IncidentType::Injury,
                'severity' => IncidentSeverity::Minor,
                'location' => 'Trail between Cabin 3 and Dining Hall',
                'title' => 'Abrasion — right knee, latex-free treatment applied',
                'description' => 'Noah tripped on uneven pavement on path to dining hall. Sustained a 3cm superficial abrasion on right knee. Wound cleaned with sterile saline. Latex-free gloves used throughout. Non-latex adhesive bandage applied. No deep tissue involvement. Camper able to walk to dining hall unassisted.',
                'witnesses' => 'Counselor Marcus Bell',
                'escalation_required' => false,
                'escalation_notes' => null,
                'incident_date' => '2026-03-03',
                'incident_time' => '12:05:00',
            ],
            // Mia — Heat exposure (environmental, moderate)
            [
                'camper' => $campers['mia'],
                'type' => IncidentType::Environmental,
                'severity' => IncidentSeverity::Moderate,
                'location' => 'Outdoor Sports Field',
                'title' => 'Heat exposure — ambient temp 89°F, early protocol activation',
                'description' => 'Ambient temperature reached 89°F at 1:15 PM. Per restriction protocol, Mia was brought inside after 25 minutes of outdoor activity. Camper reported mild fatigue but denied pain. Temp 98.8°F. Encouraged oral hydration — consumed 16oz water. Rested in air-conditioned health office for 45 minutes. Pain assessment (0/10) documented.',
                'witnesses' => 'Physical education staff Chris Morales; med staff Nurse Jones',
                'escalation_required' => false,
                'escalation_notes' => null,
                'incident_date' => '2026-03-02',
                'incident_time' => '13:15:00',
            ],
            // Lucas — Respiratory concern (medical, moderate, escalation)
            [
                'camper' => $campers['lucas'],
                'type' => IncidentType::Medical,
                'severity' => IncidentSeverity::Moderate,
                'location' => 'Cabin 6',
                'title' => 'Increased respiratory effort — post-BiPAP morning',
                'description' => 'Lucas reported feeling "tight in the chest" after morning BiPAP removal. RR 22/min (elevated for baseline). O2 sat 94% on room air (baseline 97%). Repositioned camper. O2 sat improved to 96% within 10 minutes after cough-assist technique. No cyanosis. No accessory muscle use. Physician contacted.',
                'witnesses' => 'Night cabin aide Taylor Brooks; nursing staff on shift',
                'escalation_required' => true,
                'escalation_notes' => 'Dr. Maria Gonzalez contacted at 7:45 AM. Advised to monitor for 2 hours and check O2 sat every 30 minutes. Consider increasing IPAP setting by 1 cmH2O. Parents notified.',
                'incident_date' => '2026-03-06',
                'incident_time' => '07:20:00',
            ],
            // Lily — Environmental asthma trigger (environmental, minor)
            [
                'camper' => $campers['lily'],
                'type' => IncidentType::Environmental,
                'severity' => IncidentSeverity::Minor,
                'location' => 'Nature Trail — North Perimeter',
                'title' => 'Asthma — mild wheeze after high-pollen trail walk',
                'description' => 'Lily reported chest tightness 20 minutes into nature trail walk. Pollen count was "very high" per local air quality report. Administered 2 puffs albuterol via ProAir HFA. Pre-treatment O2 sat 97%; post-treatment 99%. Mild wheeze resolved within 5 minutes. Camper monitored for 15 minutes before returning to cabin.',
                'witnesses' => 'Hike group counselor Taylor Kim',
                'escalation_required' => false,
                'escalation_notes' => null,
                'incident_date' => '2026-03-01',
                'incident_time' => '10:45:00',
            ],
            // Tyler — Minor injury (injury, minor) — simple/clean case
            [
                'camper' => $campers['tyler'],
                'type' => IncidentType::Injury,
                'severity' => IncidentSeverity::Minor,
                'location' => 'Arts & Crafts Studio',
                'title' => 'Paper cut — right index finger',
                'description' => 'Tyler sustained a small paper cut on the right index finger during arts and crafts. Minimal bleeding. Wound cleaned with antiseptic wipe. Small bandage applied. No further treatment required.',
                'witnesses' => 'Arts counselor Jamie Osei',
                'escalation_required' => false,
                'escalation_notes' => null,
                'incident_date' => '2026-03-05',
                'incident_time' => '14:00:00',
            ],
        ];

        foreach ($incidents as $row) {
            $camper = $row['camper'];
            // Use only non-encrypted columns for duplicate detection
            if (MedicalIncident::where('camper_id', $camper->id)
                ->where('type', $row['type']->value)
                ->where('incident_date', $row['incident_date'])
                ->where('incident_time', $row['incident_time'])
                ->exists()) {
                continue;
            }

            MedicalIncident::create([
                'camper_id' => $camper->id,
                'recorded_by' => $medical->id,
                'treatment_log_id' => null,
                'type' => $row['type'],
                'severity' => $row['severity'],
                'location' => $row['location'],
                'title' => $row['title'],
                'description' => $row['description'],
                'witnesses' => $row['witnesses'],
                'escalation_required' => $row['escalation_required'],
                'escalation_notes' => $row['escalation_notes'],
                'incident_date' => $row['incident_date'],
                'incident_time' => $row['incident_time'],
            ]);
        }
    }

    // ── Health Office Visits ──────────────────────────────────────────────────

    private function seedVisits(array $campers, User $medical): void
    {
        $visits = [
            // Ava — post-hypo BG check (returned to activity)
            [
                'camper' => $campers['ava'],
                'visit_date' => '2026-03-04',
                'visit_time' => '14:30:00',
                'chief_complaint' => 'Post-hypoglycemia monitoring — BG 52 mg/dL incident at archery',
                'symptoms' => 'Pallor, diaphoresis, mild tremor at presentation. Resolved by time of visit.',
                'vitals' => ['temp' => '98.4', 'pulse' => '92', 'bp' => '108/66', 'spo2' => '99', 'weight' => null],
                'treatment_provided' => 'Glucose tabs (15g) administered pre-visit. BG monitoring x3 over 45 minutes. Oral hydration encouraged. Insulin pump settings reviewed.',
                'medications_administered' => 'Glucose tabs 15g (4 tabs) — pre-visit at incident site',
                'disposition' => VisitDisposition::ReturnedToActivity,
                'disposition_notes' => 'BG stable at 94 mg/dL after 15 minutes. Camper felt well. Returned to cabin with counselor.',
                'follow_up_required' => true,
                'follow_up_notes' => 'Schedule call with endocrinologist re: basal rate adjustment. Second hypo event this session.',
            ],
            // Lily — albuterol treatment visit
            [
                'camper' => $campers['lily'],
                'visit_date' => '2026-03-01',
                'visit_time' => '11:00:00',
                'chief_complaint' => 'Mild wheeze and chest tightness after outdoor trail walk — high pollen day',
                'symptoms' => 'Mild bilateral expiratory wheeze on auscultation. O2 sat 97% on arrival.',
                'vitals' => ['temp' => '98.2', 'pulse' => '84', 'bp' => null, 'spo2' => '97', 'weight' => null],
                'treatment_provided' => 'Albuterol 2 puffs via ProAir HFA spacer. Monitored for 15 minutes post-treatment.',
                'medications_administered' => 'Albuterol HFA 90mcg x2 puffs (from camper\'s own inhaler)',
                'disposition' => VisitDisposition::ReturnedToActivity,
                'disposition_notes' => 'Wheeze resolved. O2 sat 99% post-treatment. Camper comfortable.',
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],
            // Mia — heat protocol visit
            [
                'camper' => $campers['mia'],
                'visit_date' => '2026-03-02',
                'visit_time' => '13:30:00',
                'chief_complaint' => 'Brought in per heat restriction protocol — ambient temp 89°F',
                'symptoms' => 'Mild fatigue. Denied pain (0/10). Skin warm and dry. No pallor or cyanosis.',
                'vitals' => ['temp' => '98.8', 'pulse' => '88', 'bp' => '110/70', 'spo2' => '99', 'weight' => null],
                'treatment_provided' => 'Rest in air-conditioned health office. Oral hydration — 16oz water. Cool damp cloth to forehead.',
                'medications_administered' => null,
                'disposition' => VisitDisposition::Monitoring,
                'disposition_notes' => 'Monitored for 45 minutes. Temperature stable. Pain score remained 0/10. Cleared to return to indoor activities.',
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],
            // Lucas — respiratory check
            [
                'camper' => $campers['lucas'],
                'visit_date' => '2026-03-06',
                'visit_time' => '07:40:00',
                'chief_complaint' => 'Increased respiratory effort after BiPAP removal — chest tightness reported',
                'symptoms' => 'RR 22/min, O2 sat 94% on room air. Slight accessory muscle use noted. No cyanosis.',
                'vitals' => ['temp' => '98.1', 'pulse' => '76', 'bp' => '112/72', 'spo2' => '94', 'weight' => null],
                'treatment_provided' => 'Repositioned to 30-degree incline. Cough-assist technique x3 cycles. O2 sat monitoring q30min. Physician contacted.',
                'medications_administered' => null,
                'disposition' => VisitDisposition::Monitoring,
                'disposition_notes' => 'O2 sat improved to 96% after positioning and cough assist. Physician advised monitor x2h and consider IPAP adjustment tonight.',
                'follow_up_required' => true,
                'follow_up_notes' => 'Notify cardiologist of respiratory event. Review BiPAP settings with family tonight.',
            ],
            // Noah — wound dressing change
            [
                'camper' => $campers['noah'],
                'visit_date' => '2026-03-04',
                'visit_time' => '09:00:00',
                'chief_complaint' => 'Dressing change — right knee abrasion from 03/03',
                'symptoms' => 'Wound healing well. No erythema, warmth, or purulent discharge. Edges approximating.',
                'vitals' => null,
                'treatment_provided' => 'Old dressing removed. Wound irrigated with sterile saline. Latex-free non-adherent dressing applied. Wound edges clean.',
                'medications_administered' => null,
                'disposition' => VisitDisposition::ReturnedToActivity,
                'disposition_notes' => 'Wound healing well. Camper reported no pain at wound site. Return for next dressing change in 2 days.',
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],
            // Ethan — evening medication administration visit
            [
                'camper' => $campers['ethan'],
                'visit_date' => '2026-03-05',
                'visit_time' => '20:30:00',
                'chief_complaint' => 'Scheduled evening medication administration — Keppra + Melatonin',
                'symptoms' => 'No complaints. Camper calm and cooperative after earlier behavioral incident.',
                'vitals' => ['temp' => '98.5', 'pulse' => '70', 'bp' => null, 'spo2' => '98', 'weight' => null],
                'treatment_provided' => 'Medications administered. Brief check-in regarding afternoon behavioral episode. Reviewed visual schedule plan for tomorrow.',
                'medications_administered' => 'Levetiracetam 500mg; Melatonin 3mg',
                'disposition' => VisitDisposition::ReturnedToActivity,
                'disposition_notes' => 'Camper settled. Returned to cabin for bedtime routine.',
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],
            // Sofia — scheduled catheterization check
            [
                'camper' => $campers['sofia'],
                'visit_date' => '2026-03-05',
                'visit_time' => '16:00:00',
                'chief_complaint' => 'Scheduled intermittent catheterization — 4PM per bladder management protocol',
                'symptoms' => 'No urinary symptoms. No discomfort reported.',
                'vitals' => null,
                'treatment_provided' => 'Intermittent catheterization performed per protocol. Urine clear, straw-colored, no odor. Approximately 280mL drained.',
                'medications_administered' => null,
                'disposition' => VisitDisposition::ReturnedToActivity,
                'disposition_notes' => 'Procedure completed without complication. Next scheduled at 8PM.',
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],
            // Tyler — minor headache complaint (clean/simple case)
            [
                'camper' => $campers['tyler'],
                'visit_date' => '2026-03-03',
                'visit_time' => '10:15:00',
                'chief_complaint' => 'Headache — frontal, mild, onset this morning',
                'symptoms' => 'Mild frontal headache (4/10). Denies nausea, photophobia, vision changes. No fever.',
                'vitals' => ['temp' => '98.6', 'pulse' => '72', 'bp' => '112/70', 'spo2' => '99', 'weight' => null],
                'treatment_provided' => 'Encouraged oral hydration (camper had skipped morning water intake). Rest for 20 minutes in health office.',
                'medications_administered' => null,
                'disposition' => VisitDisposition::ReturnedToActivity,
                'disposition_notes' => 'Headache resolved to 1/10 after hydration and rest. Camper returned to morning session.',
                'follow_up_required' => false,
                'follow_up_notes' => null,
            ],
        ];

        foreach ($visits as $row) {
            $camper = $row['camper'];
            // Use only non-encrypted columns for duplicate detection
            if (MedicalVisit::where('camper_id', $camper->id)
                ->where('visit_date', $row['visit_date'])
                ->where('visit_time', $row['visit_time'])
                ->exists()) {
                continue;
            }

            MedicalVisit::create([
                'camper_id' => $camper->id,
                'recorded_by' => $medical->id,
                'visit_date' => $row['visit_date'],
                'visit_time' => $row['visit_time'],
                'chief_complaint' => $row['chief_complaint'],
                'symptoms' => $row['symptoms'],
                'vitals' => $row['vitals'],
                'treatment_provided' => $row['treatment_provided'],
                'medications_administered' => $row['medications_administered'],
                'disposition' => $row['disposition'],
                'disposition_notes' => $row['disposition_notes'],
                'follow_up_required' => $row['follow_up_required'],
                'follow_up_notes' => $row['follow_up_notes'],
            ]);
        }
    }

    // ── Follow-Ups ────────────────────────────────────────────────────────────

    private function seedFollowUps(array $campers, User $medical, User $admin): void
    {
        // Dates relative to 2026-03-07 (today):
        //   past:    2026-02-28  → overdue
        //   today:   2026-03-07  → due today
        //   future:  2026-03-10+ → upcoming

        $followUps = [
            // 1. OVERDUE — Ava insulin rate review (urgent, past due)
            [
                'camper' => $campers['ava'],
                'created_by' => $medical->id,
                'assigned_to' => $medical->id,
                'treatment_log_id' => null,
                'title' => 'Contact endocrinologist re: basal rate adjustment — second hypo event',
                'notes' => 'Ava has had two hypoglycemia episodes this session. Need to schedule call with Dr. Gonzalez to review current basal rates and correction table. Second event occurred at archery on 03/04 (BG 52 mg/dL).',
                'status' => FollowUpStatus::Pending,
                'priority' => FollowUpPriority::Urgent,
                'due_date' => '2026-03-05',
                'completed_at' => null,
                'completed_by' => null,
            ],
            // 2. OVERDUE — Lucas cardiologist notification (high, past due)
            [
                'camper' => $campers['lucas'],
                'created_by' => $medical->id,
                'assigned_to' => $medical->id,
                'treatment_log_id' => null,
                'title' => 'Notify cardiologist of 03/06 respiratory event — review BiPAP settings',
                'notes' => 'Lucas experienced O2 sat drop to 94% on 03/06 morning. Dr. Gonzalez was contacted verbally. Need formal written notification to cardiologist and written confirmation of BiPAP setting change (IPAP from 14 to 15 cmH2O per verbal order).',
                'status' => FollowUpStatus::InProgress,
                'priority' => FollowUpPriority::High,
                'due_date' => '2026-03-06',
                'completed_at' => null,
                'completed_by' => null,
            ],
            // 3. DUE TODAY — Mia heat protocol staff briefing (high)
            [
                'camper' => $campers['mia'],
                'created_by' => $medical->id,
                'assigned_to' => $admin->id,
                'treatment_log_id' => null,
                'title' => 'Brief all outdoor activity staff on Mia heat restriction protocol',
                'notes' => 'Following 03/02 heat incident, all outdoor activity staff need to be re-briefed on the environmental restriction: max 30 min outdoors above 85°F, minimum 8oz hydration per hour. Update activity assignment sheet with restriction flag.',
                'status' => FollowUpStatus::Pending,
                'priority' => FollowUpPriority::High,
                'due_date' => '2026-03-07',
                'completed_at' => null,
                'completed_by' => null,
            ],
            // 4. PENDING (upcoming) — Ethan visual schedule update (medium)
            [
                'camper' => $campers['ethan'],
                'created_by' => $medical->id,
                'assigned_to' => $admin->id,
                'treatment_log_id' => null,
                'title' => 'Update activity transition visual schedule — distribute to all cabin staff',
                'notes' => 'Following 03/05 behavioral escalation during unannounced activity change, revise the visual schedule to include weather-contingency alternatives. Share updated schedule with all Cabin 4 staff before next activity period.',
                'status' => FollowUpStatus::Pending,
                'priority' => FollowUpPriority::Medium,
                'due_date' => '2026-03-09',
                'completed_at' => null,
                'completed_by' => null,
            ],
            // 5. PENDING (upcoming) — Noah wound recheck (low)
            [
                'camper' => $campers['noah'],
                'created_by' => $medical->id,
                'assigned_to' => $medical->id,
                'treatment_log_id' => null,
                'title' => 'Wound recheck — right knee abrasion (due 03/09)',
                'notes' => 'Right knee abrasion sustained 03/03. Dressing changed 03/04. Next scheduled recheck and dressing change due in 5 days. Check for signs of infection: erythema, warmth, discharge. All supplies must be latex-free.',
                'status' => FollowUpStatus::Pending,
                'priority' => FollowUpPriority::Low,
                'due_date' => '2026-03-09',
                'completed_at' => null,
                'completed_by' => null,
            ],
            // 6. IN PROGRESS — Sofia staff training for pool transfer (medium)
            [
                'camper' => $campers['sofia'],
                'created_by' => $medical->id,
                'assigned_to' => $admin->id,
                'treatment_log_id' => null,
                'title' => 'Confirm adaptive aquatics staff trained on two-person pool transfer technique',
                'notes' => 'Per Sofia\'s activity restriction, pool transfers require two trained staff using two-person lift technique. Session coordinator needs to confirm which scheduled staff have completed training and ensure at least two are present at all aquatics sessions.',
                'status' => FollowUpStatus::InProgress,
                'priority' => FollowUpPriority::Medium,
                'due_date' => '2026-03-10',
                'completed_at' => null,
                'completed_by' => null,
            ],
            // 7. COMPLETED — Lily parent notification (low)
            [
                'camper' => $campers['lily'],
                'created_by' => $medical->id,
                'assigned_to' => $medical->id,
                'treatment_log_id' => null,
                'title' => 'Notify Lily\'s parents of 03/01 albuterol rescue use',
                'notes' => 'Per protocol, parents must be notified of any rescue inhaler use within 24 hours. Called Sarah Johnson at 5:30 PM on 03/01. Parents aware and not concerned. Advised to review pollen forecast before outdoor hikes.',
                'status' => FollowUpStatus::Completed,
                'priority' => FollowUpPriority::Low,
                'due_date' => '2026-03-02',
                'completed_at' => '2026-03-01 17:30:00',
                'completed_by' => $medical->id,
            ],
        ];

        foreach ($followUps as $row) {
            $camper = $row['camper'];
            // Use only non-encrypted columns for duplicate detection
            if (MedicalFollowUp::where('camper_id', $camper->id)
                ->where('due_date', $row['due_date'])
                ->where('priority', $row['priority']->value)
                ->where('status', $row['status']->value)
                ->exists()) {
                continue;
            }

            MedicalFollowUp::create([
                'camper_id' => $camper->id,
                'created_by' => $row['created_by'],
                'assigned_to' => $row['assigned_to'],
                'treatment_log_id' => $row['treatment_log_id'],
                'title' => $row['title'],
                'notes' => $row['notes'],
                'status' => $row['status'],
                'priority' => $row['priority'],
                'due_date' => $row['due_date'],
                'completed_at' => $row['completed_at'],
                'completed_by' => $row['completed_by'],
            ]);
        }
    }
}
