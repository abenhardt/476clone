<?php

namespace App\Policies;

use App\Models\Camp;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * CampPolicy — controls who can manage camp records.
 *
 * A "camp" is the top-level entity representing Camp Burnt Gin itself or any
 * other camp in the system. Reading camp information is open to all logged-in users,
 * but creating, editing, or removing camp records is restricted to administrators only.
 */
class CampPolicy
{
    use HandlesAuthorization;

    /**
     * Can the user see a list of all camps?
     *
     * All authenticated users can view the list of camps.
     * Non-admins will have the list filtered to show only active camps.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Can the user view the details of a single camp?
     *
     * All authenticated users can view camp details.
     */
    public function view(User $user, Camp $camp): bool
    {
        return true;
    }

    /**
     * Can the user create a new camp?
     *
     * Only administrators can create new camps.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user edit an existing camp?
     *
     * Only administrators can update camps.
     */
    public function update(User $user, Camp $camp): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user delete a camp?
     *
     * Only administrators can delete camps.
     */
    public function delete(User $user, Camp $camp): bool
    {
        return $user->isAdmin();
    }
}
