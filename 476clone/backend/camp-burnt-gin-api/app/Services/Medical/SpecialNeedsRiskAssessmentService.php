<?php

namespace App\Services\Medical;

use App\Enums\AllergySeverity;
use App\Enums\DiagnosisSeverity;
use App\Enums\MedicalComplexityTier;
use App\Enums\RiskReviewStatus;
use App\Enums\SupervisionLevel;
use App\Models\Camper;
use App\Models\RiskAssessment;
use Illuminate\Support\Facades\DB;

/**
 * SpecialNeedsRiskAssessmentService — Medical Risk Scoring and Supervision Planning
 *
 * This service calculates a numeric risk score (0–100) for each camper based on their
 * medical conditions, behavioral profile, and physical support needs. The score drives:
 *
 *  1. SupervisionLevel — determines the staff-to-camper ratio:
 *       Standard  (score  0–20): 1 staff to 6 campers (typical camp ratio)
 *       Enhanced  (score 21–40): 1 staff to 3 campers (increased supervision)
 *       OneToOne  (score   41+): 1 dedicated staff member per camper
 *
 *  2. MedicalComplexityTier — categorises overall medical care requirements:
 *       Low       (score  0–25): Minimal medical intervention needed
 *       Moderate  (score 26–50): Regular monitoring and medical support
 *       High      (score   51+): Intensive care and specialised staffing
 *
 * What changed in this version (Phase 16):
 *  - Returns a full factor_breakdown array showing each factor's contribution
 *  - Life-threatening allergies now contribute to the score (+15)
 *  - Assessments are persisted to the risk_assessments table for audit trail
 *  - Medical review state (clinical notes, overrides) is preserved across
 *    recalculations when the score change is within the threshold
 *
 * Called by:
 *   CamperController → riskSummary() endpoint
 *   RiskAssessmentController → show(), plus indirectly by model observers
 *   DocumentEnforcementService for compliance checking
 *   Model observers (MedicalRecordObserver, DiagnosisObserver, etc.)
 */
class SpecialNeedsRiskAssessmentService
{
    // ── Risk score point values ──────────────────────────────────────────────

    /** Seizure history — requires an action plan and trained staff nearby */
    protected const RISK_SEIZURES = 20;

    /** G-tube (gastrostomy tube) feeding — requires trained staff for every meal */
    protected const RISK_G_TUBE = 20;

    /** Wandering risk — requires constant physical proximity to prevent elopement */
    protected const RISK_WANDERING = 15;

    /** History of aggression — requires de-escalation-trained staff */
    protected const RISK_AGGRESSION = 15;

    /** Life-threatening allergy (anaphylaxis risk) — requires epinephrine on hand at all times */
    protected const RISK_LIFE_THREATENING_ALLERGY = 15;

    /** Behavioural profile explicitly requires one-to-one supervision */
    protected const RISK_ONE_TO_ONE = 30;

    /** Physical transfer assistance required for mobility devices */
    protected const RISK_TRANSFER_ASSISTANCE = 10;

    /** Developmental delay — requires adapted programming and monitoring */
    protected const RISK_DEVELOPMENTAL_DELAY = 10;

    /** Each severe diagnosis on file */
    protected const RISK_DIAGNOSIS_SEVERE = 5;

    /** Each moderate diagnosis on file */
    protected const RISK_DIAGNOSIS_MODERATE = 3;

    // ── Score ceiling ────────────────────────────────────────────────────────
    protected const RISK_SCORE_CAP = 100;

    // ── Supervision thresholds ───────────────────────────────────────────────
    protected const SUPERVISION_STANDARD_MAX = 20;
    protected const SUPERVISION_ENHANCED_MAX = 40;

    // ── Complexity tier thresholds ───────────────────────────────────────────
    protected const COMPLEXITY_LOW_MAX = 25;
    protected const COMPLEXITY_MODERATE_MAX = 50;

