<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\ActivityPermission\StoreActivityPermissionRequest;
use App\Http\Requests\ActivityPermission\UpdateActivityPermissionRequest;
use App\Models\ActivityPermission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ActivityPermissionController
 *
 * Manages activity permission records for individual campers — formal medical
 * clearances or restrictions that say whether a camper can participate in specific
 * camp activities (swimming, hiking, contact sports, etc.). These records are
 * typically set based on a physician's orders or a nurse's clinical assessment.
 *
 * This data is PHI (Protected Health Information) because it reflects a child's
 * medical limitations. The index endpoint supports filtering by camper_id so
 * counselors and activity staff can efficiently retrieve restrictions for one
 * specific camper. All actions are gated by ActivityPermissionPolicy.
 */
class ActivityPermissionController extends Controller
{
    /**
     * List activity permission records, optionally filtered by camper.
     *
     * Passing ?camper_id=X narrows results to a single camper, which is the
     * typical use-case when loading the permissions panel on a camper's record.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only admins and medical providers may list these records.
        $this->authorize('viewAny', ActivityPermission::class);

        // Start with all permissions and their associated camper information.
        $query = ActivityPermission::with('camper');

        // Scope to one camper if a filter was provided in the query string.
        if ($request->filled('camper_id')) {
            // Cast to integer to prevent type-coercion injection.
            $query->where('camper_id', $request->integer('camper_id'));
        }

        $permissions = $query->paginate(15);

        return response()->json([
            'data' => $permissions->items(),
            'meta' => [
                'current_page' => $permissions->currentPage(),
                'last_page' => $permissions->lastPage(),
                'per_page' => $permissions->perPage(),
                'total' => $permissions->total(),
            ],
        ]);
    }

    /**
     * Create a new activity permission record for a camper.
     *
     * All incoming fields are validated and whitelisted by
     * StoreActivityPermissionRequest before they reach this method.
     */
    public function store(StoreActivityPermissionRequest $request): JsonResponse
    {
        // Confirm the caller is allowed to create activity permission records.
        $this->authorize('create', ActivityPermission::class);

        // Persist only the safe, validated fields to the database.
        $permission = ActivityPermission::create($request->validated());

        // Load the camper so the response includes context about who this applies to.
        $permission->load('camper');

        // HTTP 201 Created signals a new resource was successfully added.
        return response()->json([
            'message' => 'Activity permission created successfully.',
            'data' => $permission,
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single activity permission record.
     *
     * Laravel resolves $activityPermission from the URL automatically via
     * route-model binding.
     */
    public function show(ActivityPermission $activityPermission): JsonResponse
    {
        // Per-record policy check before returning PHI permission details.
        $this->authorize('view', $activityPermission);

        $activityPermission->load('camper');

        return response()->json([
            'data' => $activityPermission,
        ]);
    }

    /**
     * Update an existing activity permission record.
     *
     * Only fields whitelisted by UpdateActivityPermissionRequest are written
     * to the database — extra fields from the client are silently discarded.
     */
    public function update(UpdateActivityPermissionRequest $request, ActivityPermission $activityPermission): JsonResponse
    {
        // Confirm the caller is allowed to modify this specific record.
        $this->authorize('update', $activityPermission);

        $activityPermission->update($request->validated());

        return response()->json([
            'message' => 'Activity permission updated successfully.',
            'data' => $activityPermission,
        ]);
    }

    /**
     * Permanently delete an activity permission record.
     *
     * Removing a permission clears a clearance or restriction that camp staff
     * rely on for safety decisions, so ActivityPermissionPolicy limits this
     * action to administrators.
     */
    public function destroy(ActivityPermission $activityPermission): JsonResponse
    {
        // Hard gate before permanently deleting this PHI record.
        $this->authorize('delete', $activityPermission);

        $activityPermission->delete();

        return response()->json([
            'message' => 'Activity permission deleted successfully.',
        ]);
    }
}
