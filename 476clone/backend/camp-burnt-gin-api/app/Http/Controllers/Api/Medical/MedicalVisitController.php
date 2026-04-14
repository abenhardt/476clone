<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\MedicalVisit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * MedicalVisitController
 *
 * A medical visit is a structured clinical encounter at the camp health center —
 * the camper came in, a nurse or doctor assessed them, vitals were taken, treatment
 * was provided, and a disposition was decided (e.g., returned to activity, sent home,
 * emergency transfer). Visits are more formal than treatment logs and include structured
 * vitals data stored as a JSON object.
 *
 * The vitals sub-array (temp, pulse, BP, weight, SpO2) uses physiologically plausible
 * min/max ranges as validation guards so accidental data entry errors are caught early.
 *
 * The "recorder" is always the authenticated user — clients cannot forge who documented
 * the visit. All actions are gated by MedicalVisitPolicy.
 */
class MedicalVisitController extends Controller
{
    /**
     * List medical visits with optional filters (paginated).
     *
     * Results are sorted newest-first by date then time. Supports filtering
     * by camper, disposition outcome, and date range.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only admins and medical providers may list visits.
        $this->authorize('viewAny', MedicalVisit::class);

        // Eager-load camper and recorder to avoid N+1 queries across the list.
        $query = MedicalVisit::with(['camper', 'recorder'])
            ->orderByDesc('visit_date')
            ->orderByDesc('visit_time');

        // Scope to a single camper when viewing their medical record or profile.
        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }

        // Filter by how the visit ended: returned_to_activity, monitoring, sent_home, etc.
        if ($request->filled('disposition')) {
            $query->where('disposition', $request->input('disposition'));
        }

        // Apply start-of-range date filter.
        if ($request->filled('from')) {
            $query->whereDate('visit_date', '>=', $request->input('from'));
        }

        // Apply end-of-range date filter.
        if ($request->filled('to')) {
            $query->whereDate('visit_date', '<=', $request->input('to'));
        }

        $visits = $query->paginate(25);

        return response()->json([
            'data' => $visits->items(),
            'meta' => [
                'current_page' => $visits->currentPage(),
                'last_page' => $visits->lastPage(),
                'per_page' => $visits->perPage(),
                'total' => $visits->total(),
            ],
        ]);
    }

    /**
     * Record a new medical visit with vitals and disposition.
     *
     * Vitals are validated as a nested array with physiological range checks to
     * catch obvious data entry mistakes (e.g., a temperature of 200°F). The
     * recorder is set server-side and cannot be supplied by the client.
     */
    public function store(Request $request): JsonResponse
    {
        // Confirm the caller is authorized to document medical visits.
        $this->authorize('create', MedicalVisit::class);

        // Validate the visit payload including the nested vitals object.
        $validated = $request->validate([
            'camper_id' => 'required|integer|exists:campers,id',
            // 'before_or_equal:today' prevents recording future visits.
            'visit_date' => 'required|date|before_or_equal:today',
            'visit_time' => 'nullable|date_format:H:i',
            'chief_complaint' => 'required|string|max:500',
            'symptoms' => 'required|string|max:5000',
            // Vitals are optional as a whole but each sub-field has physiological limits.
            'vitals' => 'nullable|array',
            'vitals.temp' => 'nullable|numeric|min:90|max:110',      // Fahrenheit range
            'vitals.pulse' => 'nullable|integer|min:30|max:300',      // BPM range
            'vitals.bp_systolic' => 'nullable|integer|min:50|max:300',      // mmHg range
            'vitals.bp_diastolic' => 'nullable|integer|min:20|max:200',      // mmHg range
            'vitals.weight' => 'nullable|numeric|min:0|max:1000',      // lbs range
            'vitals.spo2' => 'nullable|integer|min:50|max:100',      // % oxygen saturation
            'treatment_provided' => 'nullable|string|max:5000',
            'medications_administered' => 'nullable|string|max:2000',
            // Disposition is required — staff must document the outcome of every visit.
            'disposition' => 'required|string|in:returned_to_activity,monitoring,sent_home,emergency_transfer,other',
            'disposition_notes' => 'nullable|string|max:2000',
            'follow_up_required' => 'boolean',
            'follow_up_notes' => 'nullable|string|max:2000',
        ]);

        // Stamp the authenticated user as the recorder before saving.
        $visit = MedicalVisit::create(array_merge(
            $validated,
            ['recorded_by' => $request->user()->id]
        ));

        $visit->load(['camper', 'recorder']);

        return response()->json([
            'message' => 'Medical visit recorded successfully.',
            'data' => $visit,
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single visit with all related records.
     *
     * Loads the camper, recorder, and all treatment logs linked to this visit
     * (including who wrote each log) for a complete clinical picture.
     */
    public function show(MedicalVisit $medicalVisit): JsonResponse
    {
        // Per-record policy check before returning PHI visit details.
        $this->authorize('view', $medicalVisit);

        // Nested eager-load: get treatment logs AND the recorder of each log.
        $medicalVisit->load(['camper', 'recorder', 'treatmentLogs.recorder']);

        return response()->json(['data' => $medicalVisit]);
    }

    /**
     * Update an existing medical visit record.
     *
     * Uses 'sometimes' rules so only fields explicitly sent by the client are
     * validated and updated — useful for adding follow-up notes after the fact.
     */
    public function update(Request $request, MedicalVisit $medicalVisit): JsonResponse
    {
        // Confirm the caller is allowed to edit this visit record.
        $this->authorize('update', $medicalVisit);

        // 'sometimes' means each field is only checked if it was included in the request.
        $validated = $request->validate([
            'visit_date' => 'sometimes|date|before_or_equal:today',
            'visit_time' => 'nullable|date_format:H:i',
            'chief_complaint' => 'sometimes|string|max:500',
            'symptoms' => 'sometimes|string|max:5000',
            'vitals' => 'nullable|array',
            'vitals.temp' => 'nullable|numeric|min:90|max:110',
            'vitals.pulse' => 'nullable|integer|min:30|max:300',
            'vitals.bp_systolic' => 'nullable|integer|min:50|max:300',
            'vitals.bp_diastolic' => 'nullable|integer|min:20|max:200',
            'vitals.weight' => 'nullable|numeric|min:0|max:1000',
            'vitals.spo2' => 'nullable|integer|min:50|max:100',
            'treatment_provided' => 'nullable|string|max:5000',
            'medications_administered' => 'nullable|string|max:2000',
            'disposition' => 'sometimes|string|in:returned_to_activity,monitoring,sent_home,emergency_transfer,other',
            'disposition_notes' => 'nullable|string|max:2000',
            'follow_up_required' => 'boolean',
            'follow_up_notes' => 'nullable|string|max:2000',
        ]);

        $medicalVisit->update($validated);

        // Reload to ensure the response body reflects freshly updated values.
        $medicalVisit->load(['camper', 'recorder']);

        return response()->json([
            'message' => 'Medical visit updated successfully.',
            'data' => $medicalVisit,
        ]);
    }

    /**
     * Permanently delete a medical visit record.
     *
     * Clinical visit records are legal documents of care; deletion is restricted
     * to administrators by MedicalVisitPolicy to protect accountability.
     */
    public function destroy(MedicalVisit $medicalVisit): JsonResponse
    {
        // Hard gate before permanently removing this clinical PHI record.
        $this->authorize('delete', $medicalVisit);

        $medicalVisit->delete();

        return response()->json(['message' => 'Medical visit deleted successfully.']);
    }
}
