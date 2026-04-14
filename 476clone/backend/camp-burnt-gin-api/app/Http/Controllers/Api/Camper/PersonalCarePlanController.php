<?php

namespace App\Http\Controllers\Api\Camper;

use App\Http\Controllers\Controller;
use App\Http\Requests\PersonalCarePlan\StorePersonalCarePlanRequest;
use App\Models\Camper;
use App\Models\PersonalCarePlan;
use Illuminate\Http\JsonResponse;

/**
 * PersonalCarePlanController — upsert a camper's ADL care plan.
 *
 * A camper has exactly one personal care plan (UNIQUE KEY on camper_id).
 * This endpoint is idempotent: re-submitting updates the existing record.
 *
 * Called from the application form submission (Step after feeding plan)
 * when Section 6 (Personal Care) data is present.
 */
class PersonalCarePlanController extends Controller
{
    /**
     * Retrieve the personal care plan for a camper.
     *
     * Returns null (204) if no plan exists yet.
     */
    public function show(Camper $camper): JsonResponse
    {
        $this->authorize('view', $camper);

        $plan = PersonalCarePlan::where('camper_id', $camper->id)->first();

        if (! $plan) {
            return response()->json(['data' => null], 200);
        }

        return response()->json(['data' => $plan]);
    }

    /**
     * Create or update the personal care plan for a camper.
     *
     * Authorization: the requesting user must own the camper (CamperPolicy::update).
     * This prevents one parent from overwriting another camper's care plan.
     */
    public function store(StorePersonalCarePlanRequest $request, Camper $camper): JsonResponse
    {
        $this->authorize('update', $camper);

        $plan = PersonalCarePlan::updateOrCreate(
            ['camper_id' => $camper->id],
            $request->validated()
        );

        return response()->json(['data' => $plan], $plan->wasRecentlyCreated ? 201 : 200);
    }
}
