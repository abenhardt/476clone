<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\MedicalRecord\StoreHealthProfileRequest;
use App\Http\Requests\MedicalRecord\StoreMedicalRecordRequest;
use App\Http\Requests\MedicalRecord\UpdateMedicalRecordRequest;
use App\Models\Camper;
use App\Models\MedicalRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * MedicalRecordController
 *
 * This controller is the main gatekeeper for a camper's medical record — the top-level
 * document that ties together all of a camper's health information (allergies, medications,
 * diagnoses, etc.). Because this data is Protected Health Information (PHI) under HIPAA,
 * every single action in this file first checks that the logged-in user is allowed to
 * perform it via MedicalRecordPolicy before anything else happens.
 *
 * Roles that can interact with medical records: admin, super_admin, medical provider.
 * Applicant (parent) users can only view the record belonging to their own child.
 */
class MedicalRecordController extends Controller
{
    /**
     * List all medical records (paginated).
     *
     * Only admins and medical providers reach this endpoint; parents use show() instead.
     * Records are returned 15 per page alongside basic camper info so the caller does not
     * need to make a second request to look up whose record it is.
     */
    public function index(Request $request): JsonResponse
    {
        // Verify the logged-in user is allowed to view any medical record at all.
        $this->authorize('viewAny', MedicalRecord::class);

        // Restrict to active records only — medical records whose associated camper has
        // an approved application. Inactive records (camper's application was reversed
        // or cancelled) are excluded from operational medical views while remaining
        // stored in the database for HIPAA audit and record-retention compliance.
        $medicalRecords = MedicalRecord::active()->with('camper')->paginate(15);

        // Return the page of records along with pagination metadata for the frontend.
        return response()->json([
            'data' => $medicalRecords->items(),
            'meta' => [
                'current_page' => $medicalRecords->currentPage(),
                'last_page' => $medicalRecords->lastPage(),
                'per_page' => $medicalRecords->perPage(),
                'total' => $medicalRecords->total(),
            ],
        ]);
    }

    /**
     * Create a new medical record for a camper.
     *
     * Input is validated by StoreMedicalRecordRequest before this method runs,
     * so $request->validated() only contains fields that passed all the rules.
     */
    public function store(StoreMedicalRecordRequest $request): JsonResponse
    {
        // Confirm the user has permission to create records (typically admin-only).
        $this->authorize('create', MedicalRecord::class);

        // Persist the validated PHI fields to the database.
        $medicalRecord = MedicalRecord::create($request->validated());

        // Load the related camper so the response includes their name/details.
        $medicalRecord->load('camper');

        // 201 Created signals that a new resource was successfully made.
        return response()->json([
            'message' => 'Medical record created successfully.',
            'data' => $medicalRecord,
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single medical record by its ID.
     *
     * Laravel automatically resolves the $medicalRecord model from the route
     * parameter via route-model binding — no manual query needed.
     */
    public function show(MedicalRecord $medicalRecord): JsonResponse
    {
        // Enforce per-record access: e.g., a parent can only view their own child's record.
        $this->authorize('view', $medicalRecord);

        // Attach camper details so the consumer knows which child this belongs to.
        $medicalRecord->load('camper');

        return response()->json([
            'data' => $medicalRecord,
        ]);
    }

    /**
     * Update an existing medical record with new field values.
     *
     * Only the validated (whitelisted) fields from UpdateMedicalRecordRequest are
     * written to the database — no raw user input is ever passed directly.
     */
    public function update(UpdateMedicalRecordRequest $request, MedicalRecord $medicalRecord): JsonResponse
    {
        // Check that the authenticated user is allowed to edit this specific record.
        $this->authorize('update', $medicalRecord);

        // Apply only the validated changes; unchanged fields stay untouched.
        $medicalRecord->update($request->validated());

        return response()->json([
            'message' => 'Medical record updated successfully.',
            'data' => $medicalRecord,
        ]);
    }

    /**
     * Create or update the extended health profile fields for a camper.
     *
     * This is the application-form endpoint (Section 2 extended fields).
     * It targets the camper's existing MedicalRecord via updateOrCreate so
     * parents can re-submit without creating duplicates.
     *
     * Authorization: the requesting user must own the camper (CamperPolicy::update).
     */
    public function storeHealthProfile(StoreHealthProfileRequest $request, Camper $camper): JsonResponse
    {
        $this->authorize('update', $camper);

        $record = MedicalRecord::updateOrCreate(
            ['camper_id' => $camper->id],
            $request->validated()
        );

        return response()->json(['data' => $record], $record->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Permanently delete a medical record.
     *
     * This is a destructive action that removes the top-level PHI document,
     * so only administrators are granted permission by MedicalRecordPolicy.
     */
    public function destroy(MedicalRecord $medicalRecord): JsonResponse
    {
        // Hard gate: only admins can delete PHI records.
        $this->authorize('delete', $medicalRecord);

        $medicalRecord->delete();

        return response()->json([
            'message' => 'Medical record deleted successfully.',
        ]);
    }
}
