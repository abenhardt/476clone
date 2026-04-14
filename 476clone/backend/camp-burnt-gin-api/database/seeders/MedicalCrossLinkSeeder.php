<?php

namespace Database\Seeders;

use App\Models\BehavioralProfile;
use App\Models\Camper;
use App\Models\MedicalFollowUp;
use App\Models\MedicalIncident;
use App\Models\MedicalRestriction;
use App\Models\TreatmentLog;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeder — cross-links and supplemental records filling gaps in the Phase 11 stack.
 *
 * This seeder depends on MedicalPhase11Seeder and TreatmentLogSeeder having run.
 * It back-fills foreign key relationships that could not be established at initial
 * seed time because the two sides were created in separate seeders.
 *
 * Cross-links established:
 *
 *   MedicalIncident.treatment_log_id (2 incidents):
 *     Ethan: behavioral escalation incident (2026-03-05, behavioral, minor)
 *            → evening medication treatment log (2026-03-05 at 20:30)
 *     Noah:  right knee abrasion incident (2026-03-03, injury, minor)
 *            → knee abrasion first aid treatment log (2026-03-03 at 12:10)
 *
 *   MedicalFollowUp.treatment_log_id (2 follow-ups):
 *     Lucas: cardiologist notification follow-up (due 2026-03-06, in_progress)
 *            → respiratory observation treatment log (2026-03-06 at 07:20)
 *     Ava:   endocrinologist contact follow-up (due 2026-03-05, urgent/overdue)
 *            → glucose administration treatment log (2026-03-04 at 14:12)
 *
 * New MedicalRestriction records (gaps not covered by MedicalPhase11Seeder):
 *   Ava — activity restriction: no high-impact running during insulin adjustment windows
 *   Mia — activity restriction: 20-minute outdoor cap + mandatory shade breaks above 85°F
 *          (supplements the existing environmental restriction; different restriction_type)
 *
 * New BehavioralProfile records (gaps noted in CamperProfileSeeder docblock):
 *   Ava — T1 Diabetes flag: CGM access required at all times; no behavioral concerns
 *   Mia — SCD flag: monitor for vaso-occlusive crisis signs; no behavioral concerns
 *
 * Safe to re-run — each sub-routine checks for existing records before writing.
 */
class MedicalCrossLinkSeeder extends Seeder
{
    public function run(): void
    {
        $medical = User::where('email', 'medical@example.com')->firstOrFail();

        $campers = [
            'ethan' => Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail(),
            'noah' => Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail(),
            'lucas' => Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail(),
            'ava' => Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail(),
            'mia' => Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail(),
        ];

        $this->linkIncidentTreatmentLogs($campers);
        $this->linkFollowUpTreatmentLogs($campers);
        $this->seedMissingRestrictions($campers, $medical);
        $this->seedMissingBehavioralProfiles($campers);

        $this->command->line('  Medical cross-links established (incident/follow-up treatment_log_id, restrictions, behavioral profiles for Ava and Mia).');
    }

    // ── MedicalIncident → TreatmentLog ───────────────────────────────────────

    private function linkIncidentTreatmentLogs(array $campers): void
    {
        // Ethan: behavioral escalation incident (2026-03-05)
        //        → Levetiracetam + Melatonin evening medication treatment log (2026-03-05 at 20:30)
        $ethanIncident = MedicalIncident::where('camper_id', $campers['ethan']->id)
            ->where('incident_date', '2026-03-05')
            ->whereNull('treatment_log_id')
            ->first();

        $ethanTreatment = TreatmentLog::where('camper_id', $campers['ethan']->id)
            ->where('treatment_date', '2026-03-05')
            ->where('treatment_time', '20:30')
            ->first();

        if ($ethanIncident && $ethanTreatment) {
            $ethanIncident->update(['treatment_log_id' => $ethanTreatment->id]);
        }

        // Noah: right knee abrasion incident (2026-03-03)
        //       → abrasion first aid treatment log (2026-03-03 at 12:10)
        $noahIncident = MedicalIncident::where('camper_id', $campers['noah']->id)
            ->where('incident_date', '2026-03-03')
            ->whereNull('treatment_log_id')
            ->first();

        $noahTreatment = TreatmentLog::where('camper_id', $campers['noah']->id)
            ->where('treatment_date', '2026-03-03')
            ->where('treatment_time', '12:10')
            ->first();

        if ($noahIncident && $noahTreatment) {
            $noahIncident->update(['treatment_log_id' => $noahTreatment->id]);
        }
    }

    // ── MedicalFollowUp → TreatmentLog ───────────────────────────────────────

    private function linkFollowUpTreatmentLogs(array $campers): void
    {
        // Lucas: cardiologist notification follow-up (due_date 2026-03-06, in_progress)
        //        → respiratory emergency treatment log (2026-03-06 at 07:20)
        $lucasFollowUp = MedicalFollowUp::where('camper_id', $campers['lucas']->id)
            ->where('due_date', '2026-03-06')
            ->whereNull('treatment_log_id')
            ->first();

        $lucasTreatment = TreatmentLog::where('camper_id', $campers['lucas']->id)
            ->where('treatment_date', '2026-03-06')
            ->where('treatment_time', '07:20')
            ->first();

        if ($lucasFollowUp && $lucasTreatment) {
            $lucasFollowUp->update(['treatment_log_id' => $lucasTreatment->id]);
        }

        // Ava: endocrinologist contact follow-up (due_date 2026-03-05, urgent/overdue)
        //      → glucose administration treatment log (2026-03-04 at 14:12)
        $avaFollowUp = MedicalFollowUp::where('camper_id', $campers['ava']->id)
            ->where('due_date', '2026-03-05')
            ->whereNull('treatment_log_id')
            ->first();

        $avaTreatment = TreatmentLog::where('camper_id', $campers['ava']->id)
            ->where('treatment_date', '2026-03-04')
            ->where('treatment_time', '14:12')
            ->first();

        if ($avaFollowUp && $avaTreatment) {
            $avaFollowUp->update(['treatment_log_id' => $avaTreatment->id]);
        }
    }

