<?php

namespace App\Policies;

use App\Models\ActivityPermission;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * ActivityPermissionPolicy — controls who can read and change a camper's activity permissions.
 *
 * Activity permissions record which camp activities a camper is allowed to join,
 * sometimes with restrictions based on their health. This policy makes sure only
 * the right people (admins, medical staff, or the camper's own parent) can see
 * or change those permissions.
 */
class ActivityPermissionPolicy
{
    use HandlesAuthorization;

    /**
     * Can the user see a list of all activity permissions?
     * Only admins and medical staff can browse the full list.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user see a single activity permission record?
     * Admins and medical staff can see any. Parents can only see their own camper's records.
     */
    public function view(User $user, ActivityPermission $activityPermission): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff have direct access to all camper activity permissions.
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($activityPermission->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user create a new activity permission?
     * Admins, medical staff, and parents (for their own campers) may all create them.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isApplicant();
    }

    /**
     * Can the user edit an existing activity permission?
     * Admins and medical staff can update any record. Parents can only update their camper's.
     */
    public function update(User $user, ActivityPermission $activityPermission): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may update activity permissions during active care.
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($activityPermission->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user delete an activity permission?
     * Medical staff cannot delete — only admins and the camper's parent can.
     */
    public function delete(User $user, ActivityPermission $activityPermission): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($activityPermission->camper)) {
            return true;
        }

        return false;
    }
}
