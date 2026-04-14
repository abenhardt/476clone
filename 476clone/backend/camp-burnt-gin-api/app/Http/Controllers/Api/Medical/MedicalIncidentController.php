<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MedicalIncident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * MedicalIncidentController
 *
 * A medical incident is any notable health or safety event that happens to a camper
 * at camp — a broken bone (injury), a seizure (medical), a bee sting (environmental),
 * or a behavioral episode. Each incident captures what happened, how serious it was,
 * where it occurred, and whether it needed to be escalated to parents or outside services.
 *
 * Incidents are sorted newest-first (by date then time) so staff see the most urgent
 * recent events at the top. Validation rules live inline in this controller (rather than
 * in a dedicated Request class) because incident requirements are complex and context-dependent.
 *
 * The "recorder" is always stamped server-side to the authenticated user — clients
 * cannot forge who filed the report. All actions are gated by MedicalIncidentPolicy.
 */
class MedicalIncidentController extends Controller
{
    /**
     * List medical incidents with optional filters (paginated).
     *
     * Supports filtering by camper, incident type, severity, and date range.
     * Results are ordered newest-first so recent events surface immediately.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only admins and medical providers may view incidents.
        $this->authorize('viewAny', MedicalIncident::class);

        // Eager-load camper and recorder to avoid N+1 queries across the result set.
        $query = MedicalIncident::with(['camper', 'recorder'])
            ->orderByDesc('incident_date')
            ->orderByDesc('incident_time');

        // Scope to a single camper (used when viewing a camper's profile page).
        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }

        // Filter by incident category: behavioral, medical, injury, environmental, emergency, other.
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        // Filter by severity level: minor, moderate, severe, critical.
        if ($request->filled('severity')) {
            $query->where('severity', $request->input('severity'));
        }

        // Apply start-of-range date filter.
        if ($request->filled('from')) {
            $query->whereDate('incident_date', '>=', $request->input('from'));
        }

        // Apply end-of-range date filter.
        if ($request->filled('to')) {
            $query->whereDate('incident_date', '<=', $request->input('to'));
        }

        $incidents = $query->paginate(25);

        return response()->json([
            'data' => $incidents->items(),
            'meta' => [
                'current_page' => $incidents->currentPage(),
                'last_page' => $incidents->lastPage(),
                'per_page' => $incidents->perPage(),
                'total' => $incidents->total(),
            ],
        ]);
    }

    /**
     * Record a new medical incident.
     *
     * Validation is inline here because incident fields are tightly controlled
     * with specific enum values (type, severity) and date constraints.
     * The recorder is set server-side — never from client input.
     */
    public function store(Request $request): JsonResponse
    {
        // Confirm the caller has permission to file an incident report.
        $this->authorize('create', MedicalIncident::class);

        // Validate all required and optional fields with explicit rules.
        // 'before_or_equal:today' prevents back-dating beyond today's date.
        $validated = $request->validate([
            'camper_id' => 'required|integer|exists:campers,id',
            'treatment_log_id' => 'nullable|integer|exists:treatment_logs,id',
            'type' => 'required|string|in:behavioral,medical,injury,environmental,emergency,other',
            'severity' => 'required|string|in:minor,moderate,severe,critical',
            'location' => 'nullable|string|max:255',
            'title' => 'required|string|max:500',
            'description' => 'required|string|max:5000',
            'witnesses' => 'nullable|string|max:2000',
            'escalation_required' => 'boolean',
            'escalation_notes' => 'nullable|string|max:2000',
            'incident_date' => 'required|date|before_or_equal:today',
            'incident_time' => 'nullable|date_format:H:i',
        ]);

        // Merge the server-determined recorder ID into the validated payload.
        $incident = MedicalIncident::create(array_merge(
            $validated,
            ['recorded_by' => $request->user()->id]
        ));

        // Audit log: incident creation is a significant clinical PHI event.
        AuditLog::logPhiAccess('incident.created', $request->user(), $incident, [
            'camper_id' => $incident->camper_id,
            'type' => $incident->type,
            'severity' => $incident->severity,
        ]);

        // Load relationships so the response is fully populated.
        $incident->load(['camper', 'recorder']);

        return response()->json([
            'message' => 'Medical incident recorded successfully.',
            'data' => $incident,
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single incident with full detail.
     *
     * Loads the camper, recorder, and any linked treatment log so the frontend
     * can display the complete incident report without extra API calls.
     */
    public function show(MedicalIncident $medicalIncident): JsonResponse
    {
        // Per-record policy check before returning PHI incident details.
        $this->authorize('view', $medicalIncident);

        // Include the treatment log relationship for incidents tied to a clinical visit.
        $medicalIncident->load(['camper', 'recorder', 'treatmentLog']);

        return response()->json(['data' => $medicalIncident]);
    }

    /**
     * Update an existing incident report.
     *
     * Uses 'sometimes' rules for most fields so only provided fields are validated
     * and updated — useful for partial edits like adding escalation notes later.
     */
    public function update(Request $request, MedicalIncident $medicalIncident): JsonResponse
    {
        // Confirm the caller is allowed to edit this incident.
        $this->authorize('update', $medicalIncident);

        // 'sometimes' means the field is only validated if it was included in the request.
        $validated = $request->validate([
            'type' => 'sometimes|string|in:behavioral,medical,injury,environmental,emergency,other',
            'severity' => 'sometimes|string|in:minor,moderate,severe,critical',
            'location' => 'nullable|string|max:255',
            'title' => 'sometimes|string|max:500',
            'description' => 'sometimes|string|max:5000',
            'witnesses' => 'nullable|string|max:2000',
            'escalation_required' => 'boolean',
            'escalation_notes' => 'nullable|string|max:2000',
            'incident_date' => 'sometimes|date|before_or_equal:today',
            'incident_time' => 'nullable|date_format:H:i',
            'treatment_log_id' => 'nullable|integer|exists:treatment_logs,id',
        ]);

        $oldValues = $medicalIncident->only(array_keys($validated));
        $medicalIncident->update($validated);

        // Audit log: incident updates are sensitive clinical PHI changes.
        AuditLog::logContentChange($medicalIncident, $request->user(), $oldValues, $medicalIncident->only(array_keys($validated)));

        // Reload so the response reflects the freshly updated data.
        $medicalIncident->load(['camper', 'recorder']);

        return response()->json([
            'message' => 'Medical incident updated successfully.',
            'data' => $medicalIncident,
        ]);
    }

    /**
     * Permanently delete an incident report.
     *
     * Incident records are important for accountability and legal compliance,
     * so MedicalIncidentPolicy restricts deletion to administrators only.
     */
    public function destroy(MedicalIncident $medicalIncident): JsonResponse
    {
        // Hard gate before permanently removing this PHI incident record.
        $this->authorize('delete', $medicalIncident);

        // Audit log: incident deletion must be recorded before the record is removed.
        AuditLog::logAdminAction('incident.deleted', request()->user(), 'Medical incident deleted', [
            'incident_id' => $medicalIncident->id,
            'camper_id' => $medicalIncident->camper_id,
            'type' => $medicalIncident->type,
            'severity' => $medicalIncident->severity,
        ]);

        $medicalIncident->delete();

        return response()->json(['message' => 'Medical incident deleted successfully.']);
    }
}
