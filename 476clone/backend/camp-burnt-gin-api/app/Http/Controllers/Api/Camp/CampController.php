<?php

namespace App\Http\Controllers\Api\Camp;

use App\Http\Controllers\Controller;
use App\Http\Requests\Camp\StoreCampRequest;
use App\Http\Requests\Camp\UpdateCampRequest;
use App\Models\Camp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * CampController — manages camp program records.
 *
 * A "Camp" is the top-level entity representing a named program (e.g., "Camp Burnt Gin Summer 2026").
 * Each camp can have multiple CampSessions (specific date windows). This controller manages the
 * camps themselves; see CampSessionController for session management.
 *
 * Authorization rules:
 *   - Viewing: any authenticated user, but non-admins only see active camps
 *   - Creating, updating, deleting: admin and super_admin only (enforced via CampPolicy)
 *
 * Validation is handled by dedicated Form Request classes (StoreCampRequest, UpdateCampRequest)
 * to keep this controller focused on routing and authorization.
 *
 * Routes:
 *   GET    /api/camps            — list camps (paginated)
 *   GET    /api/camps/{camp}     — show a single camp with sessions
 *   POST   /api/camps            — create a camp (admin)
 *   PUT    /api/camps/{camp}     — update a camp (admin)
 *   DELETE /api/camps/{camp}     — delete a camp (admin)
 */
class CampController extends Controller
{
    /**
     * Display a paginated listing of camp programs.
     *
     * Admins see all camps (active and inactive) for management purposes.
     * Non-admin users only see active camps — inactive camps are hidden from the public portal.
     *
     * Each camp includes its sessions with an "enrolled_count" counting approved applications,
     * which powers the session capacity display on the frontend.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Camp::class);

        // Eager-load sessions and count approved applications per session in one query
        $query = Camp::with(['sessions' => function ($q) {
            // Sub-count: how many approved applications exist for each session
            $q->withCount(['applications as enrolled_count' => function ($sq) {
                $sq->where('status', 'approved');
            }]);
        }]);

        // Non-admins should never see deactivated camps in the applicant portal
        if (! $request->user()->isAdmin()) {
            $query->where('is_active', true);
        }

        // PERFORMANCE: Paginate to prevent loading all camps at once
        $camps = $query->paginate(config('app.pagination_per_page', 15));

        return response()->json($camps);
    }

    /**
     * Display a single camp program with its associated sessions.
     *
     * No authorization check here — any authenticated user may view a camp's detail page.
     * The public listing already filters by is_active so direct access to an inactive camp
     * by ID is acceptable (e.g., for admin management links).
     */
    public function show(Camp $camp): JsonResponse
    {
        // Load sessions so the detail page can render the session list immediately
        $camp->load('sessions');

        return response()->json([
            'data' => $camp,
        ]);
    }

    /**
     * Create a new camp program record.
     *
     * Validation is fully handled by StoreCampRequest (name uniqueness, required fields, etc.)
     * before this method is called. The $request->validated() call returns only the safe fields.
     */
    public function store(StoreCampRequest $request): JsonResponse
    {
        // CampPolicy::create restricts this to admin and super_admin roles
        $this->authorize('create', Camp::class);

        // Mass-assign only the validated fields from StoreCampRequest
        $camp = Camp::create($request->validated());

        // 201 Created indicates a new resource was successfully persisted
        return response()->json([
            'message' => 'Camp created successfully.',
            'data' => $camp,
        ], Response::HTTP_CREATED);
    }

    /**
     * Update an existing camp program record.
     *
     * UpdateCampRequest validates the incoming fields. Only the fields present in the
     * request are updated (partial update / PATCH-style behavior).
     */
    public function update(UpdateCampRequest $request, Camp $camp): JsonResponse
    {
        // CampPolicy::update restricts this to admin and super_admin roles
        $this->authorize('update', $camp);

        $camp->update($request->validated());

        return response()->json([
            'message' => 'Camp updated successfully.',
            'data' => $camp,
        ]);
    }

    /**
     * Delete a camp program record.
     *
     * Whether this is a soft-delete or hard-delete depends on whether the Camp model
     * uses the SoftDeletes trait. Admin only.
     */
    public function destroy(Camp $camp): JsonResponse
    {
        // CampPolicy::delete restricts this to admin and super_admin roles
        $this->authorize('delete', $camp);

        $camp->delete();

        return response()->json([
            'message' => 'Camp deleted successfully.',
        ]);
    }
}
