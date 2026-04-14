<?php

namespace App\Policies;

use App\Models\FormSection;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * FormSectionPolicy — authorization rules for form sections.
 *
 * Mutations (create, update, delete, reorder) require super_admin AND the
 * parent form_definition must be in 'draft' state (isEditable() = true).
 * This prevents changes to the live active form or archived historical forms.
 */
class FormSectionPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, FormSection $section): bool
    {
        return $user->isAdmin();
    }

    public function create(User $user, FormSection $section): bool
    {
        return $user->isAdmin() && $section->formDefinition->isEditable();
    }

    public function update(User $user, FormSection $section): bool
    {
        return $user->isAdmin() && $section->formDefinition->isEditable();
    }

    public function delete(User $user, FormSection $section): bool
    {
        return $user->isAdmin() && $section->formDefinition->isEditable();
    }
}
