<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\Medication\StoreMedicationRequest;
use App\Http\Requests\Medication\UpdateMedicationRequest;
use App\Models\AuditLog;
use App\Models\Medication;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * MedicationController
 *
 * Manages the list of medications a camper takes — including name, dosage,
 * schedule, and purpose. This data is Protected Health Information (PHI):
 * someone's prescription list can reveal sensitive medical conditions.
 *
 * Medication records are also cross-referenced by TreatmentLogController when
 * checking for allergy conflicts during medication administration, so accuracy here
 * is important for camper safety. All actions are gated by MedicationPolicy.
 */
class MedicationController extends Controller
{
    /**
     * List all medication records (paginated).
     *
     * Returns 15 per page. Each record includes the related camper so the caller
     * can identify whose medication it is without a second request.
     * Admins and medical providers only — parents use show() on their child.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only privileged roles may browse all medication records.
        $this->authorize('viewAny', Medication::class);

        // Eager-load camper to avoid N+1 queries when rendering the list.
        $medications = Medication::with('camper')->paginate(15);

        return response()->json([
            'data' => $medications->items(),
            'meta' => [
                'current_page' => $medications->currentPage(),
                'last_page' => $medications->lastPage(),
                'per_page' => $medications->perPage(),
                'total' => $medications->total(),
            ],
        ]);
    }

    /**
     * Create a new medication record for a camper.
     *
     * StoreMedicationRequest validates and whitelists all incoming fields
     * before they reach this method, keeping raw user input out of the DB call.
     */
    public function store(StoreMedicationRequest $request): JsonResponse
    {
        // Confirm the caller is authorized to add medication records.
        $this->authorize('create', Medication::class);

        // Only validated (safe) fields are written to the database.
        $medication = Medication::create($request->validated());

        // Audit log: adding a medication record is a clinical PHI event.
        AuditLog::logPhiAccess('medication.created', $request->user(), $medication, [
            'camper_id' => $medication->camper_id,
        ]);

        // Load camper details so the API response is self-contained.
        $medication->load('camper');

        // HTTP 201 signals the resource was successfully created.
        return response()->json([
            'message' => 'Medication created successfully.',
            'data' => $medication,
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single medication record.
     *
     * Laravel's route-model binding resolves $medication from the URL parameter
     * automatically — no manual query is required.
     */
    public function show(Medication $medication): JsonResponse
    {
        // Per-record check — parents can only view their own child's medications.
        $this->authorize('view', $medication);

        $medication->load('camper');

        return response()->json([
            'data' => $medication,
        ]);
    }

    /**
     * Update an existing medication record.
     *
     * Only fields whitelisted by UpdateMedicationRequest are applied;
     * any extra fields sent by the client are silently ignored.
     */
    public function update(UpdateMedicationRequest $request, Medication $medication): JsonResponse
    {
        // Check the user is permitted to edit this specific medication record.
        $this->authorize('update', $medication);

        $oldValues = $medication->only(array_keys($request->validated()));
        $medication->update($request->validated());

        // Audit log: medication changes are clinical PHI mutations.
        AuditLog::logContentChange($medication, $request->user(), $oldValues, $medication->only(array_keys($request->validated())));

        return response()->json([
            'message' => 'Medication updated successfully.',
            'data' => $medication,
        ]);
    }

    /**
     * Delete a medication record permanently.
     *
     * Removing an active medication from the system could cause staff to miss
     * a dose or overlook a drug interaction, so MedicationPolicy restricts
     * deletion to administrators.
     */
    public function destroy(Medication $medication): JsonResponse
    {
        // Hard gate before permanently deleting this PHI record.
        $this->authorize('delete', $medication);

        // Audit log: medication deletion must be recorded before the record is removed.
        AuditLog::logAdminAction('medication.deleted', request()->user(), 'Medication record deleted', [
            'medication_id' => $medication->id,
            'camper_id' => $medication->camper_id,
        ]);

        $medication->delete();

        return response()->json([
            'message' => 'Medication deleted successfully.',
        ]);
    }
}
