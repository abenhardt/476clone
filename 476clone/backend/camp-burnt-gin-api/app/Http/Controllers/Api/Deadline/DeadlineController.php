<?php

namespace App\Http\Controllers\Api\Deadline;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDeadlineRequest;
use App\Http\Requests\UpdateDeadlineRequest;
use App\Models\CampSession;
use App\Models\Deadline;
use App\Services\DeadlineService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * DeadlineController — REST API for the deadline management system.
 *
 * Admin routes (role:admin,super_admin):
 *   GET    /deadlines                    — list all deadlines (session-filterable)
 *   POST   /deadlines                    — create a deadline
 *   GET    /deadlines/{deadline}         — get a single deadline
 *   PUT    /deadlines/{deadline}         — update a deadline
 *   DELETE /deadlines/{deadline}         — soft-delete a deadline
 *   POST   /deadlines/bulk-session       — create a session-wide deadline
 *   POST   /deadlines/{deadline}/extend  — extend due date + log override
 *   POST   /deadlines/{deadline}/complete — manually mark complete (admin override)
 *
 * Applicant routes (any authenticated):
 *   GET    /deadlines/my                 — own visible deadlines
 *
 * All write endpoints trigger DeadlineObserver → DeadlineCalendarSyncService automatically.
 * No manual calendar management is needed from this controller.
 */
class DeadlineController extends Controller
{
    public function __construct(protected DeadlineService $deadlineService) {}

    // ── Admin: List ────────────────────────────────────────────────────────────

    /**
     * List deadlines. Admins see all; applicants see only their own visible ones.
     *
     * Query params (admin only): session_id, entity_type, status
     *
     * GET /api/deadlines
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Deadline::class);

        $user = $request->user();

        if (! $user->isAdmin()) {
            // Applicants: return their own visible deadlines via the service
            $deadlines = $this->deadlineService->getApplicantDeadlines($user);

            return response()->json(['data' => $deadlines->map->toApiArray()->values()]);
        }

        // Admin: full list with optional filters
        $query = Deadline::with('creator:id,name')
            ->orderBy('due_date');

        if ($request->filled('session_id')) {
            $query->forSession((int) $request->input('session_id'));
        }

        if ($request->filled('entity_type')) {
            $query->where('entity_type', $request->input('entity_type'));
        }

        if ($request->filled('status')) {
            $status = $request->input('status');
            if ($status === 'overdue') {
                $query->overdue();
            } else {
                $query->where('status', $status);
            }
        }

        $deadlines = $query->paginate(50);

        return response()->json([
            'data' => collect($deadlines->items())->map->toApiArray()->values(),
            'meta' => [
                'current_page' => $deadlines->currentPage(),
                'last_page' => $deadlines->lastPage(),
                'total' => $deadlines->total(),
            ],
        ]);
    }

    // ── Applicant: My Deadlines ────────────────────────────────────────────────

    /**
     * Return the authenticated applicant's own visible deadlines.
     *
     * GET /api/deadlines/my
     */
    public function myDeadlines(Request $request): JsonResponse
    {
        $deadlines = $this->deadlineService->getApplicantDeadlines($request->user());

        return response()->json([
            'data' => $deadlines->map->toApiArray()->values(),
        ]);
    }

    // ── Admin: Create ──────────────────────────────────────────────────────────

    /**
     * Create a new deadline.
     * Fires DeadlineObserver::created() → CalendarEvent created automatically.
     *
     * POST /api/deadlines
     */
    public function store(StoreDeadlineRequest $request): JsonResponse
    {
        $this->authorize('create', Deadline::class);

        $deadline = $this->deadlineService->create(
            $request->validated(),
            $request->user(),
        );

        $deadline->load('creator:id,name', 'calendarEvent:id,deadline_id,starts_at');

        return response()->json([
            'message' => 'Deadline created.',
            'data' => $deadline->toApiArray(),
        ], Response::HTTP_CREATED);
    }

    // ── Admin: Bulk Session-Wide ───────────────────────────────────────────────