    /**
     * Run the full risk assessment for a camper and return a structured result.
     *
     * This is the single public entry point. It eagerly loads all needed
     * relationships, scores the camper, builds a factor breakdown, persists the
     * result to the risk_assessments table, and returns everything the API needs.
     *
     * @param  Camper  $camper  The camper to assess
     * @return array<string, mixed>
     */
    public function assessCamper(Camper $camper): array
    {
        $camper->loadMissing([
            'medicalRecord',
            'feedingPlan',
            'behavioralProfile',
            'assistiveDevices',
            'diagnoses',
            'allergies',
            'activityPermissions',
        ]);

        $factorBreakdown = $this->buildFactorBreakdown($camper);
        $riskScore = $this->scoreFromBreakdown($factorBreakdown);
        $supervisionLevel = $this->determineSupervisionLevel($riskScore);
        $complexityTier = $this->determineComplexityTier($riskScore);
        $flags = $this->extractFlags($camper);

        $this->persistSupervisionLevel($camper, $supervisionLevel);
        $assessment = $this->persistRiskAssessment(
            $camper,
            $riskScore,
            $supervisionLevel,
            $complexityTier,
            $flags,
            $factorBreakdown
        );

        return [
            'risk_score' => $riskScore,
            'supervision_level' => $supervisionLevel,
            'medical_complexity_tier' => $complexityTier,
            'flags' => $flags,
            'factor_breakdown' => $factorBreakdown,
            'assessment' => $assessment,
        ];
    }

