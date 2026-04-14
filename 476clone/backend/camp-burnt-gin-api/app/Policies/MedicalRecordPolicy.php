<?php

namespace App\Policies;

use App\Models\MedicalRecord;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * MedicalRecordPolicy — Authorization rules for MedicalRecord resources.
 *
 * Medical records contain Protected Health Information (PHI) covered by HIPAA.
 * Access is tightly restricted and all access is automatically logged by
 * the AuditPhiAccess middleware for compliance purposes.
 *
 * Access summary:
 *  - Admins        → full access (view, create, update, delete)
 *  - Medical staff → view and update (needed for active patient care)
 *  - Applicants    → view and update only for their own child's record
 *
 * Deletion is admin-only to preserve the medical audit trail.
 */
class MedicalRecordPolicy
{
    // This trait adds helper methods like allow() and deny() used by Laravel internals.
    use HandlesAuthorization;

    /**
     * Can the user browse the full list of medical records?
     *
     * Admins and medical providers need the full list for their dashboards.
     * Parents access their child's record directly — not through a list.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a specific medical record?
     *
     * Three groups are allowed — we check each in order.
     */
    public function view(User $user, MedicalRecord $medicalRecord): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may access medical records only for active (approved) campers.
            // Records for unapproved or rejected applicants are off-limits.
            return $user->canAccessCamperAsMedical($medicalRecord->camper);
        }

        // A parent may view the medical record only for their own child.
        if ($user->isApplicant() && $user->ownsCamper($medicalRecord->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user create a new medical record?
     *
     * Only admins may create medical records. Records are created automatically
     * by ApplicationService::reviewApplication() at the moment of application
     * approval — never during application submission.
     * Medical staff and applicants do not create records directly.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user update a medical record?
     *
     * Admins may update any record. Medical staff update records during
     * active care (e.g., adding a note after treating a camper).
     * Parents can update their own child's record to keep information current.
     */
    public function update(User $user, MedicalRecord $medicalRecord): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may update medical records only for active (approved) campers.
            return $user->canAccessCamperAsMedical($medicalRecord->camper);
        }

        // Parent can update only their own child's medical record.
        if ($user->isApplicant() && $user->ownsCamper($medicalRecord->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user delete a medical record?
     *
     * Only admins can delete medical records. Medical data should generally be
     * retained for regulatory compliance — deletion is a last resort.
     * Medical staff and parents cannot remove records to protect the audit trail.
     */
    public function delete(User $user, MedicalRecord $medicalRecord): bool
    {
        return $user->isAdmin();
    }
}
