<?php

namespace App\Http\Controllers\Api\Camp;

use App\Http\Controllers\Controller;
use App\Http\Requests\CampSession\StoreCampSessionRequest;
use App\Http\Requests\CampSession\UpdateCampSessionRequest;
use App\Models\CampSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * CampSessionController — manages individual camp session records.
 *
 * A CampSession is a specific date window within a camp program (e.g., "Week 1: June 2–8, 2026").
 * Sessions are the actual objects that families apply to — they have capacity limits, registration
 * open/close dates, and are linked to one parent Camp.
 *
 * Authorization rules:
 *   - Viewing: any authenticated user; non-admins only see active sessions
 *   - Filtering: supports camp_id and available_only query parameters for the applicant portal
 *   - Creating, updating, deleting: admin and super_admin only (enforced via CampSessionPolicy)
 *
 * Routes:
 *   GET    /api/sessions              — list sessions (paginated, filterable)
 *   GET    /api/sessions/{session}    — show a single session with its parent camp
 *   POST   /api/sessions              — create a session (admin)
 *   PUT    /api/sessions/{session}    — update a session (admin)
 *   DELETE /api/sessions/{session}    — delete a session (admin)
 */
class CampSessionController extends Controller
{
    /**
     * Display a paginated list of camp sessions.
     *
     * Supports three optional query filters:
     *   ?camp_id=X         — limit to sessions belonging to a specific camp
     *   ?available_only=1  — only show sessions currently open for registration
     *
     * Admins see all sessions; non-admins see only active ones.
     * Results are ordered by start_date ascending (soonest first) for the applicant portal.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', CampSession::class);

        // Each session includes its parent camp so the frontend can display the camp name.
        // withCount eager-loads enrolled_count so capacity bars render correctly.
        $query = CampSession::with('camp')
            ->withCount(['applications as enrolled_count' => function ($q) {
                $q->where('status', 'approved');
            }]);

        // Non-admins only see sessions that are active (not archived) AND open for applications.
        if (! $request->user()->isAdmin()) {
            $query->where('is_active', true)->where('portal_open', true);
        }

        // Allow frontend to scope to one specific camp's sessions
        if ($request->filled('camp_id')) {
            $query->where('camp_id', $request->camp_id);
        }

        // Filter to sessions where registration is currently open (between open and close dates)
        if ($request->boolean('available_only')) {
            $query->where('registration_opens_at', '<=', now())
                ->where('registration_closes_at', '>=', now());
        }

        // Admins may request a larger page for workspace selectors (e.g. per_page=100).
        // Capped at 100 and restricted to admin users to prevent abuse.
        $perPage = config('app.pagination_per_page', 15);
        if ($request->user()->isAdmin() && $request->filled('per_page')) {
            $perPage = min((int) $request->per_page, 100);
        }

        // PERFORMANCE: Paginate to prevent loading all sessions at once
        // Order by start_date so the soonest upcoming session appears first
        $sessions = $query->orderBy('start_date')
            ->paginate($perPage);

        return response()->json($sessions);
    }

    /**
     * Display a single camp session with its parent camp loaded.
     *
     * The parent camp is eager-loaded so the session detail page can show the camp name
     * and description without a second API call.
     */
    public function show(CampSession $session): JsonResponse
    {
        // Eager-load the parent camp to avoid an N+1 query when rendering the detail view
        $session->load('camp');

        return response()->json([
            'data' => $session,
        ]);
    }

    /**
     * Create a new camp session.
     *
     * Validation is fully handled by StoreCampSessionRequest before this method runs.
     * The request class enforces things like valid date ranges, capacity minimums, etc.
     */
    public function store(StoreCampSessionRequest $request): JsonResponse
    {
        // CampSessionPolicy::create restricts this to admin and super_admin roles
        $this->authorize('create', CampSession::class);

        // Mass-assign only the validated, safe fields from StoreCampSessionRequest.
        // refresh() re-loads the row from DB so that columns with DB-level defaults
        // (e.g. is_active = true) are present in the returned JSON. Without this,
        // is_active comes back null because create() only hydrates the fields passed in.
        $session = CampSession::create($request->validated());
        $session->refresh();

        // 201 Created indicates a new resource was successfully persisted
        return response()->json([
            'message' => 'Camp session created successfully.',
            'data' => $session,
        ], Response::HTTP_CREATED);
    }

