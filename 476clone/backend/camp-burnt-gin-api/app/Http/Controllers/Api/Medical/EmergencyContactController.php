<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\EmergencyContact\StoreEmergencyContactRequest;
use App\Http\Requests\EmergencyContact\UpdateEmergencyContactRequest;
use App\Models\AuditLog;
use App\Models\EmergencyContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * EmergencyContactController
 *
 * Manages emergency contacts for campers — the people camp staff will call if a
 * camper is injured or ill. Contact records include names, phone numbers, and whether
 * the person is authorized for pickup, all of which are PHI (Protected Health Info).
 *
 * This controller supports filtering by camper_id so the frontend can fetch only
 * the contacts for a specific camper rather than loading the entire list. All actions
 * are protected by EmergencyContactPolicy.
 */
class EmergencyContactController extends Controller
{
    /**
     * List emergency contacts, optionally filtered by camper.
     *
     * Passing ?camper_id=X in the query string narrows results to a single camper,
     * which is the typical use-case when loading a camper's medical record page.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only admins and medical providers may list contacts.
        $this->authorize('viewAny', EmergencyContact::class);

        // Start with all contacts and their associated camper information.
        $query = EmergencyContact::with('camper');

        // If a camper_id filter was provided, scope the query to that camper only.
        if ($request->filled('camper_id')) {
            // Cast to integer to prevent SQL injection via type coercion.
            $query->where('camper_id', $request->integer('camper_id'));
        }

        $contacts = $query->paginate(15);

        return response()->json([
            'data' => $contacts->items(),
            'meta' => [
                'current_page' => $contacts->currentPage(),
                'last_page' => $contacts->lastPage(),
                'per_page' => $contacts->perPage(),
                'total' => $contacts->total(),
            ],
        ]);
    }

    /**
     * Create a new emergency contact for a camper.
     *
     * StoreEmergencyContactRequest validates all fields (name, phone, relationship, etc.)
     * before they reach this method, so only safe data is written to the DB.
     */
    public function store(StoreEmergencyContactRequest $request): JsonResponse
    {
        // Confirm the caller is permitted to add emergency contacts.
        $this->authorize('create', EmergencyContact::class);

        // Persist only the validated PHI fields.
        $contact = EmergencyContact::create($request->validated());

        // Load the camper so the response includes context about whose contact this is.
        $contact->load('camper');

        if ($request->user()->isAdmin()) {
            AuditLog::logAdminAction(
                action: 'emergency_contact.created',
                user: $request->user(),
                description: 'Admin created emergency contact for camper '.$contact->camper_id,
                metadata: ['camper_id' => $contact->camper_id, 'contact_id' => $contact->id],
            );
        }

        return response()->json([
            'message' => 'Emergency contact created successfully.',
            'data' => $contact,
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single emergency contact by its ID.
     *
     * Route-model binding resolves $emergencyContact from the URL automatically.
     */
    public function show(EmergencyContact $emergencyContact): JsonResponse
    {
        // Per-record policy check before exposing contact details.
        $this->authorize('view', $emergencyContact);

        $emergencyContact->load('camper');

        return response()->json([
            'data' => $emergencyContact,
        ]);
    }

    /**
     * Update an existing emergency contact.
     *
     * Only the fields validated by UpdateEmergencyContactRequest are applied,
     * which prevents unintended columns from being overwritten.
     */
    public function update(UpdateEmergencyContactRequest $request, EmergencyContact $emergencyContact): JsonResponse
    {
        // Verify the caller can modify this specific contact record.
        $this->authorize('update', $emergencyContact);

        $data = $request->validated();
        $oldSnapshot = array_intersect_key($emergencyContact->only(array_keys($data)), $data);

        $emergencyContact->update($data);

        $newSnapshot = array_intersect_key($emergencyContact->fresh()->only(array_keys($data)), $data);

        if ($oldSnapshot !== $newSnapshot) {
            AuditLog::logContentChange(
                auditable: $emergencyContact,
                editor: $request->user(),
                oldValues: $oldSnapshot,
                newValues: $newSnapshot,
            );
        }

        return response()->json([
            'message' => 'Emergency contact updated successfully.',
            'data' => $emergencyContact,
        ]);
    }

    /**
     * Permanently delete an emergency contact.
     *
     * Deleting all contacts for a camper would leave staff with no one to call
     * in an emergency, so EmergencyContactPolicy limits this to admins.
     */
    public function destroy(EmergencyContact $emergencyContact): JsonResponse
    {
        // Hard gate before removing this PHI record permanently.
        $this->authorize('delete', $emergencyContact);

        $emergencyContact->delete();

        return response()->json([
            'message' => 'Emergency contact deleted successfully.',
        ]);
    }
}
