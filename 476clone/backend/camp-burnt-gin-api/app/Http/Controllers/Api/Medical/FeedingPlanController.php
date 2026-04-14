<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\FeedingPlan\StoreFeedingPlanRequest;
use App\Http\Requests\FeedingPlan\UpdateFeedingPlanRequest;
use App\Models\FeedingPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * FeedingPlanController
 *
 * Manages feeding plans for campers who have specialized nutritional or feeding
 * needs — for example, a camper with dysphagia (difficulty swallowing) who needs
 * modified textures, a camper on tube feeding, or a camper with strict
 * caloric/macro requirements due to a metabolic condition.
 *
 * This information is PHI (Protected Health Information) because it reveals
 * medical conditions and clinical care instructions. Feeding plans are used by
 * both medical staff and dining staff at camp, so accuracy is safety-critical.
 * All actions are gated by FeedingPlanPolicy.
 */
class FeedingPlanController extends Controller
{
    /**
     * List all feeding plan records (paginated).
     *
     * Each record includes the related camper so the caller knows whose plan
     * it is. Only admins and medical providers may use this listing endpoint.
     */
    public function index(Request $request): JsonResponse
    {
        // Policy check: only privileged roles may browse the full feeding plan list.
        $this->authorize('viewAny', FeedingPlan::class);

        // Eager-load the camper relationship to avoid N+1 queries per record.
        $feedingPlans = FeedingPlan::with('camper')->paginate(15);

        return response()->json([
            'data' => $feedingPlans->items(),
            'meta' => [
                'current_page' => $feedingPlans->currentPage(),
                'last_page' => $feedingPlans->lastPage(),
                'per_page' => $feedingPlans->perPage(),
                'total' => $feedingPlans->total(),
            ],
        ]);
    }

    /**
     * Create a new feeding plan for a camper.
     *
     * StoreFeedingPlanRequest validates all incoming fields before they arrive
     * here, so only safe, whitelisted data is written to the database.
     */
    public function store(StoreFeedingPlanRequest $request): JsonResponse
    {
        // Confirm the caller is authorized to create feeding plan records.
        $this->authorize('create', FeedingPlan::class);

        $data = $request->validated();

        // updateOrCreate makes this endpoint idempotent: if the application form
        // submission fails mid-way and is retried, we update the existing plan
        // rather than returning a 422 error that permanently blocks the user.
        $feedingPlan = FeedingPlan::updateOrCreate(
            ['camper_id' => $data['camper_id']],
            $data
        );

        // Load the related camper so the response is self-contained.
        $feedingPlan->load('camper');

        $status = $feedingPlan->wasRecentlyCreated ? Response::HTTP_CREATED : Response::HTTP_OK;

        return response()->json([
            'message' => 'Feeding plan saved successfully.',
            'data' => $feedingPlan,
        ], $status);
    }

    /**
     * Retrieve a single feeding plan record.
     *
     * Laravel resolves $feedingPlan from the URL automatically via route-model
     * binding — no manual database query is needed.
     */
    public function show(FeedingPlan $feedingPlan): JsonResponse
    {
        // Per-record policy check before returning this PHI feeding plan.
        $this->authorize('view', $feedingPlan);

        $feedingPlan->load('camper');

        return response()->json([
            'data' => $feedingPlan,
        ]);
    }

    /**
     * Update an existing feeding plan.
     *
     * Only fields whitelisted by UpdateFeedingPlanRequest are applied.
     * Feeding plans may need frequent updates as a camper's medical needs change
     * during a session, making this the most commonly used action.
     */
    public function update(UpdateFeedingPlanRequest $request, FeedingPlan $feedingPlan): JsonResponse
    {
        // Confirm the caller is permitted to edit this feeding plan.
        $this->authorize('update', $feedingPlan);

        $feedingPlan->update($request->validated());

        return response()->json([
            'message' => 'Feeding plan updated successfully.',
            'data' => $feedingPlan,
        ]);
    }

    /**
     * Permanently delete a feeding plan record.
     *
     * Removing a feeding plan could put a camper at risk if staff no longer
     * know about specialized dietary requirements, so FeedingPlanPolicy
     * restricts deletion to administrators only.
     */
    public function destroy(FeedingPlan $feedingPlan): JsonResponse
    {
        // Hard gate before permanently removing this safety-critical PHI record.
        $this->authorize('delete', $feedingPlan);

        $feedingPlan->delete();

        return response()->json([
            'message' => 'Feeding plan deleted successfully.',
        ]);
    }
}