    /**
     * Build the factor breakdown array.
     *
     * Each element describes one scoreable condition:
     *   key      — machine-readable identifier (matches flag names where possible)
     *   label    — human-readable name for UI display
     *   category — groups factors: medical | behavioral | physical | feeding | allergy
     *   points   — how many points this factor adds if present
     *   present  — whether the factor was found in the camper's data
     *   source   — which data section it came from (for tooltip / drill-down)
     *
     * @return array<int, array<string, mixed>>
     */
    protected function buildFactorBreakdown(Camper $camper): array
    {
        $factors = [];

        // ── Medical record factors ───────────────────────────────────────────
        $mr = $camper->medicalRecord;
        $factors[] = [
            'key' => 'seizures',
            'label' => 'Seizure History',
            'category' => 'medical',
            'points' => self::RISK_SEIZURES,
            'present' => (bool) ($mr && $mr->has_seizures),
            'source' => 'Medical Record',
            'tooltip' => 'Documented seizure history on file (+'.self::RISK_SEIZURES.' pts). Camp policy requires an active Seizure Action Plan signed by the physician. All cabin staff must complete seizure response training and know where emergency medication (e.g. rectal diazepam) is stored.',
        ];

        $factors[] = [
            'key' => 'neurostimulator',
            'label' => 'Neurostimulator (VNS/DBS)',
            'category' => 'medical',
            'points' => 0,
            'present' => (bool) ($mr && $mr->has_neurostimulator),
            'source' => 'Medical Record',
            'tooltip' => 'Implanted neurostimulator (VNS or DBS) on file. No score impact — flagged for staff awareness. MRI is contraindicated. Staff must not place magnets near the device. Notify medical staff before any emergency imaging is ordered.',
        ];

        // ── Allergy factors ──────────────────────────────────────────────────
        $hasLifeThreatening = $camper->allergies->contains(
            fn ($a) => $a->severity === AllergySeverity::LifeThreatening
        );
        $factors[] = [
            'key' => 'life_threatening_allergy',
            'label' => 'Life-Threatening Allergy (Anaphylaxis Risk)',
            'category' => 'allergy',
            'points' => self::RISK_LIFE_THREATENING_ALLERGY,
            'present' => $hasLifeThreatening,
            'source' => 'Allergies',
            'tooltip' => 'One or more allergies are classified as life-threatening (anaphylaxis risk, +'.self::RISK_LIFE_THREATENING_ALLERGY.' pts). An epinephrine auto-injector (EpiPen) must be accessible within 30 seconds at all times. Kitchen staff must be briefed before each meal. All cabin staff must know the anaphylaxis response protocol.',
        ];

        // ── Feeding plan factors ─────────────────────────────────────────────
        $fp = $camper->feedingPlan;
        $factors[] = [
            'key' => 'g_tube',
            'label' => 'G-Tube Feeding',
            'category' => 'feeding',
            'points' => self::RISK_G_TUBE,
            'present' => (bool) ($fp && $fp->g_tube),
            'source' => 'Feeding Plan',
            'tooltip' => 'Gastrostomy tube (G-tube) present (+'.self::RISK_G_TUBE.' pts). A staff member trained in tube-feeding procedures must be present at every meal or feeding time. Tube site must be inspected daily for irritation or infection. The medical director must sign off on the feeding protocol before session start.',
        ];

        $factors[] = [
            'key' => 'special_diet',
            'label' => 'Special Dietary Requirements',
            'category' => 'feeding',
            'points' => 0,
            'present' => (bool) ($fp && $fp->special_diet),
            'source' => 'Feeding Plan',
            'tooltip' => 'Special dietary requirements documented (texture-modified, allergen-restricted, etc.). No score impact — flagged for kitchen coordination. Dietary needs must be reviewed with food service before the camper\'s first meal. See feeding plan for full details.',
        ];

        // ── Behavioral profile factors ───────────────────────────────────────
        $bp = $camper->behavioralProfile;

        $factors[] = [
            'key' => 'one_to_one_required',
            'label' => 'Requires One-to-One Supervision',
            'category' => 'behavioral',
            'points' => self::RISK_ONE_TO_ONE,
            'present' => (bool) ($bp && $bp->one_to_one_supervision),
            'source' => 'Behavioral Profile',
            'tooltip' => 'Behavioral profile requires a dedicated 1:1 staff member at all times (+'.self::RISK_ONE_TO_ONE.' pts — highest single factor). The assigned staff member has no other camper responsibilities. Session staffing plans must account for this before the camper\'s arrival.',
        ];

        $factors[] = [
            'key' => 'wandering_risk',
            'label' => 'Wandering / Elopement Risk',
            'category' => 'behavioral',
            'points' => self::RISK_WANDERING,
            'present' => (bool) ($bp && $bp->wandering_risk),
            'source' => 'Behavioral Profile',
            'tooltip' => 'Documented wandering or elopement risk (+'.self::RISK_WANDERING.' pts). Visual contact is required during all transitions (meals, activities, bathroom). A systematic search must begin within 3 minutes if the camper cannot be located. Confirm perimeter security before sessions.',
        ];

        $factors[] = [
            'key' => 'aggression',
            'label' => 'History of Aggression',
            'category' => 'behavioral',
            'points' => self::RISK_AGGRESSION,
            'present' => (bool) ($bp && $bp->aggression),
            'source' => 'Behavioral Profile',
            'tooltip' => 'Documented history of aggressive behavior (+'.self::RISK_AGGRESSION.' pts). Counselors must review this camper\'s specific de-escalation strategies from the behavioral profile before the session. Document any aggressive episode with time, trigger, and response. Do not isolate — maintain safe proximity and involve senior staff if escalation continues.',
        ];

        $factors[] = [
            'key' => 'self_abuse',
            'label' => 'Self-Injurious Behaviour',
            'category' => 'behavioral',
            'points' => 0,
            'present' => (bool) ($bp && $bp->self_abuse),
            'source' => 'Behavioral Profile',
            'tooltip' => 'Documented self-injurious behavior (head-banging, biting, scratching, etc.). No score impact — flagged for counselor awareness. Triggers and calming strategies are in the behavioral profile. Avoid physical restraint unless there is an immediate safety risk; use environment and calming protocol instead.',
        ];

        $factors[] = [
            'key' => 'developmental_delay',
            'label' => 'Developmental Delay',
            'category' => 'behavioral',
            'points' => self::RISK_DEVELOPMENTAL_DELAY,
            'present' => (bool) ($bp && $bp->developmental_delay),
            'source' => 'Behavioral Profile',
            'tooltip' => 'Developmental delay diagnosed (+'.self::RISK_DEVELOPMENTAL_DELAY.' pts). All activities and communications should be adapted to the camper\'s functional (not chronological) age. Allow additional processing time, use simplified instructions, and provide visual schedules where possible. Review the behavioral profile for specific communication accommodations.',
        ];

        // ── Assistive device factors ─────────────────────────────────────────
        $devices = $camper->assistiveDevices;
        $needsTransfer = $devices->contains('requires_transfer_assistance', true);
        $hasCpap = $devices->contains(fn ($d) => stripos((string) $d->device_type, 'cpap') !== false)
                      || $devices->contains(fn ($d) => stripos((string) $d->device_type, 'bipap') !== false);

        $factors[] = [
            'key' => 'transfer_assistance',
            'label' => 'Transfer Assistance Required',
            'category' => 'physical',
            'points' => self::RISK_TRANSFER_ASSISTANCE,
            'present' => $needsTransfer,
            'source' => 'Assistive Devices',
            'tooltip' => 'Assistive devices on file that require staff-assisted transfers (wheelchair, Hoyer lift, specialised seating, +'.self::RISK_TRANSFER_ASSISTANCE.' pts). Staff must complete transfer training before the session. Incorrect technique risks injury to both the camper and staff. Review device-specific handling notes in the assistive devices section.',
        ];

        $factors[] = [
            'key' => 'cpap_bipap',
            'label' => 'CPAP / BiPAP Device',
            'category' => 'physical',
            'points' => 0,
            'present' => $hasCpap,
            'source' => 'Assistive Devices',
            'tooltip' => 'CPAP or BiPAP required for overnight respiratory support. No score impact — flagged for cabin staff. Overnight staff must complete device setup training before the camper\'s first night. If the device fails or is not tolerated, notify medical staff immediately. Do not allow sleep without the device unless cleared by a physician.',
        ];

        // ── Diagnosis severity factors ───────────────────────────────────────
        $diagnoses = $camper->diagnoses;
        $severeCount = $diagnoses->filter(fn ($d) => $d->severity_level === DiagnosisSeverity::Severe)->count();
        $moderateCount = $diagnoses->filter(fn ($d) => $d->severity_level === DiagnosisSeverity::Moderate)->count();

        $factors[] = [
            'key' => 'severe_diagnosis',
            'label' => 'Severe Diagnosis ('.$severeCount.' on file)',
            'category' => 'medical',
            'points' => self::RISK_DIAGNOSIS_SEVERE,
            'present' => $severeCount > 0,
            'count' => $severeCount,
            'per_item' => true,   // each instance adds points
            'source' => 'Diagnoses',
            'tooltip' => 'Each severe diagnosis (e.g. uncontrolled epilepsy, complex cardiac condition, active oncology) adds +'.self::RISK_DIAGNOSIS_SEVERE.' pts to the risk score. Severe diagnoses require pre-session review with the medical director, current emergency contacts, and accessible condition-specific protocols.',
        ];

        $factors[] = [
            'key' => 'moderate_diagnosis',
            'label' => 'Moderate Diagnosis ('.$moderateCount.' on file)',
            'category' => 'medical',
            'points' => self::RISK_DIAGNOSIS_MODERATE,
            'present' => $moderateCount > 0,
            'count' => $moderateCount,
            'per_item' => true,
            'source' => 'Diagnoses',
            'tooltip' => 'Each moderate diagnosis (e.g. controlled asthma, type 1 diabetes, anxiety disorder) adds +'.self::RISK_DIAGNOSIS_MODERATE.' pts. Requires staff familiarity with the camper\'s medication schedule, activity restrictions, and emergency protocol for each condition listed in the diagnoses section.',
        ];

        return $factors;
    }

