<?php

namespace App\Policies;

use App\Enums\ApplicantDocumentStatus;
use App\Models\ApplicantDocument;
use App\Models\User;

/**
 * ApplicantDocumentPolicy — Authorization rules for ApplicantDocument records.
 *
 * Access summary:
 *  - Admins/super admins → full access to all records
 *  - Applicants          → can only view and submit their own documents
 */
class ApplicantDocumentPolicy
{
    /**
     * Can the user browse the document list?
     *
     * Admins see the full list across all applicants.
     * Applicants may list their own documents (query is scoped in the controller).
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->role?->name === 'applicant';
    }

    /**
     * Can the user view a specific document?
     *
     * Admins see any; applicants see only their own.
     */
    public function view(User $user, ApplicantDocument $applicantDocument): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $user->id === $applicantDocument->applicant_id;
    }

    /**
     * Can the user create a new applicant document record?
     *
     * Only admins and super admins may send documents to applicants.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the applicant submit their completed document?
     *
     * The assigned applicant only, and only when the document is still pending.
     */
    public function submit(User $user, ApplicantDocument $applicantDocument): bool
    {
        return $user->id === $applicantDocument->applicant_id
            && $applicantDocument->status === ApplicantDocumentStatus::Pending;
    }

    /**
     * Can the user update the document record?
     *
     * Only admins and super admins may update (mark reviewed, replace file, etc.).
     */
    public function update(User $user, ApplicantDocument $applicantDocument): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user delete the document record?
     *
     * Only admins and super admins may delete records.
     */
    public function delete(User $user, ApplicantDocument $applicantDocument): bool
    {
        return $user->isAdmin();
    }
}