    // ── Missing MedicalRestrictions ───────────────────────────────────────────

    private function seedMissingRestrictions(array $campers, User $medical): void
    {
        // Ava — activity restriction for insulin rate adjustment periods.
        // MedicalPhase11Seeder created a dietary restriction for Ava; this adds
        // a separate activity restriction for high-impact exercise.
        if (! MedicalRestriction::where('camper_id', $campers['ava']->id)
            ->where('restriction_type', 'activity')
            ->where('start_date', '2026-03-01')
            ->exists()) {
            MedicalRestriction::create([
                'camper_id' => $campers['ava']->id,
                'created_by' => $medical->id,
                'restriction_type' => 'activity',
                'description' => 'No high-impact running activities or sustained aerobic exercise during active insulin rate adjustment periods. When basal rates have been modified within the past 48 hours, limit exertion to low-intensity activities (walking, swimming at easy pace, arts & crafts).',
                'start_date' => '2026-03-01',
                'end_date' => null,
                'is_active' => true,
                'notes' => 'Applies following any endocrinologist-ordered pump adjustment. Consult nursing staff before Ava participates in high-cardio activities. CGM alarm thresholds should be tightened during adjustment windows to catch hypoglycemia earlier.',
            ]);
        }

        // Mia — activity-level heat restriction (20-minute outdoor cap).
        // MedicalPhase11Seeder created an environmental restriction for Mia with a
        // 30-minute outdoor limit. This adds a complementary activity restriction that
        // specifies the mandatory shade breaks protocol — different restriction_type
        // so both display in the medical record.
        if (! MedicalRestriction::where('camper_id', $campers['mia']->id)
            ->where('restriction_type', 'activity')
            ->where('start_date', '2026-03-01')
            ->exists()) {
            MedicalRestriction::create([
                'camper_id' => $campers['mia']->id,
                'created_by' => $medical->id,
                'restriction_type' => 'activity',
                'description' => 'Avoid extreme heat exposure and direct sun during peak heat hours (11 AM–3 PM). Maximum continuous outdoor activity time 20 minutes when temperature exceeds 85°F. Mandatory shade and rest break after every 20-minute outdoor period.',
                'start_date' => '2026-03-01',
                'end_date' => null,
                'is_active' => true,
                'notes' => 'Sickle cell disease — heat is a primary vaso-occlusive crisis trigger for Mia. Activity staff must proactively bring Mia indoors after 20 minutes of direct sun exposure regardless of her preference. This restriction supplements the environmental outdoor-duration restriction.',
            ]);
        }
    }

    // ── Missing BehavioralProfiles ────────────────────────────────────────────

    private function seedMissingBehavioralProfiles(array $campers): void
    {
        // Ava — T1 Diabetes behavioral note.
        // CamperProfileSeeder intentionally left Ava, Lily, and Mia without profiles.
        // Adding Ava here to cover the clinical note about CGM access requirements.
        if (! BehavioralProfile::where('camper_id', $campers['ava']->id)->exists()) {
            BehavioralProfile::create([
                'camper_id' => $campers['ava']->id,
                'aggression' => false,
                'self_abuse' => false,
                'wandering_risk' => false,
                'one_to_one_supervision' => false,
                'developmental_delay' => false,
                'functioning_age_level' => 'Age-appropriate (13 years)',
                'communication_methods' => ['verbal'],
                'notes' => 'Ava is cognitively typical and age-appropriate with no behavioral concerns. She requires continuous access to her Dexcom G7 CGM at all times and must be permitted to step away from any activity immediately to check her glucose or treat a hypoglycemia episode. Staff should not question or delay these exits. Ava is mature and self-aware about her diabetes management and will communicate her needs clearly.',
            ]);
        }

        // Mia — SCD behavioral note.
        // Adding Mia here to cover the clinical flag about vaso-occlusive crisis monitoring.
        if (! BehavioralProfile::where('camper_id', $campers['mia']->id)->exists()) {
            BehavioralProfile::create([
                'camper_id' => $campers['mia']->id,
                'aggression' => false,
                'self_abuse' => false,
                'wandering_risk' => false,
                'one_to_one_supervision' => false,
                'developmental_delay' => false,
                'functioning_age_level' => 'Age-appropriate (9 years)',
                'communication_methods' => ['verbal'],
                'notes' => 'Mia is communicative and participates well in camp activities with no behavioral concerns. Staff must monitor for early signs of sickle cell vaso-occlusive crisis: sudden onset pain (especially extremities, abdomen, or chest), fever above 101°F, pallor, difficulty breathing, or unusual fatigue. If any of these signs appear, bring Mia to the health office immediately and notify nursing staff — do not wait for symptoms to worsen.',
            ]);
        }
    }
}
