<?php

namespace App\Observers;

use App\Models\Camper;

/**
 * CamperObserver — listens for Eloquent model events on the Camper model.
 *
 * Registration: Camper::observe(CamperObserver::class) in AppServiceProvider.
 *
 * Medical record creation is intentionally NOT done here.
 * Campers are created at application submission time (pre-approval), so auto-
 * provisioning a medical record here would create records before admin acceptance —
 * violating the required workflow.
 *
 * Medical records are created exclusively in ApplicationService::reviewApplication()
 * at the moment an admin approves the application.
 */
class CamperObserver
{
    // Future camper lifecycle hooks go here.
}
