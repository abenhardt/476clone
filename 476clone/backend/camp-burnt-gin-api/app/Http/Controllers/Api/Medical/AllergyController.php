<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\Allergy\StoreAllergyRequest;
use App\Http\Requests\Allergy\UpdateAllergyRequest;
use App\Models\Allergy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * AllergyController
 *
 * Manages the allergy records attached to individual campers. Allergy data is
 * Protected Health Information (PHI) — knowing that a child has a severe peanut
 * allergy, for example, is sensitive medical information. Every action here is
 * gated by AllergyPolicy, which decides who can read or change this data.
 *
 * Allergy severity values (e.g., "severe", "life_threatening") are also used
 * by MedicalStatsController to surface high-risk camper counts on the dashboard.
 */
class AllergyController extends Controller
{
    /**
     * List all allergy records (paginated).
     *
     * Returns 15 records per page. Each record includes the related camper so
     * the caller can identify which child the allergy belongs to.
     * Admins and medical providers only — parents use show() on their child's record.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only privileged roles may browse the full allergy list.
        $this->authorize('viewAny', Allergy::class);

        // Eager-load camper relationship to prevent N+1 queries across the page.
        $allergies = Allergy::with('camper')->paginate(15);

        return response()->json([
            'data' => $allergies->items(),
            'meta' => [
                'current_page' => $allergies->currentPage(),
                'last_page' => $allergies->lastPage(),
                'per_page' => $allergies->perPage(),
                'total' => $allergies->total(),
            ],
        ]);
    }

    /**
     * Create a new allergy record for a camper.
     *
     * Validation is handled upstream in StoreAllergyRequest; only fields that
     * pass those rules arrive here via $request->validated().
     */
    public function store(StoreAllergyRequest $request): JsonResponse
    {
        // Confirm the caller is allowed to add allergy records.
        $this->authorize('create', Allergy::class);

        // Insert the validated PHI fields into the database.
        $allergy = Allergy::create($request->validated());

        // Load camper so the API response is self-contained.
        $allergy->load('camper');

        // HTTP 201 signals the resource was successfully created.
        return response()->json([
            'message' => 'Allergy created successfully.',
            'data' => $allergy,
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single allergy record.
     *
     * Laravel resolves $allergy automatically from the route parameter
     * using route-model binding (no manual DB lookup needed).
     */
    public function show(Allergy $allergy): JsonResponse
    {
        // Per-record policy check — e.g., a parent may only view their own child's allergy.
        $this->authorize('view', $allergy);

        $allergy->load('camper');

        return response()->json([
            'data' => $allergy,
        ]);
    }

    /**
     * Update an existing allergy record.
     *
     * Only fields whitelisted by UpdateAllergyRequest are written to the DB,
     * preventing mass-assignment of unexpected columns.
     */
    public function update(UpdateAllergyRequest $request, Allergy $allergy): JsonResponse
    {
        // Check the user is permitted to modify this specific allergy record.
        $this->authorize('update', $allergy);

        $allergy->update($request->validated());

        return response()->json([
            'message' => 'Allergy updated successfully.',
            'data' => $allergy,
        ]);
    }

    /**
     * Delete an allergy record permanently.
     *
     * Removing an allergy is a safety-critical action — if a severe allergy
     * is accidentally deleted, camp staff lose visibility of a serious risk.
     * AllergyPolicy therefore restricts deletion to admins.
     */
    public function destroy(Allergy $allergy): JsonResponse
    {
        // Hard gate before permanently removing this PHI record.
        $this->authorize('delete', $allergy);

        $allergy->delete();

        return response()->json([
            'message' => 'Allergy deleted successfully.',
        ]);
    }
}
