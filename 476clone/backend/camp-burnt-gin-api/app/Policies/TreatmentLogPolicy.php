<?php

namespace App\Policies;

use App\Models\TreatmentLog;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * TreatmentLogPolicy — Authorization rules for TreatmentLog records.
 *
 * A TreatmentLog records a specific clinical action taken by camp medical
 * staff on a camper — for example, dispensing medication, treating a cut,
 * or applying sunscreen. These are on-site staff records, not parent records.
 *
 * Access summary:
 *  - Admins        → full access (view, create, update, delete)
 *  - Medical staff → view and create; update only their own entries
 *  - Applicants    → no access (parents do not see on-site treatment logs)
 *
 * Medical staff can only edit logs they personally authored (recorded_by
 * must match their user ID). Only admins can delete logs to protect the
 * clinical audit trail.
 */
class TreatmentLogPolicy
{
    // This trait adds helper methods like allow() and deny() used by Laravel internals.
    use HandlesAuthorization;

    /**
     * Can the user browse the list of treatment logs?
     *
     * Admins and medical staff both need the full list — admins for oversight
     * and medical staff for their clinical dashboard.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a specific treatment log entry?
     *
     * All medical staff and admins may view any treatment log.
     * Parents are excluded — treatment logs are internal clinical records.
     */
    public function view(User $user, TreatmentLog $treatmentLog): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user create a new treatment log entry?
     *
     * Only camp medical staff and admins may log treatments.
     * Parents cannot create treatment log entries.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user update a treatment log entry?
     *
     * Admins may update any entry. Medical staff may only update log entries
     * that they personally created (recorded_by === their own user ID).
     * This prevents one nurse from overwriting another nurse's records.
     */
    public function update(User $user, TreatmentLog $treatmentLog): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // Medical provider can only edit entries they personally recorded.
        return $user->isMedicalProvider() && $treatmentLog->recorded_by === $user->id;
    }

    /**
     * Can the user delete a treatment log entry?
     *
     * Only admins can delete treatment logs. Preventing medical staff from
     * deleting entries ensures the clinical record remains complete and
     * tamper-resistant for audit and liability purposes.
     */
    public function delete(User $user, TreatmentLog $treatmentLog): bool
    {
        return $user->isAdmin();
    }
}
