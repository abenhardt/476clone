<?php

namespace App\Observers;

use App\Models\Diagnosis;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Support\Facades\Log;

/**
 * DiagnosisObserver — triggers automatic risk re-assessment when a camper's diagnoses change.
 *
 * A camper's diagnosis list is one of the primary inputs to the risk assessment score.
 * The severity of each diagnosis (mild, moderate, severe) directly contributes to the
 * overall medical complexity rating that determines staffing requirements.
 *
 * This observer fires on both save (new diagnosis or edit) and delete (diagnosis removed),
 * because removing a severe diagnosis may lower the risk score just as adding one raises it.
 *
 * Registered in AppServiceProvider with Diagnosis::observe(DiagnosisObserver::class).
 */
class DiagnosisObserver
{
    /**
     * Trigger a risk re-assessment when a diagnosis is created or updated.
     *
     * "saved" fires for both INSERT and UPDATE, so this covers both adding a new diagnosis
     * and editing an existing one (e.g., upgrading severity from "mild" to "severe").
     */
    public function saved(Diagnosis $diagnosis): void
    {
        // Navigate from the diagnosis to its camper to pass to the assessment service
        $camper = $diagnosis->camper;

        if ($camper) {
            try {
                app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
            } catch (\Throwable $e) {
                Log::error('DiagnosisObserver: failed to re-assess risk after diagnosis saved', [
                    'diagnosis_id' => $diagnosis->id,
                    'camper_id' => $camper->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Trigger a risk re-assessment when a diagnosis is removed.
     *
     * Removing a diagnosis (especially a severe one) may reduce the camper's risk score
     * and potentially lower their supervision requirements — so the score must be recalculated.
     *
     * Note: the camper relationship is still accessible during the "deleted" event because
     * the model has not yet been fully garbage-collected.
     */
    public function deleted(Diagnosis $diagnosis): void
    {
        $camper = $diagnosis->camper;

        if ($camper) {
            try {
                app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
            } catch (\Throwable $e) {
                Log::error('DiagnosisObserver: failed to re-assess risk after diagnosis deleted', [
                    'diagnosis_id' => $diagnosis->id,
                    'camper_id' => $camper->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
