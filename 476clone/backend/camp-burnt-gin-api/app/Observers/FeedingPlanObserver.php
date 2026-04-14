<?php

namespace App\Observers;

use App\Models\FeedingPlan;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Support\Facades\Log;

/**
 * FeedingPlanObserver — triggers automatic risk re-assessment when a camper's feeding plan changes.
 *
 * G-tube (gastrostomy tube) feeding is one of the more medically complex care needs a camper
 * can have — it requires trained staff, specialised equipment, and documented protocols. When
 * a feeding plan is created or updated with G-tube status, the risk score must be recalculated
 * to ensure the camper is assigned appropriately trained staff.
 *
 * Examples of when this matters:
 *   - G-tube feeding is added → significant risk score increase → trained nurse required
 *   - Diet description changes from standard to special diet → moderate risk increase
 *   - G-tube is removed after surgery → major risk score reduction
 *
 * Registered in AppServiceProvider with FeedingPlan::observe(FeedingPlanObserver::class).
 */
class FeedingPlanObserver
{
    /**
     * Trigger a risk re-assessment when the feeding plan is created or updated.
     *
     * "saved" fires for both INSERT (new feeding plan) and UPDATE (plan edited).
     * G-tube status is the most impactful flag — toggling it on or off causes the
     * largest change in the camper's overall risk score.
     */
    public function saved(FeedingPlan $feedingPlan): void
    {
        // Navigate from the feeding plan to its parent camper
        $camper = $feedingPlan->camper;

        if ($camper) {
            try {
                app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
            } catch (\Throwable $e) {
                Log::error('FeedingPlanObserver: failed to re-assess risk after feeding plan saved', [
                    'feeding_plan_id' => $feedingPlan->id,
                    'camper_id' => $camper->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
