<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\Diagnosis\StoreDiagnosisRequest;
use App\Http\Requests\Diagnosis\UpdateDiagnosisRequest;
use App\Models\Diagnosis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * DiagnosisController
 *
 * Manages formal medical diagnoses attached to individual campers — for example,
 * asthma, epilepsy, or Type 1 diabetes. Diagnoses are Protected Health Information
 * (PHI) and inform supervision levels, activity restrictions, and emergency response
 * plans at camp.
 *
 * Because a diagnosis reveals sensitive medical conditions, DiagnosisPolicy strictly
 * limits which roles may read or modify these records. All five CRUD actions below
 * perform a policy check before doing anything else.
 */
class DiagnosisController extends Controller
{
    /**
     * List all diagnosis records (paginated).
     *
     * Returns 15 diagnoses per page. Each record includes the related camper
     * so the caller can see which child each diagnosis belongs to.
     * Only admins and medical providers may use this listing endpoint.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only privileged roles may browse the full diagnosis list.
        $this->authorize('viewAny', Diagnosis::class);

        // Eager-load the camper relationship to avoid N+1 queries per row.
        $diagnoses = Diagnosis::with('camper')->paginate(15);

        return response()->json([
            'data' => $diagnoses->items(),
            'meta' => [
                'current_page' => $diagnoses->currentPage(),
                'last_page' => $diagnoses->lastPage(),
                'per_page' => $diagnoses->perPage(),
                'total' => $diagnoses->total(),
            ],
        ]);
    }

    /**
     * Create a new diagnosis record for a camper.
     *
     * StoreDiagnosisRequest validates all incoming fields before they arrive here,
     * so $request->validated() only contains safe, whitelisted data.
     */
    public function store(StoreDiagnosisRequest $request): JsonResponse
    {
        // Confirm the caller has permission to add a diagnosis.
        $this->authorize('create', Diagnosis::class);

        // Persist only the validated PHI fields to the database.
        $diagnosis = Diagnosis::create($request->validated());

        // Load the associated camper so the API response is fully self-contained.
        $diagnosis->load('camper');

        // HTTP 201 Created indicates a new resource was successfully added.
        return response()->json([
            'message' => 'Diagnosis created successfully.',
            'data' => $diagnosis,
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single diagnosis record by its ID.
     *
     * Laravel resolves $diagnosis from the URL automatically via route-model binding.
     */
    public function show(Diagnosis $diagnosis): JsonResponse
    {
        // Per-record check — parents may only view their own child's diagnoses.
        $this->authorize('view', $diagnosis);

        $diagnosis->load('camper');

        return response()->json([
            'data' => $diagnosis,
        ]);
    }

    /**
     * Update an existing diagnosis record with new field values.
     *
     * Only fields whitelisted by UpdateDiagnosisRequest are applied to the model;
     * any extra payload the client sends is discarded before it touches the DB.
     */
    public function update(UpdateDiagnosisRequest $request, Diagnosis $diagnosis): JsonResponse
    {
        // Check that the user is allowed to edit this specific diagnosis.
        $this->authorize('update', $diagnosis);

        $diagnosis->update($request->validated());

        return response()->json([
            'message' => 'Diagnosis updated successfully.',
            'data' => $diagnosis,
        ]);
    }

    /**
     * Permanently delete a diagnosis record.
     *
     * Deleting a diagnosis removes important clinical context from the camper's
     * health profile, so DiagnosisPolicy restricts this action to admins only.
     */
    public function destroy(Diagnosis $diagnosis): JsonResponse
    {
        // Hard gate before permanently removing this PHI record.
        $this->authorize('delete', $diagnosis);

        $diagnosis->delete();

        return response()->json([
            'message' => 'Diagnosis deleted successfully.',
        ]);
    }
}
