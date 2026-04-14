<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;

/**
 * Policy for role assignment and delegation governance.
 *
 * Implements strict hierarchical controls:
 * - Only super_admin can assign roles
 * - Admin cannot assign super_admin role
 * - Admin cannot modify super_admin users
 * - Admin cannot promote themselves to super_admin
 * - Super_admin has absolute role management authority
 *
 * These rules prevent privilege escalation and ensure system governance.
 */
class RolePolicy
{
    /**
     * Determine if the user can assign a role to another user.
     *
     * Only super administrators can assign roles.
     * Regular admins cannot manage role assignments.
     *
     * @param  User  $user  The user attempting to assign a role
     * @param  User  $targetUser  The user receiving the role assignment
     * @param  Role  $role  The role being assigned
     */
    public function assign(User $user, User $targetUser, Role $role): bool
    {
        // Only super administrators can assign roles
        if (! $user->isSuperAdmin()) {
            return false;
        }

        // Super admin cannot demote themselves (would create lockout risk)
        if ($user->id === $targetUser->id && $role->name !== 'super_admin') {
            // Allow if there are multiple super admins
            $superAdminCount = User::whereHas('role', function ($query) {
                $query->where('name', 'super_admin');
            })->count();

            // If this is the last super admin, prevent self-demotion
            if ($superAdminCount <= 1) {
                return false;
            }
        }

        return true;
    }

    /**
     * Determine if the user can update another user's role.
     *
     * Super admins can update any user's role.
     * Regular admins cannot update roles (they must be super admin).
     * Super admins cannot be demoted by anyone except themselves (if not last).
     */
    public function update(User $user, User $targetUser, Role $newRole): bool
    {
        // Only super admins can modify roles
        if (! $user->isSuperAdmin()) {
            return false;
        }

        // Prevent modification of super_admin role for target user if they are super_admin
        // and the new role is not super_admin (demotion attempt)
        if ($targetUser->isSuperAdmin() && $newRole->name !== 'super_admin') {
            // If the user is demoting themselves, check if they are the last super admin
            if ($user->id === $targetUser->id) {
                $superAdminCount = User::whereHas('role', function ($query) {
                    $query->where('name', 'super_admin');
                })->count();

                // If this is the last super admin, prevent self-demotion
                if ($superAdminCount <= 1) {
                    return false;
                }
            } else {
                // Super admin can demote other super admins (not themselves)
                return true;
            }
        }

        return true;
    }

    /**
     * Determine if the user can view the role.
     *
     * All authenticated users can view roles.
     */
    public function view(User $user, Role $role): bool
    {
        return true;
    }

    /**
     * Determine if the user can view any roles.
     *
     * All authenticated users can view the list of roles.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine if the user can create roles.
     *
     * Only super administrators can create new roles.
     */
    public function create(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    /**
     * Determine if the user can delete roles.
     *
     * Only super administrators can delete roles.
     * Cannot delete roles that are currently assigned to users.
     */
    public function delete(User $user, Role $role): bool
    {
        if (! $user->isSuperAdmin()) {
            return false;
        }

        // Prevent deletion of roles that are in use
        if ($role->users()->exists()) {
            return false;
        }

        return true;
    }
}
