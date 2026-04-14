<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\MedicalFollowUp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

/**
 * MedicalFollowUpController
 *
 * A follow-up is a task that medical staff need to remember to do for a camper —
 * things like "check in on camper's rash in 24 hours" or "call parent about fever".
 * Each follow-up has a due date, a priority level, an optional assignee, and a status.
 *
 * The listing is intentionally sorted by due_date ascending (soonest first) and then
 * by priority using a custom MySQL FIELD() expression, so urgent overdue items always
 * rise to the top of the dashboard panel.
 *
 * Key behavior: when a follow-up is marked "completed", this controller automatically
 * records the exact timestamp and the user who completed it — no extra API call needed.
 *
 * All actions are gated by MedicalFollowUpPolicy.
 */
class MedicalFollowUpController extends Controller
{
    /**
     * List follow-ups with optional filters (paginated).
     *
     * Results are sorted by soonest due date first, then by priority
     * (urgent > high > medium > low) using a MySQL FIELD() expression.
     * The 'overdue' boolean filter surfaces only past-due, still-open items.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only admins and medical providers may list follow-ups.
        $this->authorize('viewAny', MedicalFollowUp::class);

        // Load the camper, the staff member who created it, and who it's assigned to.
        $query = MedicalFollowUp::with(['camper', 'creator', 'assignee'])
            ->orderBy('due_date')
            // Sort by priority within the same due date: urgent first, low last.
            ->orderByRaw("FIELD(priority, 'urgent', 'high', 'medium', 'low')");

        // Scope to one camper's follow-ups when viewing their medical record page.
        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }

        // Filter by workflow status: pending, in_progress, completed, cancelled.
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        // Filter to show only follow-ups assigned to a specific staff member.
        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', $request->integer('assigned_to'));
        }

        // The 'overdue' flag surfaces items that are past due and still open.
        if ($request->boolean('overdue')) {
            $query->whereNotIn('status', ['completed', 'cancelled'])
                ->whereDate('due_date', '<', now()->toDateString());
        }

        $followUps = $query->paginate(25);

        return response()->json([
            'data' => $followUps->items(),
            'meta' => [
                'current_page' => $followUps->currentPage(),
                'last_page' => $followUps->lastPage(),
                'per_page' => $followUps->perPage(),
                'total' => $followUps->total(),
            ],
        ]);
    }

    /**
     * Create a new follow-up task for a camper.
     *
     * The created_by field is stamped server-side to the authenticated user;
     * clients cannot specify a different creator. Default status is 'pending'
     * and default priority is 'medium' if not provided.
     */
    public function store(Request $request): JsonResponse
    {
        // Confirm the caller is allowed to create follow-up tasks.
        $this->authorize('create', MedicalFollowUp::class);

        $validated = $request->validate([
            'camper_id' => 'required|integer|exists:campers,id',
            // Assignee is optional — follow-ups may be unassigned initially.
            'assigned_to' => 'nullable|integer|exists:users,id',
            'treatment_log_id' => 'nullable|integer|exists:treatment_logs,id',
            'title' => 'required|string|max:500',
            'notes' => 'nullable|string|max:5000',
            'status' => 'sometimes|string|in:pending,in_progress,completed,cancelled',
            'priority' => 'sometimes|string|in:low,medium,high,urgent',
            // Due date is required so the dashboard can surface overdue items accurately.
            'due_date' => 'required|date',
        ]);

        // Stamp the creator server-side so it cannot be spoofed by the client.
        $followUp = MedicalFollowUp::create(array_merge(
            $validated,
            ['created_by' => $request->user()->id]
        ));

        $followUp->load(['camper', 'creator', 'assignee']);

        return response()->json([
            'message' => 'Follow-up created successfully.',
            'data' => $followUp,
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single follow-up with full relational context.
     *
     * Includes the linked treatment log so the reader understands what clinical
     * event originally triggered this follow-up task.
     */
    public function show(MedicalFollowUp $medicalFollowUp): JsonResponse
    {
        // Per-record policy check before returning follow-up details.
        $this->authorize('view', $medicalFollowUp);

        // Load all related models for a complete view of the follow-up.
        $medicalFollowUp->load(['camper', 'creator', 'assignee', 'treatmentLog']);

        return response()->json(['data' => $medicalFollowUp]);
    }

    /**
     * Update an existing follow-up (including marking it complete).
     *
     * When status changes to "completed", completed_at and completed_by are set
     * automatically so there is an audit trail of who resolved each task.
     */
    public function update(Request $request, MedicalFollowUp $medicalFollowUp): JsonResponse
    {
        // Confirm the caller is allowed to edit this follow-up.
        $this->authorize('update', $medicalFollowUp);

        $validated = $request->validate([
            'assigned_to' => 'nullable|integer|exists:users,id',
            'title' => 'sometimes|string|max:500',
            'notes' => 'nullable|string|max:5000',
            'status' => 'sometimes|string|in:pending,in_progress,completed,cancelled',
            'priority' => 'sometimes|string|in:low,medium,high,urgent',
            'due_date' => 'sometimes|date',
        ]);

        // Auto-set completed_at when marking complete
        if (isset($validated['status']) && $validated['status'] === 'completed') {
            // Record the exact moment of completion and who marked it done.
            $validated['completed_at'] = Carbon::now();
            $validated['completed_by'] = $request->user()->id;
        }

        $medicalFollowUp->update($validated);

        // Reload relationships so the response reflects the updated state.
        $medicalFollowUp->load(['camper', 'creator', 'assignee']);

        return response()->json([
            'message' => 'Follow-up updated successfully.',
            'data' => $medicalFollowUp,
        ]);
    }

    /**
     * Permanently delete a follow-up task.
     *
     * MedicalFollowUpPolicy restricts deletion to admins to preserve
     * the audit trail of care tasks that were created and resolved.
     */
    public function destroy(MedicalFollowUp $medicalFollowUp): JsonResponse
    {
        // Hard gate before removing this follow-up record.
        $this->authorize('delete', $medicalFollowUp);

        $medicalFollowUp->delete();

        return response()->json(['message' => 'Follow-up deleted successfully.']);
    }
}
