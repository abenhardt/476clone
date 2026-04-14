<?php

namespace App\Policies;

use App\Models\Medication;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * MedicationPolicy — Authorization rules for Medication records.
 *
 * Medication records track what drugs a camper takes, their dosage, and
 * schedule. This is critical clinical data that medical staff must be
 * able to read and update, while parents retain final authority over
 * what is permanently removed from the record.
 *
 * Access summary:
 *  - Admins        → full access (view, create, update, delete)
 *  - Medical staff → view, create, and update (but NOT delete — see delete() below)
 *  - Applicants    → access only to their own child's medication records
 *
 * The intentional asymmetry for medical staff (can create/update but not delete)
 * preserves the audit trail and is documented in the delete() method below.
 */
class MedicationPolicy
{
    // This trait adds helper methods like allow() and deny() used by Laravel internals.
    use HandlesAuthorization;

    /**
     * Can the user browse the full medication list?
     *
     * Admins and medical staff see the full list for safety and reporting.
     * Parents use scoped queries limited to their own child.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a specific medication record?
     *
     * Three groups are allowed — we check each in order.
     */
    public function view(User $user, Medication $medication): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may access medication records only for active (approved) campers.
            return $user->canAccessCamperAsMedical($medication->camper);
        }

        // A parent may view medication records only for their own child.
        if ($user->isApplicant() && $user->ownsCamper($medication->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user add a new medication record?
     *
     * All three user types may create medication records:
     *  - Admins for data entry / administrative corrections
     *  - Medical staff who prescribe or document medications during care
     *  - Parents who list their child's existing medications during registration
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isApplicant();
    }

    /**
     * Can the user update a medication record?
     *
     * Admins and medical staff may update any record — for example, a nurse
     * may adjust dosage after consulting with a doctor.
     * Parents may update their own child's medication information.
     */
    public function update(User $user, Medication $medication): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may update medication records only for active (approved) campers.
            return $user->canAccessCamperAsMedical($medication->camper);
        }

        // Parent can update only their own child's medication record.
        if ($user->isApplicant() && $user->ownsCamper($medication->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user delete a medication record?
     *
     * AUTHORIZATION DESIGN NOTE:
     * Medical providers can create and update medications but cannot delete them.
     * This intentional design ensures that:
     * - Providers can document medications discovered during care
     * - Providers can update dosage or frequency as medically appropriate
     * - Providers cannot remove medication records from the system
     * - All provider modifications are audited via PHI audit middleware
     * - Parents retain final authority over their child's medical record
     *
     * This follows HIPAA best practices for medical record integrity
     * and audit trail completeness.
     *
     * Administrators have full access.
     * Parents can delete medications for their own children.
     * Medical providers cannot delete medication records.
     */
    public function delete(User $user, Medication $medication): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // Parent can delete only their own child's medication record.
        // Medical providers are intentionally excluded — see the docblock above.
        if ($user->isApplicant() && $user->ownsCamper($medication->camper)) {
            return true;
        }

        return false;
    }
}
