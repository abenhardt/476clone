<?php

namespace App\Policies;

use App\Models\AssistiveDevice;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * AssistiveDevicePolicy — controls who can manage a camper's assistive device records.
 *
 * Assistive devices (like wheelchairs, hearing aids, or communication boards) are part
 * of a camper's medical and accessibility profile. This policy ensures only authorized
 * users — admins, medical staff, or the camper's parent — can view or change these records.
 */
class AssistiveDevicePolicy
{
    use HandlesAuthorization;

    /**
     * Can the user see a list of all assistive device records?
     * Only admins and medical staff can browse the full list.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user see a single assistive device record?
     * Admins and medical staff can see any. Parents can only see their own camper's records.
     */
    public function view(User $user, AssistiveDevice $assistiveDevice): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may access assistive device records only for active (approved) campers.
            return $user->canAccessCamperAsMedical($assistiveDevice->camper);
        }

        if ($user->isApplicant() && $user->ownsCamper($assistiveDevice->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user add a new assistive device record?
     * Admins, medical staff, and parents (for their own campers) may all create them.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isApplicant();
    }

    /**
     * Can the user edit an existing assistive device record?
     * Admins and medical staff can update any record. Parents can only update their camper's.
     */
    public function update(User $user, AssistiveDevice $assistiveDevice): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may update assistive device records only for active (approved) campers.
            return $user->canAccessCamperAsMedical($assistiveDevice->camper);
        }

        if ($user->isApplicant() && $user->ownsCamper($assistiveDevice->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user delete an assistive device record?
     * Medical staff cannot delete — only admins and the camper's parent can.
     */
    public function delete(User $user, AssistiveDevice $assistiveDevice): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($assistiveDevice->camper)) {
            return true;
        }

        return false;
    }
}
