<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\User;

/**
 * DocumentPolicy — Authorization rules for uploaded Document records.
 *
 * Documents are files uploaded and attached to other models (e.g., a Camper
 * profile or a MedicalRecord). Access depends on who uploaded the file and
 * what model it is attached to ("documentable").
 *
 * Access summary:
 *  - Admins        → full access to all documents
 *  - Applicants    → access to documents they uploaded, or attached to their child
 *  - Medical staff → view and upload documents on ACTIVE campers/medical-records only
 *
 * Only admins may verify or reject uploaded documents (the update action).
 * Implements FR-34: Document access control.
 */
class DocumentPolicy
{
    /**
     * Can the user browse the full document list?
     *
     * Only admins see every document. Other users query documents
     * through the model they are attached to (e.g., camper documents).
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user view a specific document?
     *
     * Access is granted by several independent checks — we return true
     * as soon as any one of them passes.
     */
    public function view(User $user, Document $document): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // The person who uploaded the document can always view it.
        if ($document->uploaded_by === $user->id) {
            return true;
        }

        // Medical providers can view documents only for ACTIVE (enrolled) campers and their
        // medical records. Scoping to active campers prevents PHI enumeration for applicants
        // who were rejected, withdrawn, or not yet approved. The documentable relationship
        // is loaded here to check is_active — one query per authorization call is acceptable.
        if ($user->isMedicalProvider()) {
            if ($document->documentable_type === 'App\\Models\\Camper') {
                return $document->documentable?->is_active === true;
            }
            if ($document->documentable_type === 'App\\Models\\MedicalRecord') {
                return $document->documentable?->is_active === true;
            }
        }

        // If the document is attached to a Camper, the parent who owns that
        // camper can view it. campers() scopes the query to this user's children.
        if ($document->documentable_type === 'App\\Models\\Camper') {
            return $user->campers()->where('id', $document->documentable_id)->exists();
        }

        return false;
    }

    /**
     * Can the user upload a new document?
     *
     * Admins, parents, and medical providers may upload documents.
     * The specific model they are allowed to attach the document to
     * is further validated inside StoreDocumentRequest.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant() || $user->isMedicalProvider();
    }

    /**
     * Can the user update (verify or reject) a document?
     *
     * Verification is an administrative action — only admins may approve
     * or reject documents that parents and medical providers have uploaded.
     */
    public function update(User $user, Document $document): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user delete a document?
     *
     * Admins can delete any document. The person who originally uploaded
     * a document may also remove it (they "own" what they submitted).
     */
    public function delete(User $user, Document $document): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // The uploader may delete their own document.
        return $document->uploaded_by === $user->id;
    }
}
