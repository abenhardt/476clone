<?php

namespace App\Policies;

use App\Models\CampSession;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * CampSessionPolicy — controls who can manage individual camp sessions.
 *
 * A camp session is a specific dated instance of camp (e.g., "Summer Session A, June 2026").
 * Parents and medical staff need to read session information to understand schedules,
 * but only administrators can add, edit, or remove sessions.
 */
class CampSessionPolicy
{
    use HandlesAuthorization;

    /**
     * Can the user see a list of all camp sessions?
     *
     * All authenticated users can view the list of camp sessions.
     * Non-admins will have the list filtered to show only active sessions.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Can the user view the details of a single camp session?
     *
     * All authenticated users can view camp session details.
     */
    public function view(User $user, CampSession $session): bool
    {
        return true;
    }

    /**
     * Can the user create a new camp session?
     *
     * Only administrators can create new camp sessions.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user edit an existing camp session?
     *
     * Only administrators can update camp sessions.
     */
    public function update(User $user, CampSession $session): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user delete a camp session?
     *
     * Only administrators can delete camp sessions.
     */
    public function delete(User $user, CampSession $session): bool
    {
        return $user->isAdmin();
    }
}
