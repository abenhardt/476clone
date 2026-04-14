<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\BehavioralProfile\StoreBehavioralProfileRequest;
use App\Http\Requests\BehavioralProfile\UpdateBehavioralProfileRequest;
use App\Models\AuditLog;
use App\Models\BehavioralProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * BehavioralProfileController
 *
 * A behavioral profile captures clinical and developmental information that helps
 * camp staff understand and support a camper's behavioral needs — things like
 * diagnosed behavioral conditions, known triggers, de-escalation strategies,
 * supervision requirements, and developmental notes.
 *
 * This is highly sensitive PHI (Protected Health Information). A behavioral
 * profile might reveal diagnoses like ADHD, autism spectrum disorder, or trauma
 * history. Access is therefore strictly gated by BehavioralProfilePolicy, which
 * limits read and write access to admins and medical providers only.
 *
 * Unlike some resources, behavioral profiles are one-per-camper (not a list),
 * so the index endpoint is primarily an admin tool.
 */
class BehavioralProfileController extends Controller
{
    /**
     * List all behavioral profiles (paginated).
     *
     * Each record includes the related camper so the caller can identify
     * whose profile it is. Only admins and medical providers may use this endpoint.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only privileged roles may browse the full list of behavioral profiles.
        $this->authorize('viewAny', BehavioralProfile::class);

        // Eager-load camper to avoid N+1 queries when rendering the list.
        $profiles = BehavioralProfile::with('camper')->paginate(15);

        return response()->json([
            'data' => $profiles->items(),
            'meta' => [
                'current_page' => $profiles->currentPage(),
                'last_page' => $profiles->lastPage(),
                'per_page' => $profiles->perPage(),
                'total' => $profiles->total(),
            ],
        ]);
    }

    /**
     * Create a new behavioral profile for a camper.
     *
     * StoreBehavioralProfileRequest validates and whitelists all incoming fields
     * before they reach this method, keeping raw user input away from the DB.
     */
    public function store(StoreBehavioralProfileRequest $request): JsonResponse
    {
        // Confirm the caller is authorized to create behavioral profiles.
        $this->authorize('create', BehavioralProfile::class);

        $data = $request->validated();

        // updateOrCreate makes this endpoint idempotent: if the form submission
        // failed mid-way and is retried, we update the existing profile rather
        // than returning a 422 "already exists" error that would permanently
        // block the user from completing their application.
        $profile = BehavioralProfile::updateOrCreate(
            ['camper_id' => $data['camper_id']],
            $data
        );

        // Load the camper so the response is self-contained.
        $profile->load('camper');

        $status = $profile->wasRecentlyCreated ? Response::HTTP_CREATED : Response::HTTP_OK;

        return response()->json([
            'message' => 'Behavioral profile saved successfully.',
            'data' => $profile,
        ], $status);
    }

    /**
     * Retrieve a single behavioral profile.
     *
     * Laravel resolves $behavioralProfile from the URL automatically via
     * route-model binding — no manual query needed.
     */
    public function show(BehavioralProfile $behavioralProfile): JsonResponse
    {
        // Per-record policy check before returning this sensitive PHI document.
        $this->authorize('view', $behavioralProfile);

        $behavioralProfile->load('camper');

        return response()->json([
            'data' => $behavioralProfile,
        ]);
    }

    /**
     * Update an existing behavioral profile.
     *
     * Only fields whitelisted by UpdateBehavioralProfileRequest are applied.
     * Because this is a one-per-camper document, updates are the primary way
     * staff keep behavioral information current throughout the session.
     */
    public function update(UpdateBehavioralProfileRequest $request, BehavioralProfile $behavioralProfile): JsonResponse
    {
        // Confirm the caller is permitted to edit this profile.
        $this->authorize('update', $behavioralProfile);

        $data = $request->validated();
        $oldSnapshot = array_intersect_key($behavioralProfile->only(array_keys($data)), $data);

        $behavioralProfile->update($data);

        $newSnapshot = array_intersect_key($behavioralProfile->fresh()->only(array_keys($data)), $data);

        if ($oldSnapshot !== $newSnapshot) {
            AuditLog::logContentChange(
                auditable: $behavioralProfile,
                editor: $request->user(),
                oldValues: $oldSnapshot,
                newValues: $newSnapshot,
            );
        }

        return response()->json([
            'message' => 'Behavioral profile updated successfully.',
            'data' => $behavioralProfile,
        ]);
    }

    /**
     * Permanently delete a behavioral profile.
     *
     * Removing a behavioral profile erases context that camp staff rely on to
     * support a camper safely, so BehavioralProfilePolicy limits this to admins.
     */
    public function destroy(BehavioralProfile $behavioralProfile): JsonResponse
    {
        // Hard gate before permanently removing this sensitive PHI record.
        $this->authorize('delete', $behavioralProfile);

        $behavioralProfile->delete();

        return response()->json([
            'message' => 'Behavioral profile deleted successfully.',
        ]);
    }
}
