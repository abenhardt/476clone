<?php

namespace App\Http\Controllers\Api\Camper;

use App\Enums\ApplicationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Application\ReviewApplicationRequest;
use App\Http\Requests\Application\SignApplicationRequest;
use App\Http\Requests\Application\StoreApplicationRequest;
use App\Http\Requests\Application\UpdateApplicationRequest;
use App\Models\Application;
use App\Models\ApplicationConsent;
use App\Models\AuditLog;
use App\Notifications\Camper\ApplicationSubmittedNotification;
use App\Services\Camper\ApplicationCompletenessService;
use App\Services\Camper\ApplicationService;
use App\Services\SystemNotificationService;
use App\Traits\QueuesNotifications;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * ApplicationController — Full lifecycle management for camp applications.
 *
 * A camp application links a specific camper to a specific camp session.
 * It can exist as a draft (saved but not submitted) or as a submitted application
 * that moves through a review workflow: pending → under_review → accepted/rejected.
 *
 * Role-based visibility:
 *   - Admin     → sees all applications across all families, with full filtering.
 *   - Applicant → sees only applications for their own children.
 *   - Medical   → no access to this resource.
 *
 * Key features:
 *   - Draft mode lets parents save progress and return later.
 *   - Document compliance is enforced before an admin can approve.
 *   - Digital signatures are stored with IP and timestamp for legal record.
 *   - Notifications are queued inside a DB transaction to prevent partial state.
 *
 * Implements FR-4 through FR-6, FR-9, FR-12, FR-14, FR-15, FR-18, FR-27, FR-28.
 */
class ApplicationController extends Controller
{
    // QueuesNotifications provides a queueNotification() helper that wraps queue dispatch safely.
    use QueuesNotifications;

    public function __construct(
        protected ApplicationService $applicationService,
        protected ApplicationCompletenessService $completenessService,
        protected SystemNotificationService $systemNotifications,
    ) {}

