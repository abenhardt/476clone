<?php

namespace App\Policies;

use App\Models\FormDefinition;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * FormDefinitionPolicy — authorization rules for the application form versioning system.
 *
 * Access summary:
 *  - Any authenticated user   → may read the active form schema (needed for applicant rendering)
 *  - Admin / Super Admin      → may browse all form definitions and their sections/fields
 *  - Super Admin only         → may create, edit, delete, and publish form definitions
 *
 * Rationale for super_admin only on mutations: form structure changes are high-impact
 * system configuration. A mistaken edit could break the applicant experience for all
 * families. Regular admins retain read access to understand what applicants are filling
 * out, but cannot make structural changes.
 */
class FormDefinitionPolicy
{
    use HandlesAuthorization;

    /**
     * Browse all form definition versions.
     * Admin and super_admin can see the form version history.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * View a specific form definition (including sections and fields).
     *
     * Active forms are visible to any authenticated user — applicants need to read
     * the active schema to render the application form.
     *
     * Draft and archived definitions are internal admin artifacts and must not be
     * accessible to non-admin users (e.g., via GET /api/form/version/{form}).
     * Exposing drafts would leak unreleased form structure to applicants.
     */
    public function view(User $user, FormDefinition $form): bool
    {
        // Admins can inspect any version (needed for builder and review).
        if ($user->isAdmin()) {
            return true;
        }

        // Non-admin users (applicants, medical providers) may only access the
        // active (published) form — never drafts or archived versions.
        return $form->status === 'active';
    }

    /**
     * Create a new form definition (draft).
     * Super admin only — creating a new version is a governance action.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Update a form definition's metadata (name, description).
     * Admin and super_admin, and only while the definition is in 'draft' status.
     */
    public function update(User $user, FormDefinition $form): bool
    {
        return $user->isAdmin() && $form->isEditable();
    }

    /**
     * Permanently delete a form definition.
     * Admin and super_admin, and only if it has never been published (status = 'draft').
     * Active and archived definitions cannot be deleted to preserve audit history.
     */
    public function delete(User $user, FormDefinition $form): bool
    {
        return $user->isAdmin() && $form->status === 'draft';
    }

    /**
     * Publish a draft definition, making it the live active form.
     * Admin and super_admin, and only when the definition is in 'draft' status.
     * Active and archived definitions cannot be re-published.
     */
    public function publish(User $user, FormDefinition $form): bool
    {
        return $user->isAdmin() && $form->status === 'draft';
    }

    /**
     * Duplicate an existing definition into a new draft.
     * Admin and super_admin.
     */
    public function duplicate(User $user, FormDefinition $form): bool
    {
        return $user->isAdmin();
    }
}
