<?php

namespace App\Policies;

use App\Models\BehavioralProfile;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * BehavioralProfilePolicy — controls who can access a camper's behavioral profile.
 *
 * Behavioral profiles contain sensitive information about a camper's developmental
 * needs, behavioral patterns, and support strategies. This data is treated with
 * extra privacy care — medical staff can view and update it, but cannot delete it,
 * preserving the audit trail for safeguarding and compliance purposes.
 */
class BehavioralProfilePolicy
{
    use HandlesAuthorization;

    /**
     * Can the user see a list of all behavioral profiles?
     * Only admins and medical staff can browse the full list.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a single behavioral profile?
     * Admins and medical staff can see any. Parents can only see their own camper's profile.
     */
    public function view(User $user, BehavioralProfile $behavioralProfile): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may access behavioral profiles only for active (approved) campers.
            return $user->canAccessCamperAsMedical($behavioralProfile->camper);
        }

        if ($user->isApplicant() && $user->ownsCamper($behavioralProfile->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user create a new behavioral profile?
     * Admins, medical staff, and parents (for their own campers) may all create them.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isApplicant();
    }

    /**
     * Can the user edit a behavioral profile?
     * Admins and medical staff can update any profile. Parents can only update their camper's.
     */
    public function update(User $user, BehavioralProfile $behavioralProfile): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may update behavioral profiles only for active (approved) campers.
            return $user->canAccessCamperAsMedical($behavioralProfile->camper);
        }

        if ($user->isApplicant() && $user->ownsCamper($behavioralProfile->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user delete a behavioral profile?
     *
     * Only administrators and parents can delete behavioral profiles.
     * Medical providers cannot delete to maintain audit trail integrity.
     */
    public function delete(User $user, BehavioralProfile $behavioralProfile): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($behavioralProfile->camper)) {
            return true;
        }

        return false;
    }
}