    /**
     * Update an existing camp session.
     *
     * UpdateCampSessionRequest validates the incoming fields. Partial updates are supported —
     * only the fields present in the request will be changed.
     */
    public function update(UpdateCampSessionRequest $request, CampSession $session): JsonResponse
    {
        // CampSessionPolicy::update restricts this to admin and super_admin roles
        $this->authorize('update', $session);

        $session->update($request->validated());

        return response()->json([
            'message' => 'Camp session updated successfully.',
            'data' => $session,
        ]);
    }

    /**
     * Delete a camp session.
     *
     * Blocked if any applications (draft or submitted) are linked to the session —
     * deleting would orphan applicant records. Use archive() to deactivate instead.
     */
    public function destroy(CampSession $session): JsonResponse
    {
        // CampSessionPolicy::delete restricts this to admin and super_admin roles
        $this->authorize('delete', $session);

        // Refuse deletion when applications exist — data integrity + orphan prevention
        if ($session->applications()->exists()) {
            return response()->json([
                'message' => 'Cannot delete a session that has applications. Archive the session instead.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $session->delete();

        return response()->json([
            'message' => 'Camp session deleted successfully.',
        ]);
    }

    /**
     * Open a session for applications in the parent portal.
     *
     * POST /api/sessions/{session}/activate
     *
     * Sets portal_open = true so the session appears in the applicant's session picker.
     * This is separate from is_active (archive flag) and the date-derived status —
     * admins can open registration early, before the camp dates arrive.
     *
     * Returns 422 if the session is already open (idempotency guard).
     */
    public function activate(CampSession $session): JsonResponse
    {
        $this->authorize('update', $session);

        if ($session->portal_open) {
            return response()->json(['message' => 'Session is already open for applications.'], 422);
        }

        $session->update(['portal_open' => true]);

        return response()->json([
            'message' => 'Session is now open for applications.',
            'data' => $session->fresh(),
        ]);
    }

    /**
     * Close a session to new applications in the parent portal.
     *
     * POST /api/sessions/{session}/deactivate
     *
     * Sets portal_open = false so the session no longer appears in the applicant's
     * session picker. Existing applications are unaffected.
     * Returns 422 if the session is already closed.
     */
    public function deactivate(CampSession $session): JsonResponse
    {
        $this->authorize('update', $session);

        if (! $session->portal_open) {
            return response()->json(['message' => 'Session is already closed for applications.'], 422);
        }

        $session->update(['portal_open' => false]);

        return response()->json([
            'message' => 'Session is now closed for applications.',
            'data' => $session->fresh(),
        ]);
    }

    /**
     * Archive a camp session by marking it inactive.
     *
     * POST /api/sessions/{session}/archive
     *
     * Unlike deletion, archiving preserves all application records while
     * hiding the session from the applicant portal (is_active = false).
     * This is the safe alternative when applications already exist.
     */
    public function archive(CampSession $session): JsonResponse
    {
        $this->authorize('update', $session);

        $session->update(['is_active' => false]);

        return response()->json([
            'message' => 'Session archived successfully.',
            'data' => $session,
        ]);
    }

    /**
     * Restore an archived session by marking it active again.
     *
     * POST /api/sessions/{session}/restore
     *
     * Reverses an archive() call. Sets is_active = true so the session
     * reappears in the applicant portal and can accept new applications.
     * Returns a 422 if the session is already active (idempotency guard).
     */
    public function restore(CampSession $session): JsonResponse
    {
        $this->authorize('update', $session);

        if ($session->is_active) {
            return response()->json(['message' => 'Session is already active.'], 422);
        }

        $session->update(['is_active' => true]);

        return response()->json([
            'message' => 'Session restored successfully.',
            'session' => $session->fresh(),
        ]);
    }
}
