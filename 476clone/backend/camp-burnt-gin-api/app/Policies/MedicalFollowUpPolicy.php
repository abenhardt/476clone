<?php

namespace App\Policies;

use App\Models\MedicalFollowUp;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * MedicalFollowUpPolicy — Authorization rules for MedicalFollowUp records.
 *
 * A MedicalFollowUp is a task or reminder attached to a medical incident or
 * visit — for example, "check camper's temperature again in 2 hours" or
 * "call parents if fever persists". These are internal clinical coordination
 * records managed by medical staff and administrators.
 *
 * Access summary:
 *  - Admins        → full access (view, create, update, delete)
 *  - Medical staff → view, create, and update (collaborative — any provider can edit)
 *  - Applicants    → no access (follow-up tasks are internal staff records)
 *
 * Unlike incidents, follow-ups are collaborative — any medical provider can
 * update any follow-up (not just the one who created it). Only admins can
 * delete them to preserve the audit trail.
 */
class MedicalFollowUpPolicy
{
    // This trait adds helper methods like allow() and deny() used by Laravel internals.
    use HandlesAuthorization;

    /**
     * Can the user browse the full list of follow-up tasks?
     *
     * Admins and medical staff both need the full follow-up list to manage
     * their clinical workload and prioritise outstanding tasks.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a specific follow-up record?
     *
     * All medical staff and admins may view any follow-up.
     *
     * Medical staff are additionally restricted to active (enrolled) campers only.
     * Accessing records for inactive/unenrolled campers is blocked to prevent PHI
     * exposure for applicants who have not been accepted to camp.
     */
    public function view(User $user, MedicalFollowUp $medicalFollowUp): bool
    {
        // Only allow access to records for active (enrolled) campers.
        if (! $medicalFollowUp->camper?->is_active) {
            return false;
        }

        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user create a new follow-up task?
     *
     * Admins and any medical staff member may create follow-ups,
     * typically linked to an existing incident or visit.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user update a follow-up task?
     *
     * Unlike incidents (which restrict edits to the original author),
     * follow-ups are collaborative — any medical provider or admin may
     * update them. This allows the whole medical team to work on tasks
     * regardless of who originally created the follow-up.
     */
    public function update(User $user, MedicalFollowUp $medicalFollowUp): bool
    {
        // Any admin or medical provider may update any follow-up task.
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user delete a follow-up task?
     *
     * Only admins can delete follow-ups. Medical staff cannot remove tasks
     * even if they are completed, keeping the clinical history intact.
     */
    public function delete(User $user, MedicalFollowUp $medicalFollowUp): bool
    {
        return $user->isAdmin();
    }
}
