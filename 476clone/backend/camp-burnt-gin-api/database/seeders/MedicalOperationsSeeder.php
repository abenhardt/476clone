<?php

namespace Database\Seeders;

use App\Enums\FollowUpPriority;
use App\Enums\FollowUpStatus;
use App\Enums\IncidentSeverity;
use App\Enums\IncidentType;
use App\Enums\TreatmentType;
use App\Enums\VisitDisposition;
use App\Models\Camper;
use App\Models\MedicalFollowUp;
use App\Models\MedicalIncident;
use App\Models\MedicalRestriction;
use App\Models\MedicalVisit;
use App\Models\TreatmentLog;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeder — medical operations data.
 *
 * Creates realistic medical incidents, visits, follow-ups, treatment logs,
 * and restrictions for the 2025 session (historical data) and pre-2026 review.
 *
 * All data reflects events from Session 1 and Session 2 of Summer 2025,
 * providing rich historical data for the medical dashboard and reports.
 *
 * Treatment logs cover all 5 types:
 *   medication_administered, first_aid, observation, emergency, other
 *
 * Incidents cover all 6 types:
 *   behavioral, medical, injury, environmental, emergency, other
 *
 * Follow-ups include all 4 statuses:
 *   pending, in_progress, completed, cancelled
 */
class MedicalOperationsSeeder extends Seeder
{
    private User $medical;
    private User $nurse;

    public function run(): void
    {
        $this->medical = User::where('email', 'medical@example.com')->firstOrFail();
        $this->nurse = User::where('email', 'medical2@campburntgin.org')->firstOrFail();

        $this->treatmentLogsEthan();
        $this->treatmentLogsLily();
        $this->treatmentLogsNoah();
        $this->treatmentLogsAva();
        $this->treatmentLogsLucas();
        $this->treatmentLogsMia();
        $this->treatmentLogsElijah();
        $this->treatmentLogsCarlos();

        $this->incidentsAndVisits();
        $this->followUps();
        $this->restrictions();

        $this->command->line('  Medical operations seeded: treatment logs, incidents, visits, follow-ups, restrictions.');
    }

    // ── Treatment Logs ────────────────────────────────────────────────────────

    private function treatmentLogsEthan(): void
    {
        $c = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        if (TreatmentLog::where('camper_id', $c->id)->exists()) {
            return;
        }

        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-10', 'treatment_time' => '07:00:00', 'type' => TreatmentType::MedicationAdministered, 'title' => 'Morning Levetiracetam administered', 'description' => 'Levetiracetam 500mg given with breakfast at 7am. Ethan cooperative.', 'outcome' => 'No adverse effects. Medication consumed fully.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-11', 'treatment_time' => '14:30:00', 'type' => TreatmentType::Observation, 'title' => 'Transition difficulty — swimming to arts & crafts', 'description' => 'Ethan became distressed during the activity switch from swimming to arts & crafts. Staff used visual schedule and 5-minute warning. Camper self-regulated within 10 minutes.', 'outcome' => 'Resolved without medical intervention. Visual schedule strategy effective.', 'follow_up_required' => true, 'follow_up_notes' => 'Update activity transition plan in behavioral profile. Share visual timer technique with all cabin staff.']);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-11', 'treatment_time' => '19:00:00', 'type' => TreatmentType::MedicationAdministered, 'title' => 'Evening Levetiracetam + Melatonin', 'description' => 'Levetiracetam 500mg and Melatonin 3mg administered at 7pm. Ethan settled within 25 minutes.', 'outcome' => 'Slept through the night. No seizure activity observed.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->nurse->id, 'treatment_date' => '2025-06-13', 'treatment_time' => '10:00:00', 'type' => TreatmentType::Observation, 'title' => 'Pre-departure health check', 'description' => 'End-of-session health review. Ethan in good health. No unreported incidents. BP 95/58, HR 82, Temp 98.4°F.', 'outcome' => 'Cleared for departure. Health summary provided to parent.', 'follow_up_required' => false]);
    }

