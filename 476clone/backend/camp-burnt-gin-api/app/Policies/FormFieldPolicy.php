<?php

namespace App\Policies;

use App\Models\FormField;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * FormFieldPolicy — authorization rules for form fields and their options.
 *
 * Same pattern as FormSectionPolicy: mutations require super_admin AND the
 * grandparent form_definition must be in 'draft' state. The policy walks up
 * the relationship chain: FormField → FormSection → FormDefinition.
 */
class FormFieldPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, FormField $field): bool
    {
        return $user->isAdmin();
    }

    public function create(User $user, FormField $field): bool
    {
        return $user->isAdmin() && $field->formSection->formDefinition->isEditable();
    }

    public function update(User $user, FormField $field): bool
    {
        return $user->isAdmin() && $field->formSection->formDefinition->isEditable();
    }

    public function delete(User $user, FormField $field): bool
    {
        return $user->isAdmin() && $field->formSection->formDefinition->isEditable();
    }
}
