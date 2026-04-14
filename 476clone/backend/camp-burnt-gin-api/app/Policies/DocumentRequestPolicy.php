<?php

namespace App\Policies;

use App\Models\DocumentRequest;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class DocumentRequestPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->hasRole('applicant');
    }

    public function view(User $user, DocumentRequest $documentRequest): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->hasRole('applicant')) {
            return $documentRequest->applicant_id === $user->id;
        }

        return false;
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, DocumentRequest $documentRequest): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, DocumentRequest $documentRequest): bool
    {
        return $user->isAdmin();
    }

    public function approve(User $user, DocumentRequest $documentRequest): bool
    {
        return $user->isAdmin();
    }

    public function reject(User $user, DocumentRequest $documentRequest): bool
    {
        return $user->isAdmin();
    }

    public function upload(User $user, DocumentRequest $documentRequest): bool
    {
        if (! $user->hasRole('applicant')) {
            return false;
        }

        return $documentRequest->applicant_id === $user->id;
    }

    public function download(User $user, DocumentRequest $documentRequest): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->hasRole('applicant')) {
            return $documentRequest->applicant_id === $user->id;
        }

        return false;
    }
}
