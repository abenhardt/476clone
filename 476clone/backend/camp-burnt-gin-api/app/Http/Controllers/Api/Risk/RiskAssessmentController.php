<?php

namespace App\Http\Controllers\Api\Risk;

use App\Enums\RiskReviewStatus;
use App\Enums\SupervisionLevel;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Camper;
use App\Models\RiskAssessment;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Enum;

/**
 * RiskAssessmentController — Full risk assessment API for campers.
 *
 * Provides four operations:
 *
 *  GET  /api/campers/{camper}/risk-assessment
 *    → Returns the current assessment with factor breakdown, medical review state,
 *      and the complete picture staff need for decision-making.
 *
 *  POST /api/campers/{camper}/risk-assessment/review
 *    → Medical staff validate the system-calculated assessment, optionally adding
 *      clinical notes. Does not change the supervision level.
 *
 *  POST /api/campers/{camper}/risk-assessment/override
 *    → Medical staff or super_admin override the supervision level with a documented
 *      clinical reason. Requires mandatory override_reason.
 *
 *  GET  /api/campers/{camper}/risk-assessment/history
 *    → Paginated history of all past assessments for audit/traceability.
 *
 * All write operations are logged to the audit_logs table for HIPAA compliance.
 */
class RiskAssessmentController extends Controller
{
    public function __construct(
        protected SpecialNeedsRiskAssessmentService $riskService
    ) {}

    /**
     * GET /api/campers/{camper}/risk-assessment
     *
     * Returns the full current risk assessment, running a fresh calculation to ensure
     * the factor breakdown and score reflect the latest medical data.
     *
     * The persisted medical review state (clinical notes, override) is merged into
     * the response so the UI can show the complete picture in a single request.
     */
    public function show(Camper $camper): JsonResponse
    {
        abort_unless(
            app(\App\Policies\RiskAssessmentPolicy::class)->view(auth()->user(), $camper),
            403,
            'You do not have permission to view this risk assessment.'
        );

        AuditLog::logPhiAccess('risk_assessment.view', auth()->user(), $camper);

        $result = $this->riskService->assessCamper($camper);
        /** @var RiskAssessment $assessment */
        $assessment = $result['assessment'];

        return response()->json(['data' => $this->formatAssessment($assessment, $result)]);
    }

