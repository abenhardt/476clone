<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\TreatmentLog\StoreTreatmentLogRequest;
use App\Http\Requests\TreatmentLog\UpdateTreatmentLogRequest;
use App\Models\Camper;
use App\Models\TreatmentLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * TreatmentLogController
 *
 * Treatment logs are the moment-by-moment clinical notes that medical staff
 * write each time they treat a camper — administering a medication, cleaning
 * a wound, observing a reaction, or responding to an emergency.
 *
 * Key safety feature: when a medication is recorded, this controller
 * automatically checks whether the administered drug matches any of the
 * camper's known allergens and includes allergy conflict warnings in the
 * API response so the medic can make an informed decision.
 *
 * All actions are gated by TreatmentLogPolicy. The "recorder" is always set
 * server-side to the authenticated user — clients cannot forge who wrote a log.
 */
class TreatmentLogController extends Controller
{
    /**
     * List treatment logs with optional filters (paginated).
     *
     * Supports filtering by camper_id, date range (from/to), and treatment type.
     * Results are sorted newest-first by date then time so the most recent
     * care events appear at the top.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only admins and medical providers may view treatment logs.
        $this->authorize('viewAny', TreatmentLog::class);

        // Start the query with both the camper and the staff member who wrote the log.
        $query = TreatmentLog::with(['camper', 'recorder'])
            ->orderByDesc('treatment_date')
            ->orderByDesc('treatment_time');

        // Narrow to a specific camper when viewing their individual medical record.
        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }

        // Apply start-of-range date filter if provided.
        if ($request->filled('from')) {
            $query->whereDate('treatment_date', '>=', $request->input('from'));
        }

        // Apply end-of-range date filter if provided.
        if ($request->filled('to')) {
            $query->whereDate('treatment_date', '<=', $request->input('to'));
        }

        // Filter by treatment type (e.g., medication, observation, emergency).
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        // Use a larger page size (25) since treatment logs are reviewed in bulk.
        $logs = $query->paginate(25);

        return response()->json([
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->perPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    /**
     * Record a new treatment log entry.
     *
     * The authenticated user is stamped as the recorder server-side — clients
     * cannot supply a different recorded_by value. If a medication was given,
     * the response may include allergy_warnings if any conflict is detected.
     */
    public function store(StoreTreatmentLogRequest $request): JsonResponse
    {
        // Confirm the caller is a medical provider or admin.
        $this->authorize('create', TreatmentLog::class);

        // Merge the validated payload with the server-determined recorder ID.
        $log = TreatmentLog::create(array_merge(
            $request->validated(),
            ['recorded_by' => $request->user()->id]
        ));

        // Load all related models needed for a complete API response.
        $log->load(['camper', 'recorder', 'medicalVisit']);

        // Allergy conflict check — warn if the administered medication
        // matches any of the camper's recorded allergens.
        $allergyWarnings = [];
        $medicationGiven = $request->validated('medication_given');
        if ($medicationGiven) {
            // Fetch the camper with their allergies to compare against the medication name.
            $camper = Camper::with('allergies')->find($log->camper_id);
            if ($camper) {
                // The static helper on TreatmentLog does the text-matching logic.
                $allergyWarnings = TreatmentLog::detectAllergyConflicts(
                    $medicationGiven,
                    $camper->allergies
                );
            }
        }

        $response = [
            'message' => 'Treatment log created successfully.',
            'data' => $log,
        ];

        // Only add the warnings key if conflicts were actually found, keeping the
        // response clean for the common case where there are no conflicts.
        if (! empty($allergyWarnings)) {
            $response['allergy_warnings'] = $allergyWarnings;
        }

        return response()->json($response, Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single treatment log entry with all related context.
     *
     * Loads camper, the staff recorder, and any linked medical visit so the
     * frontend can display a complete clinical picture without extra requests.
     */
    public function show(TreatmentLog $treatmentLog): JsonResponse
    {
        // Per-record policy check before exposing PHI treatment details.
        $this->authorize('view', $treatmentLog);

        $treatmentLog->load(['camper', 'recorder', 'medicalVisit']);

        return response()->json([
            'data' => $treatmentLog,
        ]);
    }

    /**
     * Update an existing treatment log entry.
     *
     * Only fields whitelisted by UpdateTreatmentLogRequest are applied.
     * The recorder and camper are reloaded so the response reflects current data.
     */
    public function update(UpdateTreatmentLogRequest $request, TreatmentLog $treatmentLog): JsonResponse
    {
        // Verify the caller is allowed to edit this log entry.
        $this->authorize('update', $treatmentLog);

        $treatmentLog->update($request->validated());

        // Reload relationships so the response body is consistent after the update.
        $treatmentLog->load(['camper', 'recorder', 'medicalVisit']);

        return response()->json([
            'message' => 'Treatment log updated successfully.',
            'data' => $treatmentLog,
        ]);
    }

    /**
     * Permanently delete a treatment log entry.
     *
     * Clinical records should be preserved for accountability, so
     * TreatmentLogPolicy restricts deletion to administrators only.
     */
    public function destroy(TreatmentLog $treatmentLog): JsonResponse
    {
        // Hard gate: admins only for deleting clinical PHI records.
        $this->authorize('delete', $treatmentLog);

        $treatmentLog->delete();

        return response()->json([
            'message' => 'Treatment log deleted successfully.',
        ]);
    }
}
