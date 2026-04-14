<?php

namespace App\Observers;

use App\Models\Allergy;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Support\Facades\Log;

/**
 * AllergyObserver — triggers automatic risk re-assessment when a camper's allergies change.
 *
 * Life-threatening allergies contribute +15 points to the risk score, which can push
 * a camper from Standard supervision (score ≤ 20) to Enhanced (score 21–40). Without
 * this observer, the denormalised campers.supervision_level would remain stale after
 * any allergy add, edit, or delete — potentially under-staffing a camper.
 *
 * This observer fires on both save (new allergy or severity edit) and delete
 * (allergy removed), because removing a life-threatening allergy may lower the
 * risk score just as adding one raises it.
 *
 * Registered in AppServiceProvider with Allergy::observe(AllergyObserver::class).
 */
class AllergyObserver
{
    /**
     * Trigger a risk re-assessment when an allergy is created or updated.
     *
     * "saved" fires for both INSERT and UPDATE, so this covers adding a new allergy
     * and changing an existing one (e.g., upgrading severity to "life_threatening").
     */
    public function saved(Allergy $allergy): void
    {
        $camper = $allergy->camper;

        if ($camper) {
            try {
                app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
            } catch (\Throwable $e) {
                Log::error('AllergyObserver: failed to re-assess risk after allergy saved', [
                    'allergy_id' => $allergy->id,
                    'camper_id' => $camper->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Trigger a risk re-assessment when an allergy is removed.
     *
     * Removing a life-threatening allergy may reduce the camper's risk score
     * and lower their required supervision level — so the score must be recalculated.
     */
    public function deleted(Allergy $allergy): void
    {
        $camper = $allergy->camper;

        if ($camper) {
            try {
                app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
            } catch (\Throwable $e) {
                Log::error('AllergyObserver: failed to re-assess risk after allergy deleted', [
                    'allergy_id' => $allergy->id,
                    'camper_id' => $camper->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