    /**
     * POST /api/campers/{camper}/risk-assessment/review
     *
     * Medical staff mark the current assessment as clinically reviewed.
     * Optional clinical_notes may contain PHI — they are stored encrypted.
     *
     * Idempotent: calling this again replaces the previous review notes.
     */
    public function review(Request $request, Camper $camper): JsonResponse
    {
        abort_unless(
            app(\App\Policies\RiskAssessmentPolicy::class)->review(auth()->user(), $camper),
            403,
            'You do not have permission to review this risk assessment.'
        );

        $validated = $request->validate([
            'clinical_notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $assessment = RiskAssessment::where('camper_id', $camper->id)
            ->where('is_current', true)
            ->firstOrFail();

        DB::transaction(function () use ($assessment, $validated, $camper) {
            $assessment->review_status = RiskReviewStatus::Reviewed;
            $assessment->reviewed_by = auth()->id();
            $assessment->reviewed_at = now();
            $assessment->clinical_notes = $validated['clinical_notes'] ?? $assessment->clinical_notes;
            $assessment->save();

            AuditLog::logAdminAction(
                'risk_assessment.reviewed',
                auth()->user(),
                "Risk assessment validated for camper #{$camper->id}",
                ['camper_id' => $camper->id, 'assessment_id' => $assessment->id]
            );
        });

        return response()->json([
            'data' => $this->formatStoredAssessment($assessment->fresh(['reviewer', 'overriddenByUser'])),
            'message' => 'Assessment marked as clinically reviewed.',
        ]);
    }

    /**
     * POST /api/campers/{camper}/risk-assessment/override
     *
     * Override the system-calculated supervision level with clinical authority.
     * Requires a mandatory override_reason (may contain PHI — stored encrypted).
     *
     * The override does NOT change the underlying risk score — it only adjusts
     * the supervision level that staff will act on. The original score and all
     * factors remain visible for transparency.
     */
    public function override(Request $request, Camper $camper): JsonResponse
    {
        abort_unless(
            app(\App\Policies\RiskAssessmentPolicy::class)->override(auth()->user(), $camper),
            403,
            'You do not have permission to override supervision level for this risk assessment.'
        );

        $validated = $request->validate([
            'override_supervision_level' => ['required', new Enum(SupervisionLevel::class)],
            'override_reason' => ['required', 'string', 'min:20', 'max:4000'],
            'clinical_notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $assessment = RiskAssessment::where('camper_id', $camper->id)
            ->where('is_current', true)
            ->firstOrFail();

        DB::transaction(function () use ($assessment, $validated, $camper) {
            $assessment->review_status = RiskReviewStatus::Overridden;
            $assessment->override_supervision_level = SupervisionLevel::from($validated['override_supervision_level']);
            $assessment->override_reason = $validated['override_reason'];
            $assessment->overridden_by = auth()->id();
            $assessment->overridden_at = now();

            // Optionally update or preserve clinical notes
            if (isset($validated['clinical_notes'])) {
                $assessment->clinical_notes = $validated['clinical_notes'];
            }

            // A review is implicitly completed when an override is applied
            if (! $assessment->reviewed_by) {
                $assessment->reviewed_by = auth()->id();
                $assessment->reviewed_at = now();
            }

            $assessment->save();

            // Also update the camper's cached supervision level to the override
            $camper->supervision_level = $assessment->override_supervision_level;
            $camper->saveQuietly();

            AuditLog::logAdminAction(
                'risk_assessment.overridden',
                auth()->user(),
                "Supervision level overridden for camper #{$camper->id}: {$assessment->supervision_level->value} → {$assessment->override_supervision_level->value}",
                [
                    'camper_id' => $camper->id,
                    'assessment_id' => $assessment->id,
                    'original_level' => $assessment->supervision_level->value,
                    'override_level' => $assessment->override_supervision_level->value,
                ]
            );
        });

        return response()->json([
            'data' => $this->formatStoredAssessment($assessment->fresh(['reviewer', 'overriddenByUser'])),
            'message' => 'Supervision level override applied.',
        ]);
    }

    /**
     * GET /api/campers/{camper}/risk-assessment/history
     *
     * Returns the last 20 assessments for a camper, newest first.
     * Used for the audit timeline in the risk assessment UI.
     */
    public function history(Camper $camper): JsonResponse
    {
        abort_unless(
            app(\App\Policies\RiskAssessmentPolicy::class)->viewHistory(auth()->user(), $camper),
            403,
            'You do not have permission to view risk assessment history.'
        );

        $history = RiskAssessment::where('camper_id', $camper->id)
            ->with(['reviewer', 'overriddenByUser'])
            ->orderByDesc('calculated_at')
            ->limit(20)
            ->get();

        return response()->json([
            'data' => $history->map(fn ($a) => $this->formatStoredAssessment($a)),
        ]);
    }

    // ── Response formatters ──────────────────────────────────────────────────

    /**
     * Format the full assessment response for the show endpoint.
     *
     * Combines the freshly-computed values (score, factors) with the persisted
     * review state, and adds UI-ready labels for every enum field.
     */
    protected function formatAssessment(RiskAssessment $assessment, array $computed): array
    {
        $effectiveLevel = $assessment->effectiveSupervisionLevel();

        return [
            'id' => $assessment->id,
            'camper_id' => $assessment->camper_id,
            'calculated_at' => $assessment->calculated_at?->toIso8601String(),

            // ── Score and tier ──────────────────────────────────────────────
            'risk_score' => $assessment->risk_score,
            'risk_level' => $assessment->riskLevelLabel(),
            'risk_level_color' => $assessment->riskLevelColor(),

            // ── Supervision (system-calculated) ─────────────────────────────
            'supervision_level' => $assessment->supervision_level->value,
            'supervision_label' => $assessment->supervision_level->label(),
            'staffing_ratio' => $assessment->supervision_level->getStaffingRatio(),

            // ── Effective supervision (may differ if overridden) ─────────────
            'effective_supervision_level' => $effectiveLevel->value,
            'effective_supervision_label' => $effectiveLevel->label(),
            'effective_staffing_ratio' => $effectiveLevel->getStaffingRatio(),
            'is_overridden' => $assessment->isOverridden(),

            // ── Complexity ──────────────────────────────────────────────────
            'medical_complexity_tier' => $assessment->medical_complexity_tier->value,
            'complexity_label' => $assessment->medical_complexity_tier->label(),

            // ── Flags and factor breakdown ───────────────────────────────────
            'flags' => $assessment->flags ?? [],
            'factor_breakdown' => $assessment->factor_breakdown ?? [],

            // ── Medical review state ────────────────────────────────────────
            'review_status' => $assessment->review_status->value,
            'review_status_label' => $assessment->review_status->label(),
            'is_reviewed_by_staff' => $assessment->review_status->isReviewedByStaff(),
            'reviewed_by' => $assessment->reviewer
                ? ['id' => $assessment->reviewer->id, 'name' => $assessment->reviewer->name]
                : null,
            'reviewed_at' => $assessment->reviewed_at?->toIso8601String(),
            'clinical_notes' => $assessment->clinical_notes,

            // ── Override ────────────────────────────────────────────────────
            'override_supervision_level' => $assessment->override_supervision_level?->value,
            'override_supervision_label' => $assessment->override_supervision_level?->label(),
            'override_reason' => $assessment->override_reason,
            'overridden_by' => $assessment->overriddenByUser
                ? ['id' => $assessment->overriddenByUser->id, 'name' => $assessment->overriddenByUser->name]
                : null,
            'overridden_at' => $assessment->overridden_at?->toIso8601String(),

            // ── Recommendations ────────────────────────────────────────────
            'recommendations' => $this->buildRecommendations($assessment->flags ?? []),

            'is_current' => $assessment->is_current,
        ];
    }

    /**
     * Format a stored assessment record (used for review responses and history).
     */
    protected function formatStoredAssessment(RiskAssessment $assessment): array
    {
        $effectiveLevel = $assessment->effectiveSupervisionLevel();

        return [
            'id' => $assessment->id,
            'calculated_at' => $assessment->calculated_at?->toIso8601String(),
            'risk_score' => $assessment->risk_score,
            'risk_level' => $assessment->riskLevelLabel(),
            'risk_level_color' => $assessment->riskLevelColor(),
            'supervision_level' => $assessment->supervision_level->value,
            'supervision_label' => $assessment->supervision_level->label(),
            'staffing_ratio' => $assessment->supervision_level->getStaffingRatio(),
            'effective_supervision_level' => $effectiveLevel->value,
            'effective_supervision_label' => $effectiveLevel->label(),
            'effective_staffing_ratio' => $effectiveLevel->getStaffingRatio(),
            'is_overridden' => $assessment->isOverridden(),
            'medical_complexity_tier' => $assessment->medical_complexity_tier->value,
            'complexity_label' => $assessment->medical_complexity_tier->label(),
            'flags' => $assessment->flags ?? [],
            'factor_breakdown' => $assessment->factor_breakdown ?? [],
            'review_status' => $assessment->review_status->value,
            'review_status_label' => $assessment->review_status->label(),
            'is_reviewed_by_staff' => $assessment->review_status->isReviewedByStaff(),
            'reviewed_by' => $assessment->reviewer
                ? ['id' => $assessment->reviewer->id, 'name' => $assessment->reviewer->name]
                : null,
            'reviewed_at' => $assessment->reviewed_at?->toIso8601String(),
            'clinical_notes' => $assessment->clinical_notes,
            'override_supervision_level' => $assessment->override_supervision_level?->value,
            'override_supervision_label' => $assessment->override_supervision_level?->label(),
            'override_reason' => $assessment->override_reason,
            'overridden_by' => $assessment->overriddenByUser
                ? ['id' => $assessment->overriddenByUser->id, 'name' => $assessment->overriddenByUser->name]
                : null,
            'overridden_at' => $assessment->overridden_at?->toIso8601String(),
            'is_current' => $assessment->is_current,
        ];
    }

    /**
     * Build actionable recommendations from active risk flags.
     *
     * Each recommendation has:
     *   flag     — the risk flag it addresses
     *   priority — 'critical' | 'high' | 'standard'
     *   text     — the actionable instruction for staff
     */
    protected function buildRecommendations(array $flags): array
    {
        $rules = [
            'seizures' => [
                'priority' => 'critical',
                'text' => 'Ensure a signed seizure action plan is on file. Brief all cabin counselors on recognition and emergency response before the session begins.',
            ],
            'life_threatening_allergy' => [
                'priority' => 'critical',
                'text' => 'Life-threatening allergy on file. Epinephrine auto-injector must be accessible at all times. Notify kitchen staff and all activity leaders.',
            ],
            'g_tube' => [
                'priority' => 'critical',
                'text' => 'G-tube feeding required. A staff member trained in tube-feeding procedures must be present at every meal and feeding time.',
            ],
            'one_to_one_required' => [
                'priority' => 'critical',
                'text' => 'Dedicated one-to-one staff member required at all times. Do not include this camper in standard group supervision counts.',
            ],
            'wandering_risk' => [
                'priority' => 'high',
                'text' => 'Documented wandering/elopement risk. Implement buddy system. Verify secure perimeter awareness during activity transitions and overnight.',
            ],
            'aggression' => [
                'priority' => 'high',
                'text' => 'History of aggressive behaviour. Assign counselors trained in de-escalation. Review behavioural profile and de-escalation strategies before first contact.',
            ],
            'transfer_assistance' => [
                'priority' => 'high',
                'text' => 'Physical transfer assistance required. Assign staff trained in safe transfer techniques. Coordinate transport plan for all activities and excursions.',
            ],
            'cpap' => [
                'priority' => 'high',
                'text' => 'CPAP/BiPAP device required overnight. Ensure cabin staff know device setup, troubleshooting, and emergency response if the device is unavailable.',
            ],
            'neurostimulator' => [
                'priority' => 'standard',
                'text' => 'Implanted neurostimulator on file. Inform medical station. Avoid MRI environments and keep device card accessible in case of emergency transfer.',
            ],
            'developmental_delay' => [
                'priority' => 'standard',
                'text' => 'Developmental delay identified. Adapt activity instructions to functional age level. Allow additional processing time and provide visual cues where possible.',
            ],
            'self_abuse' => [
                'priority' => 'standard',
                'text' => 'Self-injurious behaviour documented. Identify known triggers and de-escalation strategies. Ensure counselors are briefed before activities.',
            ],
            'severe_diagnosis' => [
                'priority' => 'standard',
                'text' => 'One or more severe diagnoses on file. Review full medical record with nursing staff before session start. Ensure condition-specific protocols are in place.',
            ],
            'special_diet' => [
                'priority' => 'standard',
                'text' => 'Special dietary requirements on file. Confirm menu accommodations with kitchen staff and communicate requirements to all meal supervisors.',
            ],
        ];

        $recommendations = [];
        $priorityOrder = ['critical' => 0, 'high' => 1, 'standard' => 2];

        foreach ($flags as $flag) {
            if (isset($rules[$flag])) {
                $recommendations[] = array_merge(['flag' => $flag], $rules[$flag]);
            }
        }

        // Sort: critical first, then high, then standard
        usort($recommendations, fn ($a, $b) => ($priorityOrder[$a['priority']] ?? 3) <=> ($priorityOrder[$b['priority']] ?? 3)
        );

        return $recommendations;
    }
}
