<?php

namespace App\Observers;

use App\Models\AssistiveDevice;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Support\Facades\Log;

/**
 * AssistiveDeviceObserver — triggers automatic risk re-assessment when a camper's assistive devices change.
 *
 * Assistive devices that require transfer assistance (e.g., wheelchair users who need to be
 * physically moved between surfaces) add to medical complexity and care burden.
 * When devices are added, modified, or removed, the camper's risk score needs recalculation.
 *
 * Examples of when this matters:
 *   - A wheelchair is added with transfer assistance required → risk score increases
 *   - A cane is added with no transfer assistance → minimal risk impact
 *   - A device is removed after the camper's mobility improves → risk score may drop
 *
 * Registered in AppServiceProvider with AssistiveDevice::observe(AssistiveDeviceObserver::class).
 */
class AssistiveDeviceObserver
{
    /**
     * Trigger a risk re-assessment when an assistive device is created or updated.
     *
     * "saved" fires for both INSERT (new device) and UPDATE (device info changed,
     * e.g., transfer assistance requirement toggled on or off).
     */
    public function saved(AssistiveDevice $assistiveDevice): void
    {
        // Navigate from the device to its parent camper
        $camper = $assistiveDevice->camper;

        if ($camper) {
            try {
                app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
            } catch (\Throwable $e) {
                Log::error('AssistiveDeviceObserver: failed to re-assess risk after device saved', [
                    'device_id' => $assistiveDevice->id,
                    'camper_id' => $camper->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Trigger a risk re-assessment when an assistive device is removed.
     *
     * If the removed device required transfer assistance, the camper's risk score
     * should decrease. The observer ensures this reduction is captured immediately.
     *
     * Note: the camper relationship is still accessible during the "deleted" event.
     */
    public function deleted(AssistiveDevice $assistiveDevice): void
    {
        $camper = $assistiveDevice->camper;

        if ($camper) {
            try {
                app(SpecialNeedsRiskAssessmentService::class)->assessCamper($camper);
            } catch (\Throwable $e) {
                Log::error('AssistiveDeviceObserver: failed to re-assess risk after device deleted', [
                    'device_id' => $assistiveDevice->id,
                    'camper_id' => $camper->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
