<?php

namespace App\Policies;

use App\Models\ApplicationDraft;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * ApplicationDraftPolicy — owns-only access control for draft save slots.
 *
 * Drafts belong to the user who created them.  Admins have no reason to
 * access parent drafts (they are raw unsanitised form state, not records).
 * There is no shared-access scenario for drafts.
 */
class ApplicationDraftPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->hasRole('applicant');
    }

    public function view(User $user, ApplicationDraft $draft): bool
    {
        return $draft->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->hasRole('applicant');
    }

    public function update(User $user, ApplicationDraft $draft): bool
    {
        return $draft->user_id === $user->id;
    }

    public function delete(User $user, ApplicationDraft $draft): bool
    {
        return $draft->user_id === $user->id;
    }
}
