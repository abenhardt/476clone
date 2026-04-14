<?php

namespace App\Policies;

use App\Models\EmergencyContact;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * EmergencyContactPolicy — controls who can view and manage emergency contact records.
 *
 * Emergency contacts are the people to call when something serious happens to a camper
 * (e.g., a parent, grandparent, or family friend). Medical staff need read access for
 * emergency response, but only admins and the camper's own parent can create, edit,
 * or delete these contacts.
 */
class EmergencyContactPolicy
{
    use HandlesAuthorization;

    /**
     * Can the user see a list of emergency contacts?
     *
     * Administrators and medical providers can view the list.
     * Parents access their own contacts through scoped queries.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a specific emergency contact record?
     *
     * Administrators have full access.
     * Medical providers can only view for campers they have valid provider links for.
     * Parents can only view contacts for their own children.
     */
    public function view(User $user, EmergencyContact $emergencyContact): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may access emergency contacts only for active (approved) campers.
            return $user->canAccessCamperAsMedical($emergencyContact->camper);
        }

        if ($user->isApplicant() && $user->ownsCamper($emergencyContact->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user add a new emergency contact?
     *
     * Administrators and parents can create emergency contacts.
     * Medical providers cannot create contacts.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant();
    }

    /**
     * Can the user edit an emergency contact?
     *
     * Administrators have full access.
     * Parents can update contacts for their own children.
     * Medical providers cannot modify contact information.
     */
    public function update(User $user, EmergencyContact $emergencyContact): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($emergencyContact->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user delete an emergency contact?
     *
     * Administrators have full access.
     * Parents can delete contacts for their own children.
     * Medical providers cannot delete contacts.
     */
    public function delete(User $user, EmergencyContact $emergencyContact): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($emergencyContact->camper)) {
            return true;
        }

        return false;
    }
}