    private function treatmentLogsLily(): void
    {
        $c = Camper::where('first_name', 'Lily')->where('last_name', 'Johnson')->firstOrFail();
        if (TreatmentLog::where('camper_id', $c->id)->exists()) {
            return;
        }

        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->nurse->id, 'treatment_date' => '2025-06-10', 'treatment_time' => '16:00:00', 'type' => TreatmentType::FirstAid, 'title' => 'Albuterol rescue — mild wheeze after outdoor activity', 'description' => 'Lily reported mild chest tightness after 30 min of outdoor activity in moderate pollen conditions. Administered 2 puffs albuterol via spacer. O2 sat 98% before and after.', 'outcome' => 'Wheeze resolved in 5 minutes. Camper returned to activity.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-12', 'treatment_time' => '09:00:00', 'type' => TreatmentType::MedicationAdministered, 'title' => 'Cetirizine administered — daily antihistamine', 'description' => 'Cetirizine 5mg given with breakfast per morning medication schedule.', 'outcome' => 'No adverse effects. Pollen count moderate — no symptoms today.', 'follow_up_required' => false]);
    }

    private function treatmentLogsNoah(): void
    {
        $c = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();
        if (TreatmentLog::where('camper_id', $c->id)->exists()) {
            return;
        }

        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-09', 'treatment_time' => '07:00:00', 'type' => TreatmentType::MedicationAdministered, 'title' => 'Morning Levothyroxine administered', 'description' => 'Levothyroxine 50mcg given on empty stomach at 7am (30 min before breakfast). No calcium supplements within 4 hours.', 'outcome' => 'Compliant. No issues.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->nurse->id, 'treatment_date' => '2025-06-11', 'treatment_time' => '11:20:00', 'type' => TreatmentType::FirstAid, 'title' => 'Minor abrasion — right knee', 'description' => 'Noah tripped on the path near Cabin 3. Small abrasion (~2cm) on right knee. Wound cleaned with saline, Neosporin applied, covered with bandage.', 'outcome' => 'Wound clean and covered. Camper returned to activity.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->nurse->id, 'treatment_date' => '2025-06-13', 'treatment_time' => '08:00:00', 'type' => TreatmentType::MedicationAdministered, 'title' => 'Final morning Levothyroxine — departure day', 'description' => 'Levothyroxine administered before breakfast per schedule. Departure day check: camper healthy, no concerns.', 'outcome' => 'Session completed without medical incident.', 'follow_up_required' => false]);
    }

    private function treatmentLogsAva(): void
    {
        $c = Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail();
        if (TreatmentLog::where('camper_id', $c->id)->exists()) {
            return;
        }

        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-09', 'treatment_time' => '12:30:00', 'type' => TreatmentType::Observation, 'title' => 'Pre-lunch BG check', 'description' => 'BG 142 mg/dL. Within target range 80–180. No bolus correction needed. Ava ate full lunch.', 'outcome' => 'Within target. No intervention.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-10', 'treatment_time' => '15:45:00', 'type' => TreatmentType::FirstAid, 'title' => 'Hypoglycemia episode — BG 58 mg/dL', 'description' => 'Dexcom alarm at 3:45pm. BG confirmed 58 mg/dL via fingerstick. Administered 4 glucose tabs (15g carbs). Ava sat quietly in medical hut for 15 min.', 'outcome' => 'BG rose to 94 mg/dL at 15 min recheck. Camper recovered fully and returned to activity.', 'follow_up_required' => true, 'follow_up_notes' => 'Adjusted afternoon basal rate per parent-provided instructions. Documented in Dexcom log. Reviewed snack schedule with Ava.']);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-11', 'treatment_time' => '07:10:00', 'type' => TreatmentType::Observation, 'title' => 'Morning fasting BG — pump site change', 'description' => 'Fasting BG 118 mg/dL. Pump running normally. Site change performed (day 3) — new site right abdomen. No issues.', 'outcome' => 'Within parameters.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->nurse->id, 'treatment_date' => '2025-06-12', 'treatment_time' => '21:15:00', 'type' => TreatmentType::Observation, 'title' => 'Bedtime BG check', 'description' => 'Bedtime BG 165 mg/dL — elevated but acceptable for overnight. No correction bolus needed per correction table. Dexcom overnight alarm set to 70 mg/dL low alert.', 'outcome' => 'Acceptable for overnight. No intervention.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-13', 'treatment_time' => '07:00:00', 'type' => TreatmentType::Emergency, 'title' => 'Hyperglycemia with ketones — morning alert', 'description' => 'Ava woke with BG 312 mg/dL and Dexcom trending up. Ketones tested: 0.8 mmol/L (moderate). Correction bolus 3U given per table. Parent notified. Water intake increased. Pump site inspected — site failure suspected, new site placed.', 'outcome' => 'BG decreased to 198 mg/dL in 2 hours. Ketones cleared. Departure delayed 30 min for confirmation. Parent present at departure.', 'follow_up_required' => true, 'follow_up_notes' => 'Called Dr. Gonzalez — documented in chart. Recommend parent review site rotation schedule. Post-session follow-up with endocrinology.']);
    }

    private function treatmentLogsLucas(): void
    {
        $c = Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail();
        if (TreatmentLog::where('camper_id', $c->id)->exists()) {
            return;
        }

        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-09', 'treatment_time' => '21:00:00', 'type' => TreatmentType::Observation, 'title' => 'BiPAP setup — first night', 'description' => 'Family-provided BiPAP set up in cabin. Settings confirmed: IPAP 14 / EPAP 8. Mask fit verified. Lucas instructed staff on setup preferences. Wore mask without difficulty.', 'outcome' => 'Slept through the night. O2 sat 95–97% throughout. No alarms.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-11', 'treatment_time' => '09:30:00', 'type' => TreatmentType::MedicationAdministered, 'title' => 'Morning medications — Deflazacort, Lisinopril, Carvedilol', 'description' => 'Deflazacort 18mg, Lisinopril 5mg, and Carvedilol 3.125mg given with breakfast. BP 108/68 mmHg pre-medication. HR 62 bpm.', 'outcome' => 'Vitals stable. Medications tolerated well.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->nurse->id, 'treatment_date' => '2025-06-11', 'treatment_time' => '14:00:00', 'type' => TreatmentType::Observation, 'title' => 'Respiratory check — post-morning activities', 'description' => 'Routine check after morning activities. RR 18/min, O2 sat 97% on room air. No increased work of breathing. Lucas reports feeling fine.', 'outcome' => 'Normal parameters.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->nurse->id, 'treatment_date' => '2025-06-12', 'treatment_time' => '10:00:00', 'type' => TreatmentType::Other, 'title' => 'Power wheelchair battery incident', 'description' => 'Lucas\' wheelchair battery died during evening activity (forgot to charge previous night). He was assisted manually to medical hut. Battery charged. Chair fully operational within 2 hours.', 'outcome' => 'Equipment issue — no medical incident. Wheelchair operational. Added battery check to daily log.', 'follow_up_required' => false]);
    }

    private function treatmentLogsMia(): void
    {
        $c = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();
        if (TreatmentLog::where('camper_id', $c->id)->exists()) {
            return;
        }

        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-10', 'treatment_time' => '08:00:00', 'type' => TreatmentType::MedicationAdministered, 'title' => 'Hydroxyurea + Folic Acid administered', 'description' => 'Daily medications given with breakfast at 8am. Mia well-hydrated (approx 32oz fluid intake by 8am per self-report). No complaints.', 'outcome' => 'No issues.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->nurse->id, 'treatment_date' => '2025-06-12', 'treatment_time' => '13:45:00', 'type' => TreatmentType::Observation, 'title' => 'Heat check — high temperature day (91°F)', 'description' => 'Outdoor temp 91°F. Per SCD protocol, Mia brought inside after 45 min outdoor activity. Temp 98.6°F. Well-hydrated. No pain complaints. Rested indoors with AC for 1 hour before returning to activities.', 'outcome' => 'No crisis. Camper felt fine after rest and additional fluids.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-12', 'treatment_time' => '20:30:00', 'type' => TreatmentType::Observation, 'title' => 'Evening pain check — hip complaint', 'description' => 'Mia reported mild right hip discomfort after afternoon activities (pain 3/10). Vital signs normal. No fever. Acetaminophen 325mg given. Position of comfort provided.', 'outcome' => 'Pain decreased to 1/10 within 1 hour. Slept normally. Likely activity-related.', 'follow_up_required' => true, 'follow_up_notes' => 'Monitor hip pain during remaining session. Reduce high-impact activities if recurrence.']);
    }

    private function treatmentLogsElijah(): void
    {
        $c = Camper::where('first_name', 'Elijah')->where('last_name', 'Green')->firstOrFail();
        if (TreatmentLog::where('camper_id', $c->id)->exists()) {
            return;
        }

        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-10', 'treatment_time' => '07:00:00', 'type' => TreatmentType::Observation, 'title' => 'Morning airway clearance therapy', 'description' => 'Elijah completed 20-min Vest therapy following albuterol nebulizer treatment. Independent setup with supervision. Sputum production: moderate, clear. No respiratory distress.', 'outcome' => 'Completed without issue. Good compliance.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->nurse->id, 'treatment_date' => '2025-06-11', 'treatment_time' => '12:00:00', 'type' => TreatmentType::Observation, 'title' => 'Enzyme reminder — lunch', 'description' => 'Elijah forgot to take pancreatic enzymes before lunch (first reminder needed this session). Enzymes given before he began eating. No GI symptoms.', 'outcome' => 'Ate lunch normally. No GI symptoms.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-12', 'treatment_time' => '19:00:00', 'type' => TreatmentType::Observation, 'title' => 'Evening airway clearance + BG check', 'description' => 'Evening vest therapy completed. BG pre-dinner: 156 mg/dL. Insulin correction 1U per table. Dinner BG 112 mg/dL 2 hours later.', 'outcome' => 'BG managed. Therapy completed. Good evening overall.', 'follow_up_required' => false]);
    }

    private function treatmentLogsCarlos(): void
    {
        $c = Camper::where('first_name', 'Carlos')->where('last_name', 'Rivera')->firstOrFail();
        if (TreatmentLog::where('camper_id', $c->id)->exists()) {
            return;
        }

        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-10', 'treatment_time' => '09:00:00', 'type' => TreatmentType::MedicationAdministered, 'title' => 'Morning medications — Lansoprazole + Miralax', 'description' => 'Lansoprazole via G-tube and Miralax in tube feeding administered. Carlos supervised self-administration. Vitals: BP 102/60, HR 70, O2 sat 96% on room air.', 'outcome' => 'Medications given without issue.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->nurse->id, 'treatment_date' => '2025-06-11', 'treatment_time' => '21:00:00', 'type' => TreatmentType::Observation, 'title' => 'Nighttime G-tube supplemental feeding', 'description' => 'Nutren 1.5 Cal 240mL via G-tube administered over 30 minutes. Carlos directed nurse on his preferred procedure. Tube patent, no residual.', 'outcome' => 'Completed without issue. BiPAP setup confirmed before sleep.', 'follow_up_required' => false]);
        TreatmentLog::create(['camper_id' => $c->id, 'recorded_by' => $this->medical->id, 'treatment_date' => '2025-06-13', 'treatment_time' => '08:00:00', 'type' => TreatmentType::Emergency, 'title' => 'BiPAP failure — mask seal issue', 'description' => 'BiPAP alarmed at 5:30am. Mask seal failed — low O2 sat alarm (91%). Night staff replaced mask cushion and re-secured. O2 sat returned to 96% within 5 minutes. Medical director notified.', 'outcome' => 'Equipment issue resolved. Carlos remained calm and directed staff. No clinical deterioration. Departure cleared.', 'follow_up_required' => true, 'follow_up_notes' => 'Document equipment failure. Recommend family bring backup mask cushion next session. BiPAP settings verified and reset.']);
    }

    // ── Incidents and Visits ──────────────────────────────────────────────────

    private function incidentsAndVisits(): void
    {
        $ethan = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        $ava = Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail();
        $mia = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();
        $liam = Camper::where('first_name', 'Liam')->where('last_name', 'Young')->firstOrFail();
        $noah = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();
        $carlos = Camper::where('first_name', 'Carlos')->where('last_name', 'Rivera')->firstOrFail();

        if (MedicalIncident::where('camper_id', $ethan->id)->exists()) {
            return;
        }

        // Ethan — behavioral incident (transition meltdown)
        MedicalIncident::create([
            'camper_id' => $ethan->id,
            'recorded_by' => $this->medical->id,
            'type' => IncidentType::Behavioral,
            'severity' => IncidentSeverity::Minor,
            'title' => 'Transition meltdown — pool to crafts',
            'description' => 'Ethan became verbally distressed and refused to leave the pool area when session ended. He shouted and pulled away from staff. Behavioral de-escalation protocol followed — visual timer shown, verbal warning given. Resolved in 12 minutes.',
            'location' => 'Swimming pool transition area',
            'witnesses' => 'Counselor J. Torres, Lifeguard M. Reed',
            'escalation_required' => false,
            'incident_date' => '2025-06-11',
            'incident_time' => '14:30:00',
        ]);

        // Ava — medical incident (hypoglycemia)
        $incident = MedicalIncident::create([
            'camper_id' => $ava->id,
            'recorded_by' => $this->medical->id,
            'type' => IncidentType::Medical,
            'severity' => IncidentSeverity::Moderate,
            'title' => 'Hypoglycemia episode — BG 58 mg/dL',
            'description' => 'Dexcom alarmed at 3:45pm. BG confirmed 58 mg/dL. Camper was pale and reported feeling shaky. Administered 15g fast-acting carbs (glucose tabs). Parent notified by phone.',
            'location' => 'Outdoor activity area — behind Arts Building',
            'witnesses' => 'Activity counselor B. Johnson',
            'escalation_required' => false,
            'incident_date' => '2025-06-10',
            'incident_time' => '15:45:00',
        ]);

        MedicalFollowUp::create([
            'camper_id' => $ava->id,
            'created_by' => $this->medical->id,
            'assigned_to' => $this->nurse->id,
            'title' => 'Review afternoon basal rate with parent',
            'notes' => 'BG 58 mg/dL episode during high-activity period. Per parent, afternoon basal may need adjustment during camp activities. Contact parent to review pump settings.',
            'status' => FollowUpStatus::Completed,
            'priority' => FollowUpPriority::High,
            'due_date' => '2025-06-11',
            'completed_at' => now()->subMonths(9)->setTime(10, 0),
            'completed_by' => $this->medical->id,
        ]);

        // Mia — environmental incident (heat exposure)
        MedicalIncident::create([
            'camper_id' => $mia->id,
            'recorded_by' => $this->nurse->id,
            'type' => IncidentType::Environmental,
            'severity' => IncidentSeverity::Minor,
            'title' => 'Heat exposure — 91°F ambient temperature',
            'description' => 'Mia was outdoors in 91°F heat. Per SCD protocol, she was brought inside for observation after 45 minutes of outdoor activity. Temperature normal, well-hydrated, no pain.',
            'location' => 'Outdoor recreation area',
            'witnesses' => 'Counselor T. Kim',
            'escalation_required' => false,
            'incident_date' => '2025-06-12',
            'incident_time' => '13:45:00',
        ]);

        // Liam — seizure incident
        $incident2 = MedicalIncident::create([
            'camper_id' => $liam->id,
            'recorded_by' => $this->medical->id,
            'type' => IncidentType::Medical,
            'severity' => IncidentSeverity::Moderate,
            'title' => 'Atypical absence seizure — dining hall',
            'description' => 'Liam became unresponsive during dinner — staring episode with rhythmic hand movements. Duration approximately 30 seconds. Counselor immediately notified nurse. Airway protected, positioned safely. Camper recovered with typical post-ictal state (~3 min drowsiness).',
            'location' => 'Dining Hall, Table 4',
            'witnesses' => 'Counselor M. Davis, 3 other campers',
            'escalation_required' => false,
            'incident_date' => '2025-06-10',
            'incident_time' => '18:20:00',
        ]);

        MedicalFollowUp::create([
            'camper_id' => $liam->id,
            'created_by' => $this->medical->id,
            'assigned_to' => $this->medical->id,
            'title' => 'Notify parents and neurologist of breakthrough seizure',
            'notes' => 'Liam had breakthrough absence seizure during dinner. Last documented seizure was September 2025. Parent called during incident — updated on outcome. Recommend notifying neurologist for medication review.',
            'status' => FollowUpStatus::Completed,
            'priority' => FollowUpPriority::Urgent,
            'due_date' => '2025-06-11',
            'completed_at' => now()->subMonths(9)->setTime(8, 30),
            'completed_by' => $this->medical->id,
        ]);

        // Noah — injury incident
        MedicalIncident::create([
            'camper_id' => $noah->id,
            'recorded_by' => $this->nurse->id,
            'type' => IncidentType::Injury,
            'severity' => IncidentSeverity::Minor,
            'title' => 'Minor knee abrasion — path near Cabin 3',
            'description' => 'Noah tripped on uneven path near Cabin 3 and sustained a small abrasion on his right knee. Wound approximately 2cm diameter. Superficial only.',
            'location' => 'Path between Cabin 3 and recreation hall',
            'witnesses' => 'Counselor A. Smith',
            'escalation_required' => false,
            'incident_date' => '2025-06-11',
            'incident_time' => '11:20:00',
        ]);

        // Carlos — emergency incident (BiPAP failure)
        MedicalIncident::create([
            'camper_id' => $carlos->id,
            'recorded_by' => $this->medical->id,
            'type' => IncidentType::Emergency,
            'severity' => IncidentSeverity::Severe,
            'title' => 'BiPAP mask failure — O2 saturation alarm',
            'description' => 'BiPAP alarmed at 5:30am on final session day. Carlos\'s BiPAP mask seal had failed. O2 saturation dropped to 91%. Night staff replaced mask cushion and re-secured within 5 minutes. O2 sat returned to 96%.',
            'location' => 'Cabin 1 — Carlos\'s sleeping area',
            'witnesses' => 'Night counselor P. Washington, RN on call',
            'escalation_required' => true,
            'escalation_notes' => 'Medical director notified immediately per SMA respiratory emergency protocol. No deterioration. Equipment failure documented for equipment review committee.',
            'incident_date' => '2025-06-13',
            'incident_time' => '05:30:00',
        ]);

        // Medical visit — Ava's hyperglycemia visit
        MedicalVisit::create([
            'camper_id' => $ava->id,
            'recorded_by' => $this->medical->id,
            'visit_date' => '2025-06-13',
            'visit_time' => '07:00:00',
            'chief_complaint' => 'Hyperglycemia with trace ketones — departure day',
            'symptoms' => 'BG 312 mg/dL on waking, trending up. Dexcom alarm. Ketones 0.8 mmol/L. Camper reports fatigue and mild nausea. No vomiting.',
            'treatment_provided' => 'Correction bolus 3U insulin. Pump site inspected — failure suspected. New site placed. Oral hydration encouraged (water). Parent notified by phone at 7:15am.',
            'medications_administered' => 'Insulin 3U bolus via OmniPod correction.',
            'vitals' => ['bp' => '100/62', 'hr' => 88, 'temp' => '98.8', 'o2_sat' => 98, 'weight_kg' => null],
            'disposition' => VisitDisposition::Monitoring,
            'disposition_notes' => 'BG repeated at 2 hours — 198 mg/dL, ketones cleared. Departure delayed 30 min. Parent present for pickup and received complete report.',
            'follow_up_required' => true,
            'follow_up_notes' => 'Recommend parent contact Dr. Gonzalez within 24 hours for post-camp insulin adjustment.',
        ]);

        // Medical visit — Lucas respiratory check
        MedicalVisit::create([
            'camper_id' => Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail()->id,
            'recorded_by' => $this->nurse->id,
            'visit_date' => '2025-06-11',
            'visit_time' => '14:00:00',
            'chief_complaint' => 'Routine respiratory assessment — post-activity check',
            'symptoms' => 'No acute symptoms. Routine monitoring.',
            'treatment_provided' => 'Vital signs assessment only.',
            'medications_administered' => null,
            'vitals' => ['bp' => '108/68', 'hr' => 62, 'temp' => '97.9', 'o2_sat' => 97, 'rr' => 18],
            'disposition' => VisitDisposition::ReturnedToActivity,
            'disposition_notes' => 'All within normal parameters. Cleared to return to activity.',
            'follow_up_required' => false,
        ]);
    }

    // ── Follow-ups ────────────────────────────────────────────────────────────

    private function followUps(): void
    {
        if (MedicalFollowUp::where('title', 'Post-session Ethan transition protocol review')->exists()) {
            return;
        }

        $ethan = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        $mia = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();
        $wyatt = Camper::where('first_name', 'Wyatt')->where('last_name', 'Mitchell')->firstOrFail();
        $nathan = Camper::where('first_name', 'Nathan')->where('last_name', 'Roberts')->firstOrFail();

        // Pending follow-up
        MedicalFollowUp::create([
            'camper_id' => $ethan->id,
            'created_by' => $this->medical->id,
            'assigned_to' => $this->nurse->id,
            'title' => 'Post-session Ethan transition protocol review',
            'notes' => 'Review and update Ethan\'s visual schedule and transition warning protocol before 2026 session. Coordinate with parent and school OT for updated behavioral strategies.',
            'status' => FollowUpStatus::Pending,
            'priority' => FollowUpPriority::Medium,
            'due_date' => '2026-04-01',
        ]);

        // In-progress follow-up
        MedicalFollowUp::create([
            'camper_id' => $mia->id,
            'created_by' => $this->medical->id,
            'assigned_to' => $this->medical->id,
            'title' => 'Review Mia\'s heat protocol for 2026 session',
            'notes' => 'Mia had one heat exposure event in 2025. Update heat activity restriction thresholds and ensure cooling station proximity for 2026. Discuss with family regarding any updated SCD guidelines.',
            'status' => FollowUpStatus::InProgress,
            'priority' => FollowUpPriority::Medium,
            'due_date' => '2026-05-01',
        ]);

        // Cancelled follow-up
        MedicalFollowUp::create([
            'camper_id' => $wyatt->id,
            'created_by' => $this->nurse->id,
            'assigned_to' => null,
            'title' => 'VP shunt monitoring protocol annual review',
            'notes' => 'Annual review of shunt malfunction protocol with Wyatt\'s neurosurgeon office. Cancelled — neurosurgeon office sent updated protocol document directly.',
            'status' => FollowUpStatus::Cancelled,
            'priority' => FollowUpPriority::Low,
            'due_date' => '2026-03-01',
        ]);

        // Urgent pending (Dravet protocol update)
        MedicalFollowUp::create([
            'camper_id' => $nathan->id,
            'created_by' => $this->medical->id,
            'assigned_to' => $this->medical->id,
            'title' => 'Obtain updated Dravet emergency protocol for 2026',
            'notes' => 'Nathan\'s emergency protocol from 2025 application is expiring. Need updated seizure emergency plan from Dr. Freeman at Children\'s Hospital before S1-2026 application can be approved.',
            'status' => FollowUpStatus::Pending,
            'priority' => FollowUpPriority::Urgent,
            'due_date' => '2026-05-01',
        ]);
    }

    // ── Medical Restrictions ──────────────────────────────────────────────────

    private function restrictions(): void
    {
        if (MedicalRestriction::exists()) {
            return;
        }

        $emma = Camper::where('first_name', 'Emma')->where('last_name', 'Anderson')->firstOrFail();
        $chloe = Camper::where('first_name', 'Chloe')->where('last_name', 'Rodriguez')->firstOrFail();
        $mia = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();
        $sofia = Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail();
        $harper = Camper::where('first_name', 'Harper')->where('last_name', 'Carter')->firstOrFail();
        $lucas = Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail();

        MedicalRestriction::create(['camper_id' => $emma->id, 'created_by' => $this->medical->id, 'restriction_type' => 'activity', 'description' => 'Swimming requires 1:1 water aide with lifeguard certification. TLSO brace must be removed for swimming and replaced immediately after.', 'start_date' => '2025-06-09', 'end_date' => null]);
        MedicalRestriction::create(['camper_id' => $chloe->id, 'created_by' => $this->medical->id, 'restriction_type' => 'environmental', 'description' => 'Must remain in air-conditioned environment when ambient temperature exceeds 85°F. No prolonged outdoor exposure without shade and cooling.', 'start_date' => '2025-06-09', 'end_date' => null]);
        MedicalRestriction::create(['camper_id' => $mia->id, 'created_by' => $this->medical->id, 'restriction_type' => 'activity', 'description' => 'Outdoor activity restricted to 30-minute maximum when temperature exceeds 88°F. Mandatory cool-down period in air-conditioned area after each outdoor period.', 'start_date' => '2025-06-09', 'end_date' => null]);
        MedicalRestriction::create(['camper_id' => $sofia->id, 'created_by' => $this->medical->id, 'restriction_type' => 'environmental', 'description' => 'STRICT latex-free environment. All supplies, gloves, and materials in contact with Sofia must be latex-free. No latex balloons in her area.', 'start_date' => '2025-06-09', 'end_date' => null]);
        MedicalRestriction::create(['camper_id' => $harper->id, 'created_by' => $this->medical->id, 'restriction_type' => 'activity', 'description' => 'No contact sports, full-body tackle activities, or rough-contact play due to osteogenesis imperfecta. Swimming and seated activities fully permitted. Adapted sports welcome.', 'start_date' => '2026-06-08', 'end_date' => null]);
        MedicalRestriction::create(['camper_id' => $lucas->id, 'created_by' => $this->medical->id, 'restriction_type' => 'activity', 'description' => 'Do not lift Lucas by the axilla (underarms) — risk of shoulder dislocation and injury due to DMD muscle weakness. Always transfer using sling or transfer board with proper technique.', 'start_date' => '2025-06-09', 'end_date' => null]);
    }
}
