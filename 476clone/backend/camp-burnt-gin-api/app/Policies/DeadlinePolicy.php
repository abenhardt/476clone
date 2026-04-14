<?php

namespace App\Policies;

use App\Models\Deadline;
use App\Models\User;

/**
 * DeadlinePolicy — RBAC for the deadline management system.
 *
 * Access model:
 *  - Admins and super_admins have full write access (create, update, delete, extend, complete).
 *  - Applicants can only view deadlines that are marked is_visible_to_applicants = true
 *    and belong to their own sessions/entities. The filtering is done in DeadlineService
 *    and DeadlineController — this policy just gates the model-level access.
 *  - Medical and other roles: read-only access to their relevant deadlines (via index only).
 */
class DeadlinePolicy
{
    /**
     * Admins see all deadlines. Applicants see only visible ones (filtered in controller).
     */
    public function viewAny(User $user): bool
    {
        return true; // All authenticated users can list; content filtered per role
    }

    /**
     * Admins see any deadline. Applicants only see visible ones that belong to their entities.
     * Fine-grained applicant filtering is done in the controller, not here.
     */
    public function view(User $user, Deadline $deadline): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $deadline->is_visible_to_applicants;
    }

    /** Only admins and super admins may create deadlines. */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /** Only admins and super admins may update deadlines. */
    public function update(User $user, Deadline $deadline): bool
    {
        return $user->isAdmin();
    }

    /** Only admins and super admins may delete (soft-delete) deadlines. */
    public function delete(User $user, Deadline $deadline): bool
    {
        return $user->isAdmin();
    }

    /** Only admins may extend a deadline. */
    public function extend(User $user, Deadline $deadline): bool
    {
        return $user->isAdmin();
    }

    /** Only admins may manually complete a deadline (override enforcement). */
    public function complete(User $user, Deadline $deadline): bool
    {
        return $user->isAdmin();
    }
}