    /**
     * Sum points from a pre-built factor breakdown, capped at RISK_SCORE_CAP.
     */
    public function scoreFromBreakdown(array $factors): int
    {
        $score = 0;

        foreach ($factors as $factor) {
            if (! $factor['present']) {
                continue;
            }

            $points = $factor['points'] ?? 0;
            $count = $factor['per_item'] ?? false ? ($factor['count'] ?? 1) : 1;
            $score += $points * $count;
        }

        return min($score, self::RISK_SCORE_CAP);
    }

    /**
     * Legacy entry point: calculate numeric score directly from camper data.
     *
     * Kept for backward compatibility with DocumentEnforcementService and tests
     * that call calculateRiskScore() directly. New code should call assessCamper().
     */
    public function calculateRiskScore(Camper $camper): int
    {
        $camper->loadMissing([
            'medicalRecord',
            'feedingPlan',
            'behavioralProfile',
            'assistiveDevices',
            'diagnoses',
            'allergies',
        ]);

        return $this->scoreFromBreakdown($this->buildFactorBreakdown($camper));
    }

    /**
     * Map a numeric risk score to the appropriate supervision level.
     */
    public function determineSupervisionLevel(int $score): SupervisionLevel
    {
        if ($score <= self::SUPERVISION_STANDARD_MAX) {
            return SupervisionLevel::Standard;
        }

        if ($score <= self::SUPERVISION_ENHANCED_MAX) {
            return SupervisionLevel::Enhanced;
        }

        return SupervisionLevel::OneToOne;
    }

