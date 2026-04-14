<?php

namespace App\Observers;

use App\Models\MedicalRecord;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Support\Facades\Log;

/**
 * MedicalRecordObserver — triggers automatic risk re-assessment when a camper's medical record changes.
 *
 * The SpecialNeedsRiskAssessmentService calculates a holistic risk score for each camper based
 * on their medical profile. This observer ensures the score stays up-to-date whenever the
 * underlying data changes — without requiring manual calls scattered throughout the codebase.
 *
 * Why MedicalRecord changes matter for risk:
 *   The medical record stores core clinical flags like seizure history, which is one of the
 *   most significant factors for determining supervision requirements at camp.
 *
 * Registered in AppServiceProvider with MedicalRecord::observe(MedicalRecordObserver::class).
 */
class MedicalRecordObserver
{
    /**
     * Trigger a risk re-assessment after the medical record is created or updated.
     *
     * Laravel fires the "saved" event for both "created" and "updated" operations,
     * so this single hook covers all write scenarios without duplication.
     *
     * The guard ($camper check) prevents errors in edge cases where the medical record
     * exists in the database but the associated camper has been deleted.
     */
    public function saved(MedicalRecord $medicalRecord): void
    {
        // Load the associated camper to pass to the risk assessment service
        $camper = $medicalRecord->camper;

        if ($camper) {
            try {
                app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
            } catch (\Throwable $e) {
                Log::error('MedicalRecordObserver: failed to re-assess risk after medical record saved', [
                    'medical_record_id' => $medicalRecord->id,
                    'camper_id' => $camper->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
