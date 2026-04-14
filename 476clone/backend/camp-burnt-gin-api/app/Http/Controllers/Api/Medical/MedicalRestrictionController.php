<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\MedicalRestriction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * MedicalRestrictionController
 *
 * Manages medical restrictions for campers — formal clinical orders that say a camper
 * must avoid or be careful with something at camp. Restrictions are categorized by type:
 *   - activity: cannot participate in swimming, hiking, etc.
 *   - dietary: must avoid certain foods (beyond the allergy system)
 *   - environmental: avoid sun exposure, heat, cold, etc.
 *   - medication: must not receive certain drug classes
 *   - other: anything that doesn't fit the above
 *
 * Restrictions have optional start/end dates and an is_active flag, so they can be
 * time-boxed (e.g., "no swimming for 2 weeks post-surgery") or toggled without deletion.
 *
 * The creator is always stamped server-side to the authenticated user so there is an
 * audit trail of who imposed each restriction. All actions are gated by
 * MedicalRestrictionPolicy.
 */
class MedicalRestrictionController extends Controller
{
    /**
     * List medical restrictions with optional filters (paginated).
     *
     * Supports filtering by camper_id, restriction_type, and is_active status.
     * Results are ordered newest-first so recently added restrictions appear at the top.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only admins and medical providers may view restrictions.
        $this->authorize('viewAny', MedicalRestriction::class);

        // Load the camper and the staff member who created the restriction.
        $query = MedicalRestriction::with(['camper', 'creator'])
            ->orderByDesc('created_at');

        // Scope to one camper when loading their medical record page.
        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }

        // Filter by restriction category: activity, dietary, environmental, medication, other.
        if ($request->filled('restriction_type')) {
            $query->where('restriction_type', $request->input('restriction_type'));
        }

        // The is_active filter uses has() rather than filled() because false is a valid value.
        if ($request->has('is_active')) {
            // Cast to boolean so "0" and "false" string values work correctly.
            $query->where('is_active', $request->boolean('is_active'));
        }

        $restrictions = $query->paginate(25);

        return response()->json([
            'data' => $restrictions->items(),
            'meta' => [
                'current_page' => $restrictions->currentPage(),
                'last_page' => $restrictions->lastPage(),
                'per_page' => $restrictions->perPage(),
                'total' => $restrictions->total(),
            ],
        ]);
    }

    /**
     * Create a new medical restriction for a camper.
     *
     * The creator is stamped server-side so clients cannot forge who issued the
     * restriction. The end_date must be on or after start_date if both are supplied.
     */
    public function store(Request $request): JsonResponse
    {
        // Confirm the caller is authorized to impose restrictions.
        $this->authorize('create', MedicalRestriction::class);

        // Validate all restriction fields including date range consistency.
        $validated = $request->validate([
            'camper_id' => 'required|integer|exists:campers,id',
            'restriction_type' => 'required|string|in:activity,dietary,environmental,medication,other',
            'description' => 'required|string|max:2000',
            'start_date' => 'nullable|date',
            // 'after_or_equal:start_date' prevents end dates that predate the start.
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'is_active' => 'boolean',
            'notes' => 'nullable|string|max:2000',
        ]);

        // Merge the server-determined creator ID into the validated payload.
        $restriction = MedicalRestriction::create(array_merge(
            $validated,
            ['created_by' => $request->user()->id]
        ));

        // Load relationships so the response is fully populated.
        $restriction->load(['camper', 'creator']);

        return response()->json([
            'message' => 'Medical restriction created successfully.',
            'data' => $restriction,
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single medical restriction with full context.
     *
     * Loads the camper and the staff member who created the restriction so
     * the caller can display attribution without extra API calls.
     */
    public function show(MedicalRestriction $medicalRestriction): JsonResponse
    {
        // Per-record policy check before returning PHI restriction details.
        $this->authorize('view', $medicalRestriction);

        $medicalRestriction->load(['camper', 'creator']);

        return response()->json(['data' => $medicalRestriction]);
    }

    /**
     * Update an existing medical restriction.
     *
     * Uses 'sometimes' rules for most fields so only supplied fields are validated
     * and changed — useful for toggling is_active or extending an end_date without
     * re-submitting the full record.
     */
    public function update(Request $request, MedicalRestriction $medicalRestriction): JsonResponse
    {
        // Confirm the caller is allowed to modify this restriction.
        $this->authorize('update', $medicalRestriction);

        // 'sometimes' means a field is only validated when it appears in the request.
        $validated = $request->validate([
            'restriction_type' => 'sometimes|string|in:activity,dietary,environmental,medication,other',
            'description' => 'sometimes|string|max:2000',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            // Toggling is_active is the primary way to deactivate a restriction without deleting it.
            'is_active' => 'boolean',
            'notes' => 'nullable|string|max:2000',
        ]);

        $medicalRestriction->update($validated);

        // Reload so the response reflects the freshly updated values.
        $medicalRestriction->load(['camper', 'creator']);

        return response()->json([
            'message' => 'Medical restriction updated successfully.',
            'data' => $medicalRestriction,
        ]);
    }

    /**
     * Permanently delete a medical restriction.
     *
     * Prefer toggling is_active=false instead of deleting when possible,
     * since deletion removes the audit trail of what restrictions were in place.
     * MedicalRestrictionPolicy restricts hard-deletion to administrators.
     */
    public function destroy(MedicalRestriction $medicalRestriction): JsonResponse
    {
        // Hard gate before permanently removing this PHI restriction record.
        $this->authorize('delete', $medicalRestriction);

        $medicalRestriction->delete();

        return response()->json(['message' => 'Medical restriction deleted successfully.']);
    }
}