    /**
     * Map a numeric risk score to the appropriate medical complexity tier.
     */
    public function determineComplexityTier(int $score): MedicalComplexityTier
    {
        if ($score <= self::COMPLEXITY_LOW_MAX) {
            return MedicalComplexityTier::Low;
        }

        if ($score <= self::COMPLEXITY_MODERATE_MAX) {
            return MedicalComplexityTier::Moderate;
        }

        return MedicalComplexityTier::High;
    }

    /**
     * Build a plain list of active risk flag identifiers.
     *
     * These are short string keys used by DocumentEnforcementService to check
     * which condition-specific documents are required, and by the UI to render
     * flag pills.
     */
    public function extractFlags(Camper $camper): array
    {
        $flags = [];

        $mr = $camper->medicalRecord;
        if ($mr) {
            if ($mr->has_seizures) {
                $flags[] = 'seizures';
            }
            if ($mr->has_neurostimulator) {
                $flags[] = 'neurostimulator';
            }
        }

        if ($camper->allergies->contains(fn ($a) => $a->severity === AllergySeverity::LifeThreatening)) {
            $flags[] = 'life_threatening_allergy';
        }

        $fp = $camper->feedingPlan;
        if ($fp) {
            if ($fp->g_tube) {
                $flags[] = 'g_tube';
            }
            if ($fp->special_diet) {
                $flags[] = 'special_diet';
            }
        }

        $bp = $camper->behavioralProfile;
        if ($bp) {
            if ($bp->wandering_risk) {
                $flags[] = 'wandering_risk';
            }
            if ($bp->aggression) {
                $flags[] = 'aggression';
            }
            if ($bp->self_abuse) {
                $flags[] = 'self_abuse';
            }
            if ($bp->one_to_one_supervision) {
                $flags[] = 'one_to_one_required';
            }
            if ($bp->developmental_delay) {
                $flags[] = 'developmental_delay';
            }
        }

        $devices = $camper->assistiveDevices;
        if ($devices->isNotEmpty()) {
            $flags[] = 'assistive_devices';

            if ($devices->contains('requires_transfer_assistance', true)) {
                $flags[] = 'transfer_assistance';
            }

            $hasCpap = $devices->contains(fn ($d) => stripos((string) $d->device_type, 'cpap') !== false)
                    || $devices->contains(fn ($d) => stripos((string) $d->device_type, 'bipap') !== false);
            if ($hasCpap) {
                $flags[] = 'cpap';
            }
        }

        $hasSevere = $camper->diagnoses->contains(fn ($d) => $d->severity_level === DiagnosisSeverity::Severe);
        if ($hasSevere) {
            $flags[] = 'severe_diagnosis';
        }

        return $flags;
    }

