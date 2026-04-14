<?php

namespace App\Policies;

use App\Models\MedicalRestriction;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * MedicalRestrictionPolicy — controls who can manage a camper's medical restrictions.
 *
 * Medical restrictions are formal constraints placed on a camper's activities or diet
 * based on their health needs (e.g., "no swimming due to ear condition"). Because these
 * restrictions directly affect safety, only administrators and trained medical staff
 * are permitted to create, view, edit, or remove them.
 */
class MedicalRestrictionPolicy
{
    use HandlesAuthorization;

    /**
     * Can the user see a list of all medical restrictions?
     * Only admins and medical staff can browse the full list.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a single medical restriction record?
     * Only admins and medical staff can view individual restriction records.
     *
     * Medical staff are additionally restricted to active (enrolled) campers only.
     * Accessing records for inactive/unenrolled campers is blocked to prevent PHI
     * exposure for applicants who have not been accepted to camp.
     */
    public function view(User $user, MedicalRestriction $medicalRestriction): bool
    {
        // Only allow access to records for active (enrolled) campers.
        if (! $medicalRestriction->camper?->is_active) {
            return false;
        }

        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user create a new medical restriction?
     * Only admins and medical staff can add restrictions — parents cannot.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user edit an existing medical restriction?
     * Only admins and medical staff can update restrictions.
     */
    public function update(User $user, MedicalRestriction $medicalRestriction): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user delete a medical restriction?
     *
     * Restricted to admins only — consistent with all other Phase 11 medical
     * record policies (MedicalIncidentPolicy, MedicalFollowUpPolicy,
     * MedicalVisitPolicy) which all require isAdmin() for delete.
     *
     * Rationale: medical restrictions affect camper safety and represent
     * clinical decisions; permanent deletion should require admin oversight
     * to preserve the audit trail and prevent accidental data loss.
     */
    public function delete(User $user, MedicalRestriction $medicalRestriction): bool
    {
        return $user->isAdmin();
    }
}
