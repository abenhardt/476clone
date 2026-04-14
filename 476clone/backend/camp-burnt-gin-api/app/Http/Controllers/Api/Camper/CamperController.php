<?php

namespace App\Http\Controllers\Api\Camper;

use App\Http\Controllers\Controller;
use App\Http\Requests\Camper\StoreCamperRequest;
use App\Http\Requests\Camper\UpdateCamperRequest;
use App\Models\AuditLog;
use App\Models\Camper;
use App\Services\Document\DocumentEnforcementService;
use App\Services\Medical\MedicalAlertService;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * CamperController — Full CRUD for camper profiles, plus medical intelligence endpoints.
 *
 * A "camper" is a child registered in the system by their parent (applicant).
 * This controller manages who can see and change camper records:
 *
 *   - Admins      → full visibility and control over all campers.
 *   - Medical     → read access to all campers (clinical workflows).
 *   - Applicants  → see and manage only their own children.
 *
 * Beyond basic CRUD, it also exposes three computed endpoints that derive
 * clinical intelligence directly from the camper's medical record at request
 * time — no separate alerts table needed.
 *
 * All actions are gated by CamperPolicy authorization rules.
 */
class CamperController extends Controller
{
    /**
     * Display a listing of campers.
     *
     * GET /api/campers
     *
     * The response data varies by the caller's role:
     *   - Admin       → all campers, with user/medical data, plus optional name/ID search.
     *   - Medical     → all campers, with deeper medical record detail (allergies, meds, diagnoses).
     *   - Applicant   → only campers belonging to the authenticated user.
     *   - Other roles → empty result set (no error, just nothing returned).
     *
     * Results are paginated in pages of 15.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            // Confirm this admin is allowed to list all campers via CamperPolicy.
            $this->authorize('viewAny', Camper::class);
            // Eager-load the parent user and the latest application with session info.
            // Medical data (allergies, medications, etc.) is intentionally excluded here —
            // the list view does not display PHI; it is loaded on the individual camper detail page.
            $query = Camper::with(['user', 'applications.campSession']);
            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    // full_name is a virtual computed attribute — not a stored DB column.
                    // Search first_name and last_name separately to avoid a SQL column-not-found error.
                    $q->where('first_name', 'like', '%'.$search.'%')
                        ->orWhere('last_name', 'like', '%'.$search.'%');
                    if (ctype_digit($search)) {
                        $q->orWhere('id', (int) $search);
                    }
                });
            }
            // Filter by session — narrows to campers who have at least one application
            // for the specified camp session ID.
            if ($request->filled('session_id')) {
                $query->whereHas('applications', function ($q) use ($request) {
                    $q->where('camp_session_id', $request->session_id);
                });
            }
            $campers = $query->paginate(15);
        } elseif ($user->isMedicalProvider()) {
            // Medical providers see only operationally active campers — those with at least
            // one approved application. Campers whose applications have been reversed or
            // cancelled are excluded from clinical workflows until re-approved.
            $query = Camper::active()->with(['medicalRecord.allergies', 'medicalRecord.medications', 'medicalRecord.diagnoses']);
            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    // Same fix as admin branch — full_name is virtual, search real columns.
                    $q->where('first_name', 'like', '%'.$search.'%')
                        ->orWhere('last_name', 'like', '%'.$search.'%');
                    if (ctype_digit($search)) {
                        $q->orWhere('id', (int) $search);
                    }
                });
            }
            $campers = $query->paginate(15);
        } elseif ($user->isApplicant()) {
            // Parents only see the campers they personally registered — scoped via the relationship.
            $campers = $user->campers()->paginate(15);
        } else {
            // User has no recognised role — return empty result.
            return response()->json([
                'data' => [],
                'meta' => [
                    'current_page' => 1,
                    'last_page' => 1,
                    'per_page' => 15,
                    'total' => 0,
                ],
            ]);
        }

        // Shape pagination metadata consistently so the frontend can build page controls.
        return response()->json([
            'data' => $campers->items(),
            'meta' => [
                'current_page' => $campers->currentPage(),
                'last_page' => $campers->lastPage(),
                'per_page' => $campers->perPage(),
                'total' => $campers->total(),
            ],
        ]);
    }

    /**
     * Store a newly created camper.
     *
     * POST /api/campers
     *
     * Step-by-step:
     *   1. CamperPolicy confirms the authenticated user may create a camper.
     *   2. Validated data from StoreCamperRequest is used (no raw input).
     *   3. For non-admin callers the user_id is forced to their own ID — they
     *      cannot create a camper on behalf of a different parent account.
     *   4. The new camper record is saved and returned.
     */
    public function store(StoreCamperRequest $request): JsonResponse
    {
        $this->authorize('create', Camper::class);

        $data = $request->validated();

        // Prevent a non-admin from supplying a different user_id and hijacking another account's campers.
        if (! $request->user()->isAdmin()) {
            $data['user_id'] = $request->user()->id;
        }

        $camper = Camper::create($data);

        return response()->json([
            'message' => 'Camper created successfully.',
            'data' => $camper,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified camper.
     *
     * GET /api/campers/{camper}
     *
     * CamperPolicy ensures the viewer is either an admin, medical provider,
     * or the parent of this specific camper.
     * The user relationship and all camp applications (with session info) are eager-loaded.
     */
    public function show(Camper $camper): JsonResponse
    {
        $this->authorize('view', $camper);

        // Load the parent user account, application history, and all clinical sub-records.
        // PHI fields are decrypted at read-time by Eloquent casts; this is intentional for
        // the individual show endpoint (not a list) — only privileged roles reach this via CamperPolicy.
        $camper->load([
            'user',
            'applications.campSession',
            'behavioralProfile',
            'emergencyContacts',
            'medicalRecord',
            'diagnoses',
            'allergies',
            'medications',
            'feedingPlan',
            'personalCarePlan',
            'assistiveDevices',
            'activityPermissions',
        ]);

        return response()->json([
            'data' => $camper,
        ]);
    }

    /**
     * Update the specified camper.
     *
     * PUT/PATCH /api/campers/{camper}
     *
     * UpdateCamperRequest validates the incoming fields before they reach the model.
     * CamperPolicy ensures only admins or the camper's own parent can update.
     */
    public function update(UpdateCamperRequest $request, Camper $camper): JsonResponse
    {
        $this->authorize('update', $camper);

        $data = $request->validated();
        $oldSnapshot = array_intersect_key($camper->only(array_keys($data)), $data);

        $camper->update($data);

        $newSnapshot = array_intersect_key($camper->fresh()->only(array_keys($data)), $data);

        if ($oldSnapshot !== $newSnapshot) {
            AuditLog::logContentChange(
                auditable: $camper,
                editor: $request->user(),
                oldValues: $oldSnapshot,
                newValues: $newSnapshot,
            );
        }

        return response()->json([
            'message' => 'Camper updated successfully.',
            'data' => $camper,
        ]);
    }

    /**
     * Remove the specified camper.
     *
     * DELETE /api/campers/{camper}
     *
     * Soft-deletes the camper record (the model uses SoftDeletes).
     * Only admins are permitted to delete campers via CamperPolicy.
     */
    public function destroy(Camper $camper): JsonResponse
    {
        $this->authorize('delete', $camper);

        $camper->delete();

        return response()->json([
            'message' => 'Camper deleted successfully.',
        ]);
    }

    /**
     * Get computed medical alerts for the specified camper.
     *
     * GET /api/campers/{camper}/medical-alerts
     *
     * Alerts are derived in real-time from the camper's clinical record:
     * severe / life-threatening allergies, seizure history, neurostimulator
     * presence, critical diagnoses, and required medications. No separate
     * alerts table is needed — the computation stays close to the source data.
     *
     * Medical staff see these alerts prominently when opening a camper's
     * record so critical information is never buried in sub-sections.
     *
     * The service is injected by Laravel's container — no manual instantiation needed.
     */
    public function medicalAlerts(Camper $camper, MedicalAlertService $alertService): JsonResponse
    {
        // CamperPolicy enforces that only authorized roles can view this camper's data.
        $this->authorize('view', $camper);

        // The service inspects allergies, diagnoses, and medications to produce alert objects.
        $alerts = $alertService->alertsFor($camper);

        return response()->json([
            'data' => $alerts,
        ]);
    }

    /**
     * Get risk assessment summary for the specified camper.
     *
     * GET /api/campers/{camper}/risk-summary
     *
     * Returns medical complexity risk score, supervision level,
     * complexity tier, and active risk flags for care planning
     * and staffing ratio determination.
     *
     * This helps the camp determine how many staff members are needed per
     * camper based on their individual medical complexity.
     */
    public function riskSummary(Camper $camper, SpecialNeedsRiskAssessmentService $riskService): JsonResponse
    {
        $this->authorize('view', $camper);

        // Risk assessment data is operational/clinical information for staff only.
        // Applicants (parents) can view their own child's camper profile via CamperPolicy::view,
        // but they must not access risk scores, supervision assignments, or medical flags —
        // those are internal staffing decisions, not parent-facing data.
        if (auth()->user()->isApplicant()) {
            abort(403, 'Risk assessment data is not accessible to applicants.');
        }

        // The service scores the camper's medical record and returns a structured assessment.
        $assessment = $riskService->assessCamper($camper);

        // Determine effective supervision level (may differ if a clinical override is in place)
        $storedAssessment = $assessment['assessment'];
        $effectiveLevel = $storedAssessment->effectiveSupervisionLevel();

        return response()->json([
            'data' => [
                // Numeric score driving all other tier/level decisions.
                'risk_score' => $assessment['risk_score'],
                // Enum value (e.g., "high") for programmatic use in the frontend.
                'supervision_level' => $assessment['supervision_level']->value,
                // Human-readable label (e.g., "High Supervision") for display.
                'supervision_label' => $assessment['supervision_level']->label(),
                // Staff-to-camper ratio string (e.g., "1:2") for scheduling.
                'staffing_ratio' => $assessment['supervision_level']->getStaffingRatio(),
                // Effective level (respects clinical override if one is set)
                'effective_supervision_level' => $effectiveLevel->value,
                'effective_supervision_label' => $effectiveLevel->label(),
                'effective_staffing_ratio' => $effectiveLevel->getStaffingRatio(),
                'medical_complexity_tier' => $assessment['medical_complexity_tier']->value,
                'complexity_label' => $assessment['medical_complexity_tier']->label(),
                // Individual flags (e.g., "seizure_history") that contributed to the score.
                'flags' => $assessment['flags'],
                // Review state — lets the compact card show the review badge
                'review_status' => $storedAssessment->review_status->value,
                'review_status_label' => $storedAssessment->review_status->label(),
                'is_overridden' => $storedAssessment->isOverridden(),
            ],
        ]);
    }

    /**
     * Get medical document compliance status for the specified camper.
     *
     * GET /api/campers/{camper}/compliance
     *
     * Returns compliance status including required documents, missing documents,
     * expired documents, and unverified documents. Used by parents to understand
     * what documentation is needed and by administrators to verify application
     * readiness for approval.
     *
     * Authorization: Admin, valid medical provider link, or parent (own camper only).
     */
    public function complianceStatus(Camper $camper, DocumentEnforcementService $documentEnforcement): JsonResponse
    {
        $this->authorize('view', $camper);

        // The service inspects required vs. uploaded documents and returns a compliance summary.
        $compliance = $documentEnforcement->checkCompliance($camper);

        return response()->json([
            'data' => $compliance,
        ]);
    }
}