    // ── Persistence ──────────────────────────────────────────────────────────

    /**
     * Persist the supervision level to the camper record (for quick access by other services).
     *
     * Uses saveQuietly() to avoid re-triggering model observers and causing loops.
     * This is a denormalised copy; the authoritative value lives in risk_assessments.
     */
    public function persistSupervisionLevel(Camper $camper, SupervisionLevel $level): void
    {
        if ($camper->supervision_level !== $level) {
            $camper->supervision_level = $level;
            $camper->saveQuietly();
        }
    }

    /**
     * Persist the full risk assessment to the risk_assessments table.
     *
     * Logic:
     *  1. Find the existing current assessment (is_current = true) for this camper.
     *  2. If none exists: create a new record, mark it current.
     *  3. If one exists with the same score: update calculated_at only (preserve review state).
     *  4. If the score changed by ≤ SCORE_CHANGE_THRESHOLD: update the record, preserve review state.
     *  5. If the score changed by > SCORE_CHANGE_THRESHOLD: demote the old record, create a new one.
     *     Copy clinical_notes to the new record but reset review_status to system_calculated
     *     so medical staff are prompted to re-review given the changed risk picture.
     *
     * All operations run inside a transaction to prevent partial-write inconsistencies.
     *
     * @return RiskAssessment The saved (current) assessment record
     */
    protected function persistRiskAssessment(
        Camper $camper,
        int $riskScore,
        SupervisionLevel $supervisionLevel,
        MedicalComplexityTier $complexityTier,
        array $flags,
        array $factorBreakdown
    ): RiskAssessment {
        return DB::transaction(function () use (
            $camper, $riskScore, $supervisionLevel, $complexityTier, $flags, $factorBreakdown
        ) {
            $current = RiskAssessment::where('camper_id', $camper->id)
                ->where('is_current', true)
                ->first();

            $now = now();

            // Case 1: No existing assessment — create fresh.
            if (! $current) {
                return RiskAssessment::create([
                    'camper_id' => $camper->id,
                    'calculated_at' => $now,
                    'risk_score' => $riskScore,
                    'supervision_level' => $supervisionLevel,
                    'medical_complexity_tier' => $complexityTier,
                    'flags' => $flags,
                    'factor_breakdown' => $factorBreakdown,
                    'is_current' => true,
                    'review_status' => RiskReviewStatus::SystemCalculated,
                ]);
            }

            $scoreDelta = abs($current->risk_score - $riskScore);

            // Case 2: Score unchanged — just refresh the timestamp.
            if ($scoreDelta === 0) {
                $current->calculated_at = $now;
                $current->factor_breakdown = $factorBreakdown; // update breakdown even if score same (label counts change)
                $current->save();

                return $current;
            }

            // Case 3: Minor score change (≤ threshold) — update in place, preserve review.
            if ($scoreDelta <= RiskAssessment::SCORE_CHANGE_THRESHOLD) {
                $current->calculated_at = $now;
                $current->risk_score = $riskScore;
                $current->supervision_level = $supervisionLevel;
                $current->medical_complexity_tier = $complexityTier;
                $current->flags = $flags;
                $current->factor_breakdown = $factorBreakdown;
                $current->save();

                return $current;
            }

            // Case 4: Significant score change — demote old, create new.
            // Preserve clinical_notes for continuity; reset review_status.
            $current->is_current = false;
            $current->save();

            return RiskAssessment::create([
                'camper_id' => $camper->id,
                'calculated_at' => $now,
                'risk_score' => $riskScore,
                'supervision_level' => $supervisionLevel,
                'medical_complexity_tier' => $complexityTier,
                'flags' => $flags,
                'factor_breakdown' => $factorBreakdown,
                'is_current' => true,
                'review_status' => RiskReviewStatus::SystemCalculated,
                // Carry forward clinical notes so context is not lost
                'clinical_notes' => $current->clinical_notes,
            ]);
        });
    }
}