    /**
     * Create a session-wide deadline (entity_id = null) that applies to ALL
     * entities of the given type in the session.
     *
     * POST /api/deadlines/bulk-session
     */
    public function bulkSession(Request $request): JsonResponse
    {
        $this->authorize('create', Deadline::class);

        $validated = $request->validate([
            'camp_session_id' => ['required', 'integer', 'exists:camp_sessions,id'],
            'entity_type' => ['required', Rule::in(['document_request', 'application', 'medical_requirement'])],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'due_date' => ['required', 'date', 'after:today'],
            'grace_period_days' => ['integer', 'min:0', 'max:30'],
            'is_enforced' => ['boolean'],
            'enforcement_mode' => [Rule::in(['hard', 'soft'])],
            'is_visible_to_applicants' => ['boolean'],
        ]);

        $session = CampSession::findOrFail($validated['camp_session_id']);
        $deadline = $this->deadlineService->createSessionWide(
            $session,
            $validated['entity_type'],
            $request->user(),
            $validated,
        );

        return response()->json([
            'message' => 'Session-wide deadline created.',
            'data' => $deadline->toApiArray(),
        ], Response::HTTP_CREATED);
    }

    // ── Admin: Show ────────────────────────────────────────────────────────────

    /**
     * GET /api/deadlines/{deadline}
     */
    public function show(Request $request, Deadline $deadline): JsonResponse
    {
        $this->authorize('view', $deadline);

        $deadline->load('creator:id,name', 'campSession:id,name');

        return response()->json(['data' => $deadline->toApiArray()]);
    }

    // ── Admin: Update ──────────────────────────────────────────────────────────

    /**
     * Partial update a deadline.
     * Fires DeadlineObserver::updated() → CalendarEvent updated automatically.
     *
     * PUT /api/deadlines/{deadline}
     */
    public function update(UpdateDeadlineRequest $request, Deadline $deadline): JsonResponse
    {
        $this->authorize('update', $deadline);

        $data = $request->validated();
        $data['updated_by'] = $request->user()->id;

        $deadline->update($data);

        return response()->json([
            'message' => 'Deadline updated.',
            'data' => $deadline->fresh()->toApiArray(),
        ]);
    }

    // ── Admin: Delete ──────────────────────────────────────────────────────────

    /**
     * Soft-delete a deadline.
     * Fires DeadlineObserver::deleted() → CalendarEvent deleted automatically.
     *
     * DELETE /api/deadlines/{deadline}
     */
    public function destroy(Request $request, Deadline $deadline): JsonResponse
    {
        $this->authorize('delete', $deadline);

        $deadline->delete();

        return response()->json(['message' => 'Deadline deleted.']);
    }

    // ── Admin: Extend ──────────────────────────────────────────────────────────

    /**
     * Extend a deadline to a new due date with an admin-provided reason.
     * Fires DeadlineObserver::updated() → CalendarEvent updated automatically.
     *
     * POST /api/deadlines/{deadline}/extend
     */
    public function extend(Request $request, Deadline $deadline): JsonResponse
    {
        $this->authorize('extend', $deadline);

        $validated = $request->validate([
            'new_due_date' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $extended = $this->deadlineService->extend(
            $deadline,
            Carbon::parse($validated['new_due_date']),
            $validated['reason'],
            $request->user(),
        );

        return response()->json([
            'message' => 'Deadline extended.',
            'data' => $extended->toApiArray(),
        ]);
    }

    // ── Admin: Complete (Override) ─────────────────────────────────────────────

    /**
     * Manually mark a deadline as completed.
     *
     * This is the admin override mechanism — it unblocks the affected applicant
     * without changing the due date, and is logged to the audit trail.
     *
     * POST /api/deadlines/{deadline}/complete
     */
    public function complete(Request $request, Deadline $deadline): JsonResponse
    {
        $this->authorize('complete', $deadline);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $completed = $this->deadlineService->markComplete(
            $deadline,
            $request->user(),
            $validated['reason'],
        );

        return response()->json([
            'message' => 'Deadline marked as completed.',
            'data' => $completed->toApiArray(),
        ]);
    }
}
