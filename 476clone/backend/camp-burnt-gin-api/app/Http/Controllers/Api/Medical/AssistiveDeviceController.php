<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssistiveDevice\StoreAssistiveDeviceRequest;
use App\Http\Requests\AssistiveDevice\UpdateAssistiveDeviceRequest;
use App\Models\AssistiveDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * AssistiveDeviceController
 *
 * Tracks assistive devices that campers bring to or use at camp — things like
 * wheelchairs, walkers, hearing aids, communication devices, insulin pumps, or
 * orthotic braces. Knowing what devices a camper depends on is critical for
 * emergency response and daily care planning.
 *
 * This data is PHI (Protected Health Information) because it reveals a child's
 * physical or neurological conditions. The index endpoint supports filtering by
 * camper_id so staff can quickly see all devices for one specific camper.
 * All actions are gated by AssistiveDevicePolicy.
 */
class AssistiveDeviceController extends Controller
{
    /**
     * List assistive device records, optionally filtered by camper.
     *
     * Passing ?camper_id=X narrows results to a single camper, which is the
     * typical use-case when loading a camper's medical record page.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only admins and medical providers may view these records.
        $this->authorize('viewAny', AssistiveDevice::class);

        // Start with all device records and their related camper information.
        $query = AssistiveDevice::with('camper');

        // Scope to one camper if a filter was supplied in the query string.
        if ($request->filled('camper_id')) {
            // Cast to integer to prevent SQL type-coercion issues.
            $query->where('camper_id', $request->integer('camper_id'));
        }

        $devices = $query->paginate(15);

        return response()->json([
            'data' => $devices->items(),
            'meta' => [
                'current_page' => $devices->currentPage(),
                'last_page' => $devices->lastPage(),
                'per_page' => $devices->perPage(),
                'total' => $devices->total(),
            ],
        ]);
    }

    /**
     * Create a new assistive device record for a camper.
     *
     * All incoming fields are validated and whitelisted by
     * StoreAssistiveDeviceRequest before reaching this method.
     */
    public function store(StoreAssistiveDeviceRequest $request): JsonResponse
    {
        // Confirm the caller is authorized to add assistive device records.
        $this->authorize('create', AssistiveDevice::class);

        // Persist only the safe, validated PHI fields to the database.
        $device = AssistiveDevice::create($request->validated());

        // Load the camper so the response is self-contained.
        $device->load('camper');

        // HTTP 201 Created signals the new resource was successfully added.
        return response()->json([
            'message' => 'Assistive device created successfully.',
            'data' => $device,
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single assistive device record.
     *
     * Laravel resolves $assistiveDevice from the URL parameter automatically
     * via route-model binding — no manual query required.
     */
    public function show(AssistiveDevice $assistiveDevice): JsonResponse
    {
        // Per-record policy check before returning PHI device details.
        $this->authorize('view', $assistiveDevice);

        $assistiveDevice->load('camper');

        return response()->json([
            'data' => $assistiveDevice,
        ]);
    }

    /**
     * Update an existing assistive device record.
     *
     * Only fields whitelisted by UpdateAssistiveDeviceRequest are applied
     * to the model — any extra fields from the client are discarded.
     */
    public function update(UpdateAssistiveDeviceRequest $request, AssistiveDevice $assistiveDevice): JsonResponse
    {
        // Confirm the caller is permitted to edit this record.
        $this->authorize('update', $assistiveDevice);

        $assistiveDevice->update($request->validated());

        return response()->json([
            'message' => 'Assistive device updated successfully.',
            'data' => $assistiveDevice,
        ]);
    }

    /**
     * Permanently delete an assistive device record.
     *
     * If a device record is accidentally deleted, staff may not know to
     * accommodate a camper's mobility or medical needs, so
     * AssistiveDevicePolicy restricts deletion to administrators.
     */
    public function destroy(AssistiveDevice $assistiveDevice): JsonResponse
    {
        // Hard gate before permanently removing this PHI record.
        $this->authorize('delete', $assistiveDevice);

        $assistiveDevice->delete();

        return response()->json([
            'message' => 'Assistive device deleted successfully.',
        ]);
    }
}