    /**
     * Display a listing of applications with search and filter support.
     *
     * GET /api/applications
     *
     * Admin callers receive a rich, filterable view of all applications.
     * Applicant callers receive only the applications for their own campers.
     * Any other role gets an empty paginated result (no 403, just nothing).
     *
     * Admin filter params:
     *   status, camp_session_id, search (name/email), date_from, date_to,
     *   drafts_only, sort (field), direction (asc/desc), per_page.
     *
     * Implements FR-14: Search and filter applications.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        // Initialised here so the final return always has a defined value regardless of
        // which branch (admin / applicant / other) executes below.
        $queueTotal = null;

        if ($user->isAdmin()) {
            // CamperPolicy viewAny gate — confirms this admin role can list all applications.
            $this->authorize('viewAny', Application::class);
            // Eager-load related records so we don't hit the DB again for each application row.
            $query = Application::with([
                'camper.user',
                'campSession.camp',
                'reviewer',
            ]);

            // Filter by status enum value (e.g., "pending", "accepted").
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }

            // Narrow results to a single camp session (e.g., "Summer 2026 Week 1").
            if ($request->filled('camp_session_id')) {
                $query->where('camp_session_id', $request->camp_session_id);
            }

            // Full-text search across camper name and parent name/email.
            // Wrapped in a grouped where() so the OR between camper-name and parent-name
            // does NOT escape the surrounding AND conditions (status, session, is_draft).
            if ($request->filled('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->whereHas('camper', function ($q2) use ($search) {
                        $q2->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    })->orWhereHas('camper.user', function ($q2) use ($search) {
                        $q2->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
                });
            }

            // Date range filter on submitted_at (not created_at, so drafts aren't included).
            if ($request->filled('date_from')) {
                $query->whereDate('submitted_at', '>=', $request->date_from);
            }

            if ($request->filled('date_to')) {
                $query->whereDate('submitted_at', '<=', $request->date_to);
            }

            // By default exclude unsubmitted drafts from the admin review queue —
            // admins should only see applications the parent has actually submitted.
            // Pass drafts_only=true to flip this and see only drafts instead.
            if ($request->boolean('drafts_only')) {
                $query->where('is_draft', true);
            } else {
                $query->where('is_draft', false);
            }

            // Dynamic sorting — only allow whitelisted columns to prevent SQL injection.
            // Default: submitted_at ASC (FIFO — oldest submission first) so the admin review
            // queue naturally surfaces the families who applied earliest at the top.
            $sortField = $request->get('sort', 'submitted_at');
            $sortDir = $request->get('direction', 'asc');
            $allowedSorts = ['created_at', 'submitted_at', 'status', 'reviewed_at', 'updated_at'];
            if (in_array($sortField, $allowedSorts)) {
                $query->orderBy($sortField, $sortDir === 'asc' ? 'asc' : 'desc');
            }
            // Stable secondary tiebreaker — ensures deterministic page order when two rows
            // share the same primary sort value (e.g., applications bulk-imported together).
            $query->orderBy('id', 'asc');

            $applications = $query->paginate($request->get('per_page', 15));

            // Queue stats — total active (non-final) submitted applications in the scoped session.
            // Provides the "X of Y pending" denominator for queue-position display on the frontend.
            // Only computed when a session is scoped; null in the global all-sessions view.
            $queueTotal = null;
            if ($request->filled('camp_session_id')) {
                $queueTotal = Application::where('camp_session_id', $request->camp_session_id)
                    ->whereIn('status', ['submitted', 'under_review', 'waitlisted'])
                    ->where('is_draft', false)
                    ->count();
            }
        } elseif ($user->isApplicant()) {
            // Collect the IDs of all campers owned by this parent, then scope the query.
            $camperIds = $user->campers()->pluck('id');
            $applications = Application::whereIn('camper_id', $camperIds)
                ->with([
                    'camper.user',
                    'campSession.camp',
                    'reviewer',
                ])
                ->latest()
                ->paginate(15);
        } else {
            // User has no recognised role — return empty result rather than 403.
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

        // Inject queue_rank into each application array.
        //
        // Strategy: page-offset rank — the Nth item on page P gets rank (P-1)*perPage + N.
        // This equals the global FIFO position when the list is sorted by submitted_at ASC,
        // which is the default. Under a status filter it becomes the rank within that subset,
        // which is exactly what an admin needs ("which pending application came first?").
        //
        // Zero extra DB queries: we compute rank from the already-known page offset.
        // Only submitted non-draft applications receive a rank; drafts get null.
        $pageOffset = ($applications->currentPage() - 1) * $applications->perPage();
        $rankedItems = [];
        foreach ($applications->items() as $index => $app) {
            $arr = $app->toArray();  // triggers $appends (application_number, session) + casts
            $arr['queue_rank'] = (! $app->is_draft && $app->submitted_at !== null)
                ? $pageOffset + $index + 1
                : null;
            $rankedItems[] = $arr;
        }

        return response()->json([
            'data' => $rankedItems,
            'meta' => [
                'current_page' => $applications->currentPage(),
                'last_page' => $applications->lastPage(),
                'per_page' => $applications->perPage(),
                'total' => $applications->total(),
                // Total active (non-final) applications in the current session scope.
                // Null when viewing all sessions (no session filter applied).
                'queue_total' => $queueTotal ?? null,
            ],
        ]);
    }

    /**
     * Store a newly created application.
     *
     * POST /api/applications
     *
     * Supports draft mode for saving incomplete applications.
     * When is_draft is false, submitted_at is stamped and notifications are sent.
     *
     * The application creation and notification queueing are wrapped in a DB
     * transaction — if the notification dispatch fails, the application record
     * is also rolled back, keeping the database and queue in sync.
     *
     * Implements FR-4: Save and return to draft.
     */
    public function store(StoreApplicationRequest $request): JsonResponse
    {
        // ApplicationPolicy create gate — only applicants (and admins) can create.
        $this->authorize('create', Application::class);

        $data = $request->validated();
        // Default to draft mode if the client didn't explicitly pass is_draft.
        $isDraft = $request->boolean('is_draft', false);

        $data['is_draft'] = $isDraft;
        // All new applications start as Submitted regardless of what the client sends.
        // Drafts also use Submitted as their status — the is_draft flag separates them.
        $data['status'] = ApplicationStatus::Submitted;

        // Only stamp the submission timestamp when the application is actually submitted (not a draft).
        if (! $isDraft) {
            $data['submitted_at'] = now();
        }

        // Wrap creation + notification in a transaction so both succeed or both fail atomically.
        $application = DB::transaction(function () use ($data, $isDraft) {
            $application = Application::create($data);
            // Eager-load camper and session so the notification has all the data it needs.
            $application->load(['camper', 'campSession']);

            if (! $isDraft) {
                // Send a confirmation email to the parent via the queue.
                $this->queueNotification(
                    $application->camper->user,
                    new ApplicationSubmittedNotification($application)
                );
                // System inbox notification
                $camperName = $application->camper->first_name.' '.$application->camper->last_name;
                // Create an in-app system notification so the parent sees it in their inbox.
                $this->systemNotifications->applicationSubmitted(
                    $application->camper->user, $application->id, $camperName
                );
            }

            return $application;
        });

        return response()->json([
            'message' => $isDraft ? 'Application draft saved.' : 'Application submitted successfully.',
            'data' => $application,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified application.
     *
     * GET /api/applications/{application}
     *
     * Returns the application with a comprehensive set of related data,
     * including all camper medical detail, behavioral profile, emergency contacts,
     * and attached documents — everything an admin needs for a full review.
     */
    public function show(Application $application): JsonResponse
    {
        // ApplicationPolicy view gate — admins see all; parents see only their own.
        $this->authorize('view', $application);

        // Deep-load all relationships needed by the ApplicationDetailPage.
        $application->load([
            'camper.user',
            'camper.medicalRecord.allergies',
            'camper.medicalRecord.medications',
            'camper.medicalRecord.diagnoses',
            'camper.emergencyContacts',
            'camper.behavioralProfile',
            'camper.feedingPlan',
            'camper.personalCarePlan',
            'camper.assistiveDevices',
            'camper.activityPermissions',
            'camper.documents',
            'campSession.camp',
            'secondSession',
            'reviewer',
            'documents',
            'consents',
        ]);

        // Append queue_position only here (single-record fetch) to avoid the N+1 problem
        // that would occur if it were in $appends and fired on every list row.
        $application->append('queue_position');

        // Build the document collection visible on the application review page.
        //
        // Three sources are merged and deduplicated:
        //
        //   1. application.documents — Application-polymorphic docs (the canonical home
        //      after the paper-packet linkage fix; also covers admin-uploaded-on-behalf docs).
        //
        //   2. camper.documents — Camper-polymorphic docs uploaded by admins using the
        //      original "attach to camper" path (uploadDocumentOnBehalf in admin.api.ts).
        //      DocumentEnforcementService still resolves compliance by camper, so these
        //      remain valid on the Camper relation.
        //
        //   3. Orphaned docs — paper_application_packet records where documentable_type IS
        //      NULL, uploaded by this application's parent user.  These exist for rows that
        //      pre-date the backfill migration (2026_04_10_000002) or were uploaded while the
        //      migration was still pending.  Once the migration has run this set will normally
        //      be empty; the fallback ensures nothing disappears for reviewers in the interim.
        $camperDocs = $application->camper->documents ?? collect();
        $appDocs = $application->documents ?? collect();
        $applicantUserId = $application->camper?->user_id;
        $orphanedDocs = $applicantUserId
            ? \App\Models\Document::whereNull('documentable_type')
                ->whereNull('documentable_id')
                ->where('uploaded_by', $applicantUserId)
                ->whereNull('deleted_at')
                ->get()
            : collect();

        $merged = $appDocs->merge($camperDocs)->merge($orphanedDocs)->unique('id')->values();

        // Submission gate: admins only see submitted documents (submitted_at IS NOT NULL).
        // Applicants see all their own documents — including drafts — so they can review
        // staged uploads and know which ones still need to be submitted to staff.
        if (request()->user()?->isAdmin()) {
            $merged = $merged->filter(fn ($doc) => $doc->submitted_at !== null)->values();
        }

        $application->setRelation('documents', $merged);

        return response()->json([
            'data' => $application,
        ]);
    }

    /**
     * Update the specified application.
     *
     * PUT/PATCH /api/applications/{application}
     *
     * Handles two scenarios:
     *   1. Editing a draft (common — parent is filling out the form in stages).
     *   2. Promoting a draft to submitted by passing submit=true in the request.
     *
     * If the application transitions from draft to submitted, a confirmation
     * notification is queued for the parent.
     *
     * Implements FR-5 and FR-6: Edit submitted and previously submitted applications.
     */
    public function update(UpdateApplicationRequest $request, Application $application): JsonResponse
    {
        $this->authorize('update', $application);

        $data = $request->validated();

        // Snapshot editable content fields before mutation so the audit log can record
        // an accurate before/after diff. Only the fields that UpdateApplicationRequest
        // allows through are included — other fillable columns are not tracked here.
        $contentFields = [
            'notes',
            'submission_source',
            'narrative_rustic_environment',
            'narrative_staff_suggestions',
            'narrative_participation_concerns',
            'narrative_camp_benefit',
            'narrative_heat_tolerance',
            'narrative_transportation',
            'narrative_additional_info',
            'narrative_emergency_protocols',
        ];
        $oldSnapshot = $application->only($contentFields);

        // Check if this is a "submit now" action on a previously saved draft.
        if ($application->isDraft() && $request->has('submit') && $request->boolean('submit')) {
            $data['is_draft'] = false;
            $data['submitted_at'] = now();
        }

        $application->update($data);

        // Write audit log if any content field changed.
        // Only log the fields that were actually present in the validated request
        // to keep the diff clean — unchanged fields are not recorded.
        $newSnapshot = array_intersect_key($application->only($contentFields), $data);
        $oldForDiff = array_intersect_key($oldSnapshot, $newSnapshot);
        $hasChanges = $oldForDiff !== $newSnapshot;

        if ($hasChanges) {
            AuditLog::logContentChange(
                auditable: $application,
                editor: $request->user(),
                oldValues: $oldForDiff,
                newValues: $newSnapshot,
            );
        }

        // If is_draft just flipped from true → false, the parent needs a confirmation notification.
        // Both the email AND the in-app inbox notification must fire — mirrors what store() does.
        if (isset($data['is_draft']) && $data['is_draft'] === false && $application->wasChanged('is_draft')) {
            $application->loadMissing('camper.user');
            $this->queueNotification(
                $application->camper->user,
                new ApplicationSubmittedNotification($application)
            );
            $camperName = $application->camper->first_name.' '.$application->camper->last_name;
            $this->systemNotifications->applicationSubmitted(
                $application->camper->user, $application->id, $camperName
            );
        }

        return response()->json([
            'message' => 'Application updated successfully.',
            'data' => $application,
        ]);
    }

    /**
     * Remove the specified application.
     *
     * DELETE /api/applications/{application}
     *
     * Admins can delete any application. Applicants can only delete their own
     * draft (is_draft=true) applications — submitted applications are locked.
     * See ApplicationPolicy::delete() for the authorization rules.
     *
     * All deletions are written to the audit log before the record is removed
     * so there is always a permanent record of what was deleted, by whom, and when.
     */
    public function destroy(Application $application): JsonResponse
    {
        $this->authorize('delete', $application);

        $user = request()->user();

        // Capture snapshot before deletion for the audit trail.
        AuditLog::logAdminAction(
            'application.deleted',
            $user,
            "Application #{$application->id} deleted".
                ($application->is_draft ? ' (draft)' : ' (submitted)').
                " for camper #{$application->camper_id}",
            [
                'application_id' => $application->id,
                'camper_id' => $application->camper_id,
                'session_id' => $application->camp_session_id,
                'status' => $application->status->value,
                'is_draft' => $application->is_draft,
                'deleted_by' => $user->id,
            ]
        );

        $application->delete();

        return response()->json([
            'message' => 'Application deleted successfully.',
        ]);
    }

    /**
     * Return a completeness report for an application before the admin approves.
     *
     * GET /api/applications/{application}/completeness
     *
     * Called by the frontend immediately when an admin clicks "Approve".
     * If is_complete is false, the frontend shows the warning modal with the
     * structured missing-data list. The admin can then choose to fix the gaps
     * or override and approve anyway.
     *
     * This endpoint is read-only and makes no state changes.
     */
    public function completeness(Application $application): JsonResponse
    {
        $this->authorize('review', $application);

        $report = $this->completenessService->check($application);

        return response()->json(['data' => $report]);
    }

    /**
     * Review and update the status of an application.
     *
     * POST /api/applications/{application}/review
     *
     * Only administrators can review applications.
     * The ApplicationService enforces medical document compliance before
     * allowing an approval — if documents are missing, expired, or unverified
     * the approval is blocked and the compliance details are returned.
     *
     * On approval or rejection, the ApplicationService also fires acceptance/
     * rejection letter notifications to the parent.
     *
     * Implements FR-15 (admin review) and FR-18 (acceptance/rejection letters).
     */
    public function review(ReviewApplicationRequest $request, Application $application): JsonResponse
    {
        // ApplicationPolicy review gate — restricts this action to admin roles.
        $this->authorize('review', $application);

        // Cast the raw string status to the typed ApplicationStatus enum.
        $newStatus = ApplicationStatus::from($request->validated('status'));

        // Delegate business logic to ApplicationService.
        // override_incomplete is set by the frontend when the admin explicitly chose
        // "Approve Anyway" after seeing the missing-data warning modal.
        $result = $this->applicationService->reviewApplication(
            application: $application,
            newStatus: $newStatus,
            notes: $request->validated('notes'),
            reviewedBy: $request->user(),
            overrideIncomplete: (bool) $request->validated('override_incomplete', false),
            missingSummary: $request->validated('missing_summary', []),
        );

        // Handle invalid state transition — the current status cannot move to the requested one.
        if (! $result['success'] && ($result['invalid_transition'] ?? false)) {
            return response()->json([
                'message' => "Invalid status transition. The application cannot be moved to \"{$newStatus->value}\" from its current state.",
                'errors' => [
                    'status' => 'This status transition is not permitted for the application in its current state.',
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Handle capacity failure — the session is full; suggest waitlisting instead.
        if (! $result['success'] && ($result['capacity_exceeded'] ?? false)) {
            return response()->json([
                'message' => "Cannot approve: \"{$result['session_name']}\" is at full capacity ({$result['enrolled']}/{$result['capacity']} enrolled). Waitlist the applicant or archive another application to free a spot.",
                'errors' => [
                    'capacity' => 'Session is at capacity.',
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Handle compliance failure — return the details so the admin knows what's missing.
        if (! $result['success']) {
            return response()->json([
                'message' => 'Application cannot be approved due to incomplete medical documentation.',
                'errors' => [
                    'compliance' => 'Required medical documents are missing, expired, or unverified.',
                ],
                // Include the full compliance breakdown so the admin can advise the parent.
                'compliance_details' => $result['compliance_details'],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->json([
            'message' => 'Application reviewed successfully.',
            // fresh() re-fetches from DB to capture any changes made by the service.
            'data' => $application->fresh(),
        ]);
    }

    /**
     * Withdraw an application (parent-initiated).
     *
     * POST /api/applications/{application}/withdraw
     *
     * Parents may withdraw their own child's application from the following states:
     * Pending, UnderReview, Approved, Waitlisted. Withdrawal sets the status to
     * Withdrawn, which is a terminal state — it cannot be reversed.
     *
     * If the application was Approved at the time of withdrawal, the service
     * will deactivate the camper and medical record (same logic as admin reversal).
     *
     * Admins cannot use this endpoint — they use the /review endpoint with
     * status=cancelled for admin-initiated termination.
     *
     * Implements: Parent withdrawal workflow.
     */
    public function withdraw(Request $request, Application $application): JsonResponse
    {
        $this->authorize('withdraw', $application);

        $this->applicationService->withdrawApplication(
            application: $application,
            withdrawnBy: $request->user()
        );

        return response()->json([
            'message' => 'Application withdrawn successfully.',
            'data' => $application->fresh(),
        ]);
    }

    /**
     * Store guardian consent records for an application.
     *
     * POST /api/applications/{application}/consents
     *
     * Accepts an array of 5 consent records (one per consent type) and bulk-upserts
     * them into the application_consents table. Idempotent — re-submitting replaces
     * existing records so the parent can correct a signed name after the fact.
     *
     * Each consent requires: consent_type, guardian_name, guardian_relationship,
     * guardian_signature, signed_at. applicant_signature is optional (only when
     * the camper is 18 or older).
     *
     * Implements the CYSHCN paper form Consents 1–5 requirement in a database record.
     */
    public function storeConsents(Request $request, Application $application): JsonResponse
    {
        // Only the application owner or an admin may submit consents.
        $this->authorize('update', $application);

        $validated = $request->validate([
            'consents' => ['required', 'array', 'min:1'],
            'consents.*.consent_type' => ['required', 'string', 'in:general,photos,liability,activity,authorization,medication,hipaa'],
            'consents.*.guardian_name' => ['required', 'string', 'max:255'],
            'consents.*.guardian_relationship' => ['required', 'string', 'max:100'],
            'consents.*.guardian_signature' => ['required', 'string'],
            'consents.*.applicant_signature' => ['nullable', 'string'],
            'consents.*.signed_at' => ['required', 'date'],
        ]);

        DB::transaction(function () use ($application, $validated) {
            foreach ($validated['consents'] as $consentData) {
                ApplicationConsent::updateOrCreate(
                    [
                        'application_id' => $application->id,
                        'consent_type' => $consentData['consent_type'],
                    ],
                    [
                        'guardian_name' => $consentData['guardian_name'],
                        'guardian_relationship' => $consentData['guardian_relationship'],
                        'guardian_signature' => $consentData['guardian_signature'],
                        'applicant_signature' => $consentData['applicant_signature'] ?? null,
                        'signed_at' => $consentData['signed_at'],
                    ]
                );
            }
        });

        return response()->json([
            'message' => 'Consents recorded successfully.',
            'data' => $application->consents()->get(),
        ]);
    }

    /**
     * Clone an existing application into a new reapplication draft.
     *
     * POST /api/applications/{application}/clone
     *
     * Creates a new draft Application for the same camper, linking it back to the
     * source application via reapplied_from_id. The parent then selects a new
     * session and submits the reapplication. All existing camper medical, behavioral,
     * and equipment data is already on file and does not need to be re-entered.
     *
     * Only the application owner (parent) can clone their own applications.
     * Only terminal applications (approved/rejected/cancelled/withdrawn) can be
     * cloned — this is enforced at both the policy layer and here.
     */
    public function clone(Request $request, Application $application): JsonResponse
    {
        // Uses the dedicated clone policy gate which enforces terminal-status requirement.
        $this->authorize('clone', $application);

        $newApplication = $this->applicationService->cloneApplication(
            source: $application,
            requestedBy: $request->user()
        );

        return response()->json([
            'message' => 'Reapplication draft created successfully.',
            'data' => $newApplication->load('camper', 'campSession'),
        ], Response::HTTP_CREATED);
    }

    /**
     * Sign an application digitally.
     *
     * POST /api/applications/{application}/sign
     *
     * Stores the parent's digital signature, name, timestamp, and IP address.
     * Once signed, the application cannot be signed again (idempotent guard).
     * This creates a legal audit trail of who signed and from where.
     *
     * Implements FR-9: Digital signature support.
     */
    public function sign(SignApplicationRequest $request, Application $application): JsonResponse
    {
        // Only the application owner (parent) can sign — via ApplicationPolicy update gate.
        $this->authorize('update', $application);

        // Guard against duplicate signatures — an application can only be signed once.
        if ($application->isSigned()) {
            return response()->json([
                'message' => 'Application has already been signed.',
            ], Response::HTTP_BAD_REQUEST);
        }

        $application->update([
            // signature_data is typically a base64-encoded SVG or PNG of the hand-drawn signature.
            'signature_data' => $request->validated('signature_data'),
            // The signer's typed name for readability on printed forms.
            'signature_name' => $request->validated('signature_name'),
            // UTC timestamp of when the signature was applied.
            'signed_at' => now(),
            // Record the IP address for the legal audit trail.
            'signed_ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Application signed successfully.',
            'data' => $application,
        ]);
    }
}
